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
     * This function now calls the backend to upload and process the CSV.
     * @param {string} analysisName - The name chosen for the analysis.
     */
    const handleSubmitAnalysisName = async (analysisName) => {
        if (!selectedFile) {
            showAppMessage('Błąd: Plik nie jest już wybrany.');
            setIsAnalysisNameModalOpen(false);
            return;
        }

        setIsCreatingAnalysis(true); // Set loading state
        showAppMessage(`Przesyłanie i przetwarzanie pliku "${selectedFile.name}"... Proszę czekać.`);
        setIsAnalysisNameModalOpen(false); // Close the modal

        const formData = new FormData();
        formData.append('csvFile', selectedFile); // Key 'csvFile' as expected by backend
        formData.append('analysisName', analysisName);

        try {
            // Call the backend API to upload and preprocess the CSV
            const result = await apiClient.uploadAndPreprocessCsv(formData);

            if (result && result.success && result.analysisId) {
                showAppMessage(`Analiza "${analysisName}" utworzona pomyślnie. ID: ${result.analysisId}`);
                
                // Add the new analysis to the local context state
                // The backend should return enough info, or we might need a specific object structure.
                // Assuming result contains { analysisId, analysisName (user input), originalFileName }
                // and we can derive the rest or the backend provides it.
                if (addAnalysisToLocalState) {
                    addAnalysisToLocalState({
                        analysisId: result.analysisId,
                        name: analysisName, // The name user provided
                        fileName: selectedFile.name, // Original file name
                        type: 'real', // Mark as a real analysis
                        // createdAt: new Date().toISOString(), // Or ideally from backend response
                        // dataNatureDescription: result.dataNatureDescription // If backend returns this
                    });
                }
                
                // Navigate to the dashboard.
                // 'load_topic' mode will signal Dashboard.js to fetch the initial analysis for this new entry.
                onNavigateToDashboard({ 
                    mode: 'load_topic', 
                    analysisId: result.analysisId, 
                    analysisName, // Pass the user-given name for display
                    fileName: selectedFile.name // Pass the original file name
                });
            } else {
                // Handle cases where backend indicates failure or returns unexpected structure
                showAppMessage(`Błąd tworzenia analizy: ${result ? result.message : 'Nieznany błąd backendu.'}`);
            }
        } catch (error) {
            // Handle network errors or errors thrown by apiClient
            showAppMessage(`Błąd serwera podczas tworzenia analizy: ${error.message}`);
        } finally {
            setIsCreatingAnalysis(false); // Clear loading state
            // Clear selected file after processing to prevent re-submission without re-selection
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