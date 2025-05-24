// src/components/Dashboard/Sidebar.js
import React from 'react';
import { useAnalysisContext } from '../../contexts/AnalysisContext';

const Sidebar = ({ activeTopic, onNavigateToLanding }) => { 
    // Consume analysis data and loading/error states from the context
    const { userCreatedAnalyses, isLoadingAnalyses, fetchAnalysesError } = useAnalysisContext();
    
    /**
     * Handles the selection of an analysis from the sidebar.
     * Navigates to the Dashboard to load the selected analysis.
     * @param {object} analysis - The selected analysis object from userCreatedAnalyses.
     * Expected to have analysisId, name, fileName.
     */
    const handleSelectAnalysis = (analysis) => {
        if (analysis && analysis.analysisId) {
            // Navigate to the Dashboard, instructing it to load this specific analysis.
            // A 'default_topic_id' is used here as a placeholder. The Dashboard
            // will use this to fetch the initial/main topic for the selected analysis.
            // The backend should define what this default topic entails (e.g., an overview).
            onNavigateToLanding({ 
                dashboardParams: { 
                    mode: 'real', // Indicates loading an existing, real analysis
                    analysisId: analysis.analysisId, 
                    analysisName: analysis.name,
                    fileName: analysis.fileName, // Pass fileName if available and needed by Dashboard
                    topicId: analysis.defaultTopicId || "default_topic_id" // Placeholder for the main/initial topic
                }
            });
        } else if (analysis && !analysis.analysisId && analysis.name) {
            // Fallback for demo/classic topics if they are ever re-introduced
            // and don't have an analysisId but are managed differently.
            // For now, this primarily handles backend-driven analyses.
            console.warn("Selected analysis does not have an analysisId, attempting classic navigation:", analysis);
            onNavigateToLanding({ dashboardParams: { topicContext: analysis.name, mode: 'classic' }});
        } else {
            console.error("Invalid analysis object selected:", analysis);
        }
    };
    
    return (
        <aside className="sidebar w-full md:w-64 lg:w-72 p-4 space-y-2 shrink-0">
            <h2 className="text-xl font-semibold mb-4 px-2 text-gray-300">Moje Analizy</h2>
            
            {/* Display loading state */}
            {isLoadingAnalyses && (
                <div className="px-4 py-2.5 text-sm text-gray-400">Ładowanie listy analiz...</div>
            )}

            {/* Display error state */}
            {!isLoadingAnalyses && fetchAnalysesError && (
                <div className="px-4 py-2.5 text-sm text-red-400">
                    Błąd ładowania analiz: {fetchAnalysesError}
                </div>
            )}

            {/* Display list of analyses or empty state */}
            {!isLoadingAnalyses && !fetchAnalysesError && (
                <nav>
                    <ul id="dashboard-sidebar-nav-list-react">
                        {userCreatedAnalyses.length === 0 ? (
                            <li className="px-4 py-2.5 text-sm text-gray-400">
                                Brak zapisanych analiz. Utwórz nową na stronie głównej.
                            </li>
                        ) : (
                            userCreatedAnalyses.map(analysis => (
                                <li key={analysis.analysisId || analysis.id || analysis.name}> {/* Use analysisId or id as key */}
                                    <a
                                        href="#" // Navigation is handled by onClick
                                        className={`sidebar-item block px-4 py-2.5 text-sm font-medium 
                                            ${analysis.type === 'real' ? 'dynamic-analysis-item' : ''} 
                                            ${activeTopic === analysis.name ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleSelectAnalysis(analysis);
                                        }}
                                        title={analysis.name} // Show full name on hover
                                    >
                                        {/* Truncate long names for display, if necessary */}
                                        {analysis.name.length > 25 ? `${analysis.name.substring(0, 22)}...` : analysis.name}
                                    </a>
                                </li>
                            ))
                        )}
                    </ul>
                </nav>
            )}

            <div className="mt-auto pt-10">
                <button 
                    id="dashboard-analyze-new-btn-react" 
                    className="bottom-button w-full py-2.5 px-4 rounded-md text-sm font-medium"
                    onClick={onNavigateToLanding} // This prop should navigate to the landing page
                >
                    Analizuj Nowy Plik
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
