// api/upload-and-preprocess-csv.js
import { formidable } from 'formidable';
import fs from 'fs/promises'; // For reading the temporary file
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { admin, firestore, storage } from './_lib/firebaseAdmin'; // Firebase Admin SDK
import { generateContent } from './_lib/geminiClient'; // Gemini API client

// Vercel specific configuration for serverless functions to handle body parsing for multipart/form-data
export const config = {
  api: {
    bodyParser: false, // Disable Next.js's default body parser to use formidable
  },
};

// --- CSV Processing Helper Functions ---

/**
 * Programmatically preprocesses CSV data.
 * - Cleans column names.
 * - Removes empty columns (all values are empty).
 * - Removes empty rows (all values in relevant fields are empty).
 * - Attempts to convert numerical data (basic placeholder).
 * @param {string} csvString - The raw CSV data as a string.
 * @returns {{ cleanedData: Array<object>, cleanedHeaders: string[], originalHeaders: string[], rowCount: number, columnCount: number }}
 * @throws {Error} if CSV parsing fails.
 */
function preprocessCsvData(csvString) {
  if (!csvString || typeof csvString !== 'string') {
    throw new Error('Invalid CSV string provided for preprocessing.');
  }

  const parseResult = Papa.parse(csvString, {
    header: true, // Use the first row as headers
    skipEmptyLines: 'greedy', // Skip lines that are completely empty or only whitespace
    dynamicTyping: true, // Attempt to convert numbers, booleans
    transformHeader: header => (header || '').toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(), // Clean headers during parsing
  });

  if (parseResult.errors.length > 0) {
    console.error('CSV parsing errors:', parseResult.errors);
    // For now, we'll try to proceed if data is available, but ideally, critical errors should stop processing.
  }
  
  let data = parseResult.data;
  const originalHeaders = parseResult.meta.fields || [];

  const nonEmptyHeaders = originalHeaders.filter(header =>
    data.some(row => row && row[header] !== null && row[header] !== undefined && row[header] !== '')
  );
  
  data = data.map(row => {
    if (!row) return null; // Handle potentially null rows if skipEmptyLines didn't catch everything
    const newRow = {};
    nonEmptyHeaders.forEach(header => {
      newRow[header] = row[header];
    });
    return newRow;
  }).filter(row => row !== null); // Remove any null rows that might have been created

  data = data.filter(row => 
    nonEmptyHeaders.some(header => row[header] !== null && row[header] !== undefined && row[header] !== '')
  );
  
  return {
    cleanedData: data, 
    cleanedHeaders: nonEmptyHeaders,
    originalHeaders: originalHeaders, 
    rowCount: data.length,
    columnCount: nonEmptyHeaders.length,
  };
}


// --- API Endpoint Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const form = formidable({});

  try {
    const [fields, files] = await form.parse(req);

    if (!files.csvFile || files.csvFile.length === 0) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
    }
    const csvFile = files.csvFile[0];
    
    if (!fields.analysisName || fields.analysisName.length === 0 || !fields.analysisName[0].trim()) {
        return res.status(400).json({ success: false, message: 'Analysis name is required and cannot be empty.' });
    }
    const analysisName = fields.analysisName[0].trim();
    const originalFileName = csvFile.originalFilename || 'uploaded_file.csv';

    const analysisId = uuidv4();
    console.log(`Processing new analysis: ${analysisName} (ID: ${analysisId})`);

    const rawCsvStoragePath = `raw_csvs/${analysisId}/${originalFileName}`;
    const rawFileBuffer = await fs.readFile(csvFile.filepath); 

    await storage.bucket().file(rawCsvStoragePath).save(rawFileBuffer, {
      metadata: { contentType: csvFile.mimetype || 'text/csv' },
    });
    console.log(`Raw CSV uploaded to: ${rawCsvStoragePath}`);
    await fs.unlink(csvFile.filepath); 

    console.log('Starting CSV preprocessing...');
    const csvString = rawFileBuffer.toString('utf-8');
    const { cleanedData, cleanedHeaders, rowCount, columnCount } = preprocessCsvData(csvString);
    
    if (rowCount === 0 || columnCount === 0) {
        return res.status(400).json({ success: false, message: 'CSV processing resulted in no usable data. The file might be empty or incorrectly formatted.' });
    }
    console.log(`CSV preprocessed: ${rowCount} rows, ${columnCount} columns.`);

    console.log('Generating dataSummaryForPrompts with Gemini...');
    const sampleDataForPrompt = cleanedData.slice(0, 5).map(row => 
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value).slice(0,100)])) // Truncate long values for prompt
    );

    const dataSummaryPrompt = `
      Przeanalizuj poniższe nagłówki danych CSV oraz niewielką próbkę wierszy, aby dostarczyć strukturalne podsumowanie.
      Nagłówki: ${cleanedHeaders.join(', ')}.
      Próbka (pierwsze 5 wierszy, jeśli dostępne, w przeciwnym razie mniej):
      ${sampleDataForPrompt.map(row => JSON.stringify(row)).join('\n')}
      
      Zwróć obiekt JSON o następującej strukturze:
      {
        "columns": [
          { "name": "nazwa_kolumny_1", "inferredType": "string/numeric/boolean/date/other", "stats": { "mean": 0, "median": 0, "uniqueValues": 0, "missingValues": 0, "min": 0, "max": 0 } },
          // ... inne kolumny
        ],
        "rowCount": ${rowCount},
        "columnCount": ${columnCount},
        "potentialProblems": ["wymień wszelkie zaobserwowane potencjalne problemy z jakością danych, np. wiele brakujących wartości w kolumnie"]
      }
      Dla 'inferredType', użyj jednej z wartości: string, numeric, boolean, date, other.
      Dla 'stats', podaj odpowiednie statystyki w oparciu o 'inferredType'. Na przykład, dla typu numerycznego podaj średnią (mean), medianę (median), min, max. Dla typu string podaj liczbę unikalnych wartości (uniqueValues). Zawsze dołączaj liczbę brakujących wartości (missingValues).
      WAŻNE: Cała odpowiedź musi być prawidłowym obiektem JSON. Wszelkie cudzysłowy (") w wartościach tekstowych (np. w nazwach kolumn, jeśli zawierają spacje i są cytowane, lub w przykładowych danych) MUSZĄ być poprawnie poprzedzone znakiem ucieczki jako \\".
    `;

    let dataSummaryForPrompts;
    try {
      dataSummaryForPrompts = await generateContent(
        'gemini-2.5-flash-preview-05-20',
        dataSummaryPrompt,
        { responseMimeType: 'application/json' } 
      );
    } catch(geminiError) {
        console.error("Gemini error during dataSummaryForPrompts generation:", geminiError);
        return res.status(500).json({ success: false, message: `Failed to generate data summary with AI: ${geminiError.message}` });
    }
    console.log('dataSummaryForPrompts generated.');

    console.log('Generating dataNatureDescription with Gemini...');
    const dataNaturePrompt = `
      Na podstawie następującego podsumowania danych:
      ${JSON.stringify(dataSummaryForPrompts, null, 2)}
      
      Krótko opisz ogólną naturę tego zbioru danych w 1-2 zdaniach. 
      Zasugeruj 1-2 ogólne typy analizy, do których byłby on najbardziej odpowiedni 
      (np. "Wygląda na to, że są to dane o transakcjach sprzedaży, odpowiednie do analizy trendów i segmentacji klientów." 
      lub "Ten zbiór danych opisuje odczyty czujników w czasie, odpowiednie do wykrywania anomalii i analizy predykcyjnego utrzymania ruchu.").
      Opis powinien być zwięzły i informacyjny. Nie używaj formatowania HTML. Odpowiedź powinna być zwykłym tekstem.
    `;
    let dataNatureDescription;
    try {
        dataNatureDescription = await generateContent(
            'gemini-2.5-flash-preview-05-20',
            dataNaturePrompt
            // No responseMimeType needed here, as plain text is expected
        );
    } catch(geminiError) {
        console.error("Gemini error during dataNatureDescription generation:", geminiError);
        return res.status(500).json({ success: false, message: `Failed to generate data nature description with AI: ${geminiError.message}` });
    }
    console.log('dataNatureDescription generated.');

    const cleanedCsvString = Papa.unparse(cleanedData);
    const cleanedCsvStoragePath = `cleaned_csvs/${analysisId}/cleaned_data.csv`;
    await storage.bucket().file(cleanedCsvStoragePath).save(cleanedCsvString, {
      metadata: { contentType: 'text/csv' },
    });
    console.log(`Cleaned CSV uploaded to: ${cleanedCsvStoragePath}`);

    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await analysisDocRef.set({
      analysisName: analysisName,
      originalFileName: originalFileName,
      rawCsvStoragePath: rawCsvStoragePath,
      cleanedCsvStoragePath: cleanedCsvStoragePath,
      dataSummaryForPrompts: dataSummaryForPrompts, 
      dataNatureDescription: dataNatureDescription, 
      rowCount: rowCount,
      columnCount: columnCount,
      createdAt: timestamp,
      lastUpdatedAt: timestamp,
      status: "ready_for_topic_analysis", 
    };

    const SMALL_DATASET_THRESHOLD_CELLS = 200; 
    const SMALL_DATASET_THRESHOLD_JSON_LENGTH = 200000; 
    
    let smallDatasetRawDataString = null;
    if (rowCount * columnCount <= SMALL_DATASET_THRESHOLD_CELLS) {
        try {
            // Przechowujemy bezpośrednio tablicę obiektów, Firestore sobie z tym poradzi
            // JSON.stringify jest potrzebny tylko do sprawdzenia długości
            const tempStringified = JSON.stringify(cleanedData);
            if (tempStringified.length <= SMALL_DATASET_THRESHOLD_JSON_LENGTH) {
                analysisDocData.smallDatasetRawData = cleanedData; 
                console.log(`Small dataset (${rowCount}x${columnCount}), storing full cleanedData in Firestore.`);
            } else {
                console.log(`Small dataset (${rowCount}x${columnCount}), but serialized JSON is too large (${tempStringified.length} bytes) for Firestore field. Not storing.`);
                analysisDocData.smallDatasetRawData = null;
            }
        } catch (stringifyError) {
            console.error("Error during size check of cleanedData for Firestore:", stringifyError);
            analysisDocData.smallDatasetRawData = null;
        }
    } else {
        console.log(`Dataset (${rowCount}x${columnCount}) is too large for storing full cleanedData in Firestore field.`);
        analysisDocData.smallDatasetRawData = null;
    }
    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    await analysisDocRef.set(analysisDocData);

    console.log(`Analysis record created in Firestore for ID: ${analysisId}`);

    return res.status(201).json({
      success: true,
      analysisId: analysisId,
      analysisName: analysisName, // Return analysisName
      originalFileName: originalFileName, // Return originalFileName
      message: "File processed and analysis record created successfully.",
      dataNatureDescription: dataNatureDescription // Return for immediate display if needed
    });

  } catch (error) {
    console.error('Error in /api/upload-and-preprocess-csv:', error);
    if (error.filepath && typeof fs.unlink === 'function') { 
        try { await fs.unlink(error.filepath); } catch (e) { console.error("Error unlinking temp file:", e); }
    }
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}