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
  const importedModule = await import('@google/genai');
  
  // Access the actual exports. Many ESM modules, when dynamically imported into CJS-like envs,
  // might place their named exports on a 'default' object. Fallback to the module itself.
  const exports = importedModule.default || importedModule;
  
  const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = exports;

  if (typeof GoogleGenAI !== 'function') {
    console.error("GoogleGenAI is not a constructor or not found. Imported module structure:", JSON.stringify(importedModule, null, 2));
    throw new Error('Failed to load GoogleGenAI constructor from @google/genai module.');
  }
  if (!HarmCategory || !HarmBlockThreshold) {
    console.error("HarmCategory or HarmBlockThreshold not found. Imported module structure:", JSON.stringify(importedModule, null, 2));
    throw new Error('Failed to load HarmCategory/HarmBlockThreshold from @google/genai module.');
  }

  const genAI = GEMINI_API_KEY ? new GoogleGenAI(GEMINI_API_KEY) : null;

  // Logging for debugging the genAI instance (can be removed once stable)
  // console.log("GEMINI_API_KEY is set:", !!GEMINI_API_KEY);
  // console.log("Type of genAI instance:", typeof genAI);
  // if (genAI) {
  //   console.log("genAI instance (brief):", Object.keys(genAI)); // Log keys to keep it brief
  //   console.log("Is genAI.getGenerativeModel a function?", typeof genAI.getGenerativeModel);
  //   console.log("Is genAI.models.getGenerativeModel a function?", genAI.models ? typeof genAI.models.getGenerativeModel : "genAI.models is undefined");
  // }


  if (!genAI) {
    throw new Error('Gemini API client could not be initialized. Check GEMINI_API_KEY.');
  }
  if (!genAI.models || typeof genAI.models.getGenerativeModel !== 'function') {
    console.error("genAI.models.getGenerativeModel is not a function. Available on genAI.models:", genAI.models ? Object.keys(genAI.models) : "genAI.models is undefined");
    throw new Error('getGenerativeModel method not found on genAI.models. SDK structure might have changed.');
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
      : currentDefaultSafetySettings; 

    const finalGenerationConfig = {
      ...defaultGenerationConfig, 
      ...generationConfigOverrides,
    };

    // CORRECTED: Call getGenerativeModel on genAI.models
    const model = genAI.models.getGenerativeModel({ // <<< MODIFIED LINE
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
        console.error("Gemini API Response Error Details:", error.response || "No additional response details.");
    }
    throw error;
  }
}

export { generateContent };
