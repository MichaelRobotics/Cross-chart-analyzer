// api/_lib/geminiClient.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set.');
  // Consider throwing an error if the application cannot function without Gemini
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Default generation configuration.
// Specific calls can override these.
const defaultGenerationConfig = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048, // Default, can be overridden
};

// Default safety settings.
const defaultSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Generates content using the Gemini API.
 *
 * @param {string} modelName - The name of the Gemini model (e.g., 'gemini-1.5-flash-latest').
 * @param {Array<object|string>|string} promptParts - The prompt or chat history.
 * @param {object} [generationConfigOverrides] - Overrides for generation config.
 * Example: { responseMimeType: 'application/json', maxOutputTokens: 4096 }
 * @param {Array<object>} [safetySettingsOverrides] - Full array to override safety settings.
 * @returns {Promise<object|string>} Parsed JSON object if 'application/json' was requested, otherwise text.
 * @throws {Error} If API call fails or API key is not set.
 */
async function generateContent(
  modelName,
  promptParts,
  generationConfigOverrides = {},
  safetySettingsOverrides = null // Pass a full array to override, or null/undefined to use defaults
) {
  if (!genAI) {
    throw new Error('Gemini API client is not initialized. Check GEMINI_API_KEY.');
  }

  try {
    const finalSafetySettings = (Array.isArray(safetySettingsOverrides) && safetySettingsOverrides.length > 0)
      ? safetySettingsOverrides
      : defaultSafetySettings;

    // Merge default generation config with any overrides.
    // With a newer SDK, responseMimeType should be a valid part of generationConfig.
    const finalGenerationConfig = {
      ...defaultGenerationConfig,
      ...generationConfigOverrides, // This will include responseMimeType if provided
    };

    const model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings: finalSafetySettings,
      generationConfig: finalGenerationConfig, // Pass the merged config here
    });

    let contentsPayload;
    // Standardize promptParts to the 'contents' array structure
    if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && 'role' in part && 'parts' in part)) {
      // Looks like chat history, pass as is
      contentsPayload = promptParts;
    } else if (typeof promptParts === 'string') {
      // Single string prompt
      contentsPayload = [{ role: "user", parts: [{ text: promptParts }] }];
    } else if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && ('text' in part || 'inlineData' in part))) {
      // Array of parts for a single turn (e.g., multimodal)
      contentsPayload = [{ role: "user", parts: promptParts }];
    } else {
      throw new Error('Invalid promptParts format. Must be a string, chat history array, or parts array for a single turn.');
    }
    
    const result = await model.generateContent({ contents: contentsPayload }); // Pass contents directly
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
           let safetyMessage = `Content generation stopped due to ${candidate.finishReason}.`;
           if (candidate.safetyRatings && candidate.safetyRatings.length > 0) {
               safetyMessage += ' Safety ratings: ' + candidate.safetyRatings.map(r => `${r.category} was ${r.probability}`).join(', ');
           }
          throw new Error(safetyMessage);
      }
      throw new Error('Gemini API returned a candidate with no content parts.');
    }

    const responsePart = candidate.content.parts[0];

    // Check the intended responseMimeType from the overrides to decide on parsing
    if (generationConfigOverrides.responseMimeType === 'application/json') {
      try {
        return JSON.parse(responsePart.text);
      } catch (e) {
        console.error('Failed to parse Gemini JSON response:', e);
        console.error('Raw Gemini response text for JSON request:', responsePart.text);
        throw new Error(`Failed to parse expected JSON response from Gemini API. Raw text: "${responsePart.text.substring(0,100)}..."`);
      }
    }
    return responsePart.text;

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    // Log the full error object if it has more details, e.g. error.response or error.details
    if (error.message && error.message.includes("API key not valid")) {
        console.error("Please check if your GEMINI_API_KEY is correct and has the necessary permissions.");
    }
    throw error;
  }
}

export { generateContent };
