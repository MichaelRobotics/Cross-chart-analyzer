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
      Jesteś Agentem AI do Analizy Danych.
      Twoim zadaniem jest pomóc mi przeprowadzić analizę krzyżową i odkryć cenne spostrzeżenia związane z tematem: "${topicDisplayName}".
      Dane, które analizujesz, dotyczą przede wszystkim: "${dataNatureDescription}".
      Skup swoją analizę tematu "${topicDisplayName}" przez ten pryzmat, biorąc pod uwagę ogólną naturę zbioru danych.
      
      O Twoich Danych (podsumowanie):
      ${typeof dataSummaryForPrompts === 'string' ? dataSummaryForPrompts : JSON.stringify(dataSummaryForPrompts, null, 2)}

      Twoja Pierwsza Odpowiedź - Wstępna Analiza i Wskazówki:
      Dostarcz swoją analizę sformatowaną jako obiekt JSON z następującymi dokładnymi kluczami:
      - "initialFindings": (String) Twoje kluczowe wstępne obserwacje, spostrzeżenia lub hipotezy związane z "${topicDisplayName}" na podstawie dostarczonego podsumowania danych. Ten ciąg znaków powinien być sformatowany za pomocą tagów HTML dla akapitów (np. "<p>Spostrzeżenie 1.</p><p>Spostrzeżenie 2.</p>"). Kiedy odnosisz się do nazw kolumn z podsumowania danych (np. OperatorWorkload_%, TasksCompleted), NIE używaj odwrotnych apostrofów. Zamiast tego, otocz dokładną nazwę kolumny tagiem <span class="column-name-highlight"></span>. Na przykład, jeśli odnosisz się do 'OperatorWorkload_%', zapisz to jako <span class="column-name-highlight">OperatorWorkload_%</span>. WAŻNE: Cała wartość ciągu znaków dla "initialFindings" musi być prawidłowym ciągiem JSON. Oznacza to, że wszelkie cudzysłowy (") będące częścią treści tekstowej lub atrybutów w HTML (w tym atrybutu class w tagu span) MUSZĄ być poprzedzone znakiem ucieczki jako \\". Na przykład, jeśli akapit to '<p>Powiedział "Więcej danych!".</p>', powinien być reprezentowany w ciągu jako "<p>Powiedział \\"Więcej danych!\\".</p>".
      - "thoughtProcess": (String) Krótko wyjaśnij kroki lub rozumowanie, które doprowadziły Cię do tych wstępnych ustaleń. Wspomnij, które części podsumowania danych były najbardziej istotne. Ten ciąg znaków powinien być sformatowany jako nieuporządkowana lista HTML (np. "<ul><li>Krok pierwszy wyjaśniający \\"dlaczego\\".</li><li>Krok drugi.</li><li>Krok trzeci.</li></ul>") zawierająca dokładnie 3 punkty. Kiedy odnosisz się do nazw kolumn, NIE używaj odwrotnych apostrofów. Zamiast tego, otocz dokładną nazwę kolumny tagiem <span class="column-name-highlight"></span>, jak opisano powyżej. WAŻNE: Cała wartość ciągu znaków для "thoughtProcess" musi być prawidłowym ciągiem JSON. Oznacza to, że wszelkie cudzysłowy (") będące częścią treści tekstowej lub atrybutów w elementach listy HTML (w tym atrybutu class w tagu span) MUSZĄ być poprzedzone znakiem ucieczki jako \\".
      - "questionSuggestions": (Array of strings) Podaj 3-5 wnikliwych pytań uzupełniających (w formie zwykłego tekstu), które użytkownik mógłby zadać, aby zagłębić się w temat "${topicDisplayName}" lub zbadać powiązane aspekty. Pytania te powinny być praktyczne i oparte na Twoich wstępnych ustaleniach lub naturze danych. Każdy ciąg znaków w tablicy powinien być prostym pytaniem tekstowym bez żadnych znaczników HTML. NIE używaj odwrotnych apostrofów ani tagów span HTML dla nazw kolumn w tych sugestiach; używaj po prostu zwykłej nazwy kolumny.

      Styl Interakcji: Bądź analityczny, wnikliwy i proaktywny w sugerowaniu kolejnych kroków.

      Teraz proszę, przedstaw swoją wstępną analizę dla tematu "${topicDisplayName}" na podstawie podsumowania zbioru danych.
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
      parts: [{ text: "Witaj! Jestem Agentem AI do analizy danych. Jak mogę pomóc Ci dzisiaj?" }], // Storing HTML here, as per prompt
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