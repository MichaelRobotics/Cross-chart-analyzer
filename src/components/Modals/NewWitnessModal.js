// src/components/Modals/NewWitnessModal.js
import React, { useState, useEffect } from 'react';
import NewStyledButton from '../UI/NewStyledButton'; // Using the new styled button

/**
 * Modal component for connecting to Witness Digital Twin.
 * @param {boolean} isOpen - Controls whether the modal is open or closed.
 * @param {function} onClose - Function to call when the modal should be closed.
 */
const NewWitnessModal = ({ isOpen, onClose }) => {
    const [witnessId, setWitnessId] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState('info'); // 'info', 'error', 'success'
    const [isConnecting, setIsConnecting] = useState(false);

    // Effect to reset form state when modal visibility changes
    useEffect(() => {
        if (isOpen) {
            setWitnessId('');
            setAccessCode('');
            setStatusMessage('');
            setIsConnecting(false);
        }
    }, [isOpen]);

    // Handles the confirm connect button click
    const handleConfirmConnect = async () => {
        if (!witnessId.trim() || !accessCode.trim()) {
            setStatusMessage('Proszę wypełnić oba pola.');
            setStatusType('error');
            return;
        }
        setIsConnecting(true);
        setStatusMessage(''); // Clear previous messages

        // Simulate API call (replace with actual API logic)
        try {
            // Example: const response = await apiClient.connectToWitness(witnessId, accessCode);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
            const mockSuccess = false; // Simulate a failed connection for now

            if (mockSuccess) {
                setStatusMessage('Pomyślnie połączono z Witness Digital Twin!');
                setStatusType('success');
                setTimeout(() => {
                    onClose(); // Close modal on success after a short delay
                }, 1500);
            } else {
                setStatusMessage('Nie znaleziono Digital Twin o podanym ID lub kod jest nieprawidłowy.');
                setStatusType('error');
            }
        } catch (error) {
            // Handle actual API errors
            setStatusMessage(`Błąd połączenia: ${error.message || 'Nieznany błąd.'}`);
            setStatusType('error');
        } finally {
            setIsConnecting(false);
        }
    };

    // Prevent rendering if not open
    if (!isOpen) return null;

    return (
        // Modal overlay handles click outside to close
        <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
            {/* Modal content stops propagation to prevent closing when clicking inside */}
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Połącz z Witness Digital Twin</h2>
                    <button
                        onClick={onClose}
                        className="modal-close-btn"
                        aria-label="Close modal"
                        disabled={isConnecting}
                    >
                        &times;
                    </button>
                </div>
                <div className="modal-body">
                    <div>
                        <label htmlFor="witnessIdInput" className="form-label">ID Systemu Witness</label>
                        <input
                            type="text"
                            id="witnessIdInput" // Changed ID to avoid potential conflicts
                            className="form-input"
                            placeholder="Wprowadź ID systemu"
                            value={witnessId}
                            onChange={(e) => setWitnessId(e.target.value)}
                            disabled={isConnecting}
                        />
                    </div>
                    <div>
                        <label htmlFor="accessCodeInput" className="form-label">Kod Dostępu</label>
                        <input
                            type="password"
                            id="accessCodeInput" // Changed ID
                            className="form-input"
                            placeholder="Wprowadź kod dostępu"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            disabled={isConnecting}
                        />
                    </div>
                    {/* Display status messages inside the modal */}
                    {statusMessage && (
                        <div id="modalStatusMessage" className={`status-message status-${statusType}`}>
                            {statusMessage}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <NewStyledButton
                        label="Anuluj"
                        variant="tertiary"
                        onClick={onClose}
                        disabled={isConnecting}
                    />
                    <NewStyledButton
                        label="Połącz"
                        variant="primary"
                        onClick={handleConfirmConnect}
                        isLoading={isConnecting}
                        loadingText="Łączenie..."
                        disabled={isConnecting} // Also disabled by isLoading prop in NewStyledButton
                    />
                </div>
            </div>
        </div>
    );
};

export default NewWitnessModal;
