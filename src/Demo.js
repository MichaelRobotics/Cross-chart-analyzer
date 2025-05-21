// App.jsx - Rewritten CSV Data Analyzer Application

import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// --- Configuration & Constants ---

const APP_TITLE = "Analizator Danych CSV";
const APP_SUBTITLE_FULL = "Prześlij plik CSV, aby uzyskać analizę opartą na AI, lub uruchom test z danymi demonstracyjnymi.";
const APP_SUBTITLE_DEMO_ONLY = "Uruchom test z danymi demonstracyjnymi, aby zobaczyć symulowaną analizę.";

const PREDEFINED_TOPICS = [
    { id: "bottlenecks", title: "Wąskie Gardła w Procesie", question: "Analyze the provided CSV data for potential bottlenecks. Identify where they might occur, their impact, and the largest bottleneck. Provide a concise summary." },
    { id: "utilization", title: "Wykorzystanie Stanowisk Pracy", question: "Based on the CSV data, analyze workstation utilization. Note any under/overutilization and average/lowest availability if inferable. Provide a concise summary." },
    { id: "quality", title: "Jakość", question: "Examine the CSV for insights into product/process quality. Indicate any quality issues or their absence. Provide a concise summary." },
    { id: "changeovers", title: "Przezbrojenia", question: "Analyze the CSV for information on changeovers/retooling and their impact on efficiency. Provide a concise summary." },
    { id: "employees", title: "Pracownicy", question: "Based on the CSV, analyze employee workload/efficiency. Note any imbalances or issues with operator numbers. Provide a concise summary." },
    { id: "costs", title: "Koszty", question: "Analyze the CSV to identify key cost drivers, largest/smallest cost categories, and potential ROI if data supports it. Provide a concise summary." },
    { id: "energy", title: "Zużycie Energii", question: "Examine the CSV for energy consumption patterns. Which workstations/products consume most energy if inferable? Provide a concise summary." },
    { id: "downtime", title: "Awarie Przestoje", question: "Analyze the CSV for failures/unplanned downtime and their impact on the process. Provide a concise summary." }
];

const SAMPLE_CSV_DATA_FOR_DEMO = `Workstation,Status,TasksCompleted,ProcessingTime_min,Energy_kWh,MaterialCost_PLN,LaborCost_PLN,Downtime_hours,DefectRate_%,ChangeoverTime_min,OperatorWorkload_%
ST1,Operational,150,30,15,2500,1200,2,1.5,45,75
ST2,Maintenance,0,0,2,100,50,8,0,0,0
ST3,Operational,200,25,20,3000,1500,1,0.5,30,90
ST4,Idle,50,60,5,1000,800,0,2.0,60,40
ST5,Operational,180,28,18,2800,1400,1.5,1.0,35,85
`;

const SIMULATED_ANALYSIS_RESULTS = PREDEFINED_TOPICS.map(topic => {
    let simulatedAnswer = `To jest symulowana odpowiedź dla tematu: "${topic.title}". `;
    switch (topic.id) {
        case "bottlenecks":
            simulatedAnswer += "Na podstawie przykładowych danych, ST2 (Konserwacja) i ST4 (Bezczynność z długim czasem przetwarzania) wydają się być wąskimi gardłami. ST2 powoduje 8h przestoju, a ST4 przetwarza tylko 50 zadań w 60 minut.";
            break;
        case "utilization":
            simulatedAnswer += "Stanowiska ST3 (90%) i ST5 (85%) wykazują wysokie wykorzystanie. ST4 (40%, Bezczynne) jest niedociążone. ST2 ma 0% wykorzystania (Konserwacja).";
            break;
        case "quality":
            simulatedAnswer += "Ogólny wskaźnik defektów jest niski. ST4 ma najwyższy (2.0%) przy niskiej liczbie zadań, co może wymagać uwagi.";
            break;
        case "costs":
            simulatedAnswer += "ST3 generuje najwyższe koszty operacyjne (Materiały: 3000 PLN, Praca: 1500 PLN). Przestój ST2 (8h) to znaczący koszt pośredni.";
            break;
        default:
            simulatedAnswer += "Analiza tego aspektu wymagałaby bardziej szczegółowych danych lub specyficznych kolumn w pliku CSV, których przykładowe dane mogą nie zawierać w pełni. Dla celów demonstracyjnych, przyjmujemy, że dane są wystarczające do podstawowej oceny.";
    }
    return { ...topic, answer: simulatedAnswer };
});

// --- Helper Components ---

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-sky-500"></div>
);

const ErrorMessage = ({ message }) => (
    <p className="text-red-400 mt-4 bg-red-900/30 p-3 rounded-md text-sm">{message}</p>
);

// --- Chat Interface Component ---
function ChatInterface({ originalCsvData }) {
    const [messages, setMessages] = useState([
        { sender: 'ai', text: 'Witaj! Zadaj pytanie dotyczące przeanalizowanych danych CSV. Pamiętaj, że to jest symulowany czat.' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isAiTyping, setIsAiTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
    };

    const handleSendMessage = () => {
        if (inputValue.trim() === '') return;

        const newUserMessage = { sender: 'user', text: inputValue };
        setMessages(prevMessages => [...prevMessages, newUserMessage]);
        setInputValue('');
        setIsAiTyping(true);

        // Simulate AI response
        setTimeout(() => {
            let aiResponseText = "To jest symulowana odpowiedź. W rzeczywistej aplikacji, zadałbym to pytanie do AI w kontekście danych:\n\n";
            if (inputValue.toLowerCase().includes("st1")) {
                aiResponseText += "Odnośnie ST1: Zgodnie z danymi, ST1 jest operacyjne, wykonało 150 zadań z czasem przetwarzania 30 min i obciążeniem operatora 75%.";
            } else if (inputValue.toLowerCase().includes("koszt")) {
                aiResponseText += "Odnośnie kosztów: Dane CSV zawierają kolumny MaterialCost_PLN i LaborCost_PLN. Czy chcesz podsumowanie tych kosztów dla konkretnego stanowiska?";
            } else if (inputValue.toLowerCase().includes("podsumuj dane")) {
                 aiResponseText += `Oto fragment oryginalnych danych CSV, o które możesz pytać:\n${originalCsvData.substring(0, 200)}... (więcej danych dostępnych dla AI)`;
            }
            else {
                aiResponseText += `Twoje pytanie: "${newUserMessage.text}". W pełnej wersji, przeanalizowałbym to w kontekście danych CSV.`;
            }
            
            const newAiMessage = { sender: 'ai', text: aiResponseText };
            setMessages(prevMessages => [...prevMessages, newAiMessage]);
            setIsAiTyping(false);
        }, 1000 + Math.random() * 1000);
    };

    return (
        <div className="mt-8 pt-6 border-t border-slate-700">
            <h3 className="text-xl font-semibold mb-4 text-sky-400">Dodatkowe Pytania (Symulowany Czat)</h3>
            <div className="bg-slate-700/50 p-4 rounded-lg h-64 overflow-y-auto mb-4 flex flex-col space-y-3">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-3 rounded-xl text-sm md:text-base
                            ${msg.sender === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-600 text-slate-200'}`}>
                            {msg.text.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    </div>
                ))}
                {isAiTyping && (
                    <div className="flex justify-start">
                         <div className="max-w-[70%] p-3 rounded-xl bg-slate-600 text-slate-200 text-sm md:text-base">
                            <span className="italic">AI pisze...</span>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="flex space-x-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Zadaj pytanie..."
                    className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-100 placeholder-slate-400"
                />
                <button
                    onClick={handleSendMessage}
                    className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-5 rounded-lg transition duration-150 ease-in-out"
                >
                    Wyślij
                </button>
            </div>
        </div>
    );
}


// --- Core Page Components ---

function LandingPage({ onAnalyzeFile, onDemoTest, isLoading }) {
    const [file, setFile] = useState(null);
    const [localError, setLocalError] = useState('');

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setLocalError('');
        }
    };

    const handleSubmitFile = () => {
        if (!file) {
            setLocalError('Proszę wybrać plik CSV do analizy.');
            return;
        }
        onAnalyzeFile(file);
    };
    const isApiAnalysisEnabled = true; 

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-6 font-sans">
            <div className="bg-slate-800 p-8 md:p-12 rounded-xl shadow-2xl w-full max-w-xl text-center">
                <h1 className="text-4xl md:text-5xl font-bold mb-3 text-sky-400">{APP_TITLE}</h1>
                <p className="text-slate-300 mb-8 text-lg">
                    {isApiAnalysisEnabled ? APP_SUBTITLE_FULL : APP_SUBTITLE_DEMO_ONLY}
                </p>

                {isApiAnalysisEnabled && (
                    <>
                        <div className="mb-6 space-y-3">
                            <div>
                                <label htmlFor="file-upload" className="w-full cursor-pointer bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-lg inline-block transition duration-150 ease-in-out shadow-md hover:shadow-lg">
                                    {file ? `Wybrano: ${file.name}` : 'Wybierz plik CSV'}
                                </label>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>
                            <button
                                onClick={handleSubmitFile}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-xl transition duration-150 ease-in-out shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!file || isLoading}
                            >
                                Analizuj Plik (Wymaga API)
                            </button>
                        </div>
                        <div className="my-4 flex items-center">
                            <hr className="flex-grow border-t border-slate-700" />
                            <span className="px-3 text-slate-500 text-sm">LUB</span>
                            <hr className="flex-grow border-t border-slate-700" />
                        </div>
                    </>
                )}

                <button
                    onClick={onDemoTest}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg text-xl transition duration-150 ease-in-out shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                >
                    Uruchom Test z Danymi Demo
                </button>

                {localError && <ErrorMessage message={localError} />}
            </div>
            <footer className="absolute bottom-4 text-center w-full text-slate-500 text-sm">
                {APP_TITLE} - Wersja demonstracyjna
            </footer>
        </div>
    );
}

function ResultsPage({ analysisResults, isLoading, globalError, originalCsvDataForChat }) {
    const navigate = useNavigate();
    const [activeTopic, setActiveTopic] = useState(null);

    const safeResults = Array.isArray(analysisResults) ? analysisResults : [];

    useEffect(() => {
        if (safeResults.length > 0) {
            const currentActiveStillValid = activeTopic && safeResults.find(r => r.id === activeTopic.id);
            if (!currentActiveStillValid) {
                setActiveTopic(safeResults[0]);
            }
        } else {
            setActiveTopic(null);
        }
    }, [safeResults, activeTopic]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
                <LoadingSpinner />
                <p className="mt-4 text-xl">Analizowanie danych...</p>
            </div>
        );
    }

    if (globalError) {
         return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
                <h2 className="text-3xl font-semibold mb-4 text-red-400">Błąd Analizy</h2>
                <ErrorMessage message={globalError} />
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-150"
                >
                    Wróć do strony głównej
                </button>
            </div>
        );
    }
    
    if (safeResults.length === 0 && !isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
                <h2 className="text-3xl font-semibold mb-4 text-sky-400">Brak wyników</h2>
                <p className="text-slate-300 mb-6">Nie udało się wygenerować analizy lub nie ma dostępnych wyników.</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-150"
                >
                    Wróć do strony głównej
                </button>
            </div>
        );
    }

    const getHtmlForAnswer = (answerText) => {
        if (answerText === null || answerText === undefined) {
            return { __html: "Analiza dla tego tematu jest niedostępna." };
        }
        return { __html: String(answerText).replace(/\n/g, '<br />') };
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col md:flex-row p-4 md:p-6 space-y-4 md:space-y-0 md:space-x-6 font-sans">
            <aside className="md:w-1/3 lg:w-1/4 bg-slate-800 p-6 rounded-xl shadow-xl flex flex-col" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
                <h2 className="text-2xl font-semibold mb-6 text-sky-400 border-b border-slate-700 pb-3">Tematy Analizy</h2>
                <nav className="flex-grow overflow-y-auto pr-2">
                    <ul>
                        {safeResults.map((result) => (
                            <li key={result.id} className="mb-2">
                                <button
                                    onClick={() => setActiveTopic(result)}
                                    className={`w-full text-left p-3 rounded-md transition-all duration-150 ease-in-out focus:outline-none
                                        ${activeTopic && activeTopic.id === result.id
                                            ? 'bg-sky-600 text-white shadow-md'
                                            : 'hover:bg-slate-700 text-slate-300'}`}
                                >
                                    {result.title || 'Brak tytułu'}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <button
                    onClick={() => navigate('/')}
                    className="mt-8 w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-150 ease-in-out shadow-md flex-shrink-0"
                >
                    Analizuj Nowy Plik
                </button>
            </aside>

            <main className="md:w-2/3 lg:w-3/4 bg-slate-800 p-6 md:p-8 rounded-xl shadow-xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
                {activeTopic ? (
                    <>
                        <h1 className="text-3xl font-bold mb-6 text-sky-400 border-b border-slate-700 pb-3">
                            {activeTopic.title || 'Brak tytułu'}
                        </h1>
                        <div
                            className="prose prose-invert prose-sm sm:prose-base max-w-none text-slate-200 leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={getHtmlForAnswer(activeTopic.answer)}
                        />
                        {/* Integrate Chat Interface here, pass original CSV data if available */}
                        <ChatInterface originalCsvData={originalCsvDataForChat || SAMPLE_CSV_DATA_FOR_DEMO} />
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400 text-xl">Wybierz temat z listy po lewej stronie, aby wyświetlić analizę.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

function App() {
    const [analysisResults, setAnalysisResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [globalError, setGlobalError] = useState('');
    const [originalCsvForChat, setOriginalCsvForChat] = useState(SAMPLE_CSV_DATA_FOR_DEMO); // Store CSV for chat
    const navigate = useNavigate();

    const handleAnalyzeFileWithApi = async (fileObject) => {
        setIsLoading(true);
        setGlobalError('');
        setAnalysisResults([]); 

        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvDataString = event.target.result;
            setOriginalCsvForChat(csvDataString); // Save for chat context
            try {
                const response = await fetch('/api/analyze', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csvData: csvDataString, topics: PREDEFINED_TOPICS }),
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || `Błąd serwera: ${response.status} - ${response.statusText}`);
                }

                const results = await response.json();
                if (!results.analysis || !Array.isArray(results.analysis)) {
                    throw new Error("Odpowiedź serwera nie zawierała oczekiwanych danych analizy.");
                }
                setAnalysisResults(results.analysis);
                navigate('/results');
            } catch (err) {
                console.error("Błąd podczas analizy pliku:", err);
                setGlobalError(`Nie udało się przeanalizować pliku: ${err.message}. Sprawdź konsolę przeglądarki i serwera (jeśli dotyczy) po więcej szczegółów.`);
                navigate('/results'); 
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            console.error("Błąd odczytu pliku.");
            setGlobalError("Nie udało się odczytać pliku.");
            setIsLoading(false);
            navigate('/results');
        };
        reader.readAsText(fileObject);
    };

    const handleDemoTestFlow = () => {
        setIsLoading(true);
        setGlobalError('');
        setAnalysisResults([]); 
        setOriginalCsvForChat(SAMPLE_CSV_DATA_FOR_DEMO); // Set sample CSV for chat

        setTimeout(() => {
            setAnalysisResults(SIMULATED_ANALYSIS_RESULTS);
            navigate('/results');
            setIsLoading(false);
        }, 800); 
    };

    return (
        <Routes>
            <Route 
                path="/" 
                element={<LandingPage 
                            onAnalyzeFile={handleAnalyzeFileWithApi} 
                            onDemoTest={handleDemoTestFlow}
                            isLoading={isLoading} 
                         />} 
            />
            <Route 
                path="/results" 
                element={<ResultsPage 
                            analysisResults={analysisResults} 
                            isLoading={isLoading}
                            globalError={globalError} 
                            originalCsvDataForChat={originalCsvForChat} // Pass CSV to results for chat
                         />} 
            />
        </Routes>
    );
}

function AppWrapper() {
    return (
        <Router>
            <App />
        </Router>
    )
}

export default AppWrapper;


// --- Serverless Function (api/analyze.js) ---
// This file should be created in your project's 'api' directory for Vercel.
/*
// Example: api/analyze.js (Node.js)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""; 

async function callGeminiAPI(prompt, csvStringData) {
    const fullPrompt = `${prompt}\n\nOto dane CSV do analizy:\n\`\`\`csv\n${csvStringData}\n\`\`\``;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error Response:", errorData); 
            const message = errorData?.error?.message || response.statusText || "Nieznany błąd API Gemini";
            throw new Error(`Błąd żądania do API Gemini: ${message} (Status: ${response.status})`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason) {
            console.warn("Odpowiedź API Gemini wskazuje na filtrowanie treści lub inny problem:", 
                         data.candidates[0].finishReason, data.candidates[0].safetyRatings);
            return `Analiza nie mogła zostać w pełni wygenerowana. Powód: ${data.candidates[0].finishReason}. Sprawdź dane lub prompt.`;
        } else {
            console.warn("Nieoczekiwana struktura odpowiedzi API Gemini:", data);
            return "Analiza nie mogła zostać wygenerowana z powodu nieoczekiwanego formatu odpowiedzi API.";
        }
    } catch (error) {
        console.error('Błąd podczas wywoływania API Gemini:', error);
        return `Błąd podczas analizy AI: ${error.message}. Sprawdź klucz API, dane CSV i prompt.`;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Metoda ${req.method} jest niedozwolona.` });
    }

    try {
        const { csvData, topics } = req.body;

        if (typeof csvData !== 'string' || !topics || !Array.isArray(topics) || topics.length === 0) {
            return res.status(400).json({ error: 'Nieprawidłowe ciało żądania: csvData musi być ciągiem znaków, a topics tablicą niepustą.' });
        }
        
        if (!GEMINI_API_KEY) {
             console.error("Zmienna środowiskowa GEMINI_API_KEY nie jest ustawiona.");
             return res.status(500).json({ error: "Usługa AI nie jest skonfigurowana. Brak klucza API." });
        }

        const analysisPromises = topics.map(topic => 
            callGeminiAPI(topic.question, csvData) 
                .then(answer => ({ 
                    id: topic.id, 
                    title: topic.title, 
                    answer: answer || "Brak dostępnej analizy dla tego tematu." 
                }))
                .catch(error => ({
                    id: topic.id, 
                    title: topic.title, 
                    answer: `Błąd analizy tego tematu: ${error.message}`
                }))
        );

        const analysisResults = await Promise.all(analysisPromises);

        return res.status(200).json({ analysis: analysisResults });

    } catch (error) {
        console.error('Błąd w /api/analyze:', error);
        return res.status(500).json({ error: `Wewnętrzny błąd serwera: ${error.message}` });
    }
};
*/