import React from 'react';
import { useAnalysisContext } from '../../contexts/AnalysisContext';

const Sidebar = ({ activeTopic, onSelectTopic, onNavigateToLanding }) => { 
    const { userCreatedAnalyses } = useAnalysisContext();
    
    // Static topics are removed from here as per previous request
    const allDisplayTopics = [
        ...userCreatedAnalyses, 
    ];
    
    return (
        <aside className="sidebar w-full md:w-64 lg:w-72 p-4 space-y-2 shrink-0">
            <h2 className="text-xl font-semibold mb-4 px-2 text-gray-300">Tematy Analizy</h2>
            <nav>
                <ul id="dashboard-sidebar-nav-list-react"> {/* Changed ID for React context */}
                    {allDisplayTopics.length === 0 && (
                        <li className="px-4 py-2.5 text-sm text-gray-400">Brak analiz. Utwórz nową.</li>
                    )}
                    {allDisplayTopics.map(topic => (
                        <li key={topic.name}>
                            <a
                                href="#" // Navigation is handled by onSelectTopic
                                className={`sidebar-item block px-4 py-2.5 text-sm font-medium ${topic.type === 'real' ? 'dynamic-analysis-item' : ''} ${activeTopic === topic.name ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onSelectTopic(topic);
                                }}
                            >
                                {topic.name}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="mt-auto pt-10">
                <button 
                    id="dashboard-analyze-new-btn-react" 
                    className="bottom-button w-full py-2.5 px-4 rounded-md text-sm font-medium"
                    onClick={onNavigateToLanding} // This prop navigates to landing page
                >
                    Analizuj Nowy Plik
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
