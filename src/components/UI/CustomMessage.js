import React, { useEffect } from 'react';

const CustomMessage = ({ message, isActive, duration = 3000, onClose }) => {
    useEffect(() => {
        let timer;
        if (isActive && onClose) { // Ensure onClose is provided
            timer = setTimeout(() => {
                onClose();
            }, duration);
        }
        return () => clearTimeout(timer);
    }, [isActive, duration, onClose]);

    if (!isActive || !message) return null;

    // Using Tailwind classes directly for styling
    return (
        <div 
            className="fixed top-5 left-1/2 -translate-x-1/2 bg-gray-700 text-white py-3 px-5 rounded-md z-[2000] shadow-lg text-sm"
            // The 'active' class for display is handled by conditional rendering (isActive prop)
        >
            {message}
        </div>
    );
};

export default CustomMessage;
