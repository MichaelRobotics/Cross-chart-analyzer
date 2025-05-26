// src/App.js
import React, { useState } from 'react';
// import LandingPage from './components/LandingPage/LandingPage'; // Old Landing Page
import NewLandingPage from './components/LandingPage/NewLandingPage'; // Import the new landing page
import Dashboard from './components/Dashboard/Dashboard';
import { AnalysisProvider } from './contexts/AnalysisContext';

function App() {
    // State to manage the current view ('landing' or 'dashboard')
    const [currentView, setCurrentView] = useState('landing');
    // State to hold parameters for the dashboard when navigating to it
    const [dashboardParams, setDashboardParams] = useState({ mode: 'my_analyses' });

    /**
     * Navigates to the Dashboard view.
     * @param {object} params - Parameters to pass to the Dashboard component
     * (e.g., mode, analysisId, analysisName).
     */
    const navigateToDashboard = (params) => {
        setDashboardParams(params || { mode: 'my_analyses' }); // Default to 'my_analyses' mode if no params
        setCurrentView('dashboard');
    };

    /**
     * Navigates to the Landing Page view.
     * Can also handle navigation from sidebar to a specific analysis on the Dashboard.
     * @param {object} navParams - Navigation parameters.
     * If navParams.dashboardParams exists, it navigates to Dashboard with those params.
     * Otherwise, navigates to the Landing Page.
     */
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
        // Wrap the application with AnalysisProvider to make analysis context available
        <AnalysisProvider>
            {/*
                Conditionally render the current view based on the 'currentView' state.
                The #root div in public/index.html will have the base font and color.
                NewLandingPage component itself will apply its specific animated background wrapper.
            */}
            {currentView === 'landing' && <NewLandingPage onNavigateToDashboard={navigateToDashboard} />}
            {currentView === 'dashboard' && <Dashboard params={dashboardParams} onNavigateToLanding={navigateToLanding} />}
        </AnalysisProvider>
    );
}

export default App;