import React, { useState, useEffect, createContext, useContext } from 'react';

const AnalysisContext = createContext();

export const AnalysisProvider = ({ children }) => {
    const [userCreatedAnalyses, setUserCreatedAnalyses] = useState(() => {
        const storedAnalyses = sessionStorage.getItem('userCreatedAnalyses_react');
        try {
            return storedAnalyses ? JSON.parse(storedAnalyses) : [];
        } catch (e) {
            console.error("Error parsing userCreatedAnalyses from sessionStorage:", e);
            return [];
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem('userCreatedAnalyses_react', JSON.stringify(userCreatedAnalyses));
        } catch (e) {
            console.error("Error saving userCreatedAnalyses to sessionStorage:", e);
        }
    }, [userCreatedAnalyses]);

    const addUserAnalysis = (newAnalysis) => {
        setUserCreatedAnalyses(prevAnalyses => {
            const existingIndex = prevAnalyses.findIndex(a => a.name === newAnalysis.name);
            let updatedAnalyses = [...prevAnalyses];
            if (existingIndex > -1) {
                updatedAnalyses.splice(existingIndex, 1);
            }
            updatedAnalyses.unshift(newAnalysis);
            return updatedAnalyses;
        });
    };

    return (
        <AnalysisContext.Provider value={{ userCreatedAnalyses, addUserAnalysis }}>
            {children}
        </AnalysisContext.Provider>
    );
};

export const useAnalysisContext = () => useContext(AnalysisContext);
