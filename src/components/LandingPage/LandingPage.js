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

    // New state for managing loading during analysis creation
    const [isCreatingAnalysis, setIsCreatingAnalysis] = useState(false);
    
    // Configuration flag to use sequential API calls (can be changed to false to use old approach)
    const USE_SEQUENTIAL_API = true;

    const csvFileInputRef = useRef(null);
    // Get addAnalysisToLocalState from the context to update the analyses list
    const { addAnalysisToLocalState } = useAnalysisContext();

    /**
     * Displays a message to the user via the CustomMessage component.
     * @param {string} message - The message to display.
     */
    const showAppMessage = (message) => {
        setCustomMessage(message);
        setIsCustomMessageActive(true);
    };

    /**
     * Handles the selection of a CSV file by the user.
     * Updates the UI to show the selected file's name and prepares
     * an initial name for the analysis based on the filename.
     * @param {Event} event - The file input change event.
     */
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setFileNameDisplay(`Wybrano: ${file.name}`);
            // Set initial analysis name based on filename (without extension)
            setInitialModalAnalysisName(file.name.replace(/\.[^/.]+$/, ""));
        } else {
            setSelectedFile(null);
            setFileNameDisplay('Nie wybrano pliku');
            setInitialModalAnalysisName('');
        }
        // Reset the file input value to allow re-selecting the same file if needed
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
     * This function now calls the backend using either the sequential or single-call approach.
     * @param {string} analysisName - The name chosen for the analysis.
     */
    const handleSubmitAnalysisName = async (analysisName) => {
        if (!selectedFile) {
            showAppMessage('Błąd: Plik nie jest już wybrany.');
            setIsAnalysisNameModalOpen(false);
            return;
        }

        setIsCreatingAnalysis(true); // Set loading state
        setIsAnalysisNameModalOpen(false); // Close the modal

        const formData = new FormData();
        formData.append('csvFile', selectedFile);
        formData.append('analysisName', analysisName);

        try {
            let finalResult;
            let analysisId;

            if (USE_SEQUENTIAL_API) {
                // NEW APPROACH: Sequential API calls to avoid timeouts
                
                // Step 1: Upload file and create initial analysis
                showAppMessage(`Krok 1/3: Przesyłanie pliku "${selectedFile.name}"...`);
                const uploadResult = await apiClient.csvInitiateUpload(formData);
                
                if (!uploadResult || !uploadResult.success || !uploadResult.analysisId) {
                    throw new Error(uploadResult?.message || 'Błąd podczas przesyłania pliku.');
                }

                analysisId = uploadResult.analysisId;
                const { csvContent } = uploadResult;

                // Step 2: Process CSV and generate summary
                showAppMessage(`Krok 2/3: Przetwarzanie danych CSV i generowanie podsumowania...`);
                const summaryResult = await apiClient.csvGenerateSummary(analysisId, csvContent);
                
                if (!summaryResult || !summaryResult.success) {
                    throw new Error(summaryResult?.message || 'Błąd podczas przetwarzania CSV.');
                }

                const { dataSummaryForPrompts } = summaryResult;

                // Step 3: Generate description and finalize
                showAppMessage(`Krok 3/3: Generowanie opisu danych i finalizacja analizy...`);
                finalResult = await apiClient.csvDescribeAndFinalize(analysisId, dataSummaryForPrompts);
                
                if (!finalResult || !finalResult.success) {
                    throw new Error(finalResult?.message || 'Błąd podczas finalizacji analizy.');
                }
            } else {
                // OLD APPROACH: Single API call (kept for backward compatibility)
                showAppMessage(`Przesyłanie i przetwarzanie pliku "${selectedFile.name}"... Proszę czekać.`);
                
                const result = await apiClient.uploadAndPreprocessCsv(formData);

                if (!result || !result.success || !result.analysisId) {
                    throw new Error(result?.message || 'Nieznany błąd backendu.');
                }

                analysisId = result.analysisId;
                finalResult = result;
            }

            showAppMessage(`Analiza "${analysisName}" utworzona pomyślnie!`);
            
            // Add the new analysis to the local context state
            if (addAnalysisToLocalState) {
                addAnalysisToLocalState({
                    analysisId: analysisId,
                    name: analysisName,
                    fileName: selectedFile.name,
                    type: 'real',
                    dataNatureDescription: finalResult.dataNatureDescription
                });
            }
            
            // Navigate to the dashboard
            onNavigateToDashboard({ 
                mode: 'load_topic', 
                analysisId: analysisId, 
                analysisName,
                fileName: selectedFile.name
            });

        } catch (error) {
            // Handle errors with user-friendly message
            showAppMessage(`Błąd: ${error.message}`);
        } finally {
            setIsCreatingAnalysis(false); // Clear loading state
            // Clear selected file after processing
            setSelectedFile(null);
            setFileNameDisplay('Nie wybrano pliku');
            setInitialModalAnalysisName('');
        }
    };

    return (
        <div className="landing-page-view-wrapper"> 
            <CustomMessage 
                message={customMessage} 
                isActive={isCustomMessageActive} 
                onClose={() => setIsCustomMessageActive(false)} 
            />
            <div className="landing-page-container">
                <h1 className="text-3xl font-bold mb-3 text-white">Analizator Danych CSV</h1>
                <p className="text-gray-400 mb-8 text-sm">
                    Prześlij plik CSV, aby uzyskać analizę opartą na AI, lub uruchom test z danymi demonstracyjnymi.
                </p>
                <input 
                    type="file" 
                    id="csv-file-input-react" 
                    accept=".csv" 
                    className="hidden" 
                    ref={csvFileInputRef}
                    onChange={handleFileSelect}
                    disabled={isCreatingAnalysis} // Disable file input during processing
                />
                <button 
                    onClick={() => csvFileInputRef.current.click()} 
                    className="btn btn-cyan mb-3"
                    disabled={isCreatingAnalysis} // Disable button during processing
                >
                    Wybierz plik CSV
                </button>
                <div className="file-name-display">{fileNameDisplay}</div>
                <button 
                    onClick={handleAnalyzeFileClick} 
                    className="btn btn-green" 
                    disabled={!selectedFile || isCreatingAnalysis} // Disable if no file or if processing
                >
                    {isCreatingAnalysis ? 'Przetwarzanie...' : 'Analizuj Plik'}
                </button>
                <div className="or-separator">LUB</div>
                <button 
                    onClick={() => onNavigateToDashboard({ mode: 'my_analyses' })} 
                    className="btn btn-purple mb-3"
                    disabled={isCreatingAnalysis} // Disable during processing
                >
                    Przeglądaj Moje Analizy
                </button>
                <button 
                    onClick={() => setIsDigitalTwinModalOpen(true)} 
                    className="btn btn-magenta"
                    disabled={isCreatingAnalysis} // Disable during processing
                >
                    Połącz z Witness Digital Twin
                </button>
            </div>
            <button 
                onClick={() => onNavigateToDashboard({ mode: 'classic' })} 
                className="btn landing-footer-link"
                disabled={isCreatingAnalysis} // Disable during processing
            >
                Analizator Danych CSV - Wersja Klasyczna
            </button>

            <AnalysisNameModal 
                isOpen={isAnalysisNameModalOpen}
                onClose={() => setIsAnalysisNameModalOpen(false)}
                onSubmit={handleSubmitAnalysisName}
                initialName={initialModalAnalysisName}
                showMessage={showAppMessage}
            />
            <DigitalTwinModal 
                isOpen={isDigitalTwinModalOpen}
                onClose={() => setIsDigitalTwinModalOpen(false)}
                showMessage={showAppMessage}
            />
        </div>
    );
};

export default LandingPage;
