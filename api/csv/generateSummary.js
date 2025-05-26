// api/csv/generateSummary.js
import Papa from 'papaparse';
import { admin, firestore, storage } from '../_lib/firebaseAdmin';
import { generateContent } from '../_lib/geminiClient';

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

  try {
    const { analysisId, csvContent } = req.body;

    if (!analysisId || !csvContent) {
      return res.status(400).json({ success: false, message: 'Missing required fields: analysisId or csvContent.' });
    }

    console.log(`Processing CSV and generating summary for analysis ID: ${analysisId}`);

    // Process CSV data
    const { cleanedData, cleanedHeaders, rowCount, columnCount } = preprocessCsvData(csvContent);
    
    if (rowCount === 0 || columnCount === 0) {
      return res.status(400).json({ success: false, message: 'CSV processing resulted in no usable data.' });
    }
    console.log(`CSV preprocessed: ${rowCount} rows, ${columnCount} columns.`);

    // Generate data summary using Gemini
    const sampleSizeForPrompt = Math.min(rowCount, 13);
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
        "columns": [
          { 
            "name": "nazwa_kolumny_1", 
            "inferredType": "string/numeric/boolean/date/other", 
            "stats": { "mean": null, "median": null, "uniqueValues": null, "missingValues": 0, "min": null, "max": null, "mostFrequent": null },
            "description": "Krótki opis kolumny i jej potencjalne znaczenie." 
          }
        ],
        "rowInsights": [
          {
            "rowIndexOrIdentifier": "Numer wiersza w próbce (0-indeksowany) lub kluczowe wartości identyfikujące wiersz",
            "observation": "Opis, co jest szczególnego lub interesującego w tym wierszu, np. wartości odstające, nietypowe kombinacje wartości w różnych kolumnach.",
            "relevantColumns": ["kolumna1", "kolumna2"]
          }
        ],
        "generalObservations": [
            "Ogólne spostrzeżenie 1...",
            "Ogólne spostrzeżenie 2..."
        ],
        "rowCountProvidedSample": ${sampleDataForSummaryPrompt.length},
        "columnCount": ${columnCount},
        "potentialProblems": ["wymień wszelkie zaobserwowane potencjalne problemy z jakością danych"]
      }
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
      return res.status(500).json({ success: false, message: `Failed to generate data summary with AI: ${geminiError.message}` });
    }
    console.log('dataSummaryForPrompts generated successfully.');

    // Save cleaned CSV to storage
    const cleanedCsvString = Papa.unparse(cleanedData);
    const cleanedCsvStoragePath = `cleaned_csvs/${analysisId}/cleaned_data.csv`;
    await storage.bucket().file(cleanedCsvStoragePath).save(cleanedCsvString, { metadata: { contentType: 'text/csv' } });
    console.log(`Cleaned CSV uploaded to: ${cleanedCsvStoragePath}`);

    // Update analysis document with preprocessing results
    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    const updateData = {
      cleanedCsvStoragePath: cleanedCsvStoragePath,
      dataSummaryForPrompts: dataSummaryForPrompts,
      rowCount: rowCount,
      columnCount: columnCount,
      status: "generating_description", // Update status
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Check if dataset is small enough to store in Firestore
    const SMALL_DATASET_THRESHOLD_CELLS = 300;
    const SMALL_DATASET_THRESHOLD_JSON_LENGTH = 300000;
    
    if (rowCount * columnCount <= SMALL_DATASET_THRESHOLD_CELLS) {
      try {
        const tempStringified = JSON.stringify(cleanedData);
        if (tempStringified.length <= SMALL_DATASET_THRESHOLD_JSON_LENGTH) {
          updateData.smallDatasetRawData = cleanedData;
          console.log(`Small dataset (${rowCount}x${columnCount}), storing full cleanedData in Firestore.`);
        }
      } catch (stringifyError) {
        console.error("Error during size check of cleanedData for Firestore:", stringifyError);
      }
    }

    await analysisDocRef.update(updateData);

    return res.status(200).json({
      success: true,
      message: "CSV processed and summary generated successfully.",
      dataSummaryForPrompts: dataSummaryForPrompts
    });

  } catch (error) {
    console.error('Error in /api/csv/generateSummary:', error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
