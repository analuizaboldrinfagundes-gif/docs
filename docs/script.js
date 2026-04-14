document.addEventListener('DOMContentLoaded', () => {
    // Estado Global
    let currentWeekStart = new Date();
    // Restaurar Domingo como começo da semana
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    currentWeekStart.setHours(0,0,0,0);
    
    let events = JSON.parse(localStorage.getItem('calendarEvents')) || {};
    let activeSlot = null;
    let currentView = 'week'; // Estados: 'week', 'month', 'year'
    let isTransitioning = false;

    // Seletores
    const grid = document.getElementById('calendar-grid');
    const viewButtons = document.querySelectorAll('.view-btn');
    const monthYearLabel = document.getElementById('month-year');
    const weekRangeLabel = document.getElementById('week-range');
    const modal = document.getElementById('event-modal');
    const clientInput = document.getElementById('client-name');
    const procedureInput = document.getElementById('procedure-type');
    const valueInput = document.getElementById('procedure-value');
    const colorInput = document.getElementById('event-color');
    const paymentMethodGroup = document.getElementById('payment-method-group');
    const modalDetails = document.getElementById('modal-details');
    const formError = document.getElementById('form-error');
    const totalPaidEl = document.getElementById('total-paid');
    const totalPendingEl = document.getElementById('total-pending');
    const searchClient = document.getElementById('search-client');
    const clientSuggestions = document.getElementById('client-suggestions');
    const profilePanel = document.getElementById('client-side-panel');
    const profileClientName = document.getElementById('profile-client-name');
    const profileHistoryList = document.getElementById('client-history-list');
    const profileTotalCount = document.getElementById('profile-total-count');
    const profileTotalValue = document.getElementById('profile-total-value');
    const todayBtn = document.getElementById('today-btn');

    // Tutorial Elements
    const tutorialWelcomeModal = document.getElementById('tutorial-welcome-modal');
    const tutorialStepBox = document.getElementById('tutorial-step-box');
    const tutorialTitle = document.getElementById('tutorial-title');
    const tutorialText = document.getElementById('tutorial-text');
    const tutorialProgress = document.getElementById('tutorial-progress');
    const nextTutorialBtn = document.getElementById('next-tutorial-step');
    const skipTutorialBtn = document.getElementById('skip-tutorial');
    const startTutorialBtn = document.getElementById('start-tutorial');
    const endTutorialBtn = document.getElementById('end-tutorial');

    // Seletores de Filtros
    const filterMonth = document.getElementById('filter-month');
    const filterYear = document.getElementById('filter-year');
    const filterDate = document.getElementById('filter-date');

    let currentTutorialStep = 0;
    const tutorialSteps = [
        {
            title: "Navegação por Semanas",
            text: "Use as setas para avançar ou retroceder as semanas. Clique em 'Hoje' para voltar instantaneamente.",
            element: ".header-left"
        },
        {
            title: "Pesquisa de Clientes",
            text: "Digite o nome de um cliente aqui. Se ele já tiver agendamentos, o perfil lateral abrirá automaticamente.",
            element: ".search-container"
        },
        {
            title: "Resumo Mensal",
            text: "Acompanhe aqui o quanto você já recebeu e o quanto ainda tem a receber no mês atual.",
            element: ".finance-summary"
        },
        {
            title: "Agendar Procedimento",
            text: "Clique em qualquer espaço vazio do calendário para agendar um novo procedimento.",
            element: ".day-column-grid:nth-child(3) .slot:nth-child(5)" // Um slot qualquer
        },
        {
            title: "Perfil do Cliente",
            text: "Ao pesquisar ou clicar em um agendamento, você verá todo o histórico e estatísticas do cliente no painel lateral.",
            element: "#search-client"
        }
    ];

    // Tutorial Logic
    function checkFirstVisit() {
        const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
        if (!hasSeenTutorial) {
            tutorialWelcomeModal.classList.add('active');
        }
    }

    function showTutorialStep(index) {
        if (index >= tutorialSteps.length) {
            finishTutorial();
            return;
        }

        const step = tutorialSteps[index];
        const targetEl = document.querySelector(step.element);

        // Limpar destaques anteriores
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

        if (targetEl) {
            targetEl.classList.add('tutorial-highlight');
            const rect = targetEl.getBoundingClientRect();
            
            tutorialStepBox.style.display = 'block';
            tutorialTitle.textContent = step.title;
            tutorialText.textContent = step.text;
            tutorialProgress.textContent = `${index + 1}/${tutorialSteps.length}`;

            // Posicionar o tooltip
            const tooltipRect = tutorialStepBox.getBoundingClientRect();
            let top = rect.bottom + 15;
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

            // Ajustes de tela
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 10;
            if (top + tooltipRect.height > window.innerHeight) top = rect.top - tooltipRect.height - 15;

            tutorialStepBox.style.top = `${top}px`;
            tutorialStepBox.style.left = `${left}px`;
        }
    }

    function finishTutorial() {
        tutorialStepBox.style.display = 'none';
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        localStorage.setItem('hasSeenTutorial', 'true');
        tutorialWelcomeModal.classList.remove('active');
    }

    startTutorialBtn.addEventListener('click', () => {
        tutorialWelcomeModal.classList.remove('active');
        currentTutorialStep = 0;
        showTutorialStep(currentTutorialStep);
    });

    skipTutorialBtn.addEventListener('click', () => {
        localStorage.setItem('hasSeenTutorial', 'true');
        tutorialWelcomeModal.classList.remove('active');
    });

    nextTutorialBtn.addEventListener('click', () => {
        currentTutorialStep++;
        showTutorialStep(currentTutorialStep);
    });

    endTutorialBtn.addEventListener('click', finishTutorial);

    // 0. Inicializar Filtros
    function initFilters() {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 5; y <= currentYear + 5; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            if (y === currentYear) option.selected = true;
            filterYear.appendChild(option);
        }
        
        filterMonth.value = currentWeekStart.getMonth();
        filterYear.value = currentWeekStart.getFullYear();
    }

    function syncFilters() {
        filterMonth.value = currentWeekStart.getMonth();
        filterYear.value = currentWeekStart.getFullYear();
        filterDate.value = currentWeekStart.toISOString().split('T')[0];
    }

    // 1. Gerar Grade de Horários (Semana)
    function generateGrid() {
        grid.className = 'calendar-grid week-view';
        grid.innerHTML = '';
        
        // Criar Coluna de Horários
        const timeCol = document.createElement('div');
        timeCol.className = 'time-column';
        
        // Cabeçalho vazio para alinhar com os dias
        const timeHeader = document.createElement('div');
        timeHeader.className = 'time-header-sticky';
        timeCol.appendChild(timeHeader);

        for (let hour = 9; hour <= 20; hour++) {
            const label = document.createElement('div');
            label.className = 'time-label-slot';
            if (hour > 9) {
                label.innerHTML = `<span>${hour.toString().padStart(2, '0')}:00</span>`;
            }
            timeCol.appendChild(label);
        }
        grid.appendChild(timeCol);

        const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const dayCol = document.createElement('div');
            dayCol.className = 'day-column-grid';
            dayCol.dataset.day = dayIdx;

            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header-sticky';
            dayHeader.innerHTML = `<span>${dayNames[dayIdx]}</span><strong class="day-num">--</strong>`;
            dayCol.appendChild(dayHeader);

            for (let hour = 9; hour <= 20; hour++) {
                const isLunch = (hour === 12 || hour === 13);
                const slot = document.createElement('div');
                slot.className = `slot ${isLunch ? 'lunch-slot' : ''}`;
                slot.dataset.hour = hour;
                slot.dataset.day = dayIdx;
                
                if (isLunch) {
                    slot.innerHTML = '<div class="lunch-text" aria-hidden="true">ALMOÇO</div>';
                    slot.setAttribute('aria-label', 'Horário de Almoço');
                } else {
                    slot.tabIndex = 0; // Tornar focável por teclado
                    slot.setAttribute('role', 'gridcell');
                    slot.setAttribute('aria-label', `Agendar para ${dayNames[dayIdx]}, ${hour}:00`);
                    slot.addEventListener('click', () => openModal(dayIdx, hour));
                    slot.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openModal(dayIdx, hour);
                        }
                    });
                }
                dayCol.appendChild(slot);
            }
            grid.appendChild(dayCol);
        }
        updateHeaderDates();
        renderEvents();
    }

    // 1.1 Gerar Grade Mensal
    function generateMonthGrid() {
        grid.className = 'calendar-grid month-view';
        grid.innerHTML = '';
        
        const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
        const monthName = currentWeekStart.toLocaleDateString('pt-BR', { month: 'long' });

        dayNames.forEach(name => {
            const header = document.createElement('div');
            header.className = 'month-day-header';
            header.textContent = name;
            grid.appendChild(header);
        });

        const firstDayOfMonth = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1);
        const lastDayOfMonth = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth() + 1, 0);
        
        // Preencher dias vazios antes do início do mês
        for (let i = 0; i < firstDayOfMonth.getDay(); i++) {
            const empty = document.createElement('div');
            empty.className = 'month-slot empty';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
            const date = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), day);
            const slot = document.createElement('div');
            slot.className = 'month-slot';
            slot.tabIndex = 0;
            slot.setAttribute('role', 'gridcell');
            slot.setAttribute('aria-label', `${day} de ${monthName}`);
            slot.innerHTML = `<span class="month-day-num">${day}</span>`;
            
            // Renderizar mini-eventos no mês
            const dateKey = date.toISOString().split('T')[0];
            const dayEvents = [];
            // Buscar eventos deste dia específico
            Object.keys(events).forEach(weekKey => {
                events[weekKey].forEach(ev => {
                    const evDate = new Date(weekKey + 'T00:00:00');
                    evDate.setDate(evDate.getDate() + ev.day);
                    if (evDate.toISOString().split('T')[0] === dateKey) {
                        dayEvents.push(ev);
                    }
                });
            });

            dayEvents.slice(0, 3).forEach(ev => {
                const dot = document.createElement('div');
                dot.className = 'month-event-dot';
                dot.setAttribute('aria-hidden', 'true');
                if (ev.color) dot.style.backgroundColor = ev.color;
                slot.appendChild(dot);
            });

            const selectDay = () => {
                currentWeekStart = new Date(date);
                currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
                switchView('week');
            };

            slot.addEventListener('click', selectDay);
            slot.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectDay();
                }
            });
            grid.appendChild(slot);
        }
        
        monthYearLabel.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${currentWeekStart.getFullYear()}`;
        weekRangeLabel.textContent = `Visão Mensal`;
    }

    // 1.2 Gerar Grade Anual
    function generateYearGrid() {
        grid.className = 'calendar-grid year-view';
        grid.innerHTML = '';
        
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        months.forEach((monthName, idx) => {
            const monthCard = document.createElement('div');
            monthCard.className = 'year-month-card';
            monthCard.tabIndex = 0;
            monthCard.setAttribute('role', 'button');
            monthCard.setAttribute('aria-label', `Ver mês de ${monthName}`);
            monthCard.innerHTML = `<h4>${monthName}</h4>`;
            
            const selectMonth = () => {
                currentWeekStart.setMonth(idx);
                currentWeekStart.setDate(1);
                currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
                switchView('month');
            };

            monthCard.addEventListener('click', selectMonth);
            monthCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectMonth();
                }
            });
            grid.appendChild(monthCard);
        });

        monthYearLabel.textContent = currentWeekStart.getFullYear();
        weekRangeLabel.textContent = `Visão Anual`;
    }

    function switchView(newView) {
        if (isTransitioning || currentView === newView) return;
        isTransitioning = true;
        
        const isZoomIn = (currentView === 'year' && newView === 'month') || 
                         (currentView === 'month' && newView === 'week');
        
        // Atualizar botões de visão
        viewButtons.forEach(btn => {
            if (btn.dataset.view === newView) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Adicionar classe de saída
        const exitClass = isZoomIn ? 'view-exit-zoom-in' : 'view-exit-zoom-out';
        const enterClass = isZoomIn ? 'view-enter-zoom-in' : 'view-enter-zoom-out';
        
        grid.classList.add(exitClass);
        
        setTimeout(() => {
            // Mudar conteúdo no meio da animação (quando estiver invisível)
            grid.classList.remove(exitClass);
            currentView = newView;
            init();
            
            // Adicionar classe de entrada
            grid.classList.add(enterClass);
            
            setTimeout(() => {
                grid.classList.remove(enterClass);
                isTransitioning = false;
            }, 400); // Tempo da animação CSS
        }, 200); // Meio do tempo total para troca de conteúdo
    }

    // Eventos para botões de visão
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    // O scroll agora é nativo e livre de interferências de zoom
    // Removemos o wheel event que causava bugs
    grid.addEventListener('wheel', (e) => {
        // Apenas deixa o scroll natural acontecer, bloqueando zoom acidental
        if (isTransitioning) e.preventDefault();
    }, { passive: true });

    // 2. Atualizar Datas do Cabeçalho (Dom a Sab)
    function updateHeaderDates() {
        if (currentView !== 'week') return;
        const dayHeaders = document.querySelectorAll('.day-header-sticky');
        const weekDays = [];
        const today = new Date();
        today.setHours(0,0,0,0);
        
        dayHeaders.forEach((header, index) => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + index);
            const dayNum = header.querySelector('.day-num');
            dayNum.textContent = date.getDate().toString().padStart(2, '0');
            
            // Highlight today
            if (date.getTime() === today.getTime()) {
                header.classList.add('is-today');
            } else {
                header.classList.remove('is-today');
            }
            
            weekDays.push(date);
        });

        const firstDay = weekDays[0];
        const lastDay = weekDays[6]; // Sábado
        const monthFirst = firstDay.toLocaleDateString('pt-BR', { month: 'long' });
        const monthLast = lastDay.toLocaleDateString('pt-BR', { month: 'long' });
        
        monthYearLabel.textContent = `${monthFirst.charAt(0).toUpperCase() + monthFirst.slice(1)} ${firstDay.getFullYear()}`;
        
        if (monthFirst === monthLast) {
            weekRangeLabel.textContent = `${firstDay.getDate()} - ${lastDay.getDate()} de ${monthFirst}`;
        } else {
            weekRangeLabel.textContent = `${firstDay.getDate()} de ${monthFirst} - ${lastDay.getDate()} de ${monthLast}`;
        }
    }

    // 3. Renderizar Eventos na Grade
    function renderEvents() {
        // Limpar eventos anteriores
        document.querySelectorAll('.event').forEach(e => e.remove());

        const weekKey = currentWeekStart.toISOString().split('T')[0];
        const weekEvents = events[weekKey] || [];
        const searchTerm = searchClient.value.toLowerCase().trim();

        weekEvents.forEach(event => {
            // Filtro de pesquisa
            if (searchTerm && !event.client.toLowerCase().includes(searchTerm)) {
                return;
            }

            const slot = document.querySelector(`.slot[data-day="${event.day}"][data-hour="${event.hour}"]`);
            if (slot) {
                const eventEl = document.createElement('div');
                eventEl.className = `event ${event.paid ? 'is-paid' : 'is-pending'}`;
                eventEl.tabIndex = 0; // Tornar focável
                eventEl.setAttribute('role', 'button');
                eventEl.setAttribute('aria-label', `Editar agendamento de ${event.client}: ${event.procedure}`);
                
                // Aplicar cor personalizada
                if (event.color) {
                    eventEl.style.backgroundColor = event.color;
                    eventEl.style.borderColor = event.paid ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.8)';
                }
                
                // Ícone de status de pagamento
                const statusIcon = event.paid ? '✓' : '•';
                eventEl.innerHTML = `
                    <span class="status-badge" aria-hidden="true">${statusIcon}</span>
                    <span class="client-name-text">${event.client}</span>
                `;

                // Impedir que o clique no evento dispare o clique no slot (abrir novo)
                const openEdit = (e) => {
                    e.stopPropagation();
                    openModal(event.day, event.hour);
                };
                eventEl.addEventListener('click', openEdit);
                eventEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEdit(e);
                    }
                });

                slot.appendChild(eventEl);
            }
        });

        updateFinanceSummary();
        updateAutocomplete();
    }

    // 3.1 Atualizar Resumo Financeiro (Mensal)
    function updateFinanceSummary() {
        let paid = 0;
        let pending = 0;

        const targetMonth = currentWeekStart.getMonth();
        const targetYear = currentWeekStart.getFullYear();

        // Percorre todas as chaves de data no localStorage
        Object.keys(events).forEach(dateKey => {
            const date = new Date(dateKey);
            if (date.getMonth() === targetMonth && date.getFullYear() === targetYear) {
                events[dateKey].forEach(e => {
                    const val = parseFloat(e.value.replace(',', '.')) || 0;
                    if (e.paid) paid += val;
                    else pending += val;
                });
            }
        });

        totalPaidEl.textContent = paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        totalPendingEl.textContent = pending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // 3.2 Atualizar Sugestões de Autocomplete
    function updateAutocomplete() {
        const uniqueClients = new Set();
        Object.values(events).forEach(dayEvents => {
            dayEvents.forEach(event => {
                if (event.client) uniqueClients.add(event.client);
            });
        });

        clientSuggestions.innerHTML = '';
        uniqueClients.forEach(client => {
            const option = document.createElement('option');
            option.value = client;
            clientSuggestions.appendChild(option);
        });
    }

    // 3.3 Abrir Perfil do Cliente
    function openClientProfile(clientName) {
        profileClientName.textContent = `Perfil: ${clientName}`;
        profileHistoryList.innerHTML = '';
        
        let totalCount = 0;
        let totalValue = 0;
        let allClientEvents = [];

        // Buscar em todo o histórico
        Object.keys(events).forEach(dateKey => {
            events[dateKey].forEach((event, index) => {
                if (event.client.toLowerCase() === clientName.toLowerCase()) {
                    allClientEvents.push({ ...event, dateKey, originalIndex: index });
                    totalCount++;
                    const val = parseFloat(event.value.replace(',', '.')) || 0;
                    totalValue += val;
                }
            });
        });

        // Ordenar por data (mais recente primeiro)
        allClientEvents.sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));

        allClientEvents.forEach(ev => {
            const dateObj = new Date(ev.dateKey);
            const dateStr = dateObj.toLocaleDateString('pt-BR');
            
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-info">
                    <span class="history-date">${dateStr} às ${ev.hour}:00</span>
                    <span class="history-proc">${ev.procedure}</span>
                    <span class="history-price">R$ ${ev.value} - ${ev.paid ? 'Pago' : 'Pendente'}</span>
                </div>
                <div class="history-actions">
                    <button class="edit-history-btn" onclick="editFromHistory(event, '${ev.dateKey}', ${ev.day}, ${ev.hour})">Ir para Data</button>
                </div>
            `;
            profileHistoryList.appendChild(item);
        });

        profileTotalCount.textContent = totalCount;
        profileTotalValue.textContent = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        profilePanel.classList.add('active');
    }

    // Função global para navegar do histórico para a data
    window.editFromHistory = (event, dateKey, day, hour) => {
        // Evita que o clique "passe" para o fundo
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Reconstrói a data do início da semana corretamente
        const targetDate = new Date(dateKey + 'T00:00:00'); // Garante horário local 00:00
        currentWeekStart = new Date(targetDate);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        
        profilePanel.classList.remove('active');
        init();
        
        // APENAS navega no calendário, sem abrir o modal de edição (info do cliente)
        console.log(`Navegado para ${dateKey}, dia ${day}, hora ${hour}`);
    };

    // 4. Modal de Edição
    function openModal(day, hour) {
        activeSlot = { day, hour };
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + day);
        
        modalDetails.textContent = `${date.toLocaleDateString('pt-BR', { weekday: 'long' })}, ${hour}:00`;
        formError.style.display = 'none'; // Limpa erro ao abrir

        const weekKey = currentWeekStart.toISOString().split('T')[0];
        const existingEvent = (events[weekKey] || []).find(e => e.day === day && e.hour === hour);
        
        if (existingEvent) {
            clientInput.value = existingEvent.client || '';
            procedureInput.value = existingEvent.procedure || '';
            valueInput.value = existingEvent.value || '';
            colorInput.value = existingEvent.color || '#2563eb';
            
            const status = existingEvent.paid ? 'paid' : 'pending';
            document.querySelector(`input[name="payment-status"][value="${status}"]`).checked = true;
            
            if (existingEvent.paid) {
                paymentMethodGroup.style.display = 'block';
                if (existingEvent.paymentMethod) {
                    const radio = document.querySelector(`input[name="payment-method"][value="${existingEvent.paymentMethod}"]`);
                    if (radio) radio.checked = true;
                }
            } else {
                paymentMethodGroup.style.display = 'none';
                document.querySelectorAll('input[name="payment-method"]').forEach(r => r.checked = false);
            }
        } else {
            clientInput.value = '';
            procedureInput.value = '';
            valueInput.value = '';
            colorInput.value = '#2563eb';
            document.querySelector('input[name="payment-status"][value="pending"]').checked = true;
            paymentMethodGroup.style.display = 'none';
            document.querySelectorAll('input[name="payment-method"]').forEach(r => r.checked = false);
        }
        
        modal.classList.add('active');
        clientInput.focus();
    }

    function closeModal() {
        if (activeSlot) {
            const slot = document.querySelector(`.slot[data-day="${activeSlot.day}"][data-hour="${activeSlot.hour}"]`);
            if (slot) slot.focus();
        }
        modal.classList.remove('active');
        formError.style.display = 'none';
        activeSlot = null;
    }

    // Atalhos de Teclado Globais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal.classList.contains('active')) closeModal();
            if (profilePanel.classList.contains('active')) profilePanel.classList.remove('active');
            if (tutorialWelcomeModal.classList.contains('active')) tutorialWelcomeModal.classList.remove('active');
            if (tutorialStepBox.style.display === 'block') finishTutorial();
        }
    });

    // 5. Salvar e Excluir
    document.getElementById('save-event').addEventListener('click', () => {
        if (!activeSlot) return;
        
        const weekKey = currentWeekStart.toISOString().split('T')[0];
        if (!events[weekKey]) events[weekKey] = [];
        
        // Remover se já existe
        events[weekKey] = events[weekKey].filter(e => !(e.day === activeSlot.day && e.hour === activeSlot.hour));
        
        const client = clientInput.value.trim();
        const procedure = procedureInput.value.trim();
        const value = valueInput.value.trim();
        const color = colorInput.value;
        const paid = document.querySelector('input[name="payment-status"]:checked').value === 'paid';
        const methodRadio = document.querySelector('input[name="payment-method"]:checked');
        const paymentMethod = paid && methodRadio ? methodRadio.value : '';

        // Validação de todos os campos
        if (!client || !procedure || !value || (paid && !paymentMethod)) {
            formError.style.display = 'block';
            return;
        }

        events[weekKey].push({
            day: activeSlot.day,
            hour: activeSlot.hour,
            client: client,
            procedure: procedure,
            value: value,
            color: color,
            paid: paid,
            paymentMethod: paymentMethod
        });
        
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        renderEvents();
        closeModal();
    });

    document.getElementById('delete-event').addEventListener('click', () => {
        if (!activeSlot) return;
        const weekKey = currentWeekStart.toISOString().split('T')[0];
        if (events[weekKey]) {
            events[weekKey] = events[weekKey].filter(e => !(e.day === activeSlot.day && e.hour === activeSlot.hour));
            localStorage.setItem('calendarEvents', JSON.stringify(events));
        }
        renderEvents();
        closeModal();
    });

    // 6. Navegação de Semanas
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        init();
    });

    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        init();
    });

    document.getElementById('close-modal').addEventListener('click', closeModal);

    todayBtn.addEventListener('click', () => {
        currentWeekStart = new Date();
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        currentWeekStart.setHours(0,0,0,0);
        init();
    });

    // Toggle do Método de Pagamento
    document.querySelectorAll('input[name="payment-status"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'paid') {
                paymentMethodGroup.style.display = 'block';
            } else {
                paymentMethodGroup.style.display = 'none';
                document.querySelectorAll('input[name="payment-method"]').forEach(r => r.checked = false);
            }
        });
    });

    // Evento de Pesquisa (Auto-abrir Perfil)
    searchClient.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const options = Array.from(clientSuggestions.options).map(o => o.value);
        
        // Se o nome digitado for um cliente real, abre o perfil e limpa a busca
        if (options.includes(val)) {
            openClientProfile(val);
            searchClient.value = '';
        }
        renderEvents();
    });

    document.getElementById('close-profile').addEventListener('click', () => {
        profilePanel.classList.remove('active');
    });

    // Eventos de Filtro
    filterMonth.addEventListener('change', () => {
        currentWeekStart.setMonth(parseInt(filterMonth.value));
        // Recalcular início da semana para o mês selecionado
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        init();
    });

    filterYear.addEventListener('change', () => {
        currentWeekStart.setFullYear(parseInt(filterYear.value));
        // Recalcular início da semana para o ano selecionado
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        init();
    });

    filterDate.addEventListener('change', () => {
        const selectedDate = new Date(filterDate.value);
        if (!isNaN(selectedDate.getTime())) {
            currentWeekStart = new Date(selectedDate);
            currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
            init();
        }
    });

    // Inicialização
    function init() {
        if (filterYear.children.length === 0) initFilters();
        
        if (currentView === 'week') {
            generateGrid();
        } else if (currentView === 'month') {
            generateMonthGrid();
        } else if (currentView === 'year') {
            generateYearGrid();
        }
        
        syncFilters();
        checkFirstVisit();
    }

    init();
});
