// api/initiate-topic-analysis.js
import { admin, firestore } from './_lib/firebaseAdmin'; // Firebase Admin SDK
import { generateContent } from './_lib/geminiClient';   // Gemini API client

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  let topicDocRef; // Declare here to be accessible in catch block

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

    // 2. Define topicDocRef and check if an initialAnalysisResult for this topicId already exists
    topicDocRef = firestore.collection('analyses').doc(analysisId).collection('topics').doc(topicId);
    const topicDoc = await topicDocRef.get();
    const initialTimestamp = admin.firestore.FieldValue.serverTimestamp(); // Timestamp for creation or initial update

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
      createdAt: topicDoc.exists ? topicDoc.data().createdAt || initialTimestamp : initialTimestamp, // Preserve original createdAt or use new
      lastUpdatedAt: initialTimestamp,
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
      - "initialFindings": (String) Your key initial observations, insights, or hypotheses related to "${topicDisplayName}" based on the provided data summary. This string should be formatted with HTML tags for paragraphs (e.g., "<p>Insight 1.</p><p>Insight 2.</p>"). When referring to column names from the data summary (e.g., OperatorWorkload_%, TasksCompleted), do NOT use backticks. Instead, wrap the exact column name in <span class="column-name-highlight"></span>. For example, if referring to 'OperatorWorkload_%', write it as <span class="column-name-highlight">OperatorWorkload_%</span>. IMPORTANT: The entire string value for "initialFindings" must be a valid JSON string. This means any double quotes (") that are part of the text content or attributes within the HTML (including the class attribute in the span) MUST be escaped as \\". For example, if a paragraph is '<p>He said "More data!".</p>', it should be represented in the string as "<p>He said \\"More data!\\".</p>".
      - "thoughtProcess": (String) Briefly explain the steps or reasoning you took to arrive at these initialFindings. Mention which parts of the data summary were most relevant. This string should be formatted as an HTML unordered list (e.g., "<ul><li>Step one explaining \\"why\\".</li><li>Step two.</li><li>Step three.</li></ul>") containing exactly 3 bullet points. When referring to column names, do NOT use backticks. Instead, wrap the exact column name in <span class="column-name-highlight"></span> as described above. IMPORTANT: The entire string value for "thoughtProcess" must be a valid JSON string. This means any double quotes (") that are part of the text content or attributes within the HTML list items (including the class attribute in the span) MUST be escaped as \\".
      - "questionSuggestions": (Array of strings) Provide 3-5 insightful plain text follow-up questions the user could ask to delve deeper into "${topicDisplayName}" or explore related aspects. These questions should be actionable and based on your initial findings or the data's nature. Each string in the array should be a simple textual question without any HTML markup. Do NOT use backticks or HTML spans for column names in these suggestions; just use the plain column name.

      Interaction Style: Be analytical, insightful, and proactive in suggesting next steps.

      Now, please provide your initial analysis for "${topicDisplayName}" based on the dataset summary.
    `;
    
    await topicDocRef.update({ initialPromptSent: initialPrompt });

    // 5. Call Gemini API, requesting JSON output
    console.log(`Calling Gemini for topic: ${topicDisplayName}`);
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
      await topicDocRef.update({ status: "error_initial_analysis", error: geminiError.message, lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(500).json({ success: false, message: `Failed to generate initial analysis with AI: ${geminiError.message}` });
    }

    if (!initialAnalysisResult || !initialAnalysisResult.initialFindings || !initialAnalysisResult.thoughtProcess || !initialAnalysisResult.questionSuggestions) {
        console.error("Gemini response for initial analysis is missing required fields.", initialAnalysisResult);
        await topicDocRef.update({ status: "error_initial_analysis", error: "AI response missing required fields.", lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(500).json({ success: false, message: "AI response for initial analysis was incomplete." });
    }
    console.log(`Initial analysis for topic ${topicId} generated successfully.`);
    
    const finalTimestamp = admin.firestore.FieldValue.serverTimestamp(); // Timestamp for completion

    // 6. Store initialAnalysisResult in the topic document
    await topicDocRef.update({
      initialAnalysisResult: initialAnalysisResult,
      status: "completed",
      lastUpdatedAt: finalTimestamp,
    });

    // 7. Initialize chatHistory subcollection with the first "model" message
    const chatHistoryRef = topicDocRef.collection('chatHistory');
    const firstMessageId = `initialMsg_${Date.now()}`; // Unique ID for the message
    
    await chatHistoryRef.doc(firstMessageId).set({
      role: "model",
      parts: [{ text: initialAnalysisResult.initialFindings }], // Storing HTML here, as per prompt
      timestamp: finalTimestamp, // Use the same timestamp for consistency
      detailedAnalysisBlock: initialAnalysisResult, // Contains HTML formatted strings
      messageId: firstMessageId // Store the ID within the document as well
    });
    console.log(`First chat message added for topic ${topicId}`);

    // Update lastUpdatedAt for the parent analysis document
    await analysisDocRef.update({ lastUpdatedAt: finalTimestamp });

    return res.status(200).json({
      success: true,
      data: initialAnalysisResult,
      message: "Initial topic analysis completed successfully."
    });

  } catch (error) {
    console.error('Error in /api/initiate-topic-analysis:', error);
    // Ensure a server timestamp is used if an error occurs
    const errorTimestamp = admin.firestore.FieldValue.serverTimestamp();
    if (topicDocRef && typeof topicDocRef.update === 'function') { 
        try {
            // Update status to indicate error, and log the error message
            await topicDocRef.update({ status: "error_server", error: error.message, lastUpdatedAt: errorTimestamp });
        } catch (updateError) {
            console.error('Failed to update topic status on server error:', updateError);
        }
    }
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}
