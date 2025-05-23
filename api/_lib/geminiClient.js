// api/_lib/geminiClient.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Get the Gemini API key from environment variables.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set.');
  // Depending on the application's needs, you might throw an error here
  // or allow the application to run in a degraded mode if Gemini is optional.
  // For this project, Gemini is crucial, so throwing an error might be appropriate
  // if an endpoint tries to use it without a key.
}

// Initialize the GoogleGenerativeAI instance with the API key.
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Define default generation configuration.
// These can be overridden on a per-call basis.
const defaultGenerationConfig = {
  temperature: 0.7, // Controls randomness. Lower for more deterministic, higher for more creative.
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048, // Adjust as needed for your use cases
};

// Define default safety settings. Adjust these based on your application's requirements.
const defaultSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Generates content using the Gemini API.
 *
 * @param {string} modelName - The name of the Gemini model to use (e.g., 'gemini-1.5-flash-latest', 'gemini-pro').
 * @param {Array<object|string>|string} promptParts - The prompt, which can be a string or an array of parts (text, image data, etc.).
 * For chat, this will include the chat history.
 * @param {object} [generationConfigOverrides] - Optional overrides for the default generation configuration.
 * If `responseMimeType` is 'application/json', a `responseSchema` should be included here.
 * @param {Array<object>} [safetySettingsOverrides] - Optional overrides for the default safety settings.
 * @returns {Promise<object|string>} - A promise that resolves with the generated content.
 * If JSON is requested, it attempts to parse and return the object.
 * Otherwise, it returns the text content.
 * @throws {Error} - Throws an error if the API call fails or if the API key is not set.
 */
async function generateContent(
  modelName,
  promptParts,
  generationConfigOverrides = {},
  safetySettingsOverrides = {}
) {
  if (!genAI) {
    throw new Error('Gemini API client is not initialized. Check GEMINI_API_KEY.');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings: { ...defaultSafetySettings, ...safetySettingsOverrides },
      generationConfig: { ...defaultGenerationConfig, ...generationConfigOverrides },
    });

    // Construct the request. For simple text prompts, promptParts can be a string.
    // For chat or multimodal, it should be an array of parts.
    // Example for chat: [{role: "user", parts: [{text: "Hi"}]}, {role: "model", parts: [{text: "Hello!"}]}, {role: "user", parts: [{text: "How are you?"}]}]
    // The `generateContent` method handles this structure directly if `promptParts` is the history array.
    // If it's a single prompt string, it can be passed directly or as [{text: promptString}].
    // For this function, we'll assume promptParts is correctly formatted by the caller.
    
    let requestPayload;
    if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && 'role' in part && 'parts' in part)) {
        // This looks like a chat history array
        requestPayload = { contents: promptParts };
    } else if (typeof promptParts === 'string') {
        // Simple text prompt
        requestPayload = { contents: [{ role: "user", parts: [{ text: promptParts }] }] };
    } else if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && ('text' in part || 'inlineData' in part))) {
        // Array of parts for a single turn
        requestPayload = { contents: [{ role: "user", parts: promptParts }] };
    } else {
        throw new Error('Invalid promptParts format. Must be a string, chat history array, or parts array for a single turn.');
    }


    const result = await model.generateContent(requestPayload);
    const response = result.response;

    if (!response || !response.candidates || response.candidates.length === 0) {
      console.warn('Gemini API returned no candidates or an empty response.', response);
      // Check for block reason if available
      if (response && response.promptFeedback && response.promptFeedback.blockReason) {
        throw new Error(`Content generation blocked. Reason: ${response.promptFeedback.blockReason}. Details: ${response.promptFeedback.blockReasonMessage || 'No additional details.'}`);
      }
      throw new Error('Gemini API returned no candidates or an empty response.');
    }
    
    const candidate = response.candidates[0];

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        // Check for block reason if available from candidate
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

    // If JSON output was requested, parse it.
    if (generationConfigOverrides.responseMimeType === 'application/json') {
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
    // Add more specific error handling if needed (e.g., for quota issues, API key errors)
    throw error; // Re-throw the error to be handled by the caller
  }
}

export { generateContent };