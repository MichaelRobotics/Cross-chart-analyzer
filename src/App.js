// src/App.js
import React, { useState } from 'react';
import LandingPage from './components/LandingPage/LandingPage';
import Dashboard from './components/Dashboard/Dashboard';
import { AnalysisProvider } from './contexts/AnalysisContext';

function App() {
    const [currentView, setCurrentView] = useState('landing'); // 'landing' or 'dashboard'
    const [dashboardParams, setDashboardParams] = useState({ mode: 'my_analyses' }); 

    const navigateToDashboard = (params) => {
        setDashboardParams(params || { mode: 'my_analyses' });
        setCurrentView('dashboard');
    };

    const navigateToLanding = (navParams = {}) => { 
        if (navParams.dashboardParams) { 
            // This case is used by Sidebar to navigate to a specific analysis on the Dashboard
            setDashboardParams(navParams.dashboardParams);
            setCurrentView('dashboard'); 
        } else {
            // This case is used by Dashboard to navigate back to the LandingPage
            setCurrentView('landing');
        }
    };

    return (
        <AnalysisProvider>
            {currentView === 'landing' && <LandingPage onNavigateToDashboard={navigateToDashboard} />}
            {currentView === 'dashboard' && <Dashboard params={dashboardParams} onNavigateToLanding={navigateToLanding} />}
        </AnalysisProvider>
    );
}

export default App;
