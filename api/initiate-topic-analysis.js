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
      createdAt: topicDoc.exists ? topicDoc.data().createdAt : timestamp, // Preserve original createdAt if doc existed partially
      lastUpdatedAt: timestamp,
    }, { merge: true }); // Merge true to avoid overwriting other fields if doc partially existed

    // 4. Construct the Initial Prompt for Gemini
    // This should align with "AI Agent Specification" and "End-to-End Flow: Initial Topic Analysis"
    const initialPrompt = `
      You are an AI Data Analysis Agent.
      Your mission is to help me perform a cross-analysis and uncover valuable insights related to the topic: "${topicDisplayName}".
      The data you are analyzing primarily concerns: "${dataNatureDescription}".
      Please focus your analysis of "${topicDisplayName}" through this lens, considering the overall nature of the dataset.
      
      About Your Data (summary):
      ${typeof dataSummaryForPrompts === 'string' ? dataSummaryForPrompts : JSON.stringify(dataSummaryForPrompts, null, 2)}

      Your First Response - Initial Analysis & Guidance:
      Provide your analysis formatted as a JSON object with the following exact keys:
      - "initialFindings": (String) Your key initial observations, insights, or hypotheses related to "${topicDisplayName}" based on the provided data summary. This should be a comprehensive textual summary.
      - "thoughtProcess": (String) Briefly explain the steps or reasoning you took to arrive at these initialFindings. Mention which parts of the data summary were most relevant.
      - "questionSuggestions": (Array of strings) Provide 3-5 insightful follow-up questions the user could ask to delve deeper into "${topicDisplayName}" or explore related aspects. These questions should be actionable and based on your initial findings or the data's nature.

      Interaction Style: Be analytical, insightful, and proactive in suggesting next steps.

      Now, please provide your initial analysis for "${topicDisplayName}" based on the dataset summary.
    `;
    
    // Store the prompt for auditing/debugging (optional, but good practice)
    await topicDocRef.update({ initialPromptSent: initialPrompt });

    // 5. Call Gemini API, requesting JSON output
    console.log(`Calling Gemini for topic: ${topicDisplayName}`);
    let initialAnalysisResult;
    try {
      initialAnalysisResult = await generateContent(
        'gemini-1.5-flash-latest', // Or your preferred model
        initialPrompt,
        {
          responseMimeType: 'application/json',
          // Optional: Define responseSchema if you want to be very strict.
          // responseSchema: {
          //   type: "OBJECT",
          //   properties: {
          //     initialFindings: { type: "STRING" },
          //     thoughtProcess: { type: "STRING" },
          //     questionSuggestions: { type: "ARRAY", items: { type: "STRING" } }
          //   },
          //   required: ["initialFindings", "thoughtProcess", "questionSuggestions"]
          // }
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
    const firstMessageId = `initialMsg_${Date.now()}`; // Generate a unique ID for the first message
    
    await chatHistoryRef.doc(firstMessageId).set({
      role: "model",
      parts: [{ text: initialAnalysisResult.initialFindings }], // Use full findings as first chat message
      timestamp: timestamp,
      detailedAnalysisBlock: initialAnalysisResult, // The full initial result serves as the detailed block for this first interaction
      messageId: firstMessageId // Storing the ID within the document as well
    });
    console.log(`First chat message added for topic ${topicId}`);

    // Update lastUpdatedAt for the parent analysis document
    await analysisDocRef.update({ lastUpdatedAt: timestamp });

    // 8. Return success response with the initialAnalysisResult
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