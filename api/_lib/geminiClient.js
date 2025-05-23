// api/_lib/geminiClient.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Get the Gemini API key from environment variables.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set.');
  // For this project, Gemini is crucial.
}

// Initialize the GoogleGenerativeAI instance with the API key.
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Define default generation configuration.
const defaultGenerationConfig = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048, // Adjust as needed
};

// Define default safety settings as an array.
const defaultSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Generates content using the Gemini API.
 */
async function generateContent(
  modelName,
  promptParts,
  generationConfigOverrides = {}, // e.g., { responseMimeType: 'application/json' }
  safetySettingsOverrides = null  // Expect a full array for override, or null/undefined to use default
) {
  if (!genAI) {
    throw new Error('Gemini API client is not initialized. Check GEMINI_API_KEY.');
  }

  try {
    // Determine final safety settings: use overrides if provided as a valid array, else use defaults.
    const finalSafetySettings = (Array.isArray(safetySettingsOverrides) && safetySettingsOverrides.length > 0)
      ? safetySettingsOverrides
      : defaultSafetySettings;

    // Initialize the model. Pass basic generation config here if needed,
    // but specific overrides like responseMimeType will be in the generateContent call.
    const model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings: finalSafetySettings, // Pass the array directly
      // generationConfig: defaultGenerationConfig // Pass only basic defaults here
    });

    // Construct the request payload's `contents` part
    let contentsPayload;
    if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && 'role' in part && 'parts' in part)) {
      contentsPayload = promptParts; // Looks like chat history
    } else if (typeof promptParts === 'string') {
      contentsPayload = [{ role: "user", parts: [{ text: promptParts }] }]; // Simple text prompt
    } else if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && ('text' in part || 'inlineData' in part))) {
      contentsPayload = [{ role: "user", parts: promptParts }]; // Array of parts for a single turn
    } else {
      throw new Error('Invalid promptParts format. Must be a string, chat history array, or parts array for a single turn.');
    }

    // Prepare the full request for model.generateContent()
    // This allows specifying generationConfig (with responseMimeType) per request.
    const request = {
      contents: contentsPayload,
      generationConfig: { ...defaultGenerationConfig, ...generationConfigOverrides },
      // Safety settings are already applied at model level, but can be overridden here too if needed:
      // safetySettings: finalSafetySettings,
    };
    
    const result = await model.generateContent(request);
    const response = result.response;

    if (!response || !response.candidates || response.candidates.length === 0) {
      console.warn('Gemini API returned no candidates or an empty response.', response);
      if (response && response.promptFeedback && response.promptFeedback.blockReason) {
        throw new Error(`Content generation blocked. Reason: ${response.promptFeedback.blockReason}. Details: ${response.promptFeedback.blockReasonMessage || 'No additional details.'}`);
      }
      throw new Error('Gemini API returned no candidates or an empty response.');
    }
    
    const candidate = response.candidates[0];

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'OTHER') {
           let safetyMessage = 'Content generation stopped.';
           if (candidate.safetyRatings && candidate.safetyRatings.length > 0) {
               safetyMessage += ' Safety ratings: ' + candidate.safetyRatings.map(r => `${r.category} was ${r.probability}`).join(', ');
           }
          throw new Error(safetyMessage);
      }
      throw new Error('Gemini API returned a candidate with no content parts.');
    }

    const responsePart = candidate.content.parts[0];

    if (request.generationConfig.responseMimeType === 'application/json') {
      try {
        return JSON.parse(responsePart.text);
      } catch (e) {
        console.error('Failed to parse Gemini JSON response:', e);
        console.error('Raw Gemini response text:', responsePart.text);
        throw new Error('Failed to parse JSON response from Gemini API.');
      }
    }
    return responsePart.text;

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

export { generateContent };
