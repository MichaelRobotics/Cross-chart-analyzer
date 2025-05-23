// src/contexts/AnalysisContext.js
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { apiClient } from '../services/apiClient'; // Import the apiClient

// Create the context
const AnalysisContext = createContext();

// Create the provider component
export const AnalysisProvider = ({ children }) => {
    // State for the list of user-created analyses, initialized as an empty array.
    // This will be populated from the backend.
    const [userCreatedAnalyses, setUserCreatedAnalyses] = useState([]);

    // State to track if the analyses list is currently being loaded from the backend.
    const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(true);

    // State to store any error that occurs while fetching analyses.
    const [fetchAnalysesError, setFetchAnalysesError] = useState(null);

    /**
     * Fetches the list of analyses from the backend.
     * This function is memoized with useCallback to prevent unnecessary re-creations.
     */
    const fetchAnalyses = useCallback(async () => {
        setIsLoadingAnalyses(true); // Set loading state to true before fetching
        setFetchAnalysesError(null); // Clear any previous errors
        try {
            // Call the apiClient to get the list of analyses.
            // The backend is expected to return an object like { analyses: [...] }
            const data = await apiClient.getAnalysesList();
            if (data && Array.isArray(data.analyses)) {
                // Ensure each analysis has an 'analysisId' and a 'type' for consistency with frontend expectations.
                // The backend should ideally provide these. If not, defaults or transformations might be needed here.
                const formattedAnalyses = data.analyses.map(analysis => ({
                    ...analysis,
                    // Assuming 'analysisId' is the primary identifier from the backend.
                    // The 'name' field is used for display and was part of the old structure.
                    // 'type' was used to differentiate 'real' analyses.
                    // These might need adjustment based on the actual backend response structure.
                    id: analysis.analysisId, // Map analysisId to id if components expect 'id'
                    type: analysis.type || 'real', // Default type if not provided
                }));
                setUserCreatedAnalyses(formattedAnalyses);
            } else {
                // If the response format is unexpected, set to empty array and log an error.
                console.error("Fetched analyses data is not in the expected format:", data);
                setUserCreatedAnalyses([]);
            }
        } catch (error) {
            console.error("Failed to fetch analyses:", error);
            setFetchAnalysesError(error.message || "An unknown error occurred while fetching analyses.");
            setUserCreatedAnalyses([]); // Set to empty array on error to prevent issues with map/filter
        } finally {
            setIsLoadingAnalyses(false); // Set loading state to false after fetching is complete
        }
    }, []);

    // useEffect hook to fetch analyses when the component mounts.
    // The empty dependency array ensures this runs only once on mount.
    useEffect(() => {
        fetchAnalyses();
    }, [fetchAnalyses]); // fetchAnalyses is stable due to useCallback

    /**
     * Adds a newly created analysis to the local state.
     * This is typically called after a successful response from the backend
     * when a new analysis (e.g., via uploadAndPreprocessCsv) has been created.
     * It helps in updating the UI optimistically or without an immediate full refresh.
     *
     * @param {object} newAnalysis - The new analysis object from the backend.
     * It should include at least `analysisId` and `name`.
     */
    const addAnalysisToLocalState = (newAnalysis) => {
        // Ensure the new analysis has an 'analysisId' (or 'id')
        if (!newAnalysis || (!newAnalysis.analysisId && !newAnalysis.id)) {
            console.error("Cannot add analysis to local state without a valid ID:", newAnalysis);
            return;
        }
        // Map analysisId to id if necessary for consistency
        const analysisToAdd = {
            ...newAnalysis,
            id: newAnalysis.analysisId || newAnalysis.id,
            type: newAnalysis.type || 'real',
        };

        setUserCreatedAnalyses(prevAnalyses => {
            // Prevent duplicates based on id
            const existingIndex = prevAnalyses.findIndex(a => a.id === analysisToAdd.id);
            if (existingIndex > -1) {
                // Optionally update the existing one, or just return prevAnalyses
                // For now, if it exists, we don't add a duplicate.
                // If an update is needed, logic would go here.
                return prevAnalyses;
            }
            // Add the new analysis to the beginning of the list for better UX.
            return [analysisToAdd, ...prevAnalyses];
        });
    };

    // The old addUserAnalysis logic that directly manipulated sessionStorage is removed.
    // The source of truth is now the backend.
    // refreshAnalyses (which is just fetchAnalyses) can be used to get the latest list.

    // Value provided by the context
    const contextValue = {
        userCreatedAnalyses,
        isLoadingAnalyses,
        fetchAnalysesError,
        refreshAnalyses: fetchAnalyses, // Expose fetchAnalyses as refreshAnalyses
        addAnalysisToLocalState,
    };

    return (
        <AnalysisContext.Provider value={contextValue}>
            {children}
        </AnalysisContext.Provider>
    );
};

// Custom hook to easily consume the AnalysisContext
export const useAnalysisContext = () => {
    const context = useContext(AnalysisContext);
    if (context === undefined) {
        throw new Error('useAnalysisContext must be used within an AnalysisProvider');
    }
    return context;
};
