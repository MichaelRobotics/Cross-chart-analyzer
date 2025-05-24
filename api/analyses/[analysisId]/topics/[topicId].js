// api/analyses/[analysisId]/topics/[topicId].js
import { firestore } from '../../../_lib/firebaseAdmin'; // Adjusted path for _lib

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { analysisId, topicId } = req.query; // Extract dynamic params from URL query

    if (!analysisId || !topicId) {
      return res.status(400).json({ success: false, message: 'Missing analysisId or topicId in request.' });
    }
    console.log(`Fetching data for analysisId: ${analysisId}, topicId: ${topicId}`);

    // 1. Fetch the specific topic document
    const topicDocRef = firestore.collection('analyses').doc(analysisId).collection('topics').doc(topicId);
    const topicDoc = await topicDocRef.get();

    if (!topicDoc.exists) {
      return res.status(404).json({ success: false, message: `Topic with ID ${topicId} not found for analysis ${analysisId}.` });
    }
    const topicData = topicDoc.data();
    const initialAnalysisResult = topicData.initialAnalysisResult || null; // This might be null if it's not the 'main' initial topic block

    // 2. Fetch the chat history for this topic, ordered by timestamp
    const chatHistoryRef = topicDocRef.collection('chatHistory');
    const chatHistorySnapshot = await chatHistoryRef.orderBy('timestamp', 'asc').get();

    const chatHistory = [];
    if (!chatHistorySnapshot.empty) {
      chatHistorySnapshot.docs.forEach(doc => {
        const messageData = doc.data();
        chatHistory.push({
          messageId: doc.id, // The document ID from chatHistory
          role: messageData.role,
          parts: messageData.parts, // Expected to be [{ text: "..." }]
          timestamp: messageData.timestamp ? messageData.timestamp.toDate().toISOString() : null,
          detailedAnalysisBlock: messageData.detailedAnalysisBlock || null, // Include if present
        });
      });
    }
    console.log(`Found ${chatHistory.length} messages for topic ${topicId}. Initial analysis result ${initialAnalysisResult ? 'found' : 'not found directly on topic doc'}.`);

    // 3. Combine and return the data
    // The frontend's Dashboard.js (processAndSetBackendData) expects an object that might contain
    // initialAnalysisResult and chatHistory.
    return res.status(200).json({
      success: true,
      // If initialAnalysisResult is always the first block, and subsequent blocks are from chatHistory's detailedAnalysisBlock,
      // the frontend logic will handle constructing the view.
      // We send both, and the frontend decides how to structure them.
      initialAnalysisResult: initialAnalysisResult, // This is the main analysis for THE topic itself
      chatHistory: chatHistory, // This contains all chat messages, some of which might have their own detailedAnalysisBlock
      message: `Data for topic ${topicId} fetched successfully.`
    });

  } catch (error) {
    console.error(`Error fetching data for analysis ${req.query.analysisId}, topic ${req.query.topicId}:`, error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}