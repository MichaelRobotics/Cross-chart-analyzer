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

// --- CSV Processing Helper Functions (Simplified - consider moving to csvProgrammaticProcessor.js) ---

/**
 * Cleans column names: removes newlines, trims whitespace, replaces multiple spaces with one.
 * @param {string[]} headers - Array of header strings.
 * @returns {string[]} - Array of cleaned header strings.
 */
function cleanColumnNames(headers) {
  return headers.map(header => 
    (header || '').toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  );
}

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
    transformHeader: header => header.toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(), // Clean headers during parsing
  });

  if (parseResult.errors.length > 0) {
    console.error('CSV parsing errors:', parseResult.errors);
    // For now, we'll try to proceed if data is available, but ideally, critical errors should stop processing.
    // throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`);
  }
  
  let data = parseResult.data;
  const originalHeaders = parseResult.meta.fields || [];

  // Further cleaning if needed:
  // 1. Remove completely empty columns (if any survived dynamicTyping and header cleaning)
  // This is a basic check; more sophisticated checks might be needed.
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

  // 2. Remove rows where all values are empty/null/undefined after selecting non-empty headers
  data = data.filter(row => 
    nonEmptyHeaders.some(header => row[header] !== null && row[header] !== undefined && row[header] !== '')
  );
  
  // At this point, `data` is an array of objects, and `nonEmptyHeaders` contains the cleaned, relevant headers.
  return {
    cleanedData: data, // Array of objects
    cleanedHeaders: nonEmptyHeaders,
    originalHeaders: originalHeaders, // Original headers from PapaParse before filtering empty columns
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
    // Parse the incoming multipart/form-data
    const [fields, files] = await form.parse(req);

    // Validate inputs
    if (!files.csvFile || files.csvFile.length === 0) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
    }
    if (!fields.analysisName || !fields.analysisName[0]) {
      return res.status(400).json({ success: false, message: 'Analysis name is required.' });
    }

    const csvFile = files.csvFile[0];
    const analysisName = fields.analysisName[0].trim();
    const originalFileName = csvFile.originalFilename || 'uploaded_file.csv';

    // 1. Generate a unique analysisId
    const analysisId = uuidv4();
    console.log(`Processing new analysis: ${analysisName} (ID: ${analysisId})`);

    // 2. Upload Raw CSV to Firebase Storage
    const rawCsvStoragePath = `raw_csvs/${analysisId}/${originalFileName}`;
    const rawFileBuffer = await fs.readFile(csvFile.filepath); // Read the temp file uploaded by formidable

    await storage.bucket().file(rawCsvStoragePath).save(rawFileBuffer, {
      metadata: { contentType: csvFile.mimetype || 'text/csv' },
    });
    console.log(`Raw CSV uploaded to: ${rawCsvStoragePath}`);
    await fs.unlink(csvFile.filepath); // Clean up the temporary file

    // 3. Programmatic Data Preprocessing
    console.log('Starting CSV preprocessing...');
    const csvString = rawFileBuffer.toString('utf-8');
    const { cleanedData, cleanedHeaders, rowCount, columnCount } = preprocessCsvData(csvString);
    
    if (rowCount === 0 || columnCount === 0) {
        return res.status(400).json({ success: false, message: 'CSV processing resulted in no usable data. The file might be empty or incorrectly formatted.' });
    }
    console.log(`CSV preprocessed: ${rowCount} rows, ${columnCount} columns.`);

    // Prepare a sample of data for Gemini if the dataset is very large
    // For now, we'll use a small sample or summary of headers for prompts.
    // The full cleanedData (array of objects) is available.
    // For dataSummaryForPrompts, we need column names, types, basic stats.
    // For dataNatureDescription, we need a high-level overview.

    // 4. Generate dataSummaryForPrompts using Gemini API
    console.log('Generating dataSummaryForPrompts with Gemini...');
    // Construct a prompt for dataSummaryForPrompts.
    // This prompt needs to instruct Gemini to return a JSON object.
    // Example: list column names, inferred types, and basic stats (mean, median for numeric; unique counts for categorical).
    const dataSummaryPrompt = `
      Analyze the following CSV data headers and a small sample of rows to provide a structured summary.
      Headers: ${cleanedHeaders.join(', ')}.
      Sample (first 5 rows if available, otherwise fewer):
      ${cleanedData.slice(0, 5).map(row => JSON.stringify(row)).join('\n')}
      
      Return a JSON object with the following structure:
      {
        "columns": [
          { "name": "column_name_1", "inferredType": "string/numeric/boolean/date", "stats": { "mean": 0, "median": 0, "uniqueValues": 0, "missingValues": 0 } },
          // ... other columns
        ],
        "rowCount": ${rowCount},
        "columnCount": ${columnCount},
        "potentialProblems": ["list any potential data quality issues observed, e.g., many missing values in a column"]
      }
      For 'inferredType', use one of: string, numeric, boolean, date, other.
      For 'stats', provide relevant statistics based on the inferredType. For example, for numeric, provide mean, median, min, max. For string, provide count of unique values. Always include 'missingValues' count.
    `;

    let dataSummaryForPrompts;
    try {
      dataSummaryForPrompts = await generateContent(
        'gemini-1.5-flash-latest', // Or your preferred model
        dataSummaryPrompt,
        { responseMimeType: 'application/json' } // Request JSON output
      );
    } catch(geminiError) {
        console.error("Gemini error during dataSummaryForPrompts generation:", geminiError);
        // Fallback or rethrow
        return res.status(500).json({ success: false, message: `Failed to generate data summary with AI: ${geminiError.message}` });
    }
    console.log('dataSummaryForPrompts generated.');


    // 5. Generate dataNatureDescription using Gemini API
    console.log('Generating dataNatureDescription with Gemini...');
    const dataNaturePrompt = `
      Based on the following data summary:
      ${JSON.stringify(dataSummaryForPrompts, null, 2)}
      
      Briefly describe the general nature of this dataset in 1-2 sentences. 
      Suggest 1-2 high-level types of analysis it would be most suitable for 
      (e.g., "This appears to be sales transaction data, suitable for trend analysis and customer segmentation." 
      or "This dataset describes sensor readings over time, suitable for anomaly detection and predictive maintenance analysis.").
      Keep the description concise and informative.
    `;
    let dataNatureDescription;
    try {
        dataNatureDescription = await generateContent(
            'gemini-1.5-flash-latest',
            dataNaturePrompt
        );
    } catch(geminiError) {
        console.error("Gemini error during dataNatureDescription generation:", geminiError);
        return res.status(500).json({ success: false, message: `Failed to generate data nature description with AI: ${geminiError.message}` });
    }
    console.log('dataNatureDescription generated.');

    // 6. Upload Cleaned CSV to Firebase Storage (Optional but Recommended)
    // For this example, we'll convert cleanedData (array of objects) back to CSV string
    const cleanedCsvString = Papa.unparse(cleanedData);
    const cleanedCsvStoragePath = `cleaned_csvs/${analysisId}/cleaned_data.csv`;
    await storage.bucket().file(cleanedCsvStoragePath).save(cleanedCsvString, {
      metadata: { contentType: 'text/csv' },
    });
    console.log(`Cleaned CSV uploaded to: ${cleanedCsvStoragePath}`);

    // 7. Create Analysis Record in Firebase Firestore
    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await analysisDocRef.set({
      // userId: "optional_user_id_if_auth_implemented", // Add if/when auth is implemented
      analysisName: analysisName,
      originalFileName: originalFileName,
      rawCsvStoragePath: rawCsvStoragePath,
      cleanedCsvStoragePath: cleanedCsvStoragePath,
      dataSummaryForPrompts: dataSummaryForPrompts, // Store the JSON object from Gemini
      dataNatureDescription: dataNatureDescription, // Store the text from Gemini
      rowCount: rowCount,
      columnCount: columnCount,
      createdAt: timestamp,
      lastUpdatedAt: timestamp,
      status: "ready_for_topic_analysis", // Initial status
    });
    console.log(`Analysis record created in Firestore for ID: ${analysisId}`);

    // 8. Return success response
    return res.status(201).json({
      success: true,
      analysisId: analysisId,
      message: "File processed and analysis record created successfully.",
      // Optionally return dataNatureDescription or a part of dataSummaryForPrompts
      // dataNatureDescription: dataNatureDescription 
    });

  } catch (error) {
    console.error('Error in /api/upload-and-preprocess-csv:', error);
    // Clean up temp file if form parsing failed mid-way and file exists
    if (error.filepath) { // formidable might attach filepath to error
        try { await fs.unlink(error.filepath); } catch (e) { console.error("Error unlinking temp file:", e); }
    }
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
