// api/chat-on-topic.js
import { admin, firestore } from './_lib/firebaseAdmin'; // Firebase Admin SDK
import { generateContent } from './_lib/geminiClient';   // Gemini API client

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
    const { dataSummaryForPrompts, dataNatureDescription, analysisName, smallDatasetRawData = null } = analysisData;


    if (!dataSummaryForPrompts || !dataNatureDescription) {
      return res.status(400).json({ success: false, message: 'Analysis document is missing dataSummaryForPrompts or dataNatureDescription.' });
    }

    const topicDocRef = firestore.collection('analyses').doc(analysisId).collection('topics').doc(topicId);
    const topicDoc = await topicDocRef.get();
    if (!topicDoc.exists) {
        return res.status(404).json({ success: false, message: `Topic with ID ${topicId} not found for analysis ${analysisId}.` });
    }
    const topicDisplayName = topicDoc.data().topicDisplayName || "current topic";

    const chatHistoryRef = topicDocRef.collection('chatHistory');
    
    const userTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const userMessageId = `userMsg_${Date.now()}`; 
    const userMessageData = {
      role: "user",
      parts: [{ text: userMessageText }], 
      timestamp: userTimestamp,
      messageId: userMessageId, 
    };
    await chatHistoryRef.doc(userMessageId).set(userMessageData);
    console.log(`User message stored for topic ${topicId}, ID: ${userMessageId}`);

    const chatHistorySnapshot = await chatHistoryRef.orderBy('timestamp', 'asc').get();
    const existingChatHistoryDocs = chatHistorySnapshot.docs;
    const formattedHistory = formatChatHistoryForGemini(existingChatHistoryDocs);

    // Determine if we use full data or just summary for data context in chat
    let dataContextForChatPrompt;
    if (smallDatasetRawData && Array.isArray(smallDatasetRawData) && smallDatasetRawData.length > 0) {
        const dataForPrompt = smallDatasetRawData.map(row => 
            Object.fromEntries(
                Object.entries(row).map(([key, value]) => [key, String(value).slice(0, 150)])
            )
        );
        dataContextForChatPrompt = `
Pełne dane (lub reprezentatywna próbka) dla tej analizy (format JSON):
${JSON.stringify(dataForPrompt, null, 2)}

Dodatkowo, podsumowanie statystyczne kolumn (zawierające także spostrzeżenia dotyczące wierszy z próbki i obserwacje ogólne):
${JSON.stringify(dataSummaryForPrompts, null, 2)}
`;
        console.log(`Using full small dataset (${smallDatasetRawData.length} rows) and extended summary in prompt for chat.`);
    } else {
        dataContextForChatPrompt = `
Podsumowanie statystyczne kolumn (zawierające także spostrzeżenia dotyczące wierszy z próbki i obserwacje ogólne):
${JSON.stringify(dataSummaryForPrompts, null, 2)}
`;
        console.log(`Using extended data summary (with row insights) in prompt for chat.`);
    }

    const chatPrompt = `
      Jesteś Agentem AI do Analizy Danych. Kontynuuj rozmowę na podstawie dostarczonej historii.
      Ogólna analiza nosi nazwę "${analysisName || 'N/A'}", a bieżący temat dyskusji to "${topicDisplayName}".
      Dane, które analizujesz, dotyczą przede wszystkim: "${dataNatureDescription}".
      
      O Twoich Danych (kontekst zawiera podsumowanie kolumn, spostrzeżenia o wierszach z próbki, a czasem pełne dane jeśli zbiór jest mały):
      ${dataContextForChatPrompt}

      Historia Rozmowy (ostatnia wiadomość użytkownika jest na końcu):
      ${formattedHistory.map(m => `${m.role}: ${m.parts.map(p => p.text).join(' ')}`).join('\n')}

      Twoja Odpowiedź:
      Na podstawie ostatniej wiadomości użytkownika ("${userMessageText}") i historii rozmowy (oraz dostarczonych danych, w tym pełnych danych lub 'rowInsights' jeśli dostępne), udziel odpowiedzi. Odnoś się do konkretnych wartości w komórkach [wiersz, kolumna], jeśli to istotne i dane na to pozwalają.
      Sformatuj swoją odpowiedź jako obiekt JSON z następującymi dokładnymi kluczami:
      - "conciseChatMessage": (String) Krótka, bezpośrednia odpowiedź na pytanie użytkownika, odpowiednia do wyświetlenia w interfejsie czatu. Powinien to być zwykły tekst. WAŻNE: Odpowiedź MUSI być w języku polskim.
      - "detailedAnalysisBlock": (Object) Strukturalny blok dla głównego obszaru wyświetlania, z tymi kluczami:
          - "questionAsked": (String) Pytanie użytkownika, na które odpowiadasz (tj. "${userMessageText}"). Powinien to być zwykły tekst.
          - "detailedFindings": (String) Twoje szczegółowe ustalenia, wyjaśnienia lub analizy związane z pytaniem. Ten ciąg znaków powinien być sformatowany za pomocą tagów HTML dla akapitów (np. "<p>Ustalenie 1.</p><p>Ustalenie 2.</p>"). Kiedy odnosisz się do nazw kolumn (np. OperatorWorkload_%, TasksCompleted), NIE używaj odwrotnych apostrofów. Zamiast tego, otocz dokładną nazwę kolumny tagiem <span class="column-name-highlight"></span>. WAŻNE: Cała wartość ciągu znaków dla "detailedFindings" musi być prawidłowym ciągiem JSON. Wszelkie cudzysłowy (") w treści lub atrybutach HTML MUSZĄ być poprzedzone znakiem ucieczki jako \\".
          - "specificThoughtProcess": (String) Krótko wyjaśnij, jak doszedłeś do tych szczegółowych ustaleń. Ten ciąg znaków powinien być sformatowany jako nieuporządkowana lista HTML (np. "<ul><li>Krok pierwszy wyjaśniający \\"dlaczego\\".</li><li>Krok drugi.</li><li>Krok trzeci.</li></ul>") zawierająca dokładnie 3 punkty. Kiedy odnosisz się do nazw kolumn, użyj tagu <span class="column-name-highlight"></span>. WAŻNE: Cała wartość ciągu znaków dla "specificThoughtProcess" musi być prawidłowym ciągiem JSON. Wszelkie cudzysłowy (") w treści lub atrybutach HTML MUSZĄ być poprzedzone znakiem ucieczki jako \\".
          - "followUpSuggestions": (Array of strings) Podaj 2-3 wnikliwe pytania uzupełniające (zwykły tekst). NIE używaj odwrotnych apostrofów ani tagów span HTML dla nazw kolumn w tych sugestiach.

      Styl Interakcji: Bądź analityczny, wnikliwy i bezpośrednio odpowiadaj na pytanie użytkownika.
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
      return res.status(500).json({ success: false, message: `Failed to get AI response: ${geminiError.message}` });
    }
    
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

    const modelTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const modelMessageId = `modelMsg_${Date.now()}`; 
    const modelMessageData = {
      role: "model",
      parts: [{ text: geminiResponsePayload.conciseChatMessage }], 
      timestamp: modelTimestamp,
      detailedAnalysisBlock: geminiResponsePayload.detailedAnalysisBlock, 
      messageId: modelMessageId, 
    };
    await chatHistoryRef.doc(modelMessageId).set(modelMessageData);
    console.log(`Model (AI) response stored for topic ${topicId}, ID: ${modelMessageId}`);

    await topicDocRef.update({ lastUpdatedAt: modelTimestamp });
    await analysisDocRef.update({ lastUpdatedAt: modelTimestamp });

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