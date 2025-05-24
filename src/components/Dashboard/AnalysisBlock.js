import React from 'react';

const AnalysisBlock = ({ blockData, isActive }) => {
    if (!blockData) return null;
    const isInitial = blockData.id === 'initial-analysis';

    // Helper to safely render HTML content
    const createMarkup = (htmlContent) => {
        return { __html: htmlContent || '' }; // Ensure htmlContent is not null/undefined
    };

    return (
        <div id={blockData.id} className={`analysis-block ${isActive ? 'active' : ''}`}>
            {!isInitial && <h2 className="analysis-question-title">Pytanie: {blockData.question && blockData.question.length > 65 ? blockData.question.substring(0,62) + "..." : blockData.question}</h2>}
            <div>
                <h3 className="unified-analysis-heading">{blockData.findingsHeading || 'Brak danych'}</h3>
                <div dangerouslySetInnerHTML={createMarkup(blockData.findingsContent)} />
            </div>
            <div className="mt-4">
                <h3 className="unified-analysis-heading">Proces Myślowy (Thought Process)</h3>
                <div dangerouslySetInnerHTML={createMarkup(blockData.thoughtProcessContent)} />
            </div>
            <div className="mt-4">
                <h3 className="unified-analysis-heading">Sugestie Dalszych Pytań (Suggestions for Other Questions)</h3>
                <ul className="space-y-1 question-suggestions-list">
                    {blockData.newSuggestionsContent && blockData.newSuggestionsContent.map((suggestion, index) => (
                        <li key={index} dangerouslySetInnerHTML={createMarkup(suggestion)} />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default AnalysisBlock;
