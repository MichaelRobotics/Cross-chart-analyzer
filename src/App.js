import React, { useState } from 'react';
import LandingPage from './components/LandingPage/LandingPage'; // Ensure this path is correct
import Dashboard from './components/Dashboard/Dashboard';     // Ensure this path is correct
import { AnalysisProvider } from './contexts/AnalysisContext'; // Ensure this path is correct
// Global styles should be imported in src/index.js or directly in public/index.html

function App() {
    const [currentView, setCurrentView] = useState('landing'); // 'landing' or 'dashboard'
    const [dashboardParams, setDashboardParams] = useState({ mode: 'my_analyses' }); 

    const navigateToDashboard = (params) => {
        setDashboardParams(params || { mode: 'my_analyses' });
        setCurrentView('dashboard');
    };

    const navigateToLanding = (navParams = {}) => { 
        if (navParams.dashboardParams) { 
            setDashboardParams(navParams.dashboardParams);
            setCurrentView('dashboard'); 
        } else {
            setCurrentView('landing');
        }
    };

    return (
        <AnalysisProvider>
            {/* Ensure global styles are handled, e.g., via src/index.css */}
            {currentView === 'landing' && <LandingPage onNavigateToDashboard={navigateToDashboard} />}
            {currentView === 'dashboard' && <Dashboard params={dashboardParams} onNavigateToLanding={navigateToLanding} />}
        </AnalysisProvider>
    );
}

export default App;
