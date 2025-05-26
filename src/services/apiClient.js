// src/services/apiClient.js

// Base URL for the backend API.
// Vercel serverless functions are typically available under the /api path.
const API_BASE_URL = '/api';

/**
 * Generic request function to interact with the backend API.
 * This function handles common aspects of API calls, such as setting the base URL,
 * managing headers, and basic error handling.
 *
 * @param {string} endpoint - The API endpoint to call (e.g., '/csv/initiateUpload').
 * @param {object} options - Configuration options for the fetch call (method, headers, body).
 * @returns {Promise<any>} - A promise that resolves with the JSON response from the API.
 * @throws {Error} - Throws an error if the API request fails (e.g., network error, non-OK HTTP status).
 */
async function request(endpoint, options = {}) {
    // Construct the full URL for the API request.
    const url = `${API_BASE_URL}${endpoint}`;

    // Default headers for JSON content. These can be overridden by options.headers.
    const defaultHeaders = {
        'Content-Type': 'application/json',
        // Add any other default headers here, like Authorization if needed
    };

    const headers = {
        ...defaultHeaders,
        ...options.headers,
    };

    // If the request body is FormData, the browser will automatically set the
    // 'Content-Type' to 'multipart/form-data' with the correct boundary.
    // In this case, we remove our explicitly set 'Content-Type' to avoid conflicts.
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    // Configure the fetch request.
    const config = {
        method: options.method || 'GET', // Default to GET if no method is specified.
        headers: headers,
        body: options.body, // The body of the request (e.g., JSON string, FormData).
    };

    try {
        // Perform the fetch request.
        const response = await fetch(url, config);

        // Check if the response was successful (HTTP status 200-299).
        if (!response.ok) {
            // If not successful, try to parse error details from the response body.
            // If parsing fails (e.g., empty or non-JSON response), use the statusText.
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // If response.json() fails, construct errorData with statusText
                errorData = { message: response.statusText || `HTTP error ${response.status}` };
            }
            // Throw an error with the message from the backend or the HTTP status text.
            const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
            console.error(`API Error (${response.status}) for ${endpoint}: ${errorMessage}`, errorData);
            throw new Error(errorMessage);
        }

        // Handle responses that do not have content (e.g., HTTP 204 No Content).
        if (response.status === 204) {
            return null; // Return null as there is no body to parse.
        }

        // If the response is successful and has content, parse it as JSON.
        return await response.json();
    } catch (error) {
        // Log the error for debugging purposes and re-throw it so it can be
        // handled by the calling component or service.
        // Error is already logged if it came from !response.ok block
        if (!(error.message.startsWith("API Error") || error.message.startsWith("HTTP error"))) {
             console.error(`API request to ${endpoint} failed: ${error.message}`, error);
        }
        throw error; // Re-throw the error to be caught by the caller
    }
}

// Export an object containing all API client methods.
export const apiClient = {
    /**
     * Initiates the CSV upload process.
     * Sends the CSV file and analysis name to the backend.
     * @param {FormData} formData - FormData object containing 'csvFile' and 'analysisName'.
     * @returns {Promise<object>} Backend response, e.g., { success, analysisId, analysisName, ... }.
     */
    initiateCsvUpload: (formData) => {
        return request('/csv/initiateUpload', { // Endpoint for Function A
            method: 'POST',
            body: formData, // FormData is passed directly
        });
    },

    /**
     * Triggers the generation of the CSV data summary on the backend.
     * @param {string} analysisId - The ID of the analysis to process.
     * @returns {Promise<object>} Backend response, e.g., { success, analysisId, dataSummaryForPrompts, ... }.
     */
    generateCsvSummary: (analysisId) => {
        return request('/csv/generateSummary', { // Endpoint for Function B
            method: 'POST',
            body: JSON.stringify({ analysisId }),
        });
    },

    /**
     * Triggers the finalization of the analysis, including data nature description.
     * @param {string} analysisId - The ID of the analysis.
     * @param {object} dataSummaryForPromptsFromPreviousStep - The summary generated in the previous step.
     * @returns {Promise<object>} Backend response, e.g., { success, analysisId, dataNatureDescription, ... }.
     */
    describeAndFinalizeCsv: (analysisId, dataSummaryForPromptsFromPreviousStep) => {
        return request('/csv/describeAndFinalize', { // Endpoint for Function C
            method: 'POST',
            body: JSON.stringify({ analysisId, dataSummaryForPromptsFromPreviousStep }),
        });
    },

    /**
     * Initiates a new topic analysis for a given analysisId or fetches an existing one.
     * @param {string} analysisId - The ID of the overall analysis.
     * @param {string} topicId - The ID of the specific topic to analyze.
     * @param {string} topicDisplayName - The user-friendly name for the topic.
     * @returns {Promise<object>} The backend response.
     */
    initiateTopicAnalysis: (analysisId, topicId, topicDisplayName) => {
        return request('/initiate-topic-analysis', {
            method: 'POST',
            body: JSON.stringify({ analysisId, topicId, topicDisplayName }),
        });
    },

    /**
     * Sends a user's message to the chat API for a specific topic and analysis.
     * @param {string} analysisId - The ID of the overall analysis.
     * @param {string} topicId - The ID of the current topic being discussed.
     * @param {string} userMessageText - The text of the user's message.
     * @returns {Promise<object>} The backend response.
     */
    chatOnTopic: (analysisId, topicId, userMessageText) => {
        return request('/chat-on-topic', {
            method: 'POST',
            body: JSON.stringify({ analysisId, topicId, userMessageText }),
        });
    },

    /**
     * Fetches the list of all available analyses from the backend.
     * @returns {Promise<object>} The backend response, e.g., { analyses: [...] }.
     */
    getAnalysesList: () => {
        return request('/analyses'); // Assumes GET by default
    },

    /**
     * Fetches detailed data for a specific analysis topic.
     * @param {string} analysisId - The ID of the overall analysis.
     * @param {string} topicId - The ID of the specific topic.
     * @returns {Promise<object>} The backend response.
     */
    getAnalysisTopicData: (analysisId, topicId) => {
        return request(`/analyses/${analysisId}/topics/${topicId}`); // Assumes GET
    },

    // Deprecated or to be removed if no longer used directly:
    // uploadAndPreprocessCsv: (formData) => {
    //     return request('/upload-and-preprocess-csv', {
    //         method: 'POST',
    //         body: formData,
    //     });
    // },
};