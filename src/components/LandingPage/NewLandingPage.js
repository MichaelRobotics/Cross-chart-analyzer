// src/components/LandingPage/NewLandingPage.js
import React, { useState, useRef } from 'react';
import NewStyledButton from '../UI/NewStyledButton';
import NewWitnessModal from '../Modals/NewWitnessModal';
import AnalysisNameModal from '../Modals/AnalysisNameModal';
import { apiClient } from '../../services/apiClient';
import { useAnalysisContext } from '../../contexts/AnalysisContext';

// SVG Paths (assuming they are defined as before)
const UploadIconPath = "M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 10.5a2.25 2.25 0 002.25 2.25c1.004 0 1.875-.694 2.148-1.683A5.25 5.25 0 0112 6.75c2.118 0 3.906 1.226 4.602 3.017.273.989 1.144 1.683 2.148 1.683A2.25 2.25 0 0021 10.5M3 16.5v-6M21 16.5v-6";
const AnalyzeIconPath = "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75";
const BrowseIconPath = "M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776";
const WitnessIconPath = "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244";


const NewLandingPage = ({ onNavigateToDashboard }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState('info');
    const [isLoadingAnalyze, setIsLoadingAnalyze] = useState(false);
    const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);
    const [isWitnessModalOpen, setIsWitnessModalOpen] = useState(false);
    const [fileInputButtonLabel, setFileInputButtonLabel] = useState('Wybierz plik z danymi');
    const [analyzeButtonCueClass, setAnalyzeButtonCueClass] = useState('');
    const [isLogoVisible, setIsLogoVisible] = useState(false); // For logo animation

    const [isAnalysisNameModalOpen, setIsAnalysisNameModalOpen] = useState(false);
    const [initialModalAnalysisName, setInitialModalAnalysisName] = useState('');

    const csvFileInputRef = useRef(null);
    const { addAnalysisToLocalState } = useAnalysisContext();

    // Effect for logo animation
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLogoVisible(true);
        }, 300); // Delay before logo starts appearing
        return () => clearTimeout(timer);
    }, []);


    const showAppStatusMessage = (message, type = 'info', duration = 5000) => {
        setStatusMessage(message);
        setStatusType(type);
        if (duration) {
            setTimeout(() => {
                setStatusMessage(prevMessage => (prevMessage === message ? '' : prevMessage));
            }, duration);
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            const displayFileName = file.name.length > 25 ? `${file.name.substring(0, 22)}...` : file.name;
            setFileInputButtonLabel(displayFileName);
            showAppStatusMessage(`Wybrano plik: ${file.name}`, 'success');
            setInitialModalAnalysisName(file.name.replace(/\.[^/.]+$/, ""));

            setAnalyzeButtonCueClass('analyze-cue');
            setTimeout(() => setAnalyzeButtonCueClass(''), 1400);

        } else {
            setSelectedFile(null);
            setFileInputButtonLabel('Wybierz plik z danymi');
            setInitialModalAnalysisName('');
            if (statusMessage.startsWith("Wybrano plik:")) {
                showAppStatusMessage('');
            }
        }
        if (csvFileInputRef.current) {
             csvFileInputRef.current.value = "";
        }
    };

    const handleAnalyzeFileClick = () => {
        if (!selectedFile) {
            showAppStatusMessage('Proszę wybrać plik z danymi.', 'error');
            return;
        }
        setIsAnalysisNameModalOpen(true);
    };

    const processAnalysisWithName = async (analysisName) => {
        setIsAnalysisNameModalOpen(false);
        if (!selectedFile) {
            showAppStatusMessage('Błąd: Plik nie jest już wybrany.', 'error');
            setIsLoadingAnalyze(false);
            return;
        }
        setIsLoadingAnalyze(true);
        showAppStatusMessage(`Rozpoczynam analizę pliku: ${selectedFile.name} jako "${analysisName}"`, 'info', null);
        const formData = new FormData();
        formData.append('csvFile', selectedFile);
        formData.append('analysisName', analysisName);
        try {
            const result = await apiClient.uploadAndPreprocessCsv(formData);
            if (result && result.success && result.analysisId) {
                showAppStatusMessage(`Analiza "${analysisName}" utworzona pomyślnie! Przekierowuję...`, 'success');
                if (addAnalysisToLocalState) {
                    addAnalysisToLocalState({
                        analysisId: result.analysisId,
                        name: analysisName,
                        fileName: selectedFile.name,
                        type: 'real',
                        dataNatureDescription: result.dataNatureDescription,
                    });
                }
                setTimeout(() => {
                    onNavigateToDashboard({
                        mode: 'load_topic',
                        analysisId: result.analysisId,
                        analysisName,
                        fileName: selectedFile.name
                    });
                }, 1500);
            } else {
                showAppStatusMessage(`Błąd podczas analizy pliku: ${result?.message || 'Nieznany błąd.'}`, 'error');
            }
        } catch (error) {
            showAppStatusMessage(`Błąd serwera: ${error.message || 'Nie udało się przetworzyć pliku.'}`, 'error');
        } finally {
            setIsLoadingAnalyze(false);
        }
    };

    const handleBrowseAnalyses = async () => {
        setIsLoadingBrowse(true);
        showAppStatusMessage('Pobieram listę analiz...', 'info', null);
        try {
            const analysesData = await apiClient.getAnalysesList();
            if(analysesData && analysesData.success !== undefined){
                showAppStatusMessage('Lista analiz załadowana! Przekierowuję...', 'success');
                 setTimeout(() => {
                    onNavigateToDashboard({ mode: 'my_analyses' });
                }, 1000);
            } else {
                showAppStatusMessage('Nie udało się załadować listy analiz. Spróbuj ponownie.', 'error');
            }
        } catch (error) {
             showAppStatusMessage(`Błąd pobierania analiz: ${error.message || 'Nieznany błąd.'}`, 'error');
        } finally {
            setIsLoadingBrowse(false);
        }
    };

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
                            e.target.onerror = null;
                            e.target.src = 'https://placehold.co/300x75/334155/CBD5E1?text=Logo+Error';
                            e.target.alt = 'Błąd ładowania logo';
                        }}
                    />
                </div>

                <p className="analyzer-subtitle">
                    Zwiększ efektywność z Agent Lean AI. Analizuj dane lub przeglądaj gotowe raporty.
                </p>

                <input
                    type="file"
                    id="csvFileInput"
                    accept=".csv"
                    style={{ display: 'none' }}
                    ref={csvFileInputRef}
                    onChange={handleFileChange}
                    disabled={isLoadingAnalyze || isLoadingBrowse}
                />
                <NewStyledButton
                    isFileInputLabel
                    htmlFor="csvFileInput" // This makes the label click the input
                    id="fileSelectBtn"
                    label={fileInputButtonLabel}
                    variant="file-input"
                    iconSvgPath={UploadIconPath}
                    disabled={isLoadingAnalyze || isLoadingBrowse}
                    // REMOVED onClick prop here to prevent double trigger
                    // onClick={() => csvFileInputRef.current && csvFileInputRef.current.click()}
                />

                <NewStyledButton
                    id="analyzeFileBtn"
                    label="Analizuj Plik"
                    variant="primary"
                    iconSvgPath={AnalyzeIconPath}
                    onClick={handleAnalyzeFileClick}
                    disabled={!selectedFile || isLoadingAnalyze || isLoadingBrowse}
                    isLoading={isLoadingAnalyze}
                    loadingText="Przetwarzam..."
                    className={analyzeButtonCueClass}
                />

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
                />
            </div>

            <p className="footer-text">&copy; 2024-2025 Advanced Manufacturing Consulting. Wszelkie prawa zastrzeżone.</p>

            <NewWitnessModal
                isOpen={isWitnessModalOpen}
                onClose={() => setIsWitnessModalOpen(false)}
            />

            <AnalysisNameModal
                isOpen={isAnalysisNameModalOpen}
                onClose={() => setIsAnalysisNameModalOpen(false)}
                onSubmit={processAnalysisWithName}
                initialName={initialModalAnalysisName}
                showMessage={showAppStatusMessage}
            />
        </div>
    );
};

export default NewLandingPage;