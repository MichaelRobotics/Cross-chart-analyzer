// api/analyses.js
import { firestore } from './_lib/firebaseAdmin'; // Corrected path

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log('Fetching list of all analyses...');

    // Query the 'analyses' collection, order by creation date descending
    // to show the newest analyses first.
    const analysesSnapshot = await firestore.collection('analyses')
                                          .orderBy('createdAt', 'desc')
                                          .get();

    if (analysesSnapshot.empty) {
      console.log('No analyses found.');
      return res.status(200).json({ success: true, analyses: [] });
    }

    // Map the documents to the format expected by the frontend
    const analysesList = analysesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        analysisId: doc.id, // The document ID is the analysisId
        name: data.analysisName,
        fileName: data.originalFileName, // Or cleanedFileName if preferred
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null, // Convert Firestore Timestamp to ISO string
        lastUpdatedAt: data.lastUpdatedAt ? data.lastUpdatedAt.toDate().toISOString() : null,
        status: data.status,
        rowCount: data.rowCount,
        columnCount: data.columnCount,
        // Add any other fields the frontend might need for the list view
        // For example, dataNatureDescription could be useful for a quick preview
        dataNatureDescription: data.dataNatureDescription || null,
        // The frontend's AnalysisContext maps analysisId to 'id' and sets a default 'type'.
        // We can ensure the core fields are here.
      };
    });

    console.log(`Found ${analysesList.length} analyses.`);
    return res.status(200).json({ success: true, analyses: analysesList });

  } catch (error) {
    console.error('Error fetching analyses list:', error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}