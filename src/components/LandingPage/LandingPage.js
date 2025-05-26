// src/components/LandingPage/LandingPage.js
import React, { useState, useRef } from 'react';
import { useAnalysisContext } from '../../contexts/AnalysisContext';
import AnalysisNameModal from '../Modals/AnalysisNameModal';
import DigitalTwinModal from '../Modals/DigitalTwinModal';
import CustomMessage from '../UI/CustomMessage';
import { apiClient } from '../../services/apiClient'; // Import the apiClient

const LandingPage = ({ onNavigateToDashboard }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileNameDisplay, setFileNameDisplay] = useState('Nie wybrano pliku');
    const [isAnalysisNameModalOpen, setIsAnalysisNameModalOpen] = useState(false);
    const [initialModalAnalysisName, setInitialModalAnalysisName] = useState('');
    const [isDigitalTwinModalOpen, setIsDigitalTwinModalOpen] = useState(false);
    
    const [customMessage, setCustomMessage] = useState('');
    const [isCustomMessageActive, setIsCustomMessageActive] = useState(false);
    const [messageTimeoutId, setMessageTimeoutId] = useState(null); // To manage message auto-close

    // New state for managing overall processing across multiple steps
    const [isProcessing, setIsProcessing] = useState(false);

    const csvFileInputRef = useRef(null);
    const { addAnalysisToLocalState } = useAnalysisContext();

    /**
     * Displays a message to the user via the CustomMessage component.
     * @param {string} message - The message to display.
     * @param {number} duration - How long to display the message in ms. 0 for manual close.
     */
    const showAppMessage = (message, duration = 4000) => {
        if (messageTimeoutId) {
            clearTimeout(messageTimeoutId); // Clear previous timeout if a new message comes quickly
        }
        setCustomMessage(message);
        setIsCustomMessageActive(true);
        
        if (duration > 0) {
            const newTimeoutId = setTimeout(() => {
                setIsCustomMessageActive(false);
                setCustomMessage(''); // Clear message content after hiding
            }, duration);
            setMessageTimeoutId(newTimeoutId);
        } else {
            setMessageTimeoutId(null); // No auto-close, manual close or next message will handle
        }
    };
    
    /**
     * Clears the selected file and resets related UI elements.
     */
    const clearFileSelection = () => {
        setSelectedFile(null);
        setFileNameDisplay('Nie wybrano pliku');
        setInitialModalAnalysisName('');
        if (csvFileInputRef.current) {
            csvFileInputRef.current.value = ""; // Important to allow re-selecting the same file
        }
    };

    /**
     * Handles the selection of a CSV file by the user.
     * @param {Event} event - The file input change event.
     */
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== "text/csv" && !file.name.toLowerCase().endsWith(".csv")) {
                showAppMessage('Proszę wybrać plik w formacie CSV.', 5000);
                clearFileSelection();
                return;
            }
            setSelectedFile(file);
            setFileNameDisplay(`Wybrano: ${file.name}`);
            // Set initial analysis name based on filename (without extension)
            setInitialModalAnalysisName(file.name.replace(/\.[^/.]+$/, ""));
        } else {
            // This case might occur if the user cancels the file dialog
            clearFileSelection();
        }
        // Reset the file input value to allow re-selecting the same file if needed
        // This is now done in clearFileSelection and after successful selection
        if (csvFileInputRef.current) {
           csvFileInputRef.current.value = "";
        }
    };

    /**
     * Handles the click on the "Analizuj Plik" button.
     * Opens the AnalysisNameModal if a file is selected, otherwise shows a message.
     */
    const handleAnalyzeFileClick = () => {
        if (selectedFile) {
            setIsAnalysisNameModalOpen(true);
        } else {
            showAppMessage('Najpierw wybierz plik CSV.');
        }
    };

    /**
     * Handles the submission of the analysis name from the modal.
     * This function now calls the backend API in three sequential steps.
     * @param {string} analysisName - The name chosen for the analysis.
     */
    const handleSubmitAnalysisName = async (analysisName) => {
        if (!selectedFile) {
            showAppMessage('Błąd: Plik nie jest już wybrany. Proszę wybrać plik ponownie.');
            setIsAnalysisNameModalOpen(false);
            clearFileSelection(); // Ensure UI is reset
            return;
        }

        setIsProcessing(true); // Set overall processing state
        setIsAnalysisNameModalOpen(false); // Close the name input modal
        let currentAnalysisId; // To store analysisId across steps

        try {
            // --- Step 1: Initiate Upload ---
            showAppMessage(`Krok 1/3: Przesyłanie pliku "${selectedFile.name}"...`, 0); // 0 duration = manual close or next message
            const formData = new FormData();
            formData.append('csvFile', selectedFile);
            formData.append('analysisName', analysisName);

            const uploadResult = await apiClient.initiateCsvUpload(formData);
            if (!uploadResult || !uploadResult.success || !uploadResult.analysisId) {
                throw new Error(uploadResult.message || 'Krok 1: Nie udało się zainicjować przesyłania pliku.');
            }
            currentAnalysisId = uploadResult.analysisId; // Store for subsequent steps
            const originalFileName = uploadResult.originalFileName; // Get originalFileName from response
            showAppMessage(`Krok 1/3: Przesyłanie pliku zakończone. ID Analizy: ${currentAnalysisId}`, 5000);

            // --- Step 2: Generate Summary ---
            showAppMessage(`Krok 2/3: Przetwarzanie CSV i generowanie podsumowania... To może chwilę potrwać.`, 0);
            const summaryResult = await apiClient.generateCsvSummary(currentAnalysisId);
            if (!summaryResult || !summaryResult.success || !summaryResult.dataSummaryForPrompts) {
                throw new Error(summaryResult.message || 'Krok 2: Nie udało się wygenerować podsumowania danych.');
            }
            const dataSummaryForPrompts = summaryResult.dataSummaryForPrompts; // Store for next step
            showAppMessage('Krok 2/3: Podsumowanie danych wygenerowane.', 5000);

            // --- Step 3: Describe and Finalize ---
            showAppMessage(`Krok 3/3: Generowanie opisu danych i finalizacja analizy...`, 0);
            const finalizeResult = await apiClient.describeAndFinalizeCsv(currentAnalysisId, dataSummaryForPrompts);
            if (!finalizeResult || !finalizeResult.success) {
                throw new Error(finalizeResult.message || 'Krok 3: Nie udało się sfinalizować analizy.');
            }
            showAppMessage(`Analiza "${analysisName}" utworzona pomyślnie! ID: ${currentAnalysisId}. Przekierowywanie...`, 5000);
            
            // Add the new analysis to the local context state
            if (addAnalysisToLocalState) {
                addAnalysisToLocalState({
                    analysisId: finalizeResult.analysisId, // Should be same as currentAnalysisId
                    name: finalizeResult.analysisName,     // Name provided by user, returned by API
                    fileName: finalizeResult.originalFileName, // originalFileName from API
                    type: 'real', // Mark as a real analysis
                    // dataNatureDescription: finalizeResult.dataNatureDescription, // Also available
                    // createdAt: new Date().toISOString(), // Or ideally from backend response if not already there
                });
            }
            
            // Navigate to the dashboard to load the newly created analysis
            onNavigateToDashboard({ 
                mode: 'load_topic', // Signal Dashboard to fetch initial topic data
                analysisId: finalizeResult.analysisId, 
                analysisName: finalizeResult.analysisName,
                fileName: finalizeResult.originalFileName,
                // topicId: "default_topic_id" // Or whatever default topic is configured
            });

        } catch (error) {
            console.error("Error during multi-step analysis creation:", error);
            showAppMessage(`Błąd podczas przetwarzania: ${error.message || 'Nieznany błąd.'}`, 8000); // Longer display for error
            // Optionally, inform the backend about the failure if an analysisId was created
            if (currentAnalysisId) {
                console.warn(`Processing failed for analysisId ${currentAnalysisId}. Consider backend cleanup or error status update.`);
                // Example: await apiClient.markAnalysisAsFailed(currentAnalysisId, error.message);
            }
        } finally {
            setIsProcessing(false); // Clear overall processing state
            clearFileSelection(); // Clear the selected file from UI after success or failure
            // Let the last message (success or error) persist based on its own duration
        }
    };

    return (
        <div className="landing-page-view-wrapper"> 
            <CustomMessage 
                message={customMessage} 
                isActive={isCustomMessageActive} 
                onClose={() => { // Allow manual closing of messages
                    setIsCustomMessageActive(false);
                    if (messageTimeoutId) clearTimeout(messageTimeoutId);
                    setCustomMessage('');
                }} 
            />
            <div className="landing-page-container">
                <h1 className="text-3xl font-bold mb-3 text-white">Analizator Danych CSV</h1>
                <p className="text-gray-400 mb-8 text-sm">
                    Prześlij plik CSV, aby uzyskać analizę opartą na AI, lub uruchom test z danymi demonstracyjnymi.
                </p>
                <input 
                    type="file" 
                    id="csv-file-input-react" 
                    accept=".csv,text/csv" // More robust accept types
                    className="hidden" 
                    ref={csvFileInputRef}
                    onChange={handleFileSelect}
                    disabled={isProcessing} // Disable file input during processing
                />
                <button 
                    onClick={() => csvFileInputRef.current.click()} 
                    className="btn btn-cyan mb-3"
                    disabled={isProcessing} // Disable button during processing
                >
                    Wybierz plik CSV
                </button>
                <div className="file-name-display">{fileNameDisplay}</div>
                <button 
                    onClick={handleAnalyzeFileClick} 
                    className="btn btn-green" 
                    disabled={!selectedFile || isProcessing} // Disable if no file or if processing
                >
                    {isProcessing ? 'Przetwarzanie...' : 'Analizuj Plik'}
                </button>
                <div className="or-separator">LUB</div>
                <button 
                    onClick={() => onNavigateToDashboard({ mode: 'my_analyses' })} 
                    className="btn btn-purple mb-3"
                    disabled={isProcessing} // Disable during processing
                >
                    Przeglądaj Moje Analizy
                </button>
                <button 
                    onClick={() => setIsDigitalTwinModalOpen(true)} 
                    className="btn btn-magenta"
                    disabled={isProcessing} // Disable during processing
                >
                    Połącz z Witness Digital Twin
                </button>
            </div>
            <button 
                onClick={() => onNavigateToDashboard({ mode: 'classic' })} 
                className="btn landing-footer-link"
                disabled={isProcessing} // Disable during processing
            >
                Analizator Danych CSV - Wersja Klasyczna
            </button>

            <AnalysisNameModal 
                isOpen={isAnalysisNameModalOpen}
                onClose={() => setIsAnalysisNameModalOpen(false)}
                onSubmit={handleSubmitAnalysisName}
                initialName={initialModalAnalysisName}
                showMessage={showAppMessage} // Pass down for modal to use
            />
            <DigitalTwinModal 
                isOpen={isDigitalTwinModalOpen}
                onClose={() => setIsDigitalTwinModalOpen(false)}
                showMessage={showAppMessage} // Pass down
            />
        </div>
    );
};

export default LandingPage;
