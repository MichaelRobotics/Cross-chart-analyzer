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
      Jesteś Agentem AI do Analizy Danych. Kontynuuj rozmowę na podstawie dostarczonej historii.
      Ogólna analiza nosi nazwę "${analysisName || 'N/A'}", a bieżący temat dyskusji to "${topicDisplayName}".
      Dane, które analizujesz, dotyczą przede wszystkim: "${dataNatureDescription}".
      
      Podsumowanie Danych (dla kontekstu, nie powtarzaj tego podsumowania w odpowiedzi, chyba że zostaniesz o to wyraźnie poproszony):
      ${typeof dataSummaryForPrompts === 'string' ? dataSummaryForPrompts : JSON.stringify(dataSummaryForPrompts, null, 2)}

      Historia Rozmowy (ostatnia wiadomość użytkownika jest na końcu):
      ${formattedHistory.map(m => `${m.role}: ${m.parts.map(p => p.text).join(' ')}`).join('\n')}

      Twoja Odpowiedź:
      Na podstawie ostatniej wiadomości użytkownika ("${userMessageText}") i historii rozmowy, udziel odpowiedzi.
      Sformatuj swoją odpowiedź jako obiekt JSON z następującymi dokładnymi kluczami:
      - "conciseChatMessage": (String) Krótka, bezpośrednia odpowiedź na pytanie użytkownika, odpowiednia do wyświetlenia w interfejsie czatu. Powinien to być zwykły tekst.
      - "detailedAnalysisBlock": (Object) Strukturalny blok dla głównego obszaru wyświetlania, z tymi kluczami:
          - "questionAsked": (String) Pytanie użytkownika, na które odpowiadasz (tj. "${userMessageText}"). Powinien to być zwykły tekst.
          - "detailedFindings": (String) Twoje szczegółowe ustalenia, wyjaśnienia lub analizy związane z pytaniem. Ten ciąg znaków powinien być sformatowany za pomocą tagów HTML dla akapitów (np. "<p>Ustalenie 1.</p><p>Ustalenie 2.</p>"). Kiedy odnosisz się do nazw kolumn z podsumowania danych (np. OperatorWorkload_%, TasksCompleted), NIE używaj odwrotnych apostrofów. Zamiast tego, otocz dokładną nazwę kolumny tagiem <span class="column-name-highlight"></span>. Na przykład, jeśli odnosisz się do 'OperatorWorkload_%', zapisz to jako <span class="column-name-highlight">OperatorWorkload_%</span>. WAŻNE: Cała wartość ciągu znaków dla "detailedFindings" musi być prawidłowym ciągiem JSON. Oznacza to, że wszelkie cudzysłowy (") będące częścią treści tekstowej lub atrybutów w HTML (w tym atrybutu class w tagu span) MUSZĄ być poprzedzone znakiem ucieczki jako \\".
          - "specificThoughtProcess": (String) Krótko wyjaśnij, jak doszedłeś do tych szczegółowych ustaleń, odwołując się do podsumowania danych lub poprzednich części rozmowy, jeśli to istotne. Ten ciąg znaków powinien być sformatowany jako nieuporządkowana lista HTML (np. "<ul><li>Krok pierwszy wyjaśniający \\"dlaczego\\".</li><li>Krok drugi.</li><li>Krok trzeci.</li></ul>") zawierająca dokładnie 3 punkty. Kiedy odnosisz się do nazw kolumn, NIE używaj odwrotnych apostrofów. Zamiast tego, otocz dokładną nazwę kolumny tagiem <span class="column-name-highlight"></span>, jak opisano powyżej. WAŻNE: Cała wartość ciągu znaków dla "specificThoughtProcess" musi być prawidłowym ciągiem JSON. Oznacza to, że wszelkie cudzysłowy (") będące częścią treści tekstowej lub atrybutów w elementach listy HTML (w tym atrybutu class w tagu span) MUSZĄ być poprzedzone znakiem ucieczki jako \\".
          - "followUpSuggestions": (Array of strings) Podaj 2-3 wnikliwe pytania uzupełniające (w formie zwykłego tekstu), które użytkownik mógłby zadać następnie. Każdy ciąg znaków w tablicy powinien być prostym pytaniem tekstowym bez żadnych znaczników HTML. NIE używaj odwrotnych apostrofów ani tagów span HTML dla nazw kolumn w tych sugestiach; używaj po prostu zwykłej nazwy kolumny.

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