import React, { useState, useRef } from 'react';
import { useAnalysisContext } from '../../contexts/AnalysisContext';
import AnalysisNameModal from '../Modals/AnalysisNameModal';
import DigitalTwinModal from '../Modals/DigitalTwinModal';
import CustomMessage from '../UI/CustomMessage';

const LandingPage = ({ onNavigateToDashboard }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileNameDisplay, setFileNameDisplay] = useState('Nie wybrano pliku');
    const [isAnalysisNameModalOpen, setIsAnalysisNameModalOpen] = useState(false);
    const [initialModalAnalysisName, setInitialModalAnalysisName] = useState('');
    const [isDigitalTwinModalOpen, setIsDigitalTwinModalOpen] = useState(false);
    
    const [customMessage, setCustomMessage] = useState('');
    const [isCustomMessageActive, setIsCustomMessageActive] = useState(false);

    const csvFileInputRef = useRef(null);
    const { addUserAnalysis } = useAnalysisContext();

    const showAppMessage = (message) => {
        setCustomMessage(message);
        setIsCustomMessageActive(true);
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        setSelectedFile(file);
        if (file) {
            setFileNameDisplay(`Wybrano: ${file.name}`);
            setInitialModalAnalysisName(file.name.replace(/\.[^/.]+$/, ""));
        } else {
            setFileNameDisplay('Nie wybrano pliku');
            setInitialModalAnalysisName('');
        }
        if (csvFileInputRef.current) {
            csvFileInputRef.current.value = ""; // Allows re-selecting the same file
        }
    };

    const handleAnalyzeFileClick = () => {
        if (selectedFile) {
            setIsAnalysisNameModalOpen(true);
        } else {
            showAppMessage('Najpierw wybierz plik CSV.');
        }
    };

    const handleSubmitAnalysisName = (analysisName) => {
        if (selectedFile) {
            addUserAnalysis({ name: analysisName, fileName: selectedFile.name, type: 'real' });
            showAppMessage(`Przygotowywanie analizy "${analysisName}"...`);
            setIsAnalysisNameModalOpen(false); 
            setTimeout(() => {
                onNavigateToDashboard({ mode: 'real', analysisName, fileName: selectedFile.name });
            }, 500); // Simulate delay
        }
    };

    return (
        <div className="landing-page-view-wrapper"> 
            <CustomMessage message={customMessage} isActive={isCustomMessageActive} onClose={() => setIsCustomMessageActive(false)} />
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
                />
                <button onClick={() => csvFileInputRef.current.click()} className="btn btn-cyan mb-3">Wybierz plik CSV</button>
                <div className="file-name-display">{fileNameDisplay}</div>
                <button onClick={handleAnalyzeFileClick} className="btn btn-green" disabled={!selectedFile}>Analizuj Plik</button>
                <div className="or-separator">LUB</div>
                <button onClick={() => onNavigateToDashboard({ mode: 'my_analyses' })} className="btn btn-purple mb-3">Przeglądaj Moje Analizy</button>
                <button onClick={() => setIsDigitalTwinModalOpen(true)} className="btn btn-magenta">Połącz z Witness Digital Twin</button>
            </div>
            <button onClick={() => onNavigateToDashboard({ mode: 'classic' })} className="btn landing-footer-link">Analizator Danych CSV - Wersja Klasyczna</button>

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
