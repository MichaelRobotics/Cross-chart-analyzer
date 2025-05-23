// api/chat-on-topic.js
import { admin, firestore } from './_lib/firebaseAdmin'; // Firebase Admin SDK
import { generateContent } from './_lib/geminiClient';   // Gemini API client

// Helper to format chat history for Gemini API
function formatChatHistoryForGemini(chatHistoryDocs) {
  if (!chatHistoryDocs || chatHistoryDocs.length === 0) {
    return [];
  }
  // Pass the parts array directly. If 'model' role parts contain HTML, Gemini gets it as context.
  return chatHistoryDocs.map(doc => {
    const data = doc.data();
    return {
      role: data.role,
      parts: data.parts, // parts is expected to be an array, e.g., [{text: "..."}]
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { analysisId, topicId, userMessageText } = req.body;

    // Input validation
    if (!analysisId || !topicId || !userMessageText) {
      return res.status(400).json({ success: false, message: 'Missing required fields: analysisId, topicId, or userMessageText.' });
    }
    if (userMessageText.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'User message text cannot be empty.' });
    }
    console.log(`Chat message received for analysisId: ${analysisId}, topicId: ${topicId}`);

    // Fetch parent analysis document for context
    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    const analysisDoc = await analysisDocRef.get();

    if (!analysisDoc.exists) {
      return res.status(404).json({ success: false, message: `Analysis with ID ${analysisId} not found.` });
    }
    const analysisData = analysisDoc.data();
    const { dataSummaryForPrompts, dataNatureDescription, analysisName } = analysisData;

    if (!dataSummaryForPrompts || !dataNatureDescription) {
      return res.status(400).json({ success: false, message: 'Analysis document is missing dataSummaryForPrompts or dataNatureDescription.' });
    }

    // Fetch topic document for context
    const topicDocRef = firestore.collection('analyses').doc(analysisId).collection('topics').doc(topicId);
    const topicDoc = await topicDocRef.get();
    if (!topicDoc.exists) {
        return res.status(404).json({ success: false, message: `Topic with ID ${topicId} not found for analysis ${analysisId}.` });
    }
    const topicDisplayName = topicDoc.data().topicDisplayName || "current topic";

    // Define chat history reference
    const chatHistoryRef = topicDocRef.collection('chatHistory');
    
    // Store user's message in Firestore first
    const userTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const userMessageId = `userMsg_${Date.now()}`; // Unique ID for the user message
    const userMessageData = {
      role: "user",
      parts: [{ text: userMessageText }], // User message is plain text
      timestamp: userTimestamp,
      messageId: userMessageId, // Store the ID within the document
    };
    await chatHistoryRef.doc(userMessageId).set(userMessageData);
    console.log(`User message stored for topic ${topicId}, ID: ${userMessageId}`);

    // Fetch chat history *after* storing the new user message to include it in the prompt
    const chatHistorySnapshot = await chatHistoryRef.orderBy('timestamp', 'asc').get();
    const existingChatHistoryDocs = chatHistorySnapshot.docs;
    const formattedHistory = formatChatHistoryForGemini(existingChatHistoryDocs);
    // The last message in formattedHistory is the current user's message.

    // Construct the prompt for Gemini
    const chatPrompt = `
      You are an AI Data Analysis Agent. Continue the conversation based on the history provided.
      The overall analysis is named "${analysisName || 'N/A'}" and the current topic of discussion is "${topicDisplayName}".
      The data you are analyzing primarily concerns: "${dataNatureDescription}".
      
      Data Summary (for context, do not repeat this summary in your answer unless specifically asked):
      ${typeof dataSummaryForPrompts === 'string' ? dataSummaryForPrompts : JSON.stringify(dataSummaryForPrompts, null, 2)}

      Conversation History (most recent user message is last):
      ${formattedHistory.map(m => `${m.role}: ${m.parts.map(p => p.text).join(' ')}`).join('\n')}

      Your Response:
      Based on the user's latest message ("${userMessageText}") and the conversation history, provide your response.
      Format your response as a JSON object with the following exact keys:
      - "conciseChatMessage": (String) A brief, direct answer to the user's question, suitable for display in a chat UI. This should be plain text.
      - "detailedAnalysisBlock": (Object) A structured block for the main display area, with these keys:
          - "questionAsked": (String) The user's question you are responding to (i.e., "${userMessageText}"). This should be plain text.
          - "detailedFindings": (String) Your detailed findings, explanations, or analysis related to the question. This string should be formatted with HTML tags for paragraphs (e.g., "<p>Finding 1.</p><p>Finding 2.</p>").
          - "specificThoughtProcess": (String) Briefly explain how you arrived at these detailedFindings, referencing the data summary or previous parts of the conversation if relevant. This string should be formatted with HTML tags, using paragraphs (<p>) or unordered lists (<ul><li>Item 1</li><li>Item 2</li></ul>) as appropriate to structure the explanation clearly.
          - "followUpSuggestions": (Array of strings) Provide 2-3 insightful plain text follow-up questions the user could ask next. Each string in the array should be a simple textual question without any HTML markup.

      Interaction Style: Be analytical, insightful, and directly answer the user's question.
    `;

    console.log(`Calling Gemini for chat response on topic: ${topicDisplayName}`);
    let geminiResponsePayload;
    try {
      geminiResponsePayload = await generateContent(
        'gemini-2.5-flash-preview-05-20', 
        chatPrompt,
        {
          responseMimeType: 'application/json',
        }
      );
    } catch (geminiError) {
      console.error(`Gemini API error during chat for topic ${topicId}:`, geminiError);
      // Optionally, store an error message in chat history or update topic status
      return res.status(500).json({ success: false, message: `Failed to get AI response: ${geminiError.message}` });
    }
    
    // Validate Gemini response structure
    if (!geminiResponsePayload || 
        !geminiResponsePayload.conciseChatMessage || 
        !geminiResponsePayload.detailedAnalysisBlock ||
        !geminiResponsePayload.detailedAnalysisBlock.detailedFindings || 
        !geminiResponsePayload.detailedAnalysisBlock.specificThoughtProcess || 
        !geminiResponsePayload.detailedAnalysisBlock.followUpSuggestions) {
        console.error("Gemini response for chat is missing required fields.", geminiResponsePayload);
        return res.status(500).json({ success: false, message: "AI response for chat was incomplete or malformed." });
    }
    console.log(`Gemini chat response received for topic ${topicId}`);

    // Store model's (AI) response in Firestore
    const modelTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const modelMessageId = `modelMsg_${Date.now()}`; // Unique ID for the model message
    const modelMessageData = {
      role: "model",
      parts: [{ text: geminiResponsePayload.conciseChatMessage }], // Plain text for chat UI
      timestamp: modelTimestamp,
      detailedAnalysisBlock: geminiResponsePayload.detailedAnalysisBlock, // Contains HTML formatted strings
      messageId: modelMessageId, // Store the ID within the document
    };
    await chatHistoryRef.doc(modelMessageId).set(modelMessageData);
    console.log(`Model (AI) response stored for topic ${topicId}, ID: ${modelMessageId}`);

    // Update lastUpdatedAt for topic and parent analysis documents
    await topicDocRef.update({ lastUpdatedAt: modelTimestamp });
    await analysisDocRef.update({ lastUpdatedAt: modelTimestamp });

    // Return success response to frontend
    return res.status(200).json({
      success: true,
      chatMessage: { // This is for the frontend's chat message list
        role: "model",
        parts: [{ text: geminiResponsePayload.conciseChatMessage }], // Plain text
        timestamp: new Date().toISOString(), // Frontend expects ISO string for immediate display
        messageId: modelMessageId,
      },
      detailedBlock: geminiResponsePayload.detailedAnalysisBlock, // Contains HTML
      message: "AI response generated successfully."
    });

  } catch (error) {
    console.error('Error in /api/chat-on-topic:', error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
