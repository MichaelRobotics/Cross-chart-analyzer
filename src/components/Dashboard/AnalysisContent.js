import React from 'react';
import AnalysisBlock from './AnalysisBlock';

const AnalysisContent = ({ blocks, currentIndex }) => {
    if (!blocks || blocks.length === 0) {
        // This case is handled by Dashboard.js (noAnalysesLoaded)
        // but as a safeguard for this component:
        return <div className="analysis-content-area"></div>; 
    }
    return (
        <div id="analysis-content-area-react" className="analysis-content-area">
            {blocks.map((block, index) => (
                 <AnalysisBlock key={block.id || `block-${index}`} blockData={block} isActive={index === currentIndex} />
            ))}
        </div>
    );
};

export default AnalysisContent;
