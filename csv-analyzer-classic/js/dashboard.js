// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (Dashboard Specific) ---
    const dashboardAnalyzeNewBtn = document.getElementById('dashboard-analyze-new-btn');
    const sendChatButton = document.getElementById('send-chat-button');
    const chatInputField = document.getElementById('chat-input-field');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const analysisContentArea = document.getElementById('analysis-content-area');
    const prevAnalysisBtn = document.getElementById('prev-analysis-btn');
    const nextAnalysisBtn = document.getElementById('next-analysis-btn');
    const mainAnalysisTitle = document.getElementById('main-analysis-title');
    const dashboardSidebarNavList = document.getElementById('dashboard-sidebar-nav-list');
    const chatInteractionWrapper = document.getElementById('chat-interaction-wrapper');


    // --- State Variables ---
    let analysisBlocksStore = [];
    let currentAnalysisIndex = 0;
    let questionIdCounter = 0;
    let currentDashboardContextTitle = "Analiza Holistyczna"; // Default or set by URL params

    // --- Initialization ---
    function initializeDashboard() {
        const params = getUrlQueryParams(); // From shared.js
        analysisBlocksStore = [];
        currentAnalysisIndex = 0;
        questionIdCounter = 0;
        
        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
        if (analysisContentArea) analysisContentArea.innerHTML = '';

        let analysisToLoadName = params.analysisName;
        let analysisToLoadFileName = params.fileName;
        let analysisToLoadMode = params.mode || 'classic'; // Default to 'classic' if no mode
        let analysisToLoadTopicContext = params.topicContext;
        
        const userAnalyses = getUserCreatedAnalyses(); // From shared.js

        if (analysisToLoadMode === 'my_analyses') {
            if (userAnalyses.length > 0) {
                const latestAnalysis = userAnalyses[0];
                analysisToLoadName = latestAnalysis.name;
                analysisToLoadFileName = latestAnalysis.fileName;
                analysisToLoadMode = 'real'; 
                currentDashboardContextTitle = analysisToLoadName;
            } else {
                currentDashboardContextTitle = "Moje Analizy";
                if (mainAnalysisTitle) mainAnalysisTitle.textContent = currentDashboardContextTitle;
                if (analysisContentArea) analysisContentArea.innerHTML = '<p class="text-center p-8 text-gray-400">Nie utworzyłeś jeszcze żadnych analiz. Przejdź do <a href="landing-page.html" class="text-blue-400 hover:underline">strony głównej</a>, aby zaimportować plik CSV.</p>';
                updateSidebar(null);
                if(prevAnalysisBtn) prevAnalysisBtn.style.visibility = 'hidden';
                if(nextAnalysisBtn) nextAnalysisBtn.style.visibility = 'hidden';
                if(chatInteractionWrapper) chatInteractionWrapper.style.display = 'none';
                setupDashboardMainEventListeners();
                return;
            }
        } else {
            currentDashboardContextTitle = analysisToLoadName || analysisToLoadTopicContext || "Analiza Holistyczna";
        }

        if(chatInteractionWrapper) chatInteractionWrapper.style.display = 'block';
        updateSidebar(currentDashboardContextTitle);

        if (analysisContentArea) {
            analysisContentArea.appendChild(createInitialBlockDOMStructure(currentDashboardContextTitle));
        } else {
            console.error("analysisContentArea not found during dashboard initialization!");
            return;
        }

        if (mainAnalysisTitle) mainAnalysisTitle.textContent = currentDashboardContextTitle;
        document.title = `Dashboard - ${currentDashboardContextTitle}`;


        if (analysisToLoadMode === 'real' && analysisToLoadName) {
            generateAndDisplayFullAnalysis(`Analiza dla: ${analysisToLoadName} (Plik: ${analysisToLoadFileName})`, true, true, currentDashboardContextTitle);
            addChatMessageToDashboard(`Załadowano analizę: ${analysisToLoadName}`, 'ai');
        } else if (analysisToLoadTopicContext && analysisToLoadMode !== 'my_analyses') {
            generateAndDisplayFullAnalysis(analysisToLoadTopicContext, true, false, currentDashboardContextTitle);
        } else if (analysisToLoadMode === 'classic' || (analysisToLoadMode === 'my_analyses' && userAnalyses.length === 0) ) {
            // For 'classic' or 'my_analyses' with no user data, load default demo
            currentDashboardContextTitle = "Analiza Holistyczna"; // Ensure context is demo
            if (mainAnalysisTitle) mainAnalysisTitle.textContent = currentDashboardContextTitle;
            document.title = `Dashboard - ${currentDashboardContextTitle}`;
            updateSidebar(currentDashboardContextTitle); // Update sidebar for "Analiza Holistyczna"
            if (analysisContentArea) { // Re-ensure initial block for demo
                 analysisContentArea.innerHTML = '';
                 analysisContentArea.appendChild(createInitialBlockDOMStructure(currentDashboardContextTitle));
            }
            generateAndDisplayFullAnalysis("Analiza Początkowa", true, false, currentDashboardContextTitle);
            addDefaultDemoQuestions();
        }
         else { // Default demo for "Analiza Holistyczna" or if other conditions aren't met
            generateAndDisplayFullAnalysis("Analiza Początkowa", true, false, currentDashboardContextTitle);
            addDefaultDemoQuestions();
        }

        currentAnalysisIndex = analysisBlocksStore.findIndex(b => b.id === 'initial-analysis');
        if (currentAnalysisIndex === -1 && analysisBlocksStore.length > 0) {
            currentAnalysisIndex = 0;
        } else if (currentAnalysisIndex === -1) {
            currentAnalysisIndex = 0;
        }

        updateDashboardNavigation();
        setupDashboardMainEventListeners();
    }
    
    function addDefaultDemoQuestions() {
        const pregenQuestion1 = "Zidentyfikuj produkty, gdzie koszt przezbrojenia ma nieproporcjonalnie duży wpływ na całkowity koszt jednostkowy w stosunku do wolumenu produkcji.";
        generateAndDisplayFullAnalysis(pregenQuestion1, false, false, null);
        addChatMessageToDashboard(pregenQuestion1, 'user');
        addChatMessageToDashboard(`Agent analizuje: "${pregenQuestion1.substring(0, 25)}...". Wyniki powyżej.`, 'ai');

        const pregenQuestion2 = "Czy istnieje grupa produktów o podobnej strukturze kosztów, ale znacząco różniąca się rentownością godzinową? Jakie mogą być tego przyczyny?";
        generateAndDisplayFullAnalysis(pregenQuestion2, false, false, null);
        addChatMessageToDashboard(pregenQuestion2, 'user');
        addChatMessageToDashboard(`Agent analizuje: "${pregenQuestion2.substring(0, 25)}...". Wyniki powyżej.`, 'ai');
    }


    function createInitialBlockDOMStructure(blockTitle = "Analiza Początkowa") {
        const initialBlockDiv = document.createElement('div');
        initialBlockDiv.id = 'initial-analysis';
        initialBlockDiv.classList.add('analysis-block');
        initialBlockDiv.dataset.blockTitle = blockTitle;
        initialBlockDiv.innerHTML = `
            <div> <h3 class="unified-analysis-heading">Wstępne Spostrzeżenia (Initial Findings)</h3> <div id="initial-findings-content"></div> </div>
            <div class="mt-4"> <h3 class="unified-analysis-heading">Proces Myślowy (Thought Process)</h3> <div id="thought-process-content"></div> </div>
            <div class="mt-4"> <h3 class="unified-analysis-heading">Sugestie Dalszych Pytań (Suggestions for Other Questions)</h3> <ul id="initial-suggestions-list" class="space-y-1 question-suggestions-list"></ul> </div>
        `;
        return initialBlockDiv;
    }

    function updateSidebar(activeAnalysisName = null) {
        if (!dashboardSidebarNavList) return;
        const userAnalyses = getUserCreatedAnalyses(); // From shared.js

        dashboardSidebarNavList.querySelectorAll('.dynamic-analysis-item').forEach(item => item.remove());

        for (let i = userAnalyses.length - 1; i >= 0; i--) {
            const analysis = userAnalyses[i];
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `analysis-dashboard.html?mode=real&analysisName=${encodeURIComponent(analysis.name)}&fileName=${encodeURIComponent(analysis.fileName)}`;
            a.classList.add('sidebar-item', 'block', 'px-4', 'py-2.5', 'text-sm', 'font-medium', 'dynamic-analysis-item');
            a.dataset.analysisTopic = analysis.name; // Keep for consistency, though href is primary
            a.textContent = analysis.name;
            li.appendChild(a);
            dashboardSidebarNavList.prepend(li);
        }

        dashboardSidebarNavList.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            // Update href for static items to use URL params
            if (item.dataset.staticItem === "true") {
                item.href = `analysis-dashboard.html?topicContext=${encodeURIComponent(item.dataset.analysisTopic)}`;
            }
        });

        let itemToActivate = null;
        if (activeAnalysisName) {
            itemToActivate = dashboardSidebarNavList.querySelector(`.sidebar-item[data-analysis-topic="${activeAnalysisName}"]`);
        }
        
        if (itemToActivate) {
            itemToActivate.classList.add('active');
        } else {
            const firstStaticItem = dashboardSidebarNavList.querySelector('.sidebar-item[data-static-item="true"]');
            if (firstStaticItem) {
                 firstStaticItem.classList.add('active');
            } else { 
                const firstItem = dashboardSidebarNavList.querySelector('.sidebar-item');
                if (firstItem) firstItem.classList.add('active');
            }
        }
        // No need to call setupDashboardSidebarEventListeners here, navigation handles page reload
    }
    
    function setupDashboardMainEventListeners() {
        if (!prevAnalysisBtn || !nextAnalysisBtn || !sendChatButton || !chatInputField || !dashboardAnalyzeNewBtn) {
            console.error("One or more dashboard main elements are missing. Cannot set up event listeners.");
            return;
        }
        prevAnalysisBtn.addEventListener('click', navigatePrevAnalysis);
        nextAnalysisBtn.addEventListener('click', navigateNextAnalysis);
        sendChatButton.addEventListener('click', handleSendChatMessage);
        chatInputField.addEventListener('keypress', handleChatInputKeypress);
        dashboardAnalyzeNewBtn.addEventListener('click', handleDashboardAnalyzeNew);
    }


    function navigatePrevAnalysis() {
        if (currentAnalysisIndex > 0) {
            currentAnalysisIndex--;
            updateDashboardNavigation();
        }
    }
    function navigateNextAnalysis() {
        if (currentAnalysisIndex < analysisBlocksStore.length - 1) {
            currentAnalysisIndex++;
            updateDashboardNavigation();
        }
    }
    function handleSendChatMessage() {
        if (!chatInputField || !sendChatButton) return;
        const userQuestion = chatInputField.value.trim();
        if (userQuestion) {
            addChatMessageToDashboard(userQuestion, 'user');
            chatInputField.value = '';
            setTimeout(() => {
                const shortAiResponse = `Agent analizuje: "${userQuestion.substring(0,25)}...". Wyniki powyżej.`;
                addChatMessageToDashboard(shortAiResponse, 'ai');
                generateAndDisplayFullAnalysis(userQuestion, false, false, currentDashboardContextTitle); 
            }, 1000);
        }
    }
    function handleChatInputKeypress(event) {
        if (event.key === 'Enter' && sendChatButton) {
            sendChatButton.click();
        }
    }
    function handleDashboardAnalyzeNew() {
        window.location.href = 'landing-page.html';
    }

    function updateDashboardNavigation() {
        if (!prevAnalysisBtn || !nextAnalysisBtn) { console.error("Navigation buttons not found for update."); return; }

        if (mainAnalysisTitle) {
            mainAnalysisTitle.textContent = currentDashboardContextTitle || "Analiza";
        }

        if (analysisBlocksStore.length === 0) {
            prevAnalysisBtn.style.visibility = 'hidden';
            nextAnalysisBtn.style.visibility = 'hidden';
            return;
        }
        
        prevAnalysisBtn.style.visibility = 'visible';
        nextAnalysisBtn.style.visibility = 'visible';

        document.querySelectorAll('.analysis-block').forEach(block => block.classList.remove('active'));
        
        if (analysisBlocksStore[currentAnalysisIndex]) {
            const currentBlockData = analysisBlocksStore[currentAnalysisIndex];
            const currentBlockElement = document.getElementById(currentBlockData.id);
            if (currentBlockElement) {
                currentBlockElement.classList.add('active');
            } else {
                console.warn("Current block element not found during navigation update:", currentBlockData.id);
            }
            prevAnalysisBtn.disabled = currentAnalysisIndex === 0;
            nextAnalysisBtn.disabled = currentAnalysisIndex >= analysisBlocksStore.length - 1; 
        } else {
             console.warn("No block data at currentAnalysisIndex during navigation update:", currentAnalysisIndex);
             prevAnalysisBtn.style.visibility = 'hidden';
             nextAnalysisBtn.style.visibility = 'hidden';
        }
    }

    function addChatMessageToDashboard(text, sender) {
        if (!chatMessagesContainer) { console.error("Chat messages container not found!"); return; }
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('flex', 'mb-2');
        const messageContentWrapper = document.createElement('div');
        messageContentWrapper.classList.add('p-3', 'rounded-lg', 'max-w-xs', 'lg:max-w-md', 'text-sm');
        if (sender === 'user') {
            messageDiv.classList.add('justify-end');
            messageContentWrapper.classList.add('bg-gray-600', 'text-white');
        } else {
            messageDiv.classList.add('justify-start');
            messageContentWrapper.classList.add('bg-blue-600', 'text-white');
        }
        messageContentWrapper.textContent = text;
        messageDiv.appendChild(messageContentWrapper);
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function generateAndDisplayFullAnalysis(questionText, isInitial = false, isRealData = false, topicContext = null) {
        if (!analysisContentArea) {
            console.error("analysisContentArea is not available to generate analysis.");
            return;
        }
        if(!isInitial) questionIdCounter++; 
        
        let analysisBlockId = isInitial ? 'initial-analysis' : `analysis-q-${questionIdCounter}`; 
        
        if (!isInitial && document.getElementById(analysisBlockId)) {
            console.warn("Duplicate ID for follow-up:", analysisBlockId, ". Incrementing counter and regenerating ID.");
            questionIdCounter++; 
            analysisBlockId = `analysis-q-${questionIdCounter}`; 
        }

        const displayQuestionTitleInBlock = questionText.length > 65 ? questionText.substring(0, 62) + "..." : questionText;
        
        let blockTitleForNavigation;
        if (isInitial) {
            blockTitleForNavigation = topicContext || questionText; 
        } else {
            blockTitleForNavigation = `Odpowiedź na pytanie ${questionIdCounter}`; 
        }
        
        let findingsHeading, findingsContent, thoughtProcessContent, newSuggestionsContent;
        const effectiveTopicContext = topicContext || currentDashboardContextTitle || "Analiza Ogólna"; 

        if (isInitial) {
            findingsHeading = isRealData ? `Wyniki dla "${effectiveTopicContext}"` : `Wstępne Spostrzeżenia (${effectiveTopicContext})`;
            if (isRealData) {
                findingsContent = `<p>To jest symulowana analiza dla <strong>${effectiveTopicContext}</strong>. W rzeczywistej aplikacji tutaj pojawiłyby się wyniki parsowania i analizy pliku CSV.</p>`;
                thoughtProcessContent = `<p>1. Wczytano plik CSV.<br>2. Przeprowadzono wstępne przetwarzanie danych.<br>3. Wygenerowano kluczowe metryki (symulacja).</p>`;
                newSuggestionsContent = [
                    `Jakie są trendy w danych dla ${ (effectiveTopicContext).substring(0,20)}...?`,
                    `Czy można zidentyfikować anomalie w ${(effectiveTopicContext).substring(0,20)}...?`
                ];
            } else if (effectiveTopicContext && effectiveTopicContext !== "Analiza Holistyczna" && effectiveTopicContext !== "Analiza Początkowa" ) { 
                 findingsContent = `<p>Dane dla tematu '<strong>${effectiveTopicContext}</strong>' są obecnie symulowane.</p><p>Możesz zadać pytania dotyczące tego tematu w czacie poniżej.</p>`;
                thoughtProcessContent = `<p>Analiza dla '<strong>${effectiveTopicContext}</strong>' jest w toku. Agent jest gotowy na Twoje pytania.</p>`;
                newSuggestionsContent = [
                    `Jakie są kluczowe wskaźniki dla ${effectiveTopicContext}?`,
                    `Poproś o szczegółową analizę X w kontekście ${effectiveTopicContext}.`
                ];
            }
             else { 
                findingsContent = `<p>Agent zidentyfikował, że produkty o relatywnie wysokim koszcie materiału nie zawsze korelują z najdłuższym czasem realizacji...</p><p>Dodatkowo, pewna grupa produktów charakteryzująca się niskim 'Wartość Dodana VA %'...</p>`;
                thoughtProcessContent = `<p>Aby sformułować te spostrzeżenia, Agent wykonał następujące kroki:</p><ul class="mt-2 space-y-1"><li>Agent obliczył złożone wskaźniki...</li><li>Agent przeprowadził analizę kwadrantową...</li><li>Agent porównał profile kosztowe...</li></ul>`;
                newSuggestionsContent = ["Które kategorie produktów wykazują największą dysproporcję...?", "Czy istnieje segment produktów, gdzie wysoka wartość 'NVA %'...", "Jakie czynniki, poza bezpośrednimi kosztami..."];
            }
        } else { 
            findingsHeading = "Wynik";
            findingsContent = `<p>W odpowiedzi na pytanie "${displayQuestionTitleInBlock}" (w kontekście: ${effectiveTopicContext}), Agent ustalił, że kluczowym elementem jest X. Na przykład, produkty Y wykazują tendencję Z.</p>`;
            thoughtProcessContent = `<p>Agent zastosował metodę A do analizy danych dotyczących "${displayQuestionTitleInBlock}". Porównano wskaźniki B i C.</p>`;
            newSuggestionsContent = [`Jak zmiana parametru D wpłynie na "${displayQuestionTitleInBlock.substring(0,15)}..."?`, `Czy można zidentyfikować inne czynniki wpływające na "${displayQuestionTitleInBlock.substring(0,15).toLowerCase()}..."?`];
        }
        
        let currentBlockElement;
        if (isInitial) { 
            currentBlockElement = document.getElementById('initial-analysis');
            if (!currentBlockElement) { 
                console.error("'initial-analysis' div not found! Cannot populate.");
                return;
            }
             currentBlockElement.innerHTML = ` 
                <div><h3 class="unified-analysis-heading">${findingsHeading}</h3><div id="initial-findings-content">${findingsContent}</div></div>
                <div class="mt-4"><h3 class="unified-analysis-heading">Proces Myślowy (Thought Process)</h3><div id="thought-process-content">${thoughtProcessContent}</div></div>
                <div class="mt-4"><h3 class="unified-analysis-heading">Sugestie Dalszych Pytań (Suggestions for Other Questions)</h3><ul id="initial-suggestions-list" class="space-y-1 question-suggestions-list">${newSuggestionsContent.map(s => `<li>${s}</li>`).join('')}</ul></div>
            `;
            currentBlockElement.dataset.blockTitle = blockTitleForNavigation; 

        } else { 
            currentBlockElement = document.createElement('div');
            currentBlockElement.id = analysisBlockId; 
            currentBlockElement.classList.add('analysis-block');
            currentBlockElement.dataset.blockTitle = blockTitleForNavigation;
            currentBlockElement.innerHTML = `
                <h2 class="analysis-question-title">Pytanie: ${displayQuestionTitleInBlock}</h2>
                <div><h3 class="unified-analysis-heading">${findingsHeading}</h3><div>${findingsContent}</div></div>
                <div class="mt-4"><h3 class="unified-analysis-heading">Proces Myślowy (Thought Process)</h3><div>${thoughtProcessContent}</div></div>
                <div class="mt-4"><h3 class="unified-analysis-heading">Sugestie Dalszych Pytań (Suggestions for Other Questions)</h3><ul class="space-y-1 question-suggestions-list">${newSuggestionsContent.map(s => `<li>${s}</li>`).join('')}</ul></div>
            `;
            if (analysisContentArea) analysisContentArea.appendChild(currentBlockElement);
            else console.error("analysisContentArea not found to append new block");
        }
        
        const existingStoreIndex = analysisBlocksStore.findIndex(b => b.id === analysisBlockId);
        const blockData = {id: analysisBlockId, titleForBlock: blockTitleForNavigation, question: questionText};
        if (existingStoreIndex > -1) { 
            analysisBlocksStore[existingStoreIndex] = blockData;
        } else {
            analysisBlocksStore.push(blockData);
        }
        
        if (isInitial) {
             currentAnalysisIndex = analysisBlocksStore.findIndex(b => b.id === 'initial-analysis');
        } else {
             currentAnalysisIndex = analysisBlocksStore.length - 1;
        }
        if(currentAnalysisIndex === -1 && analysisBlocksStore.length > 0) currentAnalysisIndex = 0;

        updateDashboardNavigation();
    }

    // Initialize the dashboard when its script loads
    initializeDashboard();
});