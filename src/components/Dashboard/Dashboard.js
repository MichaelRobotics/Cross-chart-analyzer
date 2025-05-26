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
            
            // Check if content exists and is not empty
            const hasInitialFindings = backendBlockData.initialFindings && backendBlockData.initialFindings.trim() !== "";
            const hasDetailedFindings = backendBlockData.detailedFindings && backendBlockData.detailedFindings.trim() !== "";
            findingsContent = hasInitialFindings ? backendBlockData.initialFindings : 
                             (hasDetailedFindings ? backendBlockData.detailedFindings : "<p>Brak danych.</p>");
            
            const hasThoughtProcess = backendBlockData.thoughtProcess && backendBlockData.thoughtProcess.trim() !== "";
            thoughtProcessContent = hasThoughtProcess ? backendBlockData.thoughtProcess : "<p>Brak danych.</p>";
            
            newSuggestionsContent = backendBlockData.questionSuggestions || [];
        } else { // From detailedBlock in chatOnTopic response or chat history
            id = `analysis-q-${blockIdSuffix || Date.now()}`; // Use suffix or timestamp as fallback key
            questionText = backendBlockData.questionAsked || "Odpowiedź na pytanie";
            findingsHeading = "Wynik";
            
            // Check if content exists and is not empty
            const hasDetailedFindings = backendBlockData.detailedFindings && backendBlockData.detailedFindings.trim() !== "";
            findingsContent = hasDetailedFindings ? backendBlockData.detailedFindings : "<p>Brak danych.</p>";
            
            const hasSpecificThoughtProcess = backendBlockData.specificThoughtProcess && backendBlockData.specificThoughtProcess.trim() !== "";
            thoughtProcessContent = hasSpecificThoughtProcess ? backendBlockData.specificThoughtProcess : "<p>Brak danych.</p>";
            
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

        // Process initial analysis block if it exists
        const initialBlockData = topicData.initialAnalysisResult || (isInitialSetup ? topicData.data : null);
        if (initialBlockData) {
            const formattedInitialBlock = formatBlockDataFromBackend(initialBlockData, 'initial', analysisName);
            if (formattedInitialBlock) {
                blocks.push(formattedInitialBlock);
            }
        }
        
        // Process chat history
        if (topicData.chatHistory && Array.isArray(topicData.chatHistory)) {
            topicData.chatHistory.forEach(msg => {
                // Always add chat message
                newChatMessages.push({
                    sender: msg.role === 'user' ? 'user' : 'ai',
                    text: msg.parts && msg.parts.length > 0 && msg.parts[0].text ? msg.parts[0].text : "Brak treści wiadomości",
                    id: msg.messageId || `msg-${Date.now()}-${Math.random()}`, 
                });

                // Only create analysis block if it's an AI message with detailed analysis data
                if (msg.role === 'model' && msg.detailedAnalysisBlock && 
                    (msg.detailedAnalysisBlock.detailedFindings || msg.detailedAnalysisBlock.specificThoughtProcess)) {
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
        }

        // Only add initial chat message for new analyses
        if (isInitialSetup && initialBlockData) {
            newChatMessages.push({
                sender: 'ai',
                text: initialBlockData.conciseInitialSummary || "Rozpoczęto analizę.",
                id: `msg-initial-${Date.now()}`
            });
        }

        setAnalysisBlocksStore(blocks);
        setChatMessages(newChatMessages);
        setQuestionIdCounter(newQuestionIdCounter);
        setCurrentAnalysisIndex(blocks.length > 0 ? 0 : 0); 

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
            const effectiveTopicId = paramTopicId || "default_topic_id"; 
            setCurrentTopicId(effectiveTopicId);
            setCurrentDashboardContextTitle(analysisName || topicContext || "Moje Analizy");

            try {
                if (mode === 'load_topic' && analysisId) {
                    const initialTopicData = await apiClient.initiateTopicAnalysis(analysisId, effectiveTopicId, analysisName || "Nowa Analiza");
                    if (initialTopicData && initialTopicData.success) {
                        processAndSetBackendData(initialTopicData, analysisName || "Nowa Analiza", true);
                    } else {
                        throw new Error(initialTopicData.message || "Nie udało się zainicjować analizy tematu.");
                    }
                } else if ((mode === 'real' || mode === 'my_analyses_loaded_specific') && analysisId && effectiveTopicId) {
                    const fullTopicData = await apiClient.getAnalysisTopicData(analysisId, effectiveTopicId);
                    if (fullTopicData) { 
                        processAndSetBackendData(fullTopicData, analysisName || "Analiza");
                    } else {
                        throw new Error("Nie udało się pobrać danych tematu.");
                    }
                } else if (mode === 'my_analyses') {
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
                            return; 
                        }
                    }
                     setCurrentDashboardContextTitle("Moje Analizy"); 
                } else if (mode === 'classic' || mode === 'demo' || !mode ) { 
                    setCurrentDashboardContextTitle(topicContext || "Analiza Holistyczna (Demo)");
                    const demoInitialBlock = formatBlockDataFromBackend({
                        initialFindings: "<p>To jest demonstracyjna analiza holistyczna. Agent zidentyfikował kluczowe obszary...</p>",
                        thoughtProcess: "<p>Agent przeanalizował symulowane dane...</p>",
                        questionSuggestions: ["Jakie są główne trendy?", "Czy są jakieś anomalie?"]
                    }, 'initial', topicContext || "Analiza Holistyczna (Demo)");
                    setAnalysisBlocksStore(demoInitialBlock ? [demoInitialBlock] : []);
                    setChatMessages([{sender: 'ai', text: 'Witaj w trybie demonstracyjnym! Zadaj pytanie.', id: `demo-msg-${Date.now()}`}]);
                }
            } catch (error) {
                console.error("Error loading dashboard data:", error);
                setDataError(error.message || "Wystąpił błąd podczas ładowania danych.");
                setChatMessages([{ sender: 'ai', text: `Błąd: ${error.message}`, id: `error-msg-${Date.now()}` }]);
            } finally {
                setIsLoadingInitialData(false);
            }
        };

        loadDashboardData();
    }, [params, userCreatedAnalyses, isLoadingAnalysesList, onNavigateToLanding, formatBlockDataFromBackend, processAndSetBackendData]);


    const handleSelectTopic = (topic) => {
        console.log("Topic selected in Dashboard (potentially for future sub-topic navigation):", topic);
    };

    const handleSendMessage = async (messageText) => {
        if (!currentAnalysisId || !currentTopicId) {
            setDataError("Nie można wysłać wiadomości: Brak aktywnej analizy lub tematu.");
            setChatMessages(prev => [...prev, {sender: 'ai', text: "Błąd: Kontekst analizy nie jest ustawiony.", id: `ctx-error-${Date.now()}`}]);
            return;
        }

        const userMessageId = `msg-user-${Date.now()}`;
        setChatMessages(prev => [...prev, { sender: 'user', text: messageText, id: userMessageId }]);
        setIsSendingMessage(true);
        setDataError(null);
        const thinkingMessageId = `msg-ai-thinking-${Date.now()}`;
        setChatMessages(prev => [...prev, { sender: 'ai', text: `Agent analizuje: "${messageText.substring(0, 25)}..."`, id: thinkingMessageId }]);

        try {
            const response = await apiClient.chatOnTopic(currentAnalysisId, currentTopicId, messageText);

            // Remove thinking message
            setChatMessages(prevChatMessages => prevChatMessages.filter(msg => msg.id !== thinkingMessageId));

            if (response && response.success) {
                // Add AI's concise chat response
                if (response.chatMessage && response.chatMessage.parts && response.chatMessage.parts.length > 0) {
                    const aiMessageText = response.chatMessage.parts[0].text || "Otrzymano odpowiedź.";
                    const aiMessageId = response.chatMessage.messageId || `msg-ai-${Date.now()}`;
                    setChatMessages(prevChatMessages => [
                        ...prevChatMessages,
                        {
                            sender: 'ai',
                            text: aiMessageText, // This is plain text for chat UI
                            id: aiMessageId,
                        }
                    ]);
                } else {
                     setChatMessages(prevChatMessages => [
                        ...prevChatMessages,
                        {
                            sender: 'ai',
                            text: "Otrzymano odpowiedź, ale jej format jest nietypowy.",
                            id: `msg-ai-format-error-${Date.now()}`,
                        }
                    ]);
                }

                // Add detailed block to analysisBlocksStore
                if (response.detailedBlock) {
                    const newQId = questionIdCounter + 1;
                    const newBlock = formatBlockDataFromBackend(response.detailedBlock, 'chat', currentDashboardContextTitle, newQId);
                    if (newBlock) {
                        setAnalysisBlocksStore(prevBlocksArray => {
                            const updatedBlocks = [...prevBlocksArray, newBlock];
                            // Correctly set currentAnalysisIndex to the new block's index
                            setCurrentAnalysisIndex(updatedBlocks.length - 1);
                            return updatedBlocks;
                        });
                        setQuestionIdCounter(newQId);
                    }
                }
            } else {
                // Handle cases where response.success is false or response is null/undefined
                const errorMessage = response ? response.message : "Nie udało się uzyskać odpowiedzi od agenta.";
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error("Error sending message or processing response:", error);
            // Ensure thinking message is removed if it hasn't been already
            setChatMessages(prevChatMessages => prevChatMessages.filter(msg => msg.id !== thinkingMessageId));
            setChatMessages(prevChatMessages => [
                ...prevChatMessages,
                { sender: 'ai', text: `Błąd odpowiedzi: ${error.message}`, id: `msg-ai-error-${Date.now()}` }
            ]);
            setDataError(`Błąd odpowiedzi: ${error.message}`);
        } finally {
            setIsSendingMessage(false);
        }
    };
    
    const noAnalysesAvailable = params.mode === 'my_analyses' && !isLoadingAnalysesList && userCreatedAnalyses.length === 0;
    const displayContent = !isLoadingInitialData && !dataError && (analysisBlocksStore.length > 0 || noAnalysesAvailable);

    if (isLoadingInitialData && !params.mode) { 
         return <div className="flex justify-center items-center min-h-screen text-white">Ładowanie dashboardu...</div>;
    }

    return (
        <div id="dashboard-view-content" className="dashboard-view-wrapper"> 
            <Sidebar 
                activeTopic={currentDashboardContextTitle} 
                onSelectTopic={handleSelectTopic} 
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
                                    disabled={currentAnalysisIndex >= analysisBlocksStore.length - 1 || analysisBlocksStore.length === 0}
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
                                !isLoadingInitialData && <div className="analysis-content-area text-center p-8 text-gray-400">Brak bloków analizy do wyświetlenia.</div>
                            )
                        )
                    )}
                    
                    {displayContent && !noAnalysesAvailable && analysisBlocksStore.length > 0 && (
                        <Chat 
                            messages={chatMessages} 
                            onSendMessage={handleSendMessage} 
                            isSending={isSendingMessage} 
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
