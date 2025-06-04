// api/upload-and-preprocess-csv.js
import { formidable } from 'formidable';
import fs from 'fs/promises'; // For reading the temporary file
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { admin, firestore, storage } from './_lib/firebaseAdmin'; // Firebase Admin SDK
import { generateContent } from './_lib/geminiClient'; // Gemini API client

// Vercel specific configuration
export const config = {
  api: {
    bodyParser: false,
  },
};

function preprocessCsvData(csvString) {
  if (!csvString || typeof csvString !== 'string') {
    throw new Error('Invalid CSV string provided for preprocessing.');
  }
  const parseResult = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: true,
    transformHeader: header => (header || '').toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
  });

  if (parseResult.errors.length > 0) {
    console.warn('CSV parsing errors (will attempt to proceed):', parseResult.errors.slice(0, 5));
  }
  
  let data = parseResult.data.filter(row => row && Object.values(row).some(val => val !== null && val !== '' && val !== undefined));
  const originalHeaders = parseResult.meta.fields || [];

  if (data.length === 0) {
      return { cleanedData: [], cleanedHeaders: [], originalHeaders, rowCount: 0, columnCount: 0 };
  }

  const nonEmptyHeaders = originalHeaders.filter(header =>
    data.some(row => row[header] !== null && row[header] !== undefined && row[header] !== '')
  );
  
  data = data.map(row => {
    const newRow = {};
    nonEmptyHeaders.forEach(header => {
      newRow[header] = row[header];
    });
    return newRow;
  });

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const form = formidable({});
  let tempFilepath; 

  try {
    const [fields, files] = await form.parse(req);

    if (!files.csvFile || files.csvFile.length === 0) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
    }
    const csvFile = files.csvFile[0];
    tempFilepath = csvFile.filepath; 
    
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
    tempFilepath = null; 

    console.log('Starting CSV preprocessing...');
    const csvString = rawFileBuffer.toString('utf-8');
    const { cleanedData, cleanedHeaders, rowCount, columnCount } = preprocessCsvData(csvString);
    
    if (rowCount === 0 || columnCount === 0) {
        return res.status(400).json({ success: false, message: 'CSV processing resulted in no usable data. The file might be empty or incorrectly formatted.' });
    }
    console.log(`CSV preprocessed: ${rowCount} rows, ${columnCount} columns.`);

    // Zwiększamy próbkę danych dla promptu, jeśli dane są małe, np. do 10-13 wierszy
    const sampleSizeForPrompt = Math.min(rowCount, 13); // Użyj wszystkich wierszy jeśli jest ich <= 13, wpp 13
    const sampleDataForSummaryPrompt = cleanedData.slice(0, sampleSizeForPrompt).map(row => 
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value).slice(0,100)]))
    );

    const dataSummaryPrompt = `
      Przeanalizuj poniższe nagłówki danych CSV oraz dostarczoną próbkę wierszy, aby dostarczyć kompleksowe, strukturalne podsumowanie obejmujące zarówno kolumny, jak i wiersze.
      Nagłówki: ${cleanedHeaders.join(', ')}.
      Całkowita liczba wierszy w zbiorze: ${rowCount}.
      Całkowita liczba kolumn w zbiorze: ${columnCount}.
      Próbka danych (${sampleDataForSummaryPrompt.length} wierszy):
      ${sampleDataForSummaryPrompt.map(row => JSON.stringify(row)).join('\n')}
      
      Zwróć obiekt JSON o następującej strukturze:
      {
        "columns": [ // Analiza dla każdej kolumny
          { 
            "name": "nazwa_kolumny_1", 
            "inferredType": "string/numeric/boolean/date/other", 
            "stats": { "mean": null, "median": null, "uniqueValues": null, "missingValues": 0, "min": null, "max": null, "mostFrequent": null },
            "description": "Krótki opis kolumny i jej potencjalne znaczenie." 
          }
          // ... inne kolumny
        ],
        "rowInsights": [ // Spostrzeżenia dotyczące wierszy z dostarczonej próbki (wybierz 2-3 najbardziej interesujące)
          {
            "rowIndexOrIdentifier": "Numer wiersza w próbce (0-indeksowany) lub kluczowe wartości identyfikujące wiersz",
            "observation": "Opis, co jest szczególnego lub interesującego w tym wierszu, np. wartości odstające, nietypowe kombinacje wartości w różnych kolumnach.",
            "relevantColumns": ["kolumna1", "kolumna2"] // Kolumny, które są kluczowe dla tej obserwacji
          }
          // ... inne spostrzeżenia dotyczące wierszy
        ],
        "generalObservations": [ // 1-2 ogólne spostrzeżenia lub wzorce zauważone w próbce danych, które dotyczą relacji między wierszami/kolumnami lub ogólnej struktury danych.
            "Ogólne spostrzeżenie 1...",
            "Ogólne spostrzeżenie 2..."
        ],
        "rowCountProvidedSample": ${sampleDataForSummaryPrompt.length}, // Liczba wierszy w przekazanej próbce
        "columnCount": ${columnCount}, // Całkowita liczba kolumn
        "potentialProblems": ["wymień wszelkie zaobserwowane potencjalne problemy z jakością danych, np. wiele brakujących wartości w kolumnie, niespójności"]
      }
      Dla 'columns.inferredType', użyj jednej z wartości: string, numeric, boolean, date, other.
      Dla 'columns.stats', podaj odpowiednie statystyki; jeśli statystyka nie ma zastosowania, użyj null. Zawsze dołączaj 'missingValues'. Dodaj 'mostFrequent' dla kolumn kategorycznych/tekstowych, jeśli to ma sens.
      Dla 'columns.description', krótko opisz zawartość i potencjalne znaczenie kolumny.
      Dla 'rowInsights', wybierz 2-3 najbardziej wyróżniające się wiersze z dostarczonej próbki i opisz je. Wskaż numer wiersza z próbki (0-indeksowany) lub podaj kluczowe wartości, które go identyfikują.
      Dla 'generalObservations', podaj zwięzłe, ogólne spostrzeżenia.
      WAŻNE: Cała odpowiedź musi być prawidłowym obiektem JSON. Wszelkie cudzysłowy (") w wartościach tekstowych MUSZĄ być poprawnie poprzedzone znakiem ucieczki jako \\".
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
        // Poprawka: upewnij się, że tempFilepath jest czyszczony nawet przy błędzie Gemini
        if (tempFilepath) { try { await fs.unlink(tempFilepath); } catch (e) { console.error("Error unlinking temp file on Gemini error:", e); } }
        return res.status(500).json({ success: false, message: `Failed to generate data summary with AI: ${geminiError.message}` });
    }
    console.log('dataSummaryForPrompts (now includes row insights) generated.');

    // ... (reszta kodu pozostaje taka sama, w tym generowanie dataNatureDescription, zapisywanie danych, itp.)
    // dataNatureDescription może teraz korzystać z bardziej szczegółowego dataSummaryForPrompts

    const dataNaturePrompt = `
      Na podstawie następującego podsumowania danych (które zawiera analizę kolumn i spostrzeżenia dotyczące wierszy):
      ${JSON.stringify(dataSummaryForPrompts, null, 2)}
      
      Krótko opisz ogólną naturę tego zbioru danych w 1-2 zdaniach. 
      Zasugeruj 1-2 ogólne typy analizy, do których byłby on najbardziej odpowiedni, biorąc pod uwagę zarówno charakterystyki kolumn, jak i przykładowe spostrzeżenia dotyczące wierszy.
      Opis powinien być zwięzły i informacyjny. Nie używaj formatowania HTML. Odpowiedź powinna być zwykłym tekstem.
    `;
    let dataNatureDescription;
    try {
        dataNatureDescription = await generateContent(
            'gemini-2.5-flash-preview-05-20',
            dataNaturePrompt
        );
    } catch(geminiError) {
        console.error("Gemini error during dataNatureDescription generation:", geminiError);
        if (tempFilepath) { try { await fs.unlink(tempFilepath); } catch (e) { console.error("Error unlinking temp file on Gemini error (nature):", e); } }
        return res.status(500).json({ success: false, message: `Failed to generate data nature description with AI: ${geminiError.message}` });
    }
    console.log('dataNatureDescription generated.');

    const cleanedCsvString = Papa.unparse(cleanedData);
    const cleanedCsvStoragePath = `cleaned_csvs/${analysisId}/cleaned_data.csv`;
    await storage.bucket().file(cleanedCsvStoragePath).save(cleanedCsvString, { metadata: { contentType: 'text/csv' } });
    console.log(`Cleaned CSV uploaded to: ${cleanedCsvStoragePath}`);

    const analysisDocData = {
      analysisName: analysisName,
      originalFileName: originalFileName,
      rawCsvStoragePath: rawCsvStoragePath,
      cleanedCsvStoragePath: cleanedCsvStoragePath,
      dataSummaryForPrompts: dataSummaryForPrompts, 
      dataNatureDescription: dataNatureDescription, 
      rowCount: rowCount,
      columnCount: columnCount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      analysisName: analysisName, 
      originalFileName: originalFileName, 
      message: "File processed and analysis record created successfully.",
      dataNatureDescription: dataNatureDescription 
    });

  } catch (error) {
    console.error('Error in /api/upload-and-preprocess-csv:', error);
    if (tempFilepath) { 
        try { await fs.unlink(tempFilepath); } catch (e) { console.error("Error unlinking temp file on error:", e); }
    }
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
