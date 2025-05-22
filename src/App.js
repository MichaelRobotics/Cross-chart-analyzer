import React, { useState } from 'react';
import LandingPage from './components/LandingPage/LandingPage';
import Dashboard from './components/Dashboard/Dashboard';
import { AnalysisProvider } from './contexts/AnalysisContext';
// GlobalStyle component is no longer needed here as styles are in src/index.css

function App() {
    const [currentView, setCurrentView] = useState('landing'); // 'landing' or 'dashboard'
    const [dashboardParams, setDashboardParams] = useState({ mode: 'my_analyses' }); 

    // This simulates navigation. In a real app with multiple HTML pages, 
    // you'd use window.location.href or a routing library for actual page changes.
    // For a React SPA, React Router would handle this without full page reloads.
    // Here, we are keeping it as a single React app that switches components.
    const navigateToDashboard = (params) => {
        setDashboardParams(params || { mode: 'my_analyses' });
        setCurrentView('dashboard');
    };

    const navigateToLanding = (navParams = {}) => { 
        if (navParams.dashboardParams) { 
            // This logic means if we are on dashboard and click a sidebar item,
            // we stay on dashboard but re-initialize it with new params.
            setDashboardParams(navParams.dashboardParams);
            setCurrentView('dashboard'); 
        } else {
            // This is for navigating from dashboard back to landing page
            setCurrentView('landing');
        }
    };

    return (
        <AnalysisProvider>
            {/* Global styles are now in src/index.css and linked in public/index.html via src/index.js */}
            {currentView === 'landing' && <LandingPage onNavigateToDashboard={navigateToDashboard} />}
            {currentView === 'dashboard' && <Dashboard params={dashboardParams} onNavigateToLanding={navigateToLanding} />}
        </AnalysisProvider>
    );
}

export default App;