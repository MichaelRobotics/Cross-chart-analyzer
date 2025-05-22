import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ onSendMessage, messages }) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    return (
        <div id="chat-interaction-wrapper-react" className="symulowany-czat-container mt-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-white">Dodatkowe Pytania (Symulowany Czat)</h2>
            <div className="chat-input-container p-4 md:p-6">
                <div id="chat-messages-react" className="space-y-3 mb-4 h-64 overflow-y-auto p-3 bg-gray-800 rounded-md border border-gray-700">
                    {messages.map((msg, index) => (
                        <div key={`${msg.sender}-${index}-${msg.text.substring(0,5)}`} className={`flex mb-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-xs lg:max-w-md text-sm ${msg.sender === 'user' ? 'bg-gray-600 text-white' : 'bg-blue-600 text-white'}`}>
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
                        placeholder="Zadaj pytanie..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button onClick={handleSend} id="send-chat-button-react" className="chat-button py-3 px-6 rounded-md text-sm font-medium">Wyślij</button>
                </div>
            </div>
        </div>
    );
};

export default Chat;
