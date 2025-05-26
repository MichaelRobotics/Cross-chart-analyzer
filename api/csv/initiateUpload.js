// api/csv/initiateUpload.js
import { formidable } from 'formidable';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { admin, firestore, storage } from '../_lib/firebaseAdmin';

// Configuration for Vercel to correctly parse multipart/form-data
export const config = {
  api: {
    bodyParser: false, // Crucial for formidable to work
  },
};

/**
 * Handles the initial phase of CSV processing:
 * 1. Receives the CSV file and analysis name from the client.
 * 2. Validates the input.
 * 3. Generates a unique analysisId.
 * 4. Uploads the raw CSV file to Firebase Storage.
 * 5. Creates an initial document in Firestore for this analysis with a status of "upload_completed".
 * 6. Returns the analysisId and other relevant details to the client.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const form = formidable({});
  let tempFilepath; // To store the path of the temporary uploaded file for cleanup

  try {
    // Parse the incoming form data (file and fields)
    const [fields, files] = await form.parse(req);

    // Validate that a CSV file was uploaded
    if (!files.csvFile || files.csvFile.length === 0) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
    }
    const csvFile = files.csvFile[0];
    tempFilepath = csvFile.filepath; // Store path for potential cleanup on error

    // Validate that an analysis name was provided
    if (!fields.analysisName || fields.analysisName.length === 0 || !fields.analysisName[0].trim()) {
      if (tempFilepath) await fs.unlink(tempFilepath); // Clean up temp file if it exists
      return res.status(400).json({ success: false, message: 'Analysis name is required and cannot be empty.' });
    }
    const analysisName = fields.analysisName[0].trim();
    const originalFileName = csvFile.originalFilename || 'uploaded_file.csv';

    // Generate a unique ID for this analysis
    const analysisId = uuidv4();
    console.log(`Initiating upload for analysis: ${analysisName} (ID: ${analysisId})`);

    // Define the path for storing the raw CSV in Firebase Storage
    const rawCsvStoragePath = `raw_csvs/${analysisId}/${originalFileName}`;
    
    // Read the uploaded file content from its temporary location
    const rawFileBuffer = await fs.readFile(csvFile.filepath);

    // Upload the raw CSV to Firebase Storage
    await storage.bucket().file(rawCsvStoragePath).save(rawFileBuffer, {
      metadata: { contentType: csvFile.mimetype || 'text/csv' },
    });
    console.log(`Raw CSV uploaded to Firebase Storage at: ${rawCsvStoragePath}`);

    // Clean up the temporary file from the server's local filesystem
    await fs.unlink(csvFile.filepath);
    tempFilepath = null; // Reset tempFilepath as it's been successfully handled

    // Prepare data for the initial Firestore document
    const analysisDocData = {
      analysisId: analysisId, // Also store analysisId within the document for easier querying
      analysisName: analysisName,
      originalFileName: originalFileName,
      rawCsvStoragePath: rawCsvStoragePath,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Record creation time
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(), // Record last update time
      status: "upload_completed", // Set initial status
      // Other fields will be added in subsequent steps
    };

    // Create the initial analysis document in Firestore
    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    await analysisDocRef.set(analysisDocData);
    console.log(`Initial analysis record created in Firestore for ID: ${analysisId}`);

    // Respond to the client with success and relevant data
    return res.status(201).json({
      success: true,
      analysisId: analysisId,
      analysisName: analysisName,
      originalFileName: originalFileName,
      rawCsvStoragePath: rawCsvStoragePath,
      message: "File uploaded and initial record created successfully. Proceed to generate summary.",
    });

  } catch (error) {
    console.error('Error in /api/csv/initiateUpload:', error);
    // Ensure temporary file is cleaned up in case of an error
    if (tempFilepath) {
      try { await fs.unlink(tempFilepath); } catch (e) { console.error("Error unlinking temporary file during error handling:", e); }
    }
    return res.status(500).json({ success: false, message: `Server error during upload initiation: ${error.message}` });
  }
}