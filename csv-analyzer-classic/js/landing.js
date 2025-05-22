// js/landing.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const appTitleElement = document.getElementById('app-title');
    const appSubtitleElement = document.getElementById('app-subtitle');
    const footerAppTitleElement = document.getElementById('footer-app-title');

    const fileUploadInput = document.getElementById('file-upload');
    const fileUploadLabel = document.getElementById('file-upload-label');
    const analyzeFileButton = document.getElementById('analyze-file-button');
    const demoTestButton = document.getElementById('demo-test-button');
    const localErrorContainer = document.getElementById('local-error-message-container');
    const apiKeyWarningDiv = document.getElementById('api-key-warning');
    const liveAnalysisSection = document.getElementById('live-analysis-section');
    const loadingSpinnerContainer = document.getElementById('loading-spinner-container');


    // Witness Modal Elements
    const openWitnessModalButton = document.getElementById('open-witness-modal-button');
    const witnessModal = document.getElementById('witness-modal');
    const closeWitnessModalButton = document.getElementById('close-witness-modal-button');
    const cancelWitnessButton = document.getElementById('cancel-witness-button');
    const witnessForm = document.getElementById('witness-form');
    const twinIdInput = document.getElementById('twinId');
    const accessCodeInput = document.getElementById('accessCode');
    const toastNotification = document.getElementById('toast-notification');

    let selectedFile = null;

    // --- Initialization ---
    if (appTitleElement) appTitleElement.textContent = APP_TITLE;
    if (footerAppTitleElement) footerAppTitleElement.textContent = APP_TITLE;

    if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") {
        if (appSubtitleElement) appSubtitleElement.textContent = APP_SUBTITLE_FULL;
        if (apiKeyWarningDiv) apiKeyWarningDiv.classList.add('hidden');
        if (liveAnalysisSection) liveAnalysisSection.classList.remove('hidden'); // Should be visible by default
    } else {
        if (appSubtitleElement) appSubtitleElement.textContent = APP_SUBTITLE_DEMO_ONLY;
        if (apiKeyWarningDiv) apiKeyWarningDiv.classList.remove('hidden');
        // Optionally hide or further disable the live analysis section if no API key
        if (analyzeFileButton) analyzeFileButton.disabled = true;
        if (analyzeFileButton) analyzeFileButton.title = "Klucz API Gemini nie jest skonfigurowany w js/constants.js";
        if (fileUploadLabel) fileUploadLabel.classList.add('opacity-50', 'cursor-not-allowed');
        if (fileUploadInput) fileUploadInput.disabled = true;
    }


    // --- Helper Functions ---
    function displayLocalError(message) {
        if (localErrorContainer) {
            localErrorContainer.innerHTML = `<p class="text-red-400 bg-red-900/30 p-3 rounded-md text-sm">${message}</p>`;
        }
    }

    function clearLocalError() {
        if (localErrorContainer) {
            localErrorContainer.innerHTML = '';
        }
    }
     function showLoadingSpinner() {
        if(loadingSpinnerContainer) loadingSpinnerContainer.classList.remove('hidden');
        if(analyzeFileButton) analyzeFileButton.disabled = true;
        if(demoTestButton) demoTestButton.disabled = true;
        if(openWitnessModalButton) openWitnessModalButton.disabled = true;
    }

    function hideLoadingSpinner() {
        if(loadingSpinnerContainer) loadingSpinnerContainer.classList.add('hidden');
        if(analyzeFileButton && selectedFile && GEMINI_API_KEY) analyzeFileButton.disabled = false;
        else if (analyzeFileButton) analyzeFileButton.disabled = true;

        if(demoTestButton) demoTestButton.disabled = false;
        if(openWitnessModalButton) openWitnessModalButton.disabled = false;
    }

    function showToast(message, duration = 3000) {
        if (!toastNotification) return;
        toastNotification.textContent = message;
        toastNotification.classList.remove('opacity-0');
        toastNotification.classList.add('opacity-100');

        setTimeout(() => {
            toastNotification.classList.remove('opacity-100');
            toastNotification.classList.add('opacity-0');
        }, duration);
    }


    // --- Event Listeners ---
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")) {
                    selectedFile = file;
                    if (fileUploadLabel) fileUploadLabel.textContent = `Wybrano: ${file.name}`;
                    if (analyzeFileButton && GEMINI_API_KEY) analyzeFileButton.disabled = false;
                    clearLocalError();
                } else {
                    selectedFile = null;
                    if (fileUploadLabel) fileUploadLabel.textContent = 'Wybierz plik CSV';
                    if (analyzeFileButton) analyzeFileButton.disabled = true;
                    displayLocalError('Proszę wybrać plik w formacie CSV.');
                    fileUploadInput.value = ""; // Reset file input
                }
            } else {
                selectedFile = null;
                if (fileUploadLabel) fileUploadLabel.textContent = 'Wybierz plik CSV';
                if (analyzeFileButton) analyzeFileButton.disabled = true;
            }
        });
    }

    if (analyzeFileButton) {
        analyzeFileButton.addEventListener('click', () => {
            if (!selectedFile) {
                displayLocalError('Proszę wybrać plik CSV do analizy.');
                return;
            }
            if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === "") {
                displayLocalError('Klucz API Gemini nie jest skonfigurowany. Nie można przeprowadzić analizy.');
                return;
            }
            showLoadingSpinner();
            clearLocalError();

            const reader = new FileReader();
            reader.onload = (event) => {
                const csvDataString = event.target.result;
                if (!csvDataString || typeof csvDataString !== 'string' || !csvDataString.trim()) {
                    displayLocalError("Plik CSV jest pusty lub nie można go odczytać.");
                    hideLoadingSpinner();
                    return;
                }
                localStorage.setItem('csvForAnalysis', csvDataString);
                localStorage.removeItem('runDemo'); // Ensure demo mode is off
                window.location.href = 'analysis-dashboard.html';
            };
            reader.onerror = () => {
                console.error("Błąd odczytu pliku.");
                displayLocalError("Nie udało się odczytać pliku. Upewnij się, że plik jest poprawny i spróbuj ponownie.");
                hideLoadingSpinner();
            };
            reader.readAsText(selectedFile, 'UTF-8');
        });
    }

    if (demoTestButton) {
        demoTestButton.addEventListener('click', () => {
            showLoadingSpinner();
            localStorage.setItem('runDemo', 'true');
            localStorage.removeItem('csvForAnalysis');
            // Simulate a small delay before redirecting for spinner visibility
            setTimeout(() => {
                 window.location.href = 'analysis-dashboard.html';
            }, 500);
        });
    }

    // Witness Modal Logic
    if (openWitnessModalButton) {
        openWitnessModalButton.addEventListener('click', () => {
            if (witnessModal) witnessModal.classList.remove('hidden');
        });
    }
    if (closeWitnessModalButton) {
        closeWitnessModalButton.addEventListener('click', () => {
            if (witnessModal) witnessModal.classList.add('hidden');
        });
    }
    if (cancelWitnessButton) {
        cancelWitnessButton.addEventListener('click', () => {
            if (witnessModal) witnessModal.classList.add('hidden');
        });
    }
    if (witnessModal) {
        witnessModal.addEventListener('click', (event) => { // Close on overlay click
            if (event.target === witnessModal) {
                witnessModal.classList.add('hidden');
            }
        });
    }

    if (witnessForm) {
        witnessForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const twinId = twinIdInput ? twinIdInput.value : 'N/A';
            const accessCode = accessCodeInput ? accessCodeInput.value : 'N/A';
            console.log("Witness Digital Twin ID:", twinId);
            console.log("Access Code:", accessCode);
            // Placeholder for actual connection logic

            if (witnessModal) witnessModal.classList.add('hidden');
            if (twinIdInput) twinIdInput.value = '';
            if (accessCodeInput) accessCodeInput.value = '';
            showToast('Dane Witness zostały zalogowane w konsoli (funkcja demonstracyjna).');
        });
    }
});