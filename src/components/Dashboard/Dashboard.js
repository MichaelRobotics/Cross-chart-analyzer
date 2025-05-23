// src/components/Dashboard/Dashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import AnalysisContent from './AnalysisContent';
import Chat from './Chat';
import { useAnalysisContext } from '../../contexts/AnalysisContext';
import { apiClient } from '../../services/apiClient'; // Import apiClient

const Dashboard = ({ params, onNavigateToLanding }) => {
    // Core data stores for the UI
    const [analysisBlocksStore, setAnalysisBlocksStore] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    
    // Navigation and context states
    const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState(0);
    const [currentDashboardContextTitle, setCurrentDashboardContextTitle] = useState("Moje Analizy");
    const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
    const [currentTopicId, setCurrentTopicId] = useState(null);
    
    // Loading and error states
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [dataError, setDataError] = useState(null); // For general data loading errors

    // Counter for client-side block IDs if backend doesn't provide them for chat-generated blocks
    const [questionIdCounter, setQuestionIdCounter] = useState(0);

    // Context for "My Analyses" list (primarily for the initial 'my_analyses' mode redirection)
    const { userCreatedAnalyses, isLoadingAnalyses: isLoadingAnalysesList } = useAnalysisContext();

    /**
     * Transforms backend data (initialAnalysisResult or detailedBlock from chat)
     * into the structure expected by AnalysisBlock.js.
     */
    const formatBlockDataFromBackend = useCallback((backendBlockData, type = 'initial', analysisName = '', blockIdSuffix = null) => {
        if (!backendBlockData) return null;

        let questionText, findingsHeading, findingsContent, thoughtProcessContent, newSuggestionsContent, id;

        if (type === 'initial') { // From initiateTopicAnalysis or initial part of getAnalysisTopicData
            id = 'initial-analysis';
            questionText = analysisName || "Analiza Początkowa";
            findingsHeading = backendBlockData.initialFindings ? `Wyniki dla "${analysisName}"` : (backendBlockData.detailedFindings ? "Wynik" : "Analiza Początkowa");
            findingsContent = backendBlockData.initialFindings || backendBlockData.detailedFindings || "<p>Brak danych.</p>";
            thoughtProcessContent = backendBlockData.thoughtProcess || backendBlockData.specificThoughtProcess || "<p>Brak danych.</p>";
            newSuggestionsContent = backendBlockData.questionSuggestions || backendBlockData.followUpSuggestions || [];
        } else { // From detailedBlock in chatOnTopic response or chat history
            id = `analysis-q-${blockIdSuffix || Date.now()}`; // Use suffix or timestamp as fallback key
            questionText = backendBlockData.questionAsked || "Odpowiedź na pytanie";
            findingsHeading = "Wynik";
            findingsContent = backendBlockData.detailedFindings || "<p>Brak danych.</p>";
            thoughtProcessContent = backendBlockData.specificThoughtProcess || "<p>Brak danych.</p>";
            newSuggestionsContent = backendBlockData.followUpSuggestions || [];
        }
        
        return {
            id,
            titleForBlock: questionText, // Use question as title for navigation block
            question: questionText,
            findingsHeading,
            findingsContent,
            thoughtProcessContent,
            newSuggestionsContent,
        };
    }, []);
    
    /**
     * Processes data fetched from the backend (either initial topic data or full topic data with chat history)
     * and updates the state for analysis blocks and chat messages.
     */
    const processAndSetBackendData = useCallback((topicData, analysisName, isInitialSetup = false) => {
        let blocks = [];
        let newChatMessages = [];
        let newQuestionIdCounter = 0;

        // Handle the primary analysis block (initialAnalysisResult)
        // This could be from initiateTopicAnalysis or the initial part of getAnalysisTopicData
        const initialBlockData = topicData.initialAnalysisResult || (isInitialSetup ? topicData.data : null);
        if (initialBlockData) {
            const formattedInitialBlock = formatBlockDataFromBackend(initialBlockData, 'initial', analysisName);
            if (formattedInitialBlock) {
                blocks.push(formattedInitialBlock);
            }
        }
        
        // Process chat history if available
        if (topicData.chatHistory && Array.isArray(topicData.chatHistory)) {
            topicData.chatHistory.forEach(msg => {
                newChatMessages.push({
                    sender: msg.role === 'user' ? 'user' : 'ai',
                    text: msg.parts && msg.parts.length > 0 ? msg.parts[0].text : "Brak treści wiadomości",
                    id: msg.messageId || `msg-${Date.now()}-${Math.random()}`, // Use backend ID or generate one
                });

                // If a model message has a detailedAnalysisBlock, create an analysis block for it
                if (msg.role === 'model' && msg.detailedAnalysisBlock) {
                    newQuestionIdCounter++;
                    const formattedChatBlock = formatBlockDataFromBackend(
                        msg.detailedAnalysisBlock, 
                        'chat', 
                        analysisName, 
                        newQuestionIdCounter
                    );
                    if (formattedChatBlock) {
                        blocks.push(formattedChatBlock);
                    }
                }
            });
        } else if (isInitialSetup && initialBlockData) {
            // If it's an initial setup (from initiateTopicAnalysis) and no explicit chat history is returned yet,
            // create the first AI message for the chat UI based on initialFindings.
            // The backend's initiate-topic-analysis is expected to create the first chat message in Firestore.
            // This frontend part is more for immediate UI update if chatHistory isn't returned by that specific endpoint.
             newChatMessages.push({
                sender: 'ai',
                text: initialBlockData.initialFindings || "Rozpoczęto analizę.",
                id: `msg-initial-${Date.now()}`
            });
        }

        setAnalysisBlocksStore(blocks);
        setChatMessages(newChatMessages);
        setQuestionIdCounter(newQuestionIdCounter);
        setCurrentAnalysisIndex(blocks.length > 0 ? 0 : 0); // Start at the first block

    }, [formatBlockDataFromBackend]);


    // Main effect for loading data based on params
    useEffect(() => {
        const loadDashboardData = async () => {
            setIsLoadingInitialData(true);
            setDataError(null);
            setAnalysisBlocksStore([]);
            setChatMessages([]);
            setQuestionIdCounter(0);
            setCurrentAnalysisIndex(0);

            const { mode, analysisId, analysisName, fileName, topicContext, topicId: paramTopicId } = params || {};
            
            setCurrentAnalysisId(analysisId);
            const effectiveTopicId = paramTopicId || "default_topic_id"; // Use provided topicId or a default
            setCurrentTopicId(effectiveTopicId);
            setCurrentDashboardContextTitle(analysisName || topicContext || "Moje Analizy");

            try {
                if (mode === 'load_topic' && analysisId) {
                    // New analysis: initiate topic analysis and get the first block of data.
                    // The backend's /api/initiate-topic-analysis should return initialAnalysisResult.
                    // It also creates the first chat message in Firestore.
                    const initialTopicData = await apiClient.initiateTopicAnalysis(analysisId, effectiveTopicId, analysisName || "Nowa Analiza");
                    // initialTopicData expected: { success: true, data: { initialFindings, thoughtProcess, questionSuggestions } }
                    if (initialTopicData && initialTopicData.success) {
                        processAndSetBackendData(initialTopicData, analysisName || "Nowa Analiza", true);
                         // Optionally, immediately fetch full chat history if initiateTopicAnalysis doesn't return it
                        // and if it's crucial for the first view. For now, assuming the first block is enough.
                    } else {
                        throw new Error(initialTopicData.message || "Nie udało się zainicjować analizy tematu.");
                    }
                } else if ((mode === 'real' || mode === 'my_analyses_loaded_specific') && analysisId && effectiveTopicId) {
                    // Existing analysis: fetch all data for the specified analysisId and topicId.
                    // This endpoint should return initialAnalysisResult (if applicable for this topic) AND full chatHistory.
                    const fullTopicData = await apiClient.getAnalysisTopicData(analysisId, effectiveTopicId);
                    // fullTopicData expected: { initialAnalysisResult: {...} (optional), chatHistory: [...] }
                    if (fullTopicData) { // Assuming direct return of data object or check for success field
                        processAndSetBackendData(fullTopicData, analysisName || "Analiza");
                    } else {
                        throw new Error("Nie udało się pobrać danych tematu.");
                    }
                } else if (mode === 'my_analyses') {
                    // This mode should ideally be resolved by App.js/LandingPage to a specific analysis.
                    // If it reaches here and analyses are loaded, navigate to the latest.
                    // If no analyses, show empty state (handled by return below).
                    if (!isLoadingAnalysesList && userCreatedAnalyses.length > 0) {
                        const latestAnalysis = userCreatedAnalyses[0];
                        if (latestAnalysis && latestAnalysis.analysisId) {
                             onNavigateToLanding({ 
                                dashboardParams: { 
                                    mode: 'real', 
                                    analysisId: latestAnalysis.analysisId, 
                                    analysisName: latestAnalysis.name,
                                    fileName: latestAnalysis.fileName,
                                    topicId: latestAnalysis.defaultTopicId || "default_topic_id"
                                }
                            });
                            return; // Prevent further processing in this render cycle
                        }
                    }
                    // If still here, means no analyses or still loading list, handled by UI conditions.
                     setCurrentDashboardContextTitle("Moje Analizy"); // Set title for empty state
                } else if (mode === 'classic' || mode === 'demo' || !mode ) { 
                    // Client-side demo logic (simplified, adapt from original if needed)
                    setCurrentDashboardContextTitle(topicContext || "Analiza Holistyczna (Demo)");
                    const demoInitialBlock = formatBlockDataFromBackend({
                        initialFindings: "<p>To jest demonstracyjna analiza holistyczna. Agent zidentyfikował kluczowe obszary...</p>",
                        thoughtProcess: "<p>Agent przeanalizował symulowane dane...</p>",
                        questionSuggestions: ["Jakie są główne trendy?", "Czy są jakieś anomalie?"]
                    }, 'initial', topicContext || "Analiza Holistyczna (Demo)");
                    setAnalysisBlocksStore(demoInitialBlock ? [demoInitialBlock] : []);
                    setChatMessages([{sender: 'ai', text: 'Witaj w trybie demonstracyjnym! Zadaj pytanie.'}]);
                }
            } catch (error) {
                console.error("Error loading dashboard data:", error);
                setDataError(error.message || "Wystąpił błąd podczas ładowania danych.");
                setChatMessages([{ sender: 'ai', text: `Błąd: ${error.message}` }]);
            } finally {
                setIsLoadingInitialData(false);
            }
        };

        loadDashboardData();
    // Dependencies: params for navigation, userCreatedAnalyses for 'my_analyses' mode, onNavigateToLanding for redirection.
    // formatBlockDataFromBackend and processAndSetBackendData are memoized.
    }, [params, userCreatedAnalyses, isLoadingAnalysesList, onNavigateToLanding, formatBlockDataFromBackend, processAndSetBackendData]);


    const handleSelectTopic = (topic) => {
        // This function is passed to Sidebar.
        // Sidebar now directly calls onNavigateToLanding with dashboardParams.
        // If Sidebar needs to interact with Dashboard state before navigating, this function could be expanded.
        // For now, direct navigation from Sidebar is simpler.
        // If 'topic' here represents something different (e.g., sub-topics within an analysisId),
        // this logic would change to fetch data for that new topicId under the currentAnalysisId.
        console.log("Topic selected in Dashboard (potentially for future sub-topic navigation):", topic);
        // Example for sub-topic navigation (would require topic to have topicId):
        // if (currentAnalysisId && topic.topicId) {
        //     onNavigateToLanding({ dashboardParams: { 
        //         mode: 'real', 
        //         analysisId: currentAnalysisId, 
        //         analysisName: currentDashboardContextTitle, // Or a new topic title
        //         topicId: topic.topicId 
        //     }});
        // }
    };

    const handleSendMessage = async (messageText) => {
        if (!currentAnalysisId || !currentTopicId) {
            setDataError("Nie można wysłać wiadomości: Brak aktywnej analizy lub tematu.");
            setChatMessages(prev => [...prev, {sender: 'ai', text: "Błąd: Kontekst analizy nie jest ustawiony."}]);
            return;
        }

        setChatMessages(prev => [...prev, { sender: 'user', text: messageText, id: `msg-user-${Date.now()}` }]);
        setIsSendingMessage(true);
        setDataError(null);
        const thinkingMessageId = `msg-ai-thinking-${Date.now()}`;
        setChatMessages(prev => [...prev, { sender: 'ai', text: `Agent analizuje: "${messageText.substring(0, 25)}..."`, id: thinkingMessageId }]);

        try {
            const response = await apiClient.chatOnTopic(currentAnalysisId, currentTopicId, messageText);
            // response: { success: true, chatMessage: {...}, detailedBlock: {...} }

            setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId)); // Remove thinking message

            if (response && response.success) {
                // Add AI's concise chat response
                setChatMessages(prev => [...prev, {
                    sender: 'ai',
                    text: response.chatMessage.parts && response.chatMessage.parts.length > 0 ? response.chatMessage.parts[0].text : "Otrzymano odpowiedź.",
                    id: response.chatMessage.messageId || `msg-ai-${Date.now()}`,
                }]);

                // Add detailed block to analysisBlocksStore
                if (response.detailedBlock) {
                    const newQId = questionIdCounter + 1;
                    const newBlock = formatBlockDataFromBackend(response.detailedBlock, 'chat', currentDashboardContextTitle, newQId);
                    if (newBlock) {
                        setAnalysisBlocksStore(prevBlocks => [...prevBlocks, newBlock]);
                        setQuestionIdCounter(newQId);
                        setCurrentAnalysisIndex(prevBlocks => prevBlocks.length); // Navigate to new block
                    }
                }
            } else {
                throw new Error(response.message || "Nie udało się uzyskać odpowiedzi od agenta.");
            }
        } catch (error) {
            console.error("Error sending message or processing response:", error);
            setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));
            setChatMessages(prev => [...prev, { sender: 'ai', text: `Błąd odpowiedzi: ${error.message}`, id: `msg-ai-error-${Date.now()}` }]);
            setDataError(`Błąd odpowiedzi: ${error.message}`);
        } finally {
            setIsSendingMessage(false);
        }
    };
    
    // Determine if we should show the "no analyses" message
    const noAnalysesAvailable = params.mode === 'my_analyses' && !isLoadingAnalysesList && userCreatedAnalyses.length === 0;
    const displayContent = !isLoadingInitialData && !dataError && (analysisBlocksStore.length > 0 || noAnalysesAvailable);

    if (isLoadingInitialData && !params.mode) { // Show loading only if not in a specific mode that handles its own content
         return <div className="flex justify-center items-center min-h-screen text-white">Ładowanie dashboardu...</div>;
    }

    return (
        <div id="dashboard-view-content" className="dashboard-view-wrapper"> 
            <Sidebar 
                activeTopic={currentDashboardContextTitle} 
                onSelectTopic={handleSelectTopic} // Retained for potential future use (sub-topics)
                onNavigateToLanding={onNavigateToLanding} 
            />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                <div className="main-content-bg p-6 md:p-8">
                    <div className="title-and-navigation-container">
                        <h1 id="main-analysis-title-react" className="text-2xl md:text-3xl font-bold text-white">
                            {currentDashboardContextTitle}
                        </h1>
                        {analysisBlocksStore.length > 0 && (
                            <div className="analysis-navigation-arrows">
                                <button 
                                    className="nav-arrow" 
                                    onClick={() => setCurrentAnalysisIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentAnalysisIndex === 0}
                                >
                                    &lt;
                                </button>
                                <button 
                                    className="nav-arrow" 
                                    onClick={() => setCurrentAnalysisIndex(prev => Math.min(analysisBlocksStore.length - 1, prev + 1))}
                                    disabled={currentAnalysisIndex >= analysisBlocksStore.length - 1}
                                >
                                    &gt;
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {isLoadingInitialData && (
                         <div className="analysis-content-area text-center p-8 text-gray-400">Ładowanie danych analizy...</div>
                    )}
                    {dataError && !isLoadingInitialData && (
                        <div className="analysis-content-area text-center p-8 text-red-400">
                            Błąd: {dataError}
                        </div>
                    )}

                    {displayContent && (
                        noAnalysesAvailable ? (
                            <div className="analysis-content-area">
                                <p className="text-center p-8 text-gray-400">
                                    Nie utworzyłeś jeszcze żadnych analiz. Przejdź do <a href="#" onClick={(e) => {e.preventDefault(); onNavigateToLanding();}} className="text-blue-400 hover:underline">strony głównej</a>, aby zaimportować plik CSV.
                                </p>
                            </div>
                        ) : (
                            analysisBlocksStore.length > 0 ? (
                                <AnalysisContent blocks={analysisBlocksStore} currentIndex={currentAnalysisIndex} />
                            ) : (
                                // This case might occur if dataError is not set but blocks are empty after loading
                                !isLoadingInitialData && <div className="analysis-content-area text-center p-8 text-gray-400">Brak bloków analizy do wyświetlenia.</div>
                            )
                        )
                    )}
                    
                    {/* Show chat only if not loading, no error, and not in the 'no analyses available' state */}
                    {displayContent && !noAnalysesAvailable && analysisBlocksStore.length > 0 && (
                        <Chat 
                            messages={chatMessages} 
                            onSendMessage={handleSendMessage} 
                            isSending={isSendingMessage} // Pass sending state to Chat if it needs to disable input
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
