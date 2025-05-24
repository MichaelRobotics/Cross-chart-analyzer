// src/components/Dashboard/Chat.js
import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ onSendMessage, messages, isSending }) => { // Added isSending prop
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = () => {
        // Prevent sending if already sending or if input is empty
        if (isSending || !inputValue.trim()) {
            return;
        }
        onSendMessage(inputValue.trim());
        setInputValue('');
    };

    return (
        <div id="chat-interaction-wrapper-react" className="symulowany-czat-container mt-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-white">Dodatkowe Pytania</h2>
            <div className="chat-input-container p-4 md:p-6">
                <div 
                    id="chat-messages-react" 
                    className="space-y-3 mb-4 h-64 overflow-y-auto p-3 bg-gray-800 rounded-md border border-gray-700"
                >
                    {messages.map((msg, index) => (
                        <div 
                            // Use a more robust key if message IDs are available from backend
                            key={msg.id || `${msg.sender}-${index}-${msg.text.substring(0,10)}`} 
                            className={`flex mb-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div 
                                className={`p-3 rounded-lg max-w-xs lg:max-w-md text-sm break-words ${
                                    msg.sender === 'user' ? 'bg-gray-600 text-white' 
                                    : (msg.id && msg.id.includes('thinking') ? 'bg-yellow-600 text-white italic' // Style for thinking messages
                                    : (msg.id && msg.id.includes('error') ? 'bg-red-700 text-white' // Style for error messages
                                    : 'bg-blue-600 text-white'))
                                }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="flex items-center space-x-3">
                    <input 
                        type="text" 
                        id="chat-input-field-react" 
                        className="chat-input flex-1 p-3 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder={isSending ? "Agent analizuje..." : "Zadaj pytanie..."}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !isSending) { // Prevent send on Enter if already sending
                                handleSend();
                            }
                        }}
                        disabled={isSending} // Disable input when isSending is true
                    />
                    <button 
                        onClick={handleSend} 
                        id="send-chat-button-react" 
                        className="chat-button py-3 px-6 rounded-md text-sm font-medium"
                        disabled={isSending || !inputValue.trim()} // Disable button when isSending or input is empty
                    >
                        {isSending ? 'Wysyłanie...' : 'Wyślij'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;