// js/landing.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (Landing Page Specific) ---
    const selectCsvBtn = document.getElementById('select-csv-btn');
    const csvFileInput = document.getElementById('csv-file-input');
    const analyzeFileBtn = document.getElementById('analyze-file-btn');
    const fileNameDisplay = document.getElementById('file-name-display');
    const browseMyAnalysesBtn = document.getElementById('browse-my-analyses-btn');
    const connectDigitalTwinBtn = document.getElementById('connect-digital-twin-btn');
    const classicVersionBtn = document.getElementById('classic-version-btn');
    const analysisNameModal = document.getElementById('analysis-name-modal');
    const analysisNameInput = document.getElementById('analysis-name-input');
    const cancelAnalysisNameBtn = document.getElementById('cancel-analysis-name-btn');
    const submitAnalysisNameBtn = document.getElementById('submit-analysis-name-btn');
    const digitalTwinModal = document.getElementById('digital-twin-modal');
    const digitalTwinIdInput = document.getElementById('digital-twin-id');
    const accessCodeInput = document.getElementById('access-code');
    const cancelDigitalTwinBtn = document.getElementById('cancel-digital-twin-btn');
    const submitDigitalTwinBtn = document.getElementById('submit-digital-twin-btn');

    let selectedFile = null;

    // --- Event Listeners ---
    if (selectCsvBtn && csvFileInput) {
        selectCsvBtn.addEventListener('click', () => {
            csvFileInput.click();
        });
    } else {
        console.error("selectCsvBtn or csvFileInput not found on landing page");
    }

    if (csvFileInput) {
        csvFileInput.addEventListener('change', (event) => {
            selectedFile = event.target.files[0];
            if (selectedFile) {
                if (fileNameDisplay) fileNameDisplay.textContent = `Wybrano: ${selectedFile.name}`;
                if (analyzeFileBtn) analyzeFileBtn.disabled = false;
            } else {
                if (fileNameDisplay) fileNameDisplay.textContent = 'Nie wybrano pliku';
                if (analyzeFileBtn) analyzeFileBtn.disabled = true;
                selectedFile = null;
            }
        });
    } else {
        console.error("csvFileInput not found for change event on landing page");
    }

    if (analyzeFileBtn) {
        analyzeFileBtn.addEventListener('click', () => {
            if (selectedFile) {
                if (analysisNameInput) analysisNameInput.value = selectedFile.name.replace(/\.[^/.]+$/, "");
                if (analysisNameModal) analysisNameModal.classList.add('active');
            } else {
                showCustomMessage('Najpierw wybierz plik CSV.');
            }
        });
    } else {
        console.error("analyzeFileBtn not found on landing page");
    }

    if (browseMyAnalysesBtn) {
        browseMyAnalysesBtn.addEventListener('click', () => {
            window.location.href = `analysis-dashboard.html?mode=my_analyses`;
        });
    } else {
        console.error("browseMyAnalysesBtn not found on landing page");
    }

    if (classicVersionBtn) {
        classicVersionBtn.addEventListener('click', () => {
            // Assuming 'classic' mode loads the default demo or a specific static view
            window.location.href = `analysis-dashboard.html?mode=classic`;
        });
    } else {
        console.error("classicVersionBtn not found on landing page");
    }
    
    if (connectDigitalTwinBtn) {
        connectDigitalTwinBtn.addEventListener('click', () => {
            if (digitalTwinIdInput) digitalTwinIdInput.value = '';
            if (accessCodeInput) accessCodeInput.value = '';
            if (digitalTwinModal) digitalTwinModal.classList.add('active');
            else console.error("digitalTwinModal not found to open");
        });
    } else {
        console.error("connectDigitalTwinBtn not found on landing page");
    }

    // Modal Event Listeners
    if (analysisNameModal && cancelAnalysisNameBtn) {
        cancelAnalysisNameBtn.addEventListener('click', () => analysisNameModal.classList.remove('active'));
    }
    if (analysisNameModal && submitAnalysisNameBtn) {
        submitAnalysisNameBtn.addEventListener('click', () => {
            if (!analysisNameInput) { console.error("analysisNameInput not found for submit"); return; }
            const analysisName = analysisNameInput.value.trim();
            if (!analysisName) {
                showCustomMessage('Proszę podać nazwę analizy.');
                return;
            }
            if (selectedFile) {
                addUserCreatedAnalysis({ name: analysisName, fileName: selectedFile.name, type: 'real' });
                showCustomMessage(`Przygotowywanie analizy "${analysisName}"...`);
                analysisNameModal.classList.remove('active');
                // Navigate to dashboard, passing analysis info
                setTimeout(() => {
                    window.location.href = `analysis-dashboard.html?mode=real&analysisName=${encodeURIComponent(analysisName)}&fileName=${encodeURIComponent(selectedFile.name)}`;
                }, 500);
            }
        });
    }

    if (digitalTwinModal && cancelDigitalTwinBtn) {
        cancelDigitalTwinBtn.addEventListener('click', () => digitalTwinModal.classList.remove('active'));
    }
    if (digitalTwinModal && submitDigitalTwinBtn) {
        submitDigitalTwinBtn.addEventListener('click', () => {
            if (!digitalTwinIdInput || !accessCodeInput) { console.error("Digital twin input fields not found"); return; }
            const twinId = digitalTwinIdInput.value.trim();
            const accCode = accessCodeInput.value.trim();
            if (!twinId || !accCode) {
                showCustomMessage('Proszę wypełnić oba pola.'); return;
            }
            showCustomMessage('Cyfrowy Bliźniak (Digital Twin) nie istnieje lub dane są nieprawidłowe.');
        });
    }
    
    // Shared Modal Closing Logic
    [analysisNameModal, digitalTwinModal].forEach(modal => {
        if (modal) { 
            modal.addEventListener('click', (event) => {
                if (event.target === modal) modal.classList.remove('active');
            });
            window.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                }
            });
        }
    });
});
