// js/shared.js

// --- Utility Functions ---
function showCustomMessage(message, duration = 3000) {
    const customMessageBox = document.getElementById('custom-message-box');
    if (!customMessageBox) {
        console.error("Custom message box not found!");
        return;
    }
    customMessageBox.textContent = message;
    customMessageBox.classList.add('active');
    setTimeout(() => {
        customMessageBox.classList.remove('active');
    }, duration);
}

// --- User Created Analyses Management (Session Storage) ---
const USER_ANALYSES_KEY = 'userCreatedAnalyses';

function getUserCreatedAnalyses() {
    const storedAnalyses = sessionStorage.getItem(USER_ANALYSES_KEY);
    return storedAnalyses ? JSON.parse(storedAnalyses) : [];
}

function saveUserCreatedAnalyses(analysesArray) {
    sessionStorage.setItem(USER_ANALYSES_KEY, JSON.stringify(analysesArray));
}

function addUserCreatedAnalysis(newAnalysis) {
    let analyses = getUserCreatedAnalyses();
    // Remove if exists to re-add at top (ensuring newest is first)
    const existingAnalysisIndex = analyses.findIndex(a => a.name === newAnalysis.name);
    if (existingAnalysisIndex > -1) {
        analyses.splice(existingAnalysisIndex, 1);
    }
    analyses.unshift(newAnalysis); // Add to the beginning
    saveUserCreatedAnalyses(analyses);
}

// --- URL Parameter Parsing ---
function getUrlQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const regex = /([^&=]+)=([^&]*)/g;
    let m;
    while (m = regex.exec(queryString)) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }
    return params;
}