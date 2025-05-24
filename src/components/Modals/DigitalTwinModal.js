import React, { useState } from 'react';

const DigitalTwinModal = ({ isOpen, onClose, showMessage }) => {
    const [twinId, setTwinId] = useState('');
    const [accessCode, setAccessCode] = useState('');

    const handleSubmit = () => {
        const displayMessage = showMessage || alert;
        if (!twinId.trim() || !accessCode.trim()) {
            displayMessage('Proszę wypełnić oba pola.');
            return;
        }
        displayMessage('Cyfrowy Bliźniak (Digital Twin) nie istnieje lub dane są nieprawidłowe.');
        onClose(); 
    };

    if (!isOpen) return null;

    return (
        <div className="modal active"> 
            <div className="modal-content">
                <h2 className="modal-title">Połącz z Witness Digital Twin</h2>
                <p className="text-sm text-gray-400 mb-3">Wprowadź dane dostępowe do Twojego Cyfrowego Bliźniaka Witness.</p>
                <label htmlFor="digital-twin-id-react" className="block text-xs font-medium text-gray-400 mb-1">Digital Twin ID</label>
                <input 
                    type="text" 
                    id="digital-twin-id-react" 
                    value={twinId}
                    onChange={(e) => setTwinId(e.target.value)}
                    className="modal-input" 
                    placeholder="np. DT_ProjectAlpha_123"
                />
                <label htmlFor="access-code-react" className="block text-xs font-medium text-gray-400 mb-1 mt-2">Kod Dostępu</label>
                <input 
                    type="password" 
                    id="access-code-react" 
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="modal-input" 
                    placeholder="••••••••"
                />
                <div className="modal-buttons">
                    <button onClick={onClose} className="modal-button modal-button-secondary">Anuluj</button>
                    <button onClick={handleSubmit} className="modal-button modal-button-primary">Połącz</button>
                </div>
            </div>
        </div>
    );
};

export default DigitalTwinModal;
