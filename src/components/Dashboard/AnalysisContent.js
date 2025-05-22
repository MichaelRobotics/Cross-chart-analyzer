import React from 'react';
import AnalysisBlock from './AnalysisBlock';

const AnalysisContent = ({ blocks, currentIndex }) => {
    return (
        <div id="analysis-content-area-react" className="analysis-content-area">
            {blocks.map((block, index) => (
                 <AnalysisBlock key={block.id} blockData={block} isActive={index === currentIndex} />
            ))}
        </div>
    );
};

export default AnalysisContent;
