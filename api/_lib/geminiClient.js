// api/_lib/geminiClient.js
// Note: Top-level import for @google/genai is removed. It will be dynamically imported.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set.');
}

const defaultGenerationConfig = {
  temperature: 0.7,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

async function generateContent(
  modelName,
  promptParts,
  generationConfigOverrides = {},
  safetySettingsOverrides = null
) {
  const importedModule = await import('@google/genai');
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

  const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

  if (!genAI) {
    throw new Error('Gemini API client could not be initialized. Check GEMINI_API_KEY.');
  }
  
  if (!genAI.models || typeof genAI.models.generateContent !== 'function') {
    console.error(
      "genAI.models.generateContent is not a function. Available on genAI.models:", 
      genAI.models ? Object.keys(genAI.models) : "genAI.models is undefined"
    );
    throw new Error('generateContent method not found on genAI.models. SDK structure might have changed.');
  }

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
    
    const result = await genAI.models.generateContent({
      model: modelName, 
      contents: contentsForApi,
      generationConfig: finalGenerationConfig,
      safetySettings: finalSafetySettings,
    });
    
    // +++ ADDED LOGGING +++
    console.log("Full result from genAI.models.generateContent:", JSON.stringify(result, null, 2));
    // +++ END ADDED LOGGING +++

    // Determine the actual response object that contains candidates and promptFeedback
    // Based on README, it should be result.response.
    // If result.response is undefined, let's check if 'result' itself has these properties.
    const apiResponseObject = result.response || result;


    if (!apiResponseObject || !apiResponseObject.candidates || apiResponseObject.candidates.length === 0) {
      console.warn('Gemini API returned no candidates or an empty response. API Response Object:', JSON.stringify(apiResponseObject, null, 2));
      // Check for blocking reason on the determined API response object
      if (apiResponseObject && apiResponseObject.promptFeedback && apiResponseObject.promptFeedback.blockReason) {
        throw new Error(`Content generation blocked. Reason: ${apiResponseObject.promptFeedback.blockReason}. Details: ${apiResponseObject.promptFeedback.blockReasonMessage || 'No additional details.'}`);
      }
      throw new Error('Gemini API returned no candidates or an empty response.');
    }
    
    const candidate = apiResponseObject.candidates[0];

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

    let textOutput = '';
    // Try to access text using candidate.content.parts[0].text first
    if (responsePart && typeof responsePart.text === 'string') {
        textOutput = responsePart.text;
    } 
    // Fallback: The README shows response.response.text()
    // So, if apiResponseObject is what result.response was, then apiResponseObject.text()
    else if (apiResponseObject && typeof apiResponseObject.text === 'function') { 
        textOutput = apiResponseObject.text();
    } else {
        console.warn("Could not directly extract text from response part or response.text(). Response structure:", JSON.stringify(apiResponseObject, null, 2));
        throw new Error("Could not extract text from Gemini response.");
    }


    if (generationConfigOverrides.responseMimeType === 'application/json') {
      try {
        return JSON.parse(textOutput);
      } catch (e) {
        console.error('Failed to parse Gemini JSON response:', e);
        console.error('Raw Gemini response text for JSON request:', textOutput);
        throw new Error(`Failed to parse expected JSON response from Gemini API. Raw text: "${textOutput.substring(0,100)}..."`);
      }
    }
    return textOutput;

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
