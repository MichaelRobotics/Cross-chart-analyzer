import React, { useState, useEffect, useRef } from 'react';

const AnalysisNameModal = ({ isOpen, onClose, onSubmit, initialName = '', showMessage }) => {
    const [analysisName, setAnalysisName] = useState(initialName);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setAnalysisName(initialName); // Reset or set initial name when modal opens
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [isOpen, initialName]);
    
    const handleSubmit = () => {
        if (!analysisName.trim()) {
            if(showMessage) showMessage('Proszę podać nazwę analizy.');
            else alert('Proszę podać nazwę analizy.');
            return;
        }
        onSubmit(analysisName.trim());
        setAnalysisName(''); 
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal active"> {/* Classes defined in src/index.css */}
            <div className="modal-content">
                <h2 className="modal-title">Nazwa Analizy</h2>
                <p className="text-sm text-gray-400 mb-3">Podaj nazwę dla tej analizy, aby łatwiej ją później zidentyfikować.</p>
                <input 
                    ref={inputRef}
                    type="text" 
                    value={analysisName}
                    onChange={(e) => setAnalysisName(e.target.value)}
                    className="modal-input" 
                    placeholder="Np. Analiza sprzedaży Q1"
                />
                <div className="modal-buttons">
                    <button onClick={onClose} className="modal-button modal-button-secondary">Anuluj</button>
                    <button onClick={handleSubmit} className="modal-button modal-button-primary">Rozpocznij Analizę</button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisNameModal;