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
                <h2 className="analysis-question-title text-2xl md:text-3xl lg:text-4xl font-semibold mb-6">
                    Pytanie: {blockData.question && blockData.question.length > 65 ? blockData.question.substring(0,62) + "..." : blockData.question}
                </h2>
            )}
            <div className="mb-8">
                <h3 className="unified-analysis-heading text-xl md:text-2xl lg:text-3xl font-semibold mb-4">
                    {blockData.findingsHeading || 'Brak danych'}
                </h3>
                <div className="text-lg md:text-xl lg:text-2xl leading-relaxed" dangerouslySetInnerHTML={createMarkup(blockData.findingsContent)} />
            </div>
            <div className="mb-8">
                <h3 className="unified-analysis-heading text-xl md:text-2xl lg:text-3xl font-semibold mb-4">
                    Proces Myślowy
                </h3>
                <div className="text-lg md:text-xl lg:text-2xl leading-relaxed" dangerouslySetInnerHTML={createMarkup(blockData.thoughtProcessContent)} />
            </div>
            <div className="mb-8">
                <h3 className="unified-analysis-heading text-xl md:text-2xl lg:text-3xl font-semibold mb-4">
                    Sugestie Dalszych Pytań
                </h3>
                <ul className="space-y-3 question-suggestions-list text-lg md:text-xl lg:text-2xl leading-relaxed">
                    {blockData.newSuggestionsContent && blockData.newSuggestionsContent.map((suggestion, index) => (
                        <li key={index} className="pl-6" dangerouslySetInnerHTML={createMarkup(suggestion)} />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default AnalysisBlock;
