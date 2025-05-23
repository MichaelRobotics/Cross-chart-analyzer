// api/chat-on-topic.js
import { admin, firestore } from '../_lib/firebaseAdmin'; // Firebase Admin SDK
import { generateContent } from '../_lib/geminiClient';   // Gemini API client

// Helper to format chat history for Gemini API
function formatChatHistoryForGemini(chatHistoryDocs) {
  if (!chatHistoryDocs || chatHistoryDocs.length === 0) {
    return [];
  }
  return chatHistoryDocs.map(doc => {
    const data = doc.data();
    return {
      role: data.role,
      parts: data.parts,
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

    if (!analysisId || !topicId || !userMessageText) {
      return res.status(400).json({ success: false, message: 'Missing required fields: analysisId, topicId, or userMessageText.' });
    }
    if (userMessageText.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'User message text cannot be empty.' });
    }
    console.log(`Chat message received for analysisId: ${analysisId}, topicId: ${topicId}`);

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

    const topicDocRef = firestore.collection('analyses').doc(analysisId).collection('topics').doc(topicId);
    const topicDoc = await topicDocRef.get();
    if (!topicDoc.exists) {
        return res.status(404).json({ success: false, message: `Topic with ID ${topicId} not found for analysis ${analysisId}.` });
    }
    const topicDisplayName = topicDoc.data().topicDisplayName || "current topic";

    const chatHistoryRef = firestore.collection('analyses').doc(analysisId).collection('topics').doc(topicId).collection('chatHistory');
    const chatHistorySnapshot = await chatHistoryRef.orderBy('timestamp', 'asc').get();
    const existingChatHistoryDocs = chatHistorySnapshot.docs;
    const formattedHistory = formatChatHistoryForGemini(existingChatHistoryDocs);

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const userMessageId = `userMsg_${Date.now()}`;
    const userMessageData = {
      role: "user",
      parts: [{ text: userMessageText }],
      timestamp: timestamp,
      messageId: userMessageId,
    };
    await chatHistoryRef.doc(userMessageId).set(userMessageData);
    console.log(`User message stored for topic ${topicId}`);

    const currentChatTurnForPrompt = [...formattedHistory, { role: "user", parts: [{ text: userMessageText }] }];

    const chatPrompt = `
      You are an AI Data Analysis Agent. Continue the conversation based on the history provided.
      The overall analysis is named "${analysisName || 'N/A'}" and the current topic of discussion is "${topicDisplayName}".
      The data you are analyzing primarily concerns: "${dataNatureDescription}".
      
      Data Summary (for context, do not repeat this summary in your answer unless specifically asked):
      ${typeof dataSummaryForPrompts === 'string' ? dataSummaryForPrompts : JSON.stringify(dataSummaryForPrompts, null, 2)}

      Conversation History (most recent user message is last):
      ${currentChatTurnForPrompt.map(m => `${m.role}: ${m.parts[0].text}`).join('\n')}

      Your Response:
      Based on the user's latest message ("${userMessageText}") and the conversation history, provide your response.
      Format your response as a JSON object with the following exact keys:
      - "conciseChatMessage": (String) A brief, direct answer to the user's question, suitable for display in a chat UI.
      - "detailedAnalysisBlock": (Object) A structured block for the main display area, with these keys:
          - "questionAsked": (String) The user's question you are responding to (i.e., "${userMessageText}").
          - "detailedFindings": (String) Your detailed findings, explanations, or analysis related to the question.
          - "specificThoughtProcess": (String) Briefly explain how you arrived at these detailedFindings, referencing the data summary or previous parts of the conversation if relevant.
          - "followUpSuggestions": (Array of strings) Provide 2-3 insightful follow-up questions the user could ask next.

      Interaction Style: Be analytical, insightful, and directly answer the user's question.
    `;

    console.log(`Calling Gemini for chat response on topic: ${topicDisplayName}`);
    let geminiResponsePayload;
    try {
      geminiResponsePayload = await generateContent(
        'gemini-2.5-flash-latest', // MODIFIED MODEL NAME
        chatPrompt,
        {
          responseMimeType: 'application/json',
        }
      );
    } catch (geminiError) {
      console.error(`Gemini API error during chat for topic ${topicId}:`, geminiError);
      return res.status(500).json({ success: false, message: `Failed to get AI response: ${geminiError.message}` });
    }
    
    if (!geminiResponsePayload || !geminiResponsePayload.conciseChatMessage || !geminiResponsePayload.detailedAnalysisBlock ||
        !geminiResponsePayload.detailedAnalysisBlock.detailedFindings) {
        console.error("Gemini response for chat is missing required fields.", geminiResponsePayload);
        return res.status(500).json({ success: false, message: "AI response for chat was incomplete or malformed." });
    }
    console.log(`Gemini chat response received for topic ${topicId}`);

    const modelMessageId = `modelMsg_${Date.now()}`;
    const modelMessageData = {
      role: "model",
      parts: [{ text: geminiResponsePayload.conciseChatMessage }],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      detailedAnalysisBlock: geminiResponsePayload.detailedAnalysisBlock,
      messageId: modelMessageId,
    };
    await chatHistoryRef.doc(modelMessageId).set(modelMessageData);
    console.log(`Model (AI) response stored for topic ${topicId}`);

    const updateTimestamp = admin.firestore.FieldValue.serverTimestamp();
    await topicDocRef.update({ lastUpdatedAt: updateTimestamp });
    await analysisDocRef.update({ lastUpdatedAt: updateTimestamp });

    return res.status(200).json({
      success: true,
      chatMessage: {
        role: "model",
        parts: [{ text: geminiResponsePayload.conciseChatMessage }],
        timestamp: new Date().toISOString(),
        messageId: modelMessageId,
      },
      detailedBlock: geminiResponsePayload.detailedAnalysisBlock,
      message: "AI response generated successfully."
    });

  } catch (error) {
    console.error('Error in /api/chat-on-topic:', error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
