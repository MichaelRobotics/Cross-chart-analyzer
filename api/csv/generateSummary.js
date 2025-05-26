// api/csv/generateSummary.js
import Papa from 'papaparse';
import { admin, firestore, storage } from '../_lib/firebaseAdmin';
import { generateContent } from '../_lib/geminiClient';

/**
 * Preprocesses a CSV string:
 * - Parses the CSV.
 * - Handles headers and empty lines.
 * - Filters out rows and columns that are entirely empty.
 * @param {string} csvString - The CSV data as a string.
 * @returns {object} An object containing cleanedData, cleanedHeaders, originalHeaders, rowCount, and columnCount.
 */
function preprocessCsvData(csvString) {
  if (!csvString || typeof csvString !== 'string') {
    console.error("preprocessCsvData: Invalid CSV string input.");
    throw new Error('Invalid CSV string provided for preprocessing.');
  }

  // Parse the CSV string
  const parseResult = Papa.parse(csvString, {
    header: true, // Treat the first row as headers
    skipEmptyLines: 'greedy', // Skip lines that are completely empty or contain only whitespace
    dynamicTyping: true, // Attempt to convert numeric and boolean data to their types
    transformHeader: header => (header || '').toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(), // Clean headers
  });

  if (parseResult.errors.length > 0) {
    console.warn('CSV parsing errors encountered (will attempt to proceed):', parseResult.errors.slice(0, 5)); // Log first 5 errors
  }
  
  // Filter out rows that are completely empty or null
  let data = parseResult.data.filter(row => row && Object.values(row).some(val => val !== null && val !== '' && val !== undefined));
  const originalHeaders = parseResult.meta.fields || [];

  if (data.length === 0) {
      console.log("preprocessCsvData: No data rows after initial filtering.");
      return { cleanedData: [], cleanedHeaders: [], originalHeaders, rowCount: 0, columnCount: 0 };
  }

  // Identify headers that actually have data in at least one row
  const nonEmptyHeaders = originalHeaders.filter(header =>
    data.some(row => row[header] !== null && row[header] !== undefined && row[header] !== '')
  );
  
  // Re-map data to only include non-empty headers
  data = data.map(row => {
    const newRow = {};
    nonEmptyHeaders.forEach(header => {
      newRow[header] = row[header];
    });
    return newRow;
  });

  // Final filter for rows that might have become empty after header removal (should be rare if nonEmptyHeaders is correct)
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

/**
 * Handles the second phase of CSV processing:
 * 1. Retrieves the analysisId from the request.
 * 2. Fetches the raw CSV from Firebase Storage using the path stored in Firestore.
 * 3. Preprocesses the CSV data (cleaning, parsing).
 * 4. Saves the cleaned CSV data back to Firebase Storage.
 * 5. Generates a structured data summary using the Gemini API.
 * 6. Updates the Firestore document with the cleaned CSV path, summary, row/column counts, and status "summary_generated".
 * 7. Returns the generated summary to the client.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const { analysisId } = req.body;

  if (!analysisId) {
    return res.status(400).json({ success: false, message: 'analysisId is required.' });
  }
  
  const analysisDocRef = firestore.collection('analyses').doc(analysisId);

  try {
    console.log(`Generating summary for analysisId: ${analysisId}`);

    const analysisDoc = await analysisDocRef.get();
    if (!analysisDoc.exists) {
      return res.status(404).json({ success: false, message: `Analysis record for ID ${analysisId} not found.` });
    }
    const { rawCsvStoragePath } = analysisDoc.data();

    if (!rawCsvStoragePath) {
        console.error(`rawCsvStoragePath not found in Firestore for analysis ID ${analysisId}.`);
        await analysisDocRef.update({ status: "error_missing_raw_path", error: "Raw CSV storage path missing."});
        return res.status(400).json({ success: false, message: `rawCsvStoragePath not found for analysis ID ${analysisId}. Cannot proceed.`});
    }

    // Download raw CSV from Firebase Storage
    const [rawFileBuffer] = await storage.bucket().file(rawCsvStoragePath).download();
    const csvString = rawFileBuffer.toString('utf-8'); // Assuming UTF-8 encoding

    console.log('Starting CSV preprocessing...');
    const { cleanedData, cleanedHeaders, rowCount, columnCount } = preprocessCsvData(csvString);
    
    if (rowCount === 0 || columnCount === 0) {
        console.warn(`CSV processing for ${analysisId} resulted in no usable data.`);
        await analysisDocRef.update({ status: "error_processing_no_data", error: "CSV processing resulted in no usable data.", rowCount: 0, columnCount: 0 });
        return res.status(400).json({ success: false, message: 'CSV processing resulted in no usable data. The file might be empty or incorrectly formatted.' });
    }
    console.log(`CSV preprocessed for ${analysisId}: ${rowCount} rows, ${columnCount} columns.`);

    // Save cleaned CSV to Firebase Storage
    const cleanedCsvString = Papa.unparse(cleanedData); // Convert cleaned data back to CSV string
    const cleanedCsvStoragePath = `cleaned_csvs/${analysisId}/cleaned_data.csv`;
    await storage.bucket().file(cleanedCsvStoragePath).save(cleanedCsvString, { metadata: { contentType: 'text/csv' } });
    console.log(`Cleaned CSV for ${analysisId} uploaded to: ${cleanedCsvStoragePath}`);

    // Prepare a sample of data for the Gemini prompt
    const sampleSizeForPrompt = Math.min(rowCount, 13); // Use up to 13 rows for the sample
    const sampleDataForSummaryPrompt = cleanedData.slice(0, sampleSizeForPrompt).map(row => 
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value).slice(0,100)])) // Truncate long cell values
    );

    // Construct the prompt for Gemini to generate the data summary
    // This prompt is crucial for getting the desired JSON structure.
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
      // Call Gemini API to generate the summary
      dataSummaryForPrompts = await generateContent(
        'gemini-1.5-flash-preview-05-20', // Ensure this model is appropriate and available
        dataSummaryPrompt,
        { responseMimeType: 'application/json' } // Expecting a JSON response
      );
    } catch(geminiError) {
        console.error(`Gemini error during dataSummaryForPrompts generation for ${analysisId}:`, geminiError);
        await analysisDocRef.update({ status: "error_generating_summary_ai", error: geminiError.message, lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(500).json({ success: false, message: `Failed to generate data summary with AI: ${geminiError.message}` });
    }
    console.log(`dataSummaryForPrompts generated for ${analysisId}.`);
    
    // Prepare data for updating the Firestore document
    const updateData = {
      cleanedCsvStoragePath: cleanedCsvStoragePath,
      dataSummaryForPrompts: dataSummaryForPrompts, // The JSON object from Gemini
      rowCount: rowCount,
      columnCount: columnCount,
      status: "summary_generated", // Update status
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Update the Firestore document
    await analysisDocRef.update(updateData);

    // Respond to the client with success and the generated summary
    return res.status(200).json({
      success: true,
      analysisId: analysisId,
      dataSummaryForPrompts: dataSummaryForPrompts, // Pass this to the next step on the client
      message: "Data summary generated and analysis record updated successfully. Proceed to describe and finalize.",
    });

  } catch (error) {
    console.error(`Error in /api/csv/generateSummary for analysisId ${analysisId}:`, error);
    // Attempt to update Firestore with error status if analysisId is known
    if (analysisId) {
        try {
            await analysisDocRef.update({
                status: "error_generating_summary_server",
                error: `Server error: ${error.message}`,
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (dbError) {
            console.error(`Failed to update Firestore status on server error (generateSummary) for ${analysisId}:`, dbError);
        }
    }
    return res.status(500).json({ success: false, message: `Server error during summary generation: ${error.message}` });
  }
}
