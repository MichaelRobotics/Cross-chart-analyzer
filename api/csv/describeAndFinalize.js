// api/csv/describeAndFinalize.js
import { admin, firestore } from '../_lib/firebaseAdmin';
import { generateContent } from '../_lib/geminiClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { analysisId, dataSummaryForPrompts } = req.body;

    if (!analysisId || !dataSummaryForPrompts) {
      return res.status(400).json({ success: false, message: 'Missing required fields: analysisId or dataSummaryForPrompts.' });
    }

    console.log(`Generating data nature description for analysis ID: ${analysisId}`);

    // Generate data nature description using Gemini
    const dataNaturePrompt = `
      Na podstawie następującego podsumowania danych (które zawiera analizę kolumn i spostrzeżenia dotyczące wierszy):
      ${JSON.stringify(dataSummaryForPrompts, null, 2)}
      
      Krótko opisz ogólną naturę tego zbioru danych w 1-2 zdaniach. 
      Zasugeruj 1-2 ogólne typy analizy, do których byłby on najbardziej odpowiedni, biorąc pod uwagę zarówno charakterystyki kolumn, jak i przykładowe spostrzeżenia dotyczące wierszy.
      Opis powinien być zwięzły i informacyjny. Nie używaj formatowania HTML. Odpowiedź powinna być zwykłym tekstem.
    `;

    let dataNatureDescription;
    try {
      dataNatureDescription = await generateContent(
        'gemini-2.5-flash-preview-05-20',
        dataNaturePrompt
      );
    } catch(geminiError) {
      console.error("Gemini error during dataNatureDescription generation:", geminiError);
      return res.status(500).json({ success: false, message: `Failed to generate data nature description with AI: ${geminiError.message}` });
    }
    console.log('dataNatureDescription generated successfully.');

    // Finalize the analysis document
    const analysisDocRef = firestore.collection('analyses').doc(analysisId);
    await analysisDocRef.update({
      dataNatureDescription: dataNatureDescription,
      status: "ready_for_topic_analysis",
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Get the full analysis document to return complete data
    const analysisDoc = await analysisDocRef.get();
    const analysisData = analysisDoc.data();

    console.log(`Analysis finalized and ready for topic analysis. ID: ${analysisId}`);

    return res.status(200).json({
      success: true,
      analysisId: analysisId,
      analysisName: analysisData.analysisName,
      originalFileName: analysisData.originalFileName,
      dataNatureDescription: dataNatureDescription,
      message: "Analysis created successfully and ready for topic analysis."
    });

  } catch (error) {
    console.error('Error in /api/csv/describeAndFinalize:', error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}