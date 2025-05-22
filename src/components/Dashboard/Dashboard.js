import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import AnalysisContent from './AnalysisContent';
import Chat from './Chat';
import { useAnalysisContext } from '../../contexts/AnalysisContext';

const Dashboard = ({ params, onNavigateToLanding }) => {
    const [analysisBlocksStore, setAnalysisBlocksStore] = useState([]);
    const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState(0);
    const [questionIdCounter, setQuestionIdCounter] = useState(0);
    const [currentDashboardContextTitle, setCurrentDashboardContextTitle] = useState("Moje Analizy");
    const [chatMessages, setChatMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { userCreatedAnalyses } = useAnalysisContext();

    const generateAndDisplayFullAnalysis = useCallback((questionText, isInitial = false, isRealData = false, topicContextForContent = null) => {
        let newBlockData;
        let blockSpecificQuestionId = questionIdCounter; // Use current counter for ID generation if !isInitial

        if (!isInitial) {
            blockSpecificQuestionId = questionIdCounter + 1; // This ID will be for the new block
        }
        
        const analysisBlockId = isInitial ? 'initial-analysis' : `analysis-q-${blockSpecificQuestionId}`;
        
        let blockTitleForNavigation;
        if (isInitial) {
            blockTitleForNavigation = topicContextForContent || questionText;
        } else {
            blockTitleForNavigation = `Odpowiedź na pytanie ${blockSpecificQuestionId}`;
        }

        let findingsHeading, findingsContent, thoughtProcessContent, newSuggestionsContent;
        const effectiveTopicContext = topicContextForContent || currentDashboardContextTitle || "Analiza Ogólna";

        if (isInitial) {
            findingsHeading = isRealData ? `Wyniki dla "${effectiveTopicContext}"` : `Wstępne Spostrzeżenia (${effectiveTopicContext})`;
            if (isRealData) {
                findingsContent = `<p>To jest symulowana analiza dla <strong>${effectiveTopicContext}</strong>. W rzeczywistej aplikacji tutaj pojawiłyby się wyniki parsowania i analizy pliku CSV.</p>`;
                thoughtProcessContent = `<p>1. Wczytano plik CSV.<br>2. Przeprowadzono wstępne przetwarzanie danych.<br>3. Wygenerowano kluczowe metryki (symulacja).</p>`;
                newSuggestionsContent = [
                    `Jakie są trendy w danych dla ${ (effectiveTopicContext).substring(0,20)}...?`,
                    `Czy można zidentyfikować anomalie w ${(effectiveTopicContext).substring(0,20)}...?`
                ];
            } else if (effectiveTopicContext && effectiveTopicContext !== "Moje Analizy" && effectiveTopicContext !== "Analiza Holistyczna" && effectiveTopicContext !== "Analiza Początkowa") { 
                 findingsContent = `<p>Dane dla tematu '<strong>${effectiveTopicContext}</strong>' są obecnie symulowane.</p><p>Możesz zadać pytania dotyczące tego tematu w czacie poniżej.</p>`;
                thoughtProcessContent = `<p>Analiza dla '<strong>${effectiveTopicContext}</strong>' jest w toku. Agent jest gotowy na Twoje pytania.</p>`;
                newSuggestionsContent = [
                    `Jakie są kluczowe wskaźniki dla ${effectiveTopicContext}?`,
                    `Poproś o szczegółową analizę X w kontekście ${effectiveTopicContext}.`
                ];
            } else { 
                findingsContent = `<p>Agent zidentyfikował, że produkty o relatywnie wysokim koszcie materiału nie zawsze korelują z najdłuższym czasem realizacji...</p><p>Dodatkowo, pewna grupa produktów charakteryzująca się niskim 'Wartość Dodana VA %'...</p>`;
                thoughtProcessContent = `<p>Aby sformułować te spostrzeżenia, Agent wykonał następujące kroki:</p><ul class="mt-2 space-y-1"><li>Agent obliczył złożone wskaźniki...</li><li>Agent przeprowadził analizę kwadrantową...</li><li>Agent porównał profile kosztowe...</li></ul>`;
                newSuggestionsContent = ["Które kategorie produktów wykazują największą dysproporcję...?", "Czy istnieje segment produktów, gdzie wysoka wartość 'NVA %'...", "Jakie czynniki, poza bezpośrednimi kosztami..."];
            }
        } else { 
            findingsHeading = "Wynik";
            const qExcerpt = questionText.substring(0,62) + (questionText.length > 65 ? "..." : "");
            findingsContent = `<p>W odpowiedzi na pytanie "${qExcerpt}" (w kontekście: ${effectiveTopicContext}), Agent ustalił, że kluczowym elementem jest X. Na przykład, produkty Y wykazują tendencję Z.</p>`;
            thoughtProcessContent = `<p>Agent zastosował metodę A do analizy danych dotyczących "${qExcerpt}". Porównano wskaźniki B i C.</p>`;
            newSuggestionsContent = [`Jak zmiana parametru D wpłynie na "${qExcerpt.substring(0,15)}..."?`, `Czy można zidentyfikować inne czynniki wpływające na "${qExcerpt.substring(0,15).toLowerCase()}..."?`];
        }

        newBlockData = { 
            id: analysisBlockId, 
            titleForBlock: blockTitleForNavigation, 
            question: questionText,
            findingsHeading, 
            findingsContent, 
            thoughtProcessContent, 
            newSuggestionsContent 
        };
        
        setAnalysisBlocksStore(prevBlocks => {
            let newBlocksArray;
            if (isInitial) { 
                newBlocksArray = [newBlockData]; 
                setCurrentAnalysisIndex(0); // Set index for initial block
            } else {
                // For new question blocks, always append.
                newBlocksArray = [...prevBlocks, newBlockData];
                setCurrentAnalysisIndex(newBlocksArray.length - 1); // Set index to the new block
            }
            return newBlocksArray; 
        });
        
        if (!isInitial) {
            setQuestionIdCounter(prevCounter => prevCounter + 1); // Increment counter after use
        }
        return newBlockData; 
    }, [currentDashboardContextTitle, questionIdCounter]);


    useEffect(() => {
        setIsLoading(true);
        const newParams = params || {};
        let currentMode = newParams.mode;
        let analysisNameFromParams = newParams.analysisName;
        let fileNameFromParams = newParams.fileName;
        let newContextTitle = "Moje Analizy";
        let shouldAddDefaultQuestions = false;

        if (currentMode === 'my_analyses') {
            if (userCreatedAnalyses.length > 0) {
                const latestAnalysis = userCreatedAnalyses[0];
                analysisNameFromParams = latestAnalysis.name;
                fileNameFromParams = latestAnalysis.fileName;
                currentMode = 'real'; 
                newContextTitle = analysisNameFromParams;
            } else {
                setCurrentDashboardContextTitle("Moje Analizy");
                setAnalysisBlocksStore([]); 
                setChatMessages([]);
                setIsLoading(false);
                return; 
            }
        } else if (currentMode === 'real' && analysisNameFromParams) {
            newContextTitle = analysisNameFromParams;
            shouldAddDefaultQuestions = false; 
        } else if (currentMode === 'classic' || currentMode === 'demo' || !currentMode ) { 
            newContextTitle = "Analiza Holistyczna"; 
            currentMode = 'demo'; 
            shouldAddDefaultQuestions = true; 
        } else if (newParams.topicContext) { 
            // This handles clicking on a static topic name if they were present.
            // Since static topics are removed, this path might be less relevant,
            // but we can treat it as loading a demo for that topic name.
            newContextTitle = newParams.topicContext;
            currentMode = 'demo'; 
            shouldAddDefaultQuestions = true;
        }
        
        setCurrentDashboardContextTitle(newContextTitle);
        setQuestionIdCounter(0); 
        setAnalysisBlocksStore([]); 
        setChatMessages([]);      

        if (currentMode === 'real') {
            generateAndDisplayFullAnalysis(`Analiza dla: ${analysisNameFromParams} (Plik: ${fileNameFromParams})`, true, true, newContextTitle);
            setChatMessages(prev => [{ sender: 'ai', text: `Załadowano analizę: ${analysisNameFromParams}` }]);
        } else if (currentMode === 'demo') { 
            generateAndDisplayFullAnalysis(newContextTitle, true, false, newContextTitle); 
        }
        
        if (shouldAddDefaultQuestions) { 
             setTimeout(() => { 
                const q1 = "Zidentyfikuj produkty, gdzie koszt przezbrojenia ma nieproporcjonalnie duży wpływ na całkowity koszt jednostkowy w stosunku do wolumenu produkcji.";
                const block1Data = generateAndDisplayFullAnalysis(q1, false, false, newContextTitle);
                setChatMessages(prev => [...prev, {sender: 'user', text: q1}]);
                const thinkingMsg1Id = Date.now() + "_q1_think";
                setChatMessages(prev => [...prev, {sender: 'ai', text: `Agent analizuje: "${q1.substring(0,25)}..."`, id: thinkingMsg1Id}]);
                setTimeout(() => {
                    setChatMessages(prevMsgs => {
                        const updatedMsgs = prevMsgs.filter(m => m.id !== thinkingMsg1Id);
                        const findingsText = block1Data?.findingsContent?.match(/<p>(.*?)<\/p>/)?.[1] || "Oto wyniki dla pytania 1.";
                        return [...updatedMsgs, {sender: 'ai', text: findingsText.substring(0,100) + (findingsText.length > 100 ? "..." : "")}];
                    });
                }, 50); 
                
                const q2 = "Czy istnieje grupa produktów o podobnej strukturze kosztów, ale znacząco różniąca się rentownością godzinową? Jakie mogą być tego przyczyny?";
                const block2Data = generateAndDisplayFullAnalysis(q2, false, false, newContextTitle);
                setChatMessages(prev => [...prev, {sender: 'user', text: q2}]);
                const thinkingMsg2Id = Date.now() + "_q2_think";
                setChatMessages(prev => [...prev, {sender: 'ai', text: `Agent analizuje: "${q2.substring(0,25)}..."`, id: thinkingMsg2Id}]);
                 setTimeout(() => {
                    setChatMessages(prevMsgs => {
                        const updatedMsgs = prevMsgs.filter(m => m.id !== thinkingMsg2Id);
                        const findingsText = block2Data?.findingsContent?.match(/<p>(.*?)<\/p>/)?.[1] || "Oto wyniki dla pytania 2.";
                        return [...updatedMsgs, {sender: 'ai', text: findingsText.substring(0,100) + (findingsText.length > 100 ? "..." : "")}];
                    });
                }, 50);
            }, 150); 
        }
        setIsLoading(false);
    }, [params, userCreatedAnalyses, generateAndDisplayFullAnalysis]);


    const handleSelectTopic = (topic) => {
        if (topic.type === 'navigate_to_landing') {
            onNavigateToLanding(); 
            return;
        }
        if (topic.type === 'real') {
            onNavigateToLanding({ dashboardParams: { mode: 'real', analysisName: topic.name, fileName: topic.fileName }});
        } else { 
             onNavigateToLanding({ dashboardParams: { topicContext: topic.name, mode: 'classic' }});
        }
    };

    const handleSendMessage = (messageText) => {
        // Add user message immediately
        setChatMessages(prev => [...prev, { sender: 'user', text: messageText }]);
        
        // Add AI response after a short delay
        setTimeout(() => {
            setChatMessages(prev => [...prev, { 
                sender: 'ai', 
                text: `Przetwarzam pytanie: "${messageText}"...` 
            }]);
            
            // Generate analysis after another short delay
            setTimeout(() => {
                generateAndDisplayFullAnalysis(messageText, false, false, currentDashboardContextTitle);
                
                // Update AI response with final message
                setChatMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.sender === 'ai') {
                        lastMessage.text = `Analiza dla pytania "${messageText}" została wygenerowana. Sprawdź wyniki powyżej.`;
                    }
                    return newMessages;
                });
            }, 1000);
        }, 500);
    };


    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen text-white">Ładowanie dashboardu...</div>;
    }
    
    const noAnalysesLoaded = params.mode === 'my_analyses' && userCreatedAnalyses.length === 0 && analysisBlocksStore.length === 0;

    return (
        <div id="dashboard-view-content" className="dashboard-view-wrapper"> 
            <Sidebar activeTopic={currentDashboardContextTitle} onSelectTopic={handleSelectTopic} onNavigateToLanding={onNavigateToLanding} />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                <div className="main-content-bg p-6 md:p-8">
                    <div className="title-and-navigation-container">
                        <h1 id="main-analysis-title-react" className="text-2xl md:text-3xl font-bold text-white">
                            {currentDashboardContextTitle}
                        </h1>
                        {!noAnalysesLoaded && analysisBlocksStore.length > 0 && (
                            <div className="analysis-navigation-arrows">
                                <button 
                                    className="nav-arrow" 
                                    onClick={() => setCurrentAnalysisIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentAnalysisIndex === 0 || analysisBlocksStore.length === 0}
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
                    
                    {noAnalysesLoaded ? (
                         <div className="analysis-content-area">
                            <p className="text-center p-8 text-gray-400">Nie utworzyłeś jeszcze żadnych analiz. Przejdź do <a href="#" onClick={(e) => {e.preventDefault(); onNavigateToLanding();}} className="text-blue-400 hover:underline">strony głównej</a>, aby zaimportować plik CSV.</p>
                         </div>
                    ) : (
                        <AnalysisContent blocks={analysisBlocksStore} currentIndex={currentAnalysisIndex} />
                    )}

                    {!noAnalysesLoaded && <Chat messages={chatMessages} onSendMessage={handleSendMessage} />}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
