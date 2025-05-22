import React, { useState } from 'react';
import LandingPage from './components/LandingPage/LandingPage';
import Dashboard from './components/Dashboard/Dashboard';
import { AnalysisProvider } from './contexts/AnalysisContext';
// Note: GlobalStyle component is removed as styles are now in src/index.css

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
            {/* GlobalStyle component removed, styles are in index.css */}
            {currentView === 'landing' && <LandingPage onNavigateToDashboard={navigateToDashboard} />}
            {currentView === 'dashboard' && <Dashboard params={dashboardParams} onNavigateToLanding={navigateToLanding} />}
        </AnalysisProvider>
    );
}

export default App;
