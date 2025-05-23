// src/services/apiClient.js

// Base URL for the backend API.
// Vercel serverless functions are typically available under the /api path.
const API_BASE_URL = '/api';

/**
 * Generic request function to interact with the backend API.
 * This function handles common aspects of API calls, such as setting the base URL,
 * managing headers, and basic error handling.
 *
 * @param {string} endpoint - The API endpoint to call (e.g., '/upload-and-preprocess-csv').
 * @param {object} options - Configuration options for the fetch call (method, headers, body).
 * @returns {Promise<any>} - A promise that resolves with the JSON response from the API.
 * @throws {Error} - Throws an error if the API request fails (e.g., network error, non-OK HTTP status).
 */
async function request(endpoint, options = {}) {
    // Construct the full URL for the API request.
    const url = `${API_BASE_URL}${endpoint}`;

    // Default headers for JSON content. These can be overridden by options.headers.
    const headers = {
        'Content-Type': 'application/json',
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
                errorData = { message: response.statusText };
            }
            // Throw an error with the message from the backend or the HTTP status text.
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        console.error(`API request to ${endpoint} failed: ${error.message}`);
        throw error;
    }
}

// Export an object containing all API client methods.
export const apiClient = {
    /**
     * Uploads a CSV file and an analysis name to the backend for processing.
     * The backend is expected to handle the file, perform preprocessing,
     * and create an initial analysis record.
     *
     * @param {FormData} formData - FormData object containing 'csvFile' (the file)
     * and 'analysisName' (user-defined name for the analysis).
     * @returns {Promise<object>} - The backend response, typically including the
     * `analysisId` of the newly created analysis.
     */
    uploadAndPreprocessCsv: (formData) => {
        return request('/upload-and-preprocess-csv', {
            method: 'POST',
            body: formData, // FormData is passed directly; fetch handles multipart/form-data.
        });
    },

    /**
     * Initiates a new topic analysis for a given analysisId or fetches an existing one.
     * This is used to get the initial AI-generated overview for a specific topic
     * related to an uploaded CSV.
     *
     * @param {string} analysisId - The ID of the overall analysis (e.g., from uploadAndPreprocessCsv).
     * @param {string} topicId - The ID of the specific topic to analyze (e.g., "WaskieGardla", "default_topic_id").
     * @param {string} topicDisplayName - The user-friendly name for the topic (e.g., "Wąskie Gardła").
     * @returns {Promise<object>} - The backend response, expected to contain `initialAnalysisResult`
     * (with fields like initialFindings, thoughtProcess, questionSuggestions).
     */
    initiateTopicAnalysis: (analysisId, topicId, topicDisplayName) => {
        return request('/initiate-topic-analysis', {
            method: 'POST',
            body: JSON.stringify({ analysisId, topicId, topicDisplayName }),
        });
    },

    /**
     * Sends a user's message to the chat API for a specific topic and analysis.
     * The backend will process the message, interact with the AI, and return
     * the AI's response.
     *
     * @param {string} analysisId - The ID of the overall analysis.
     * @param {string} topicId - The ID of the current topic being discussed.
     * @param {string} userMessageText - The text of the user's message.
     * @returns {Promise<object>} - The backend response, including the AI's concise
     * `chatMessage` for the UI and a more `detailedBlock`
     * for the main analysis display.
     */
    chatOnTopic: (analysisId, topicId, userMessageText) => {
        return request('/chat-on-topic', {
            method: 'POST',
            body: JSON.stringify({ analysisId, topicId, userMessageText }),
        });
    },

    /**
     * Fetches the list of all available analyses from the backend.
     * This assumes a new backend endpoint (GET /api/analyses) will be implemented
     * to provide this list.
     *
     * @returns {Promise<object>} - The backend response, typically an object containing
     * an array of analyses, e.g., { analyses: [{ analysisId, analysisName, ... }] }.
     */
    getAnalysesList: () => {
        // Note: The backend endpoint GET /api/analyses needs to be defined and implemented.
        return request('/analyses');
    },

    /**
     * Fetches detailed data for a specific analysis topic, including its initial
     * analysis (if applicable for that topicId) and the full chat history.
     * This assumes a new backend endpoint (GET /api/analyses/{analysisId}/topics/{topicId})
     * will be implemented.
     *
     * @param {string} analysisId - The ID of the overall analysis.
     * @param {string} topicId - The ID of the specific topic.
     * @returns {Promise<object>} - The backend response, expected to contain data like
     * `initialAnalysisResult` (if it's the primary block for the topic)
     * and `chatHistory` (an array of chat messages).
     */
    getAnalysisTopicData: (analysisId, topicId) => {
        // Note: The backend endpoint GET /api/analyses/{analysisId}/topics/{topicId}
        // needs to be defined and implemented.
        return request(`/analyses/${analysisId}/topics/${topicId}`);
    },

    // Future API methods can be added here as the application evolves.
};
