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
        const newQuestionIdCounter = isInitial ? questionIdCounter : questionIdCounter + 1;
        if (!isInitial) setQuestionIdCounter(newQuestionIdCounter);

        const analysisBlockId = isInitial ? 'initial-analysis' : `analysis-q-${newQuestionIdCounter}`;
        
        let blockTitleForNavigation;
        if (isInitial) {
            blockTitleForNavigation = topicContextForContent || questionText;
        } else {
            blockTitleForNavigation = `Odpowiedź na pytanie ${newQuestionIdCounter}`;
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
            } else if (effectiveTopicContext && effectiveTopicContext !== "Moje Analizy") { 
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
            findingsContent = `<p>W odpowiedzi na pytanie "${questionText}" (w kontekście: ${effectiveTopicContext}), Agent ustalił, że kluczowym elementem jest X. Na przykład, produkty Y wykazują tendencję Z.</p>`;
            thoughtProcessContent = `<p>Agent zastosował metodę A do analizy danych dotyczących "${questionText}". Porównano wskaźniki B i C.</p>`;
            newSuggestionsContent = [`Jak zmiana parametru D wpłynie na "${questionText.substring(0,15)}..."?`, `Czy można zidentyfikować inne czynniki wpływające na "${questionText.substring(0,15).toLowerCase()}..."?`];
        }

        const newBlock = { 
            id: analysisBlockId, 
            titleForBlock: blockTitleForNavigation, 
            question: questionText,
            findingsHeading, 
            findingsContent, 
            thoughtProcessContent, 
            newSuggestionsContent 
        };
        
        setAnalysisBlocksStore(prevBlocks => {
            const existingIndex = prevBlocks.findIndex(b => b.id === analysisBlockId);
            if (existingIndex > -1) {
                const updatedBlocks = [...prevBlocks];
                updatedBlocks[existingIndex] = newBlock;
                return updatedBlocks;
            }
            return [...prevBlocks, newBlock];
        });

        if (isInitial) {
             setCurrentAnalysisIndex(prevIndex => {
                const newIndex = analysisBlocksStore.findIndex(b => b.id === 'initial-analysis');
                return newIndex > -1 ? newIndex : 0;
            });
        } else {
            // Set current index to the newly added block
            // This needs to be done carefully as state updates are async
            // Handled by a separate useEffect below
        }
    }, [questionIdCounter, currentDashboardContextTitle]); // Added dependencies

    useEffect(() => { 
        if (analysisBlocksStore.length > 0 && !isInitialBlock(analysisBlocksStore[analysisBlocksStore.length -1])) {
             setCurrentAnalysisIndex(analysisBlocksStore.length -1);
        }
    }, [analysisBlocksStore]);

    const isInitialBlock = (block) => block && block.id === 'initial-analysis';


    useEffect(() => {
        setIsLoading(true);
        let mode = params.mode;
        let analysisName = params.analysisName;
        let fileName = params.fileName;
        let topicContext = params.topicContext; // This is for static topics if they were used
        let newContextTitle = "Moje Analizy";

        if (mode === 'my_analyses') {
            if (userCreatedAnalyses.length > 0) {
                const latestAnalysis = userCreatedAnalyses[0];
                analysisName = latestAnalysis.name;
                fileName = latestAnalysis.fileName;
                mode = 'real'; 
                newContextTitle = analysisName;
            } else {
                newContextTitle = "Moje Analizy";
                setAnalysisBlocksStore([]); 
                setChatMessages([]);
                setIsLoading(false);
                setCurrentDashboardContextTitle(newContextTitle);
                return; 
            }
        } else if (mode === 'real' && analysisName) {
            newContextTitle = analysisName;
        } else if (mode === 'classic' || !analysisName) { // Default to 'classic' or if no specific analysis
            newContextTitle = "Analiza Holistyczna"; // Default demo context
            mode = 'demo'; // Ensure mode is demo
        }
        
        setCurrentDashboardContextTitle(newContextTitle);
        setAnalysisBlocksStore([]); 
        setChatMessages([]);      

        if (mode === 'real') {
            generateAndDisplayFullAnalysis(`Analiza dla: ${analysisName} (Plik: ${fileName})`, true, true, newContextTitle);
            setChatMessages(prev => [...prev, { sender: 'ai', text: `Załadowano analizę: ${analysisName}` }]);
        } else { // Demo mode (includes 'classic' and fallback)
            generateAndDisplayFullAnalysis("Analiza Początkowa", true, false, newContextTitle);
        }
        
        // Add default demo questions after initial analysis block is set up
        if (mode === 'real' || mode === 'demo') {
            setTimeout(() => {
                const q1 = "Zidentyfikuj produkty, gdzie koszt przezbrojenia ma nieproporcjonalnie duży wpływ na całkowity koszt jednostkowy w stosunku do wolumenu produkcji.";
                generateAndDisplayFullAnalysis(q1, false, false, newContextTitle);
                setChatMessages(prev => [...prev, {sender: 'user', text: q1}, {sender: 'ai', text: `Agent analizuje: "${q1.substring(0,25)}...". Wyniki powyżej.`}]);
                
                const q2 = "Czy istnieje grupa produktów o podobnej strukturze kosztów, ale znacząco różniąca się rentownością godzinową? Jakie mogą być tego przyczyny?";
                generateAndDisplayFullAnalysis(q2, false, false, newContextTitle);
                setChatMessages(prev => [...prev, {sender: 'user', text: q2}, {sender: 'ai', text: `Agent analizuje: "${q2.substring(0,25)}...". Wyniki powyżej.`}]);
            }, 100);
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
        } else { // Static topic (though we removed them from display, logic kept for potential re-add)
            onNavigateToLanding({ dashboardParams: { topicContext: topic.name, mode: 'classic' }});
        }
    };

    const handleSendMessage = (messageText) => {
        setChatMessages(prev => [...prev, { sender: 'user', text: messageText }]);
        setTimeout(() => {
            const shortAiResponse = `Agent analizuje: "${messageText.substring(0,25)}...". Wyniki powyżej.`;
            setChatMessages(prev => [...prev, { sender: 'ai', text: shortAiResponse }]);
            generateAndDisplayFullAnalysis(messageText, false, false, currentDashboardContextTitle);
        }, 1000);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen text-white">Ładowanie dashboardu...</div>;
    }
    
    const noAnalysesLoaded = params.mode === 'my_analyses' && userCreatedAnalyses.length === 0;

    return (
        <div id="dashboard-view-content" className="dashboard-view-wrapper"> {/* Class from index.css */}
            <Sidebar activeTopic={currentDashboardContextTitle} onSelectTopic={handleSelectTopic} />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                <div className="main-content-bg p-6 md:p-8">
                    <div className="title-and-navigation-container">
                        <h1 id="main-analysis-title-react" className="text-2xl md:text-3xl font-bold text-white">
                            {currentDashboardContextTitle}
                        </h1>
                        {!noAnalysesLoaded && (
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