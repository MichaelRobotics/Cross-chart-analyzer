// src/components/LandingPage/NewLandingPage.js
import React, { useState, useRef, useEffect } from 'react'; // useEffect is imported
import NewStyledButton from '../UI/NewStyledButton';
import NewWitnessModal from '../Modals/NewWitnessModal';
import AnalysisNameModal from '../Modals/AnalysisNameModal';
import { apiClient } from '../../services/apiClient';
import { useAnalysisContext } from '../../contexts/AnalysisContext';

// SVG Paths for icons
const UploadIconPath = "M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 10.5a2.25 2.25 0 002.25 2.25c1.004 0 1.875-.694 2.148-1.683A5.25 5.25 0 0112 6.75c2.118 0 3.906 1.226 4.602 3.017.273.989 1.144 1.683 2.148 1.683A2.25 2.25 0 0021 10.5M3 16.5v-6M21 16.5v-6";
const AnalyzeIconPath = "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75";
const BrowseIconPath = "M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776";
const WitnessIconPath = "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244";

/**
 * NewLandingPage component with updated design, integrated AnalysisNameModal,
 * and logo animation.
 * @param {function} onNavigateToDashboard - Function to navigate to the dashboard view.
 */
const NewLandingPage = ({ onNavigateToDashboard }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState('info');
    const [isLoadingAnalyze, setIsLoadingAnalyze] = useState(false);
    const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);
    const [isWitnessModalOpen, setIsWitnessModalOpen] = useState(false);
    const [fileInputButtonLabel, setFileInputButtonLabel] = useState('Wybierz plik z danymi');
    const [analyzeButtonCueClass, setAnalyzeButtonCueClass] = useState('');
    const [isLogoVisible, setIsLogoVisible] = useState(false); // State for logo visibility animation

    // State for AnalysisNameModal
    const [isAnalysisNameModalOpen, setIsAnalysisNameModalOpen] = useState(false);
    const [initialModalAnalysisName, setInitialModalAnalysisName] = useState('');

    const csvFileInputRef = useRef(null);
    const { addAnalysisToLocalState } = useAnalysisContext();

    // Effect for logo entrance animation
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLogoVisible(true);
        }, 300); // Delay before logo starts appearing (adjust as needed)
        return () => clearTimeout(timer); // Cleanup timer on component unmount
    }, []); // Empty dependency array ensures this runs only once on mount

    /**
     * Displays a status message on the landing page.
     * @param {string} message - The message text.
     * @param {string} type - Message type ('info', 'success', 'error').
     * @param {number|null} duration - Auto-clear duration in ms. Null for no auto-clear.
     */
    const showAppStatusMessage = (message, type = 'info', duration = 5000) => {
        setStatusMessage(message);
        setStatusType(type);
        if (duration) {
            const messageClearTimer = setTimeout(() => {
                // Clear message only if it's still the same one to avoid race conditions
                setStatusMessage(prevMessage => (prevMessage === message ? '' : prevMessage));
            }, duration);
            // Optional: return a cleanup function if this component could unmount while timer is active
            // return () => clearTimeout(messageClearTimer);
        }
    };

    /**
     * Handles file selection from the input.
     * @param {Event} event - The file input change event.
     */
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            const displayFileName = file.name.length > 25 ? `${file.name.substring(0, 22)}...` : file.name;
            setFileInputButtonLabel(displayFileName);
            showAppStatusMessage(`Wybrano plik: ${file.name}`, 'success');
            // Set initial name for AnalysisNameModal based on filename (without extension)
            setInitialModalAnalysisName(file.name.replace(/\.[^/.]+$/, ""));

            // Trigger cue animation for the "Analizuj Plik" button
            setAnalyzeButtonCueClass('analyze-cue');
            // Remove cue class after animation completes (2 * 0.7s = 1.4s)
            const cueTimer = setTimeout(() => setAnalyzeButtonCueClass(''), 1400);
            // No explicit cleanup needed for this short-lived timer if component re-renders don't interfere.
        } else {
            setSelectedFile(null);
            setFileInputButtonLabel('Wybierz plik z danymi');
            setInitialModalAnalysisName('');
            if (statusMessage.startsWith("Wybrano plik:")) {
                showAppStatusMessage(''); // Clear file selection message
            }
        }
        // Reset file input to allow re-selecting the same file
        if (csvFileInputRef.current) {
             csvFileInputRef.current.value = "";
        }
    };

    /**
     * Opens the AnalysisNameModal when "Analizuj Plik" is clicked, if a file is selected.
     */
    const handleAnalyzeFileClick = () => {
        if (!selectedFile) {
            showAppStatusMessage('Proszę wybrać plik z danymi.', 'error');
            return;
        }
        // Open the modal to get the analysis name from the user
        setIsAnalysisNameModalOpen(true);
    };

    /**
     * Called by AnalysisNameModal's onSubmit.
     * Proceeds with file upload and analysis creation using the user-provided name.
     * @param {string} analysisName - The name for the analysis.
     */
    const processAnalysisWithName = async (analysisName) => {
        setIsAnalysisNameModalOpen(false); // Close the name modal

        if (!selectedFile) { // Double-check if a file is still selected
            showAppStatusMessage('Błąd: Plik nie jest już wybrany.', 'error');
            setIsLoadingAnalyze(false); // Ensure loading state is reset
            return;
        }

        setIsLoadingAnalyze(true); // Set loading state for the "Analizuj Plik" button
        showAppStatusMessage(`Rozpoczynam analizę pliku: ${selectedFile.name} jako "${analysisName}"`, 'info', null); // No auto-clear

        const formData = new FormData();
        formData.append('csvFile', selectedFile);
        formData.append('analysisName', analysisName);

        try {
            // Replace with actual API call:
            const result = await apiClient.uploadAndPreprocessCsv(formData);

            if (result && result.success && result.analysisId) {
                showAppStatusMessage(`Analiza "${analysisName}" utworzona pomyślnie! Przekierowuję...`, 'success');
                if (addAnalysisToLocalState) {
                    addAnalysisToLocalState({
                        analysisId: result.analysisId,
                        name: analysisName,
                        fileName: selectedFile.name,
                        type: 'real',
                        dataNatureDescription: result.dataNatureDescription, // Assuming backend returns this
                    });
                }
                // Navigate to dashboard after a short delay to show success message
                setTimeout(() => {
                    onNavigateToDashboard({
                        mode: 'load_topic',
                        analysisId: result.analysisId,
                        analysisName, // Pass the confirmed name
                        fileName: selectedFile.name
                    });
                }, 1500);
            } else {
                showAppStatusMessage(`Błąd podczas analizy pliku: ${result?.message || 'Nieznany błąd.'}`, 'error');
            }
        } catch (error) {
            showAppStatusMessage(`Błąd serwera: ${error.message || 'Nie udało się przetworzyć pliku.'}`, 'error');
        } finally {
            setIsLoadingAnalyze(false); // Reset loading state
            // Optionally clear the selected file after processing to prevent accidental re-submission
            // setSelectedFile(null);
            // setFileInputButtonLabel('Wybierz plik z danymi');
            // setInitialModalAnalysisName('');
        }
    };

    /**
     * Handles the "Przeglądaj Analizy" button click.
     * Fetches the list of analyses and navigates to the dashboard.
     */
    const handleBrowseAnalyses = async () => {
        setIsLoadingBrowse(true);
        showAppStatusMessage('Pobieram listę analiz...', 'info', null); // No auto-clear
        try {
            // Replace with actual API call:
            const analysesData = await apiClient.getAnalysesList();

            if(analysesData && analysesData.success !== undefined){ // Check for success property
                showAppStatusMessage('Lista analiz załadowana! Przekierowuję...', 'success');
                 setTimeout(() => {
                    onNavigateToDashboard({ mode: 'my_analyses' });
                }, 1000); // Shorter delay for quicker navigation
            } else {
                showAppStatusMessage('Nie udało się załadować listy analiz. Spróbuj ponownie.', 'error');
            }
        } catch (error) {
             showAppStatusMessage(`Błąd pobierania analiz: ${error.message || 'Nieznany błąd.'}`, 'error');
        } finally {
            setIsLoadingBrowse(false);
        }
    };

    /**
     * Handles the "Połącz z Witness Digital Twin" button click, opening the modal.
     */
    const handleWitnessButtonClick = () => {
        setIsWitnessModalOpen(true);
    };

    return (
        <div className="new-landing-page-body-wrapper">
            <div className="analyzer-card">
                <div className="analyzer-card-header">
                    <img
                        src="https://firebasestorage.googleapis.com/v0/b/csv-data-analyzer-e3207.firebasestorage.app/o/Twinn%20Agent%20AI.png?alt=media&token=08be442b-f6fb-4a00-9993-1fd3be2ddab7"
                        alt="Twinn Agent AI - Twinn Witness Logo"
                        className={`header-logo-img ${isLogoVisible ? 'logo-visible' : 'logo-hidden'}`}
                        onError={(e) => {
                            e.target.onerror = null; // Prevent infinite loop if placeholder also fails
                            e.target.src = 'https://placehold.co/300x75/334155/CBD5E1?text=Logo+Error';
                            e.target.alt = 'Błąd ładowania logo';
                        }}
                    />
                </div>

                <p className="analyzer-subtitle">
                    Zwiększ efektywność z Agent Lean AI. Analizuj dane lub przeglądaj gotowe raporty.
                </p>

                {/* Hidden file input, triggered by the styled button/label */}
                <input
                    type="file"
                    id="csvFileInput" // Unique ID for the input
                    accept=".csv"
                    style={{ display: 'none' }}
                    ref={csvFileInputRef}
                    onChange={handleFileChange}
                    disabled={isLoadingAnalyze || isLoadingBrowse} // Disable if any main action is loading
                />
                {/* Styled button acting as a label for the file input */}
                <NewStyledButton
                    isFileInputLabel
                    htmlFor="csvFileInput" // Associates label with the input
                    id="fileSelectBtn"
                    label={fileInputButtonLabel}
                    variant="file-input" // Uses btn-primary styles internally
                    iconSvgPath={UploadIconPath}
                    disabled={isLoadingAnalyze || isLoadingBrowse}
                    // No onClick needed here, htmlFor handles the input trigger
                />

                <NewStyledButton
                    id="analyzeFileBtn"
                    label="Analizuj Plik"
                    variant="primary"
                    iconSvgPath={AnalyzeIconPath}
                    onClick={handleAnalyzeFileClick} // Opens the AnalysisNameModal
                    disabled={!selectedFile || isLoadingAnalyze || isLoadingBrowse}
                    isLoading={isLoadingAnalyze} // Shows spinner when processAnalysisWithName is active
                    loadingText="Przetwarzam..."
                    className={analyzeButtonCueClass} // For visual cue after file selection
                />

                {/* Container for status messages */}
                <div id="statusMessagesContainer">
                    {statusMessage && (
                        <div className={`status-message status-${statusType}`}>
                            {statusMessage}
                        </div>
                    )}
                </div>

                <div className="separator">LUB</div>

                <NewStyledButton
                    id="browseAnalysesBtn"
                    label="Przeglądaj Analizy"
                    variant="secondary"
                    iconSvgPath={BrowseIconPath}
                    onClick={handleBrowseAnalyses}
                    disabled={isLoadingAnalyze || isLoadingBrowse}
                    isLoading={isLoadingBrowse}
                    loadingText="Ładowanie..."
                />

                <NewStyledButton
                    id="witnessBtn"
                    label="Połącz z Witness Digital Twin"
                    variant="tertiary"
                    iconSvgPath={WitnessIconPath}
                    onClick={handleWitnessButtonClick}
                    disabled={isLoadingAnalyze || isLoadingBrowse}
                    // isLoading={isLoadingWitnessButton} // If you add a loading state for this button itself
                    // loadingText="Otwieram..."
                />
            </div>

            <p className="footer-text">&copy; 2024-2025 Advanced Manufacturing Consulting. Wszelkie prawa zastrzeżone.</p>

            {/* Modals */}
            <NewWitnessModal
                isOpen={isWitnessModalOpen}
                onClose={() => setIsWitnessModalOpen(false)}
            />

            <AnalysisNameModal
                isOpen={isAnalysisNameModalOpen}
                onClose={() => setIsAnalysisNameModalOpen(false)}
                onSubmit={processAnalysisWithName} // Passes the chosen name to this function
                initialName={initialModalAnalysisName}
                showMessage={showAppStatusMessage} // Allows modal to show validation errors via landing page's system
            />
        </div>
    );
};

export default NewLandingPage;