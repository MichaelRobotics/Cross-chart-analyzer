// Dashboard interactivity and chart functionality will go here 
// js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const topicsListElement = document.getElementById('topics-list');
    const activeTopicTitleElement = document.getElementById('active-topic-title');
    const analysisBlocksContainer = document.getElementById('analysis-blocks-container'); // New container for all blocks
    const initialPlaceholderMessage = document.getElementById('initial-placeholder-message');

    const analyzeNewFileButton = document.getElementById('analyze-new-file-button');
    const loadingSpinnerDashboard = document.getElementById('loading-spinner-dashboard');
    const globalErrorContainer = document.getElementById('global-error-container');
    const globalErrorMessageText = document.getElementById('global-error-message-text');
    const backToLandingButtonError = document.getElementById('back-to-landing-button-error');
    const analysisDisplaySection = document.getElementById('analysis-display-section');

    const sendChatButton = document.getElementById('send-chat-button');
    const chatInputField = document.getElementById('chat-input-field');
    const chatMessagesContainer = document.getElementById('chat-messages');

    const prevAnalysisBtn = document.getElementById('prev-analysis-btn');
    const nextAnalysisBtn = document.getElementById('next-analysis-btn');

    // --- State Variables ---
    let analysisBlocksStore = []; // Array of objects: {id, titleForBlock, question, findingsHeading, findingsContentHTML, thoughtProcessContentHTML, suggestionsContentArray, isTopicSummary, topicId (optional)}
    let currentAnalysisBlockIndex = 0;
    let nextBlockIdCounter = 0; // To generate unique IDs for new analysis blocks
    let originalCsvDataForContext = ""; // Stores the CSV data if loaded, for AI context

    // --- Helper Functions ---
    function showLoading() {
        if (loadingSpinnerDashboard) loadingSpinnerDashboard.classList.remove('hidden');
        if (loadingSpinnerDashboard) loadingSpinnerDashboard.classList.add('flex');
        if (analysisDisplaySection) analysisDisplaySection.classList.add('hidden');
        if (globalErrorContainer) globalErrorContainer.classList.add('hidden');
    }

    function hideLoading() {
        if (loadingSpinnerDashboard) loadingSpinnerDashboard.classList.add('hidden');
        if (loadingSpinnerDashboard) loadingSpinnerDashboard.classList.remove('flex');
    }

    function displayGlobalError(message) {
        hideLoading();
        if (globalErrorMessageText) globalErrorMessageText.textContent = message;
        if (globalErrorContainer) globalErrorContainer.classList.remove('hidden');
        if (analysisDisplaySection) analysisDisplaySection.classList.add('hidden');
    }
    
    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return "";
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Function to create the HTML for an analysis block
    function createAnalysisBlockHTML(blockData) {
        const suggestionsHTML = blockData.suggestionsContentArray.map(s => `<li>${escapeHtml(s)}</li>`).join('');
        return `
            <h2 class="analysis-question-title">${escapeHtml(blockData.question)}</h2>
            <div>
                <h3 class="unified-analysis-heading">${escapeHtml(blockData.findingsHeading)}</h3>
                <div class="prose prose-sm sm:prose-base prose-invert max-w-none text-slate-200 leading-relaxed">
                    ${blockData.findingsContentHTML} {/* Already formatted HTML or needs formatting */}
                </div>
            </div>
            <div class="mt-4">
                <h3 class="unified-analysis-heading">Proces Myślowy (Thought Process)</h3>
                 <div class="prose prose-sm sm:prose-base prose-invert max-w-none text-slate-200 leading-relaxed">
                    ${blockData.thoughtProcessContentHTML} {/* Already formatted HTML or needs formatting */}
                </div>
            </div>
            <div class="mt-4">
                <h3 class="unified-analysis-heading">Sugestie Dalszych Pytań</h3>
                <ul class="space-y-1 question-suggestions-list">
                    ${suggestionsHTML}
                </ul>
            </div>
        `;
    }

    // Adds a new analysis block to the DOM and store, then displays it
    function addNewAnalysisBlockToDOM(blockData) {
        if (!analysisBlocksContainer) return;

        const blockElement = document.createElement('div');
        blockElement.id = blockData.id;
        blockElement.classList.add('analysis-block');
        blockElement.dataset.blockTitle = blockData.titleForBlock; // For the main H1 title
        blockElement.innerHTML = createAnalysisBlockHTML(blockData);
        
        analysisBlocksContainer.appendChild(blockElement);
    }


    function renderTopicsSidebar() {
        if (!topicsListElement) return;
        topicsListElement.innerHTML = '';
        PREDEFINED_TOPICS.forEach(topic => {
            const listItem = document.createElement('li');
            const button = document.createElement('button');
            button.className = 'sidebar-item block px-4 py-2.5 text-sm font-medium w-full text-left text-slate-300 hover:bg-slate-700 hover:text-slate-100';
            button.textContent = topic.title;
            button.dataset.topicId = topic.id; // Use PREDEFINED_TOPICS id

            button.addEventListener('click', async () => {
                // Check if a block for this predefined topic summary already exists
                let blockIndex = analysisBlocksStore.findIndex(b => b.topicId === topic.id && b.isTopicSummary);

                if (blockIndex === -1) { // If not, create it
                    showLoading(); // Show loading while fetching/simulating summary
                    if (analysisDisplaySection) analysisDisplaySection.classList.add('hidden');

                    let summaryAnswer;
                    const isDemoMode = localStorage.getItem('runDemo') === 'true';

                    if (isDemoMode || !GEMINI_API_KEY) {
                        const simulated = SIMULATED_TOPIC_SUMMARIES.find(s => s.id === topic.id);
                        summaryAnswer = simulated ? simulated.answer : "Symulowana odpowiedź dla tego tematu.";
                    } else if (originalCsvDataForContext) {
                        summaryAnswer = await callGeminiAPIInternal(topic.question, originalCsvDataForContext);
                    } else {
                        summaryAnswer = "Brak danych CSV do analizy tego tematu. Proszę najpierw załadować plik.";
                    }
                    
                    const newBlockData = {
                        id: `analysis-block-${nextBlockIdCounter++}`,
                        titleForBlock: topic.title,
                        question: topic.question, // The question for this topic
                        findingsHeading: `Podsumowanie: ${topic.title}`,
                        findingsContentHTML: formatAnswerToHtml(summaryAnswer), // Format the raw answer
                        thoughtProcessContentHTML: `<p>Analiza dla tego tematu została wygenerowana na podstawie ogólnego zapytania dotyczącego "${escapeHtml(topic.title)}".</p>`,
                        suggestionsContentArray: [`Zadaj szczegółowe pytanie dotyczące "${escapeHtml(topic.title)}" w czacie.`],
                        isTopicSummary: true,
                        topicId: topic.id
                    };
                    analysisBlocksStore.push(newBlockData);
                    addNewAnalysisBlockToDOM(newBlockData);
                    blockIndex = analysisBlocksStore.length - 1;
                    
                    hideLoading();
                    if (analysisDisplaySection) analysisDisplaySection.classList.remove('hidden');
                }
                currentAnalysisBlockIndex = blockIndex;
                updateDisplay();
            });
            listItem.appendChild(button);
            topicsListElement.appendChild(listItem);
        });
    }
    
    function formatAnswerToHtml(answerText) {
        if (answerText === null || answerText === undefined || typeof answerText !== 'string') {
            return "<p class='text-slate-400'>Analiza jest niedostępna lub wystąpił błąd.</p>";
        }
        // Basic escaping and newline conversion
        let html = escapeHtml(answerText)
            .replace(/\n\n+/g, '<br><br>') 
            .replace(/\n/g, '<br />');

        // Convert markdown-like lists
        html = html.replace(/^\s*([-*•])\s+(.*)(<br \/>)?/gm, (match, bullet, item) => `<li>${item.trim()}</li>`);
        if (html.includes('<li>')) {
            html = html.replace(/(<li>.*?<\/li>)+/g, (match) => `<ul>${match}</ul>`);
            html = html.replace(/<br \/>\s*<ul>/g, '<ul>');
            html = html.replace(/<\/ul><br \/>/g, '</ul>');
            html = html.replace(/<\/li><br \/>/g, '</li>');
        }
        // If the content doesn't look like a list or already formatted HTML, wrap plain text in <p>
        if (!html.startsWith('<ul>') && !html.startsWith('<p>')) {
             html = `<p>${html}</p>`;
        }
        return html; 
    }


    function updateDisplay() {
        if (!analysisBlocksContainer || analysisBlocksStore.length === 0) {
            if (activeTopicTitleElement) activeTopicTitleElement.textContent = "Brak Analiz";
            if (analysisBlocksContainer) analysisBlocksContainer.innerHTML = "<p class='text-slate-400'>Brak dostępnych analiz do wyświetlenia.</p>";
            if (prevAnalysisBtn) prevAnalysisBtn.disabled = true;
            if (nextAnalysisBtn) nextAnalysisBtn.disabled = true;
            return;
        }
        
        if (initialPlaceholderMessage) initialPlaceholderMessage.classList.add('hidden');


        // Deactivate all DOM blocks
        const domBlocks = analysisBlocksContainer.querySelectorAll('.analysis-block');
        domBlocks.forEach(block => block.classList.remove('active'));

        // Activate current DOM block
        const currentBlockData = analysisBlocksStore[currentAnalysisBlockIndex];
        const currentBlockElement = document.getElementById(currentBlockData.id);

        if (currentBlockElement) {
            currentBlockElement.classList.add('active');
            if (activeTopicTitleElement) activeTopicTitleElement.textContent = currentBlockData.titleForBlock;
        } else {
            // This case should ideally not happen if DOM elements are managed correctly with store
            console.error("DOM element for current block not found:", currentBlockData.id);
            if (activeTopicTitleElement) activeTopicTitleElement.textContent = "Błąd Wyświetlania";
        }

        if (prevAnalysisBtn) prevAnalysisBtn.disabled = currentAnalysisBlockIndex === 0;
        if (nextAnalysisBtn) nextAnalysisBtn.disabled = currentAnalysisBlockIndex >= analysisBlocksStore.length - 1;

        // Update sidebar active state
        const sidebarButtons = topicsListElement.querySelectorAll('.sidebar-item');
        sidebarButtons.forEach(btn => {
            // Active state for sidebar items is now based on whether the current block is a summary for that topic
            if (currentBlockData.isTopicSummary && btn.dataset.topicId === currentBlockData.topicId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }


    // --- Chat Functionality ---
    function addChatMessageToUI(text, sender) {
        if (!chatMessagesContainer) return;
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('flex', 'mb-2');

        const messageContentWrapper = document.createElement('div');
        messageContentWrapper.classList.add('p-3', 'rounded-lg', 'max-w-xs', 'lg:max-w-md', 'text-sm', 'shadow');

        if (sender === 'user') {
            messageDiv.classList.add('justify-end');
            messageContentWrapper.classList.add('bg-sky-600', 'text-white', 'rounded-br-none');
        } else {
            messageDiv.classList.add('justify-start');
            messageContentWrapper.classList.add('bg-slate-600', 'text-slate-200', 'rounded-bl-none');
            if (sender === 'system') messageContentWrapper.classList.add('italic');
        }
        
        text.split('\n').forEach((line, index) => {
            const p = document.createElement('p');
            p.textContent = line; // Text content is automatically escaped by the browser
            if (index > 0) p.classList.add('mt-1');
            messageContentWrapper.appendChild(p);
        });

        messageDiv.appendChild(messageContentWrapper);
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    async function handleSendChatMessage() {
        const userQuestion = chatInputField.value.trim();
        if (!userQuestion) return;

        addChatMessageToUI(userQuestion, 'user');
        chatInputField.value = '';
        if (sendChatButton) sendChatButton.disabled = true;
        addChatMessageToUI("AI analizuje Twoje pytanie...", 'system');

        let findingsContent, thoughtProcessContent, suggestionsArray;
        const isDemoMode = localStorage.getItem('runDemo') === 'true';

        if (!isDemoMode && GEMINI_API_KEY && originalCsvDataForContext) {
            const promptForAi = `Biorąc pod uwagę następujące dane CSV:\n\`\`\`csv\n${originalCsvDataForContext}\n\`\`\`\n\nOdpowiedz na pytanie: "${userQuestion}". 
            Podaj odpowiedź w języku polskim, dzieląc ją na sekcje: 
            1. "Wynik Analizy:" (bezpośrednia odpowiedź na pytanie).
            2. "Proces Myślowy:" (jak doszedłeś do odpowiedzi, jakie kroki podjąłeś).
            3. "Sugestie Dalszych Pytań:" (trzy powiązane pytania, które użytkownik mógłby zadać).
            Formatuj sugestie jako listę punktowaną. Użyj **markdown** do formatowania odpowiedzi, np. do list i pogrubień.`;
            
            const aiResponseFull = await callGeminiAPIInternal(promptForAi, ""); 

            findingsContent = aiResponseFull.match(/Wynik Analizy:([\s\S]*?)(Proces Myślowy:|Sugestie Dalszych Pytań:|$)/is)?.[1]?.trim() || aiResponseFull;
            thoughtProcessContent = aiResponseFull.match(/Proces Myślowy:([\s\S]*?)(Sugestie Dalszych Pytań:|$)/is)?.[1]?.trim() || "Proces myślowy nie został jasno określony w odpowiedzi.";
            const suggestionsMatch = aiResponseFull.match(/Sugestie Dalszych Pytań:([\s\S]*)/is)?.[1]?.trim();
            suggestionsArray = suggestionsMatch ? suggestionsMatch.split('\n').map(s => s.replace(/^[-*•]\s*/, '').trim()).filter(s => s) : PLACEHOLDER_CHAT_ANALYSIS.suggestionsContentArray;
            
            findingsContent = formatAnswerToHtml(findingsContent);
            thoughtProcessContent = formatAnswerToHtml(thoughtProcessContent);

        } else { 
            findingsContent = formatAnswerToHtml(`(Symulacja) W odpowiedzi na "${userQuestion}", ${PLACEHOLDER_CHAT_ANALYSIS.findingsContentHTML}`);
            thoughtProcessContent = formatAnswerToHtml(`(Symulacja) ${PLACEHOLDER_CHAT_ANALYSIS.thoughtProcessContentHTML}`);
            suggestionsArray = PLACEHOLDER_CHAT_ANALYSIS.suggestionsContentArray.map(s => `(Symulacja) ${s}`);
        }
        
        const systemMessages = Array.from(chatMessagesContainer.querySelectorAll('.italic')).map(el => el.closest('.flex.mb-2'));
        if (systemMessages.length > 0) {
            systemMessages[systemMessages.length - 1].remove();
        }
        addChatMessageToUI(`Odpowiedź na: "${userQuestion.substring(0, 30)}..."\nWyniki analizy zostały dodane do panelu głównego.`, 'ai');
        
        const newBlockData = {
            id: `analysis-block-${nextBlockIdCounter++}`,
            titleForBlock: `Czat: ${userQuestion.substring(0, 25)}...`,
            question: userQuestion,
            findingsHeading: "Odpowiedź na Pytanie z Czatu",
            findingsContentHTML: findingsContent,
            thoughtProcessContentHTML: thoughtProcessContent,
            suggestionsContentArray: suggestionsArray,
            isTopicSummary: false
        };
        analysisBlocksStore.push(newBlockData);
        addNewAnalysisBlockToDOM(newBlockData);
        currentAnalysisBlockIndex = analysisBlocksStore.length - 1; 
        updateDisplay();

        if (sendChatButton) sendChatButton.disabled = false;
    }

    // --- Page Initialization Logic ---
    async function initializeDashboard() {
        showLoading();
        analysisBlocksStore = []; 
        nextBlockIdCounter = 0; 
        currentAnalysisBlockIndex = 0;
        if (analysisBlocksContainer) analysisBlocksContainer.innerHTML = ''; 
        if (initialPlaceholderMessage) initialPlaceholderMessage.classList.remove('hidden');


        const runDemo = localStorage.getItem('runDemo') === 'true';
        const csvDataStringFromStorage = localStorage.getItem('csvForAnalysis');
        originalCsvDataForContext = runDemo ? SAMPLE_CSV_DATA_FOR_DEMO : csvDataStringFromStorage;

        renderTopicsSidebar(); 

        if (runDemo) {
            addChatMessageToUI("Witaj! Analizujesz dane demonstracyjne. Możesz zadawać pytania lub wybrać temat z listy.", 'ai');
            const initialBlock = { ...INITIAL_ANALYSIS_BLOCK_CONTENT, id: `analysis-block-${nextBlockIdCounter++}` };
            analysisBlocksStore.push(initialBlock);
            addNewAnalysisBlockToDOM(initialBlock);
            
            const pregenQuestion1 = "Zidentyfikuj produkty, gdzie koszt przezbrojenia ma duży wpływ.";
            const pregen1Data = {
                id: `analysis-block-${nextBlockIdCounter++}`, titleForBlock: `Pyt: ${pregenQuestion1.substring(0,20)}...`, question: pregenQuestion1,
                findingsHeading: "Wynik dla Przykładowego Pytania 1",
                findingsContentHTML: formatAnswerToHtml(PLACEHOLDER_CHAT_ANALYSIS.findingsContentHTML.replace('X', 'koszt przezbrojenia')),
                thoughtProcessContentHTML: formatAnswerToHtml(PLACEHOLDER_CHAT_ANALYSIS.thoughtProcessContentHTML),
                suggestionsContentArray: PLACEHOLDER_CHAT_ANALYSIS.suggestionsContentArray, isTopicSummary: false
            };
            analysisBlocksStore.push(pregen1Data);
            addNewAnalysisBlockToDOM(pregen1Data);

            const pregenQuestion2 = "Produkty o podobnych kosztach i różnej rentowności?";
             const pregen2Data = {
                id: `analysis-block-${nextBlockIdCounter++}`, titleForBlock: `Pyt: ${pregenQuestion2.substring(0,20)}...`, question: pregenQuestion2,
                findingsHeading: "Wynik dla Przykładowego Pytania 2",
                findingsContentHTML: formatAnswerToHtml(PLACEHOLDER_CHAT_ANALYSIS.findingsContentHTML.replace('X', 'strategia cenowa')),
                thoughtProcessContentHTML: formatAnswerToHtml(PLACEHOLDER_CHAT_ANALYSIS.thoughtProcessContentHTML),
                suggestionsContentArray: PLACEHOLDER_CHAT_ANALYSIS.suggestionsContentArray, isTopicSummary: false
            };
            analysisBlocksStore.push(pregen2Data);
            addNewAnalysisBlockToDOM(pregen2Data);
            
            currentAnalysisBlockIndex = 0; 

        } else if (csvDataStringFromStorage) {
            if (!GEMINI_API_KEY) {
                displayGlobalError("Klucz API Gemini nie jest skonfigurowany. Uruchom tryb demo lub dodaj klucz.");
                return;
            }
            addChatMessageToUI("Witaj! Twoje dane CSV są gotowe do analizy. Wybierz temat lub zadaj pytanie.", 'ai');
            const firstTopic = PREDEFINED_TOPICS[0];
            if (firstTopic) {
                const summaryAnswer = await callGeminiAPIInternal(firstTopic.question, originalCsvDataForContext);
                const firstTopicBlock = {
                    id: `analysis-block-${nextBlockIdCounter++}`, titleForBlock: firstTopic.title, question: firstTopic.question,
                    findingsHeading: `Podsumowanie: ${firstTopic.title}`,
                    findingsContentHTML: formatAnswerToHtml(summaryAnswer),
                    thoughtProcessContentHTML: `<p>Analiza dla tematu "${escapeHtml(firstTopic.title)}" na podstawie dostarczonych danych CSV.</p>`,
                    suggestionsContentArray: [`Zadaj szczegółowe pytanie dotyczące "${escapeHtml(firstTopic.title)}".`],
                    isTopicSummary: true, topicId: firstTopic.id
                };
                analysisBlocksStore.push(firstTopicBlock);
                addNewAnalysisBlockToDOM(firstTopicBlock);
                currentAnalysisBlockIndex = 0;
            }

        } else { 
            displayGlobalError("Brak danych do analizy. Wróć i prześlij plik CSV lub uruchom demo.");
            return;
        }

        hideLoading();
        if (analysisDisplaySection) analysisDisplaySection.classList.remove('hidden');
        updateDisplay();
    }

    // --- Event Listeners ---
    if (analyzeNewFileButton) {
        analyzeNewFileButton.addEventListener('click', () => {
            localStorage.removeItem('csvForAnalysis');
            localStorage.removeItem('runDemo');
            window.location.href = 'landing-page.html';
        });
    }
    if (backToLandingButtonError) {
         backToLandingButtonError.addEventListener('click', () => {
            window.location.href = 'landing-page.html';
        });
    }

    if (prevAnalysisBtn) {
        prevAnalysisBtn.addEventListener('click', () => {
            if (currentAnalysisBlockIndex > 0) {
                currentAnalysisBlockIndex--;
                updateDisplay();
            }
        });
    }
    if (nextAnalysisBtn) {
        nextAnalysisBtn.addEventListener('click', () => {
            if (currentAnalysisBlockIndex < analysisBlocksStore.length - 1) {
                currentAnalysisBlockIndex++;
                updateDisplay();
            }
        });
    }

    if (sendChatButton) sendChatButton.addEventListener('click', handleSendChatMessage);
    if (chatInputField) {
        chatInputField.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && (!sendChatButton || !sendChatButton.disabled)) {
                handleSendChatMessage();
            }
        });
    }

    // --- Start Initialization ---
    initializeDashboard();
});