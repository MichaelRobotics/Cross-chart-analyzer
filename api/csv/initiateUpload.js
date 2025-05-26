// api/csv/initiateUpload.js
import { formidable } from 'formidable';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { admin, firestore, storage } from '../_lib/firebaseAdmin';

// Vercel specific configuration
export const config = {
  api: {
    bodyParser: false,
  },
};

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
    console.log(`Initiating upload for analysis: ${analysisName} (ID: ${analysisId})`);

    // Upload raw CSV to Firebase Storage
    const rawCsvStoragePath = `raw_csvs/${analysisId}/${originalFileName}`;
    const rawFileBuffer = await fs.readFile(csvFile.filepath);

    await storage.bucket().file(rawCsvStoragePath).save(rawFileBuffer, {
      metadata: { contentType: csvFile.mimetype || 'text/csv' },
    });
    console.log(`Raw CSV uploaded to: ${rawCsvStoragePath}`);
    
    // Clean up temp file
    await fs.unlink(csvFile.filepath);
    tempFilepath = null;

    // Create initial analysis document with status
    const analysisDocData = {
      analysisId: analysisId,
      analysisName: analysisName,
      originalFileName: originalFileName,
      rawCsvStoragePath: rawCsvStoragePath,
      status: "processing_csv", // New status field
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    await analysisDocRef.set(analysisDocData);
    console.log(`Initial analysis record created for ID: ${analysisId}`);

    // Return the CSV content for the next step
    return res.status(200).json({
      success: true,
      analysisId: analysisId,
      analysisName: analysisName,
      csvContent: rawFileBuffer.toString('utf-8'), // Send CSV content for next step
      message: "File uploaded successfully. Ready for processing."
    });

  } catch (error) {
    console.error('Error in /api/csv/initiateUpload:', error);
    if (tempFilepath) { 
      try { await fs.unlink(tempFilepath); } catch (e) { console.error("Error unlinking temp file:", e); }
    }
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
