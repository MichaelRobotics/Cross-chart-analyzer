// api/_lib/geminiClient.js
// Note: Top-level import for @google/genai is removed. It will be dynamically imported.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set.');
  // Consider the implications for your application if the key is missing.
}

// Default generation configuration can remain top-level as it doesn't depend on the SDK import.
const defaultGenerationConfig = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

// We will define defaultSafetySettings inside generateContent after HarmCategory/HarmBlockThreshold are imported.

/**
 * Generates content using the Gemini API with the @google/genai SDK (dynamically imported).
 *
 * @param {string} modelName - The name of the Gemini model.
 * @param {Array<object|string>|string} promptParts - The prompt or chat history.
 * @param {object} [generationConfigOverrides] - Overrides for generation config.
 * @param {Array<object>} [safetySettingsOverrides] - Full array to override safety settings.
 * @returns {Promise<object|string>} Parsed JSON object or text.
 * @throws {Error} If API call fails, API key is not set, or dynamic import fails.
 */
async function generateContent(
  modelName,
  promptParts,
  generationConfigOverrides = {},
  safetySettingsOverrides = null
) {
  // Dynamically import the @google/genai module
  const genaiModule = await import('@google/genai');
  const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = genaiModule;

  // Initialize genAI instance now that GoogleGenerativeAI is available
  const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

  if (!genAI) {
    throw new Error('Gemini API client could not be initialized. Check GEMINI_API_KEY and ensure @google/genai loaded.');
  }

  // Define default safety settings now that HarmCategory and HarmBlockThreshold are available
  const currentDefaultSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  try {
    const finalSafetySettings = (Array.isArray(safetySettingsOverrides) && safetySettingsOverrides.length > 0)
      ? safetySettingsOverrides
      : currentDefaultSafetySettings; // Use dynamically defined defaults

    const finalGenerationConfig = {
      ...defaultGenerationConfig, // Use top-level defaults
      ...generationConfigOverrides,
    };

    const model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings: finalSafetySettings,
      generationConfig: finalGenerationConfig,
    });

    let contentsForApi;
    if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && 'role' in part && 'parts' in part)) {
      contentsForApi = promptParts;
    } else if (typeof promptParts === 'string') {
      contentsForApi = [{ role: "user", parts: [{ text: promptParts }] }];
    } else if (Array.isArray(promptParts) && promptParts.every(part => typeof part === 'object' && ('text' in part || 'inlineData' in part))) {
      contentsForApi = [{ role: "user", parts: promptParts }];
    } else {
      throw new Error('Invalid promptParts format. Must be a string, chat history array (Content[]), or parts array for a single turn.');
    }
    
    const result = await model.generateContent({ contents: contentsForApi });
    const response = result.response;

    if (!response || !response.candidates || response.candidates.length === 0) {
      console.warn('Gemini API returned no candidates or an empty response.', response);
      if (response && response.promptFeedback && response.promptFeedback.blockReason) {
        throw new Error(`Content generation blocked. Reason: ${response.promptFeedback.blockReason}. Details: ${response.promptFeedback.blockReasonMessage || 'No additional details.'}`);
      }
      throw new Error('Gemini API returned no candidates or an empty response.');
    }
    
    const candidate = response.candidates[0];

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        let message = `Content generation finished with reason: ${candidate.finishReason}.`;
        if (candidate.safetyRatings && candidate.safetyRatings.length > 0) {
            const problematicRatings = candidate.safetyRatings.filter(r => r.blocked || r.probability === 'HIGH' || r.probability === 'MEDIUM');
            if (problematicRatings.length > 0) {
                message += ' Safety issues detected: ' + problematicRatings.map(r => `${r.category} was ${r.probability}`).join(', ');
            }
        }
        if (candidate.finishReason !== 'MAX_TOKENS') {
             console.warn(message);
        }
        if (candidate.finishReason === 'SAFETY') throw new Error(message);
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Gemini API returned a candidate with no content parts. Finish reason: ' + candidate.finishReason);
    }

    const responsePart = candidate.content.parts[0];

    if (generationConfigOverrides.responseMimeType === 'application/json') {
      if (typeof responsePart.text !== 'string') {
        console.error('Gemini response part for JSON request is not text. Received:', responsePart);
        throw new Error('Gemini response part for JSON request is not in the expected text format.');
      }
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
    if (error.message && error.message.includes("API key not valid")) {
        console.error("Please check if your GEMINI_API_KEY is correct and has the necessary permissions.");
    }
    if (error.constructor && error.constructor.name === 'GoogleGenerativeAIResponseError') {
        console.error("Gemini API Response Error Details:", error.response);
    }
    throw error;
  }
}

export { generateContent };