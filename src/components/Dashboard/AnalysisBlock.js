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
            {!isInitial && (
                <h2 className="analysis-question-title text-xl md:text-2xl font-semibold mb-4">
                    Pytanie: {blockData.question && blockData.question.length > 65 ? blockData.question.substring(0,62) + "..." : blockData.question}
                </h2>
            )}
            <div className="mb-6">
                <h3 className="unified-analysis-heading text-lg md:text-xl font-semibold mb-3">
                    {blockData.findingsHeading || 'Brak danych'}
                </h3>
                <div className="text-base md:text-lg leading-relaxed" dangerouslySetInnerHTML={createMarkup(blockData.findingsContent)} />
            </div>
            <div className="mb-6">
                <h3 className="unified-analysis-heading text-lg md:text-xl font-semibold mb-3">
                    Proces Myślowy
                </h3>
                <div className="text-base md:text-lg leading-relaxed" dangerouslySetInnerHTML={createMarkup(blockData.thoughtProcessContent)} />
            </div>
            <div className="mb-6">
                <h3 className="unified-analysis-heading text-lg md:text-xl font-semibold mb-3">
                    Sugestie Dalszych Pytań
                </h3>
                <ul className="space-y-2 question-suggestions-list text-base md:text-lg leading-relaxed">
                    {blockData.newSuggestionsContent && blockData.newSuggestionsContent.map((suggestion, index) => (
                        <li key={index} className="pl-4" dangerouslySetInnerHTML={createMarkup(suggestion)} />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default AnalysisBlock;
