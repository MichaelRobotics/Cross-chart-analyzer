// api/initiate-topic-analysis.js
import { admin, firestore } from '../_lib/firebaseAdmin'; // Firebase Admin SDK
import { generateContent } from '../_lib/geminiClient';   // Gemini API client

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { analysisId, topicId, topicDisplayName } = req.body;

    // Validate inputs
    if (!analysisId || !topicId || !topicDisplayName) {
      return res.status(400).json({ success: false, message: 'Missing required fields: analysisId, topicId, or topicDisplayName.' });
    }
    console.log(`Initiating topic analysis for analysisId: ${analysisId}, topicId: ${topicId}, displayName: ${topicDisplayName}`);

    // 1. Fetch the analysis document to get context
    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    const analysisDoc = await analysisDocRef.get();

    if (!analysisDoc.exists) {
      return res.status(404).json({ success: false, message: `Analysis with ID ${analysisId} not found.` });
    }
    const analysisData = analysisDoc.data();
    const { dataSummaryForPrompts, dataNatureDescription } = analysisData;

    if (!dataSummaryForPrompts || !dataNatureDescription) {
      return res.status(400).json({ success: false, message: 'Analysis document is missing dataSummaryForPrompts or dataNatureDescription.' });
    }

    // 2. Check if an initialAnalysisResult for this topicId already exists
    const topicDocRef = firestore.collection('analyses').doc(analysisId).collection('topics').doc(topicId);
    const topicDoc = await topicDocRef.get();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    if (topicDoc.exists && topicDoc.data().initialAnalysisResult) {
      console.log(`Initial analysis for topic ${topicId} already exists. Returning existing data.`);
      return res.status(200).json({
        success: true,
        data: topicDoc.data().initialAnalysisResult,
        message: "Initial analysis for this topic already existed."
      });
    }

    // 3. Create/update the topic document with status "analyzing"
    await topicDocRef.set({
      topicDisplayName: topicDisplayName,
      status: "analyzing",
      createdAt: topicDoc.exists ? topicDoc.data().createdAt : timestamp, 
      lastUpdatedAt: timestamp,
    }, { merge: true }); 

    // 4. Construct the Initial Prompt for Gemini
    const initialPrompt = `
      You are an AI Data Analysis Agent.
      Your mission is to help me perform a cross-analysis and uncover valuable insights related to the topic: "${topicDisplayName}".
      The data you are analyzing primarily concerns: "${dataNatureDescription}".
      Please focus your analysis of "${topicDisplayName}" through this lens, considering the overall nature of the dataset.
      
      About Your Data (summary):
      ${typeof dataSummaryForPrompts === 'string' ? dataSummaryForPrompts : JSON.stringify(dataSummaryForPrompts, null, 2)}

      Your First Response - Initial Analysis & Guidance:
      Provide your analysis formatted as a JSON object with the following exact keys:
      - "initialFindings": (String) Provide your key initial observations and insights related to "${topicDisplayName}" based on the provided data summary. Be concise: aim for 2-3 short paragraphs, each about 2-4 sentences long.
      - "thoughtProcess": (String) Briefly explain the key steps (3-4 points) in your reasoning as a bulleted list (e.g., "- Analyzed X.\n- Compared Y and Z.\n- Concluded A.").
      - "questionSuggestions": (Array of strings) Provide 2-3 concise and insightful follow-up questions the user could ask to delve deeper. Each question should be brief.

      Interaction Style: Be analytical, insightful, and proactive in suggesting next steps. Ensure all text is in Polish.

      Now, please provide your initial analysis for "${topicDisplayName}" based on the dataset summary.
    `;
    
    await topicDocRef.update({ initialPromptSent: initialPrompt });

    // 5. Call Gemini API, requesting JSON output
    console.log(`Calling Gemini for topic: ${topicDisplayName} with model: gemini-2.5-flash-preview-05-20`);
    let initialAnalysisResult;
    try {
      initialAnalysisResult = await generateContent(
        'gemini-2.5-flash-preview-05-20', 
        initialPrompt,
        {
          responseMimeType: 'application/json',
        }
      );
    } catch (geminiError) {
      console.error(`Gemini API error for topic ${topicId}:`, geminiError);
      await topicDocRef.update({ status: "error_initial_analysis", error: geminiError.message, lastUpdatedAt: timestamp });
      return res.status(500).json({ success: false, message: `Failed to generate initial analysis with AI: ${geminiError.message}` });
    }

    if (!initialAnalysisResult || !initialAnalysisResult.initialFindings || !initialAnalysisResult.thoughtProcess || !initialAnalysisResult.questionSuggestions) {
        console.error("Gemini response for initial analysis is missing required fields.", initialAnalysisResult);
        await topicDocRef.update({ status: "error_initial_analysis", error: "AI response missing required fields.", lastUpdatedAt: timestamp });
        return res.status(500).json({ success: false, message: "AI response for initial analysis was incomplete." });
    }
    console.log(`Initial analysis for topic ${topicId} generated successfully.`);

    // 6. Store initialAnalysisResult in the topic document
    await topicDocRef.update({
      initialAnalysisResult: initialAnalysisResult,
      status: "completed",
      lastUpdatedAt: timestamp,
    });

    // 7. Initialize chatHistory subcollection with the first "model" message
    const chatHistoryRef = topicDocRef.collection('chatHistory');
    const firstMessageId = `initialMsg_${Date.now()}`;
    
    await chatHistoryRef.doc(firstMessageId).set({
      role: "model",
      parts: [{ text: initialAnalysisResult.initialFindings }], 
      timestamp: timestamp,
      detailedAnalysisBlock: initialAnalysisResult,
      messageId: firstMessageId
    });
    console.log(`First chat message added for topic ${topicId}`);

    await analysisDocRef.update({ lastUpdatedAt: timestamp });

    return res.status(200).json({
      success: true,
      data: initialAnalysisResult,
      message: "Initial topic analysis completed successfully."
    });

  } catch (error) {
    console.error('Error in /api/initiate-topic-analysis:', error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
