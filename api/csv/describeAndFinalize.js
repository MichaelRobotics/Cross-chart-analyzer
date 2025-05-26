// api/csv/describeAndFinalize.js
import { admin, firestore, storage } from '../_lib/firebaseAdmin';
import { generateContent } from '../_lib/geminiClient';
import Papa from 'papaparse'; // Needed if fetching cleaned data for smallDatasetRawData

/**
 * Handles the final phase of CSV processing:
 * 1. Retrieves analysisId and the previously generated dataSummaryForPrompts from the request.
 * 2. Fetches the analysis document from Firestore.
 * 3. Generates a dataNatureDescription using the Gemini API based on the summary.
 * 4. If the dataset is small (based on row/column count and serialized size),
 * it fetches the cleaned CSV from Storage, parses it, and stores the full cleaned data
 * (as an array of objects) in the Firestore document under `smallDatasetRawData`.
 * 5. Updates the Firestore document with the dataNatureDescription, potentially smallDatasetRawData,
 * and sets the status to "ready_for_topic_analysis".
 * 6. Returns success and relevant final details to the client.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const { analysisId, dataSummaryForPromptsFromPreviousStep } = req.body;

  if (!analysisId) {
    return res.status(400).json({ success: false, message: 'analysisId is required.' });
  }
  if (!dataSummaryForPromptsFromPreviousStep) {
    // While we could fetch this from Firestore, it's more efficient for the client to pass it.
    return res.status(400).json({ success: false, message: 'dataSummaryForPromptsFromPreviousStep is required.' });
  }
  
  const analysisDocRef = firestore.collection('analyses').doc(analysisId);

  try {
    console.log(`Describing and finalizing analysisId: ${analysisId}`);
    const analysisDoc = await analysisDocRef.get();

    if (!analysisDoc.exists) {
      return res.status(404).json({ success: false, message: `Analysis record for ID ${analysisId} not found.` });
    }
    
    const analysisData = analysisDoc.data();
    // Use dataSummaryForPrompts passed from previous step.
    const dataSummaryForPrompts = dataSummaryForPromptsFromPreviousStep;

    // Construct prompt for Gemini to generate dataNatureDescription
    const dataNaturePrompt = `
      Na podstawie następującego podsumowania danych (które zawiera analizę kolumn i spostrzeżenia dotyczące wierszy):
      ${JSON.stringify(dataSummaryForPrompts, null, 2)}
      
      Krótko opisz ogólną naturę tego zbioru danych w 1-2 zdaniach. 
      Zasugeruj 1-2 ogólne typy analizy, do których byłby on najbardziej odpowiedni, biorąc pod uwagę zarówno charakterystyki kolumn, jak i przykładowe spostrzeżenia dotyczące wierszy.
      Opis powinien być zwięzły i informacyjny. Nie używaj formatowania HTML. Odpowiedź powinna być zwykłym tekstem.
    `;
    let dataNatureDescription;
    try {
        // Call Gemini API
        dataNatureDescription = await generateContent(
            'gemini-1.5-flash-preview-05-20', // Corrected model name as per original file
            dataNaturePrompt
            // No responseMimeType needed, expecting plain text
        );
    } catch(geminiError) {
        console.error(`Gemini error during dataNatureDescription generation for ${analysisId}:`, geminiError);
        await analysisDocRef.update({ status: "error_generating_description_ai", error: geminiError.message, lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(500).json({ success: false, message: `Failed to generate data nature description with AI: ${geminiError.message}` });
    }
    console.log(`dataNatureDescription generated for ${analysisId}.`);

    // Prepare data for the final Firestore update
    const finalUpdateData = {
      dataNatureDescription: dataNatureDescription,
      status: "ready_for_topic_analysis", // Mark as ready for next stage
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Logic for storing full cleaned data in Firestore if the dataset is small
    const { rowCount, columnCount, cleanedCsvStoragePath } = analysisData; // These should have been set by generateSummary step
    const SMALL_DATASET_THRESHOLD_CELLS = 200; // e.g., 10 rows * 20 cols
    const SMALL_DATASET_THRESHOLD_JSON_LENGTH = 200000; // Approx 200KB, Firestore field limit is 1MB

    if (rowCount === undefined || columnCount === undefined || !cleanedCsvStoragePath) {
        console.warn(`rowCount, columnCount, or cleanedCsvStoragePath missing for ${analysisId}. Skipping smallDatasetRawData logic.`);
    } else if (rowCount * columnCount <= SMALL_DATASET_THRESHOLD_CELLS) {
        console.log(`Dataset ${analysisId} (${rowCount}x${columnCount}) is small. Attempting to store full cleaned data.`);
        try {
            // Fetch the cleaned CSV data from Firebase Storage
            const [cleanedFileBuffer] = await storage.bucket().file(cleanedCsvStoragePath).download();
            const cleanedCsvString = cleanedFileBuffer.toString('utf-8');
            
            // Parse the cleaned CSV string into an array of objects
            const parseResult = Papa.parse(cleanedCsvString, { 
                header: true, 
                skipEmptyLines: 'greedy', 
                dynamicTyping: true 
            });
            const cleanedDataForFirestore = parseResult.data.filter(row => Object.values(row).some(val => val !== null && val !== undefined && val !== ''));


            // Check if the stringified version of the cleaned data exceeds the JSON length threshold
            const tempStringified = JSON.stringify(cleanedDataForFirestore);
            if (tempStringified.length <= SMALL_DATASET_THRESHOLD_JSON_LENGTH) {
                finalUpdateData.smallDatasetRawData = cleanedDataForFirestore; // Store as an array of objects
                console.log(`Stored full cleanedData (${cleanedDataForFirestore.length} rows) in Firestore for ${analysisId}.`);
            } else {
                console.log(`Small dataset (${rowCount}x${columnCount}), but serialized JSON is too large (${tempStringified.length} bytes) for Firestore field. Not storing full data.`);
                finalUpdateData.smallDatasetRawData = null; // Explicitly set to null if too large
            }
        } catch (error) {
            console.error(`Error processing cleanedData for smallDatasetRawData logic for ${analysisId}:`, error);
            finalUpdateData.smallDatasetRawData = null; // Ensure it's null on error
        }
    } else {
        console.log(`Dataset ${analysisId} (${rowCount}x${columnCount}) is too large for storing full cleanedData in Firestore field.`);
        finalUpdateData.smallDatasetRawData = null; // Explicitly set to null if large
    }

    // Perform the final update to the Firestore document
    await analysisDocRef.update(finalUpdateData);
    console.log(`Analysis record finalized in Firestore for ID: ${analysisId}`);

    // Respond to the client with success and final details
    return res.status(200).json({
      success: true,
      analysisId: analysisId,
      analysisName: analysisData.analysisName, // From initially fetched data
      originalFileName: analysisData.originalFileName, // From initially fetched data
      dataNatureDescription: dataNatureDescription,
      message: "Analysis finalized and is now ready for topic analysis.",
    });

  } catch (error) {
    console.error(`Error in /api/csv/describeAndFinalize for analysisId ${analysisId}:`, error);
    // Attempt to update Firestore with error status if analysisId is known
    if (analysisId) {
        try {
            await analysisDocRef.update({
                status: "error_finalizing_server",
                error: `Server error: ${error.message}`,
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (dbError) {
            console.error(`Failed to update Firestore status on server error (describeAndFinalize) for ${analysisId}:`, dbError);
        }
    }
    return res.status(500).json({ success: false, message: `Server error during finalization: ${error.message}` });
  }
}