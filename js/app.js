/**
 * AGENDA ÓTICA - MAIN APPLICATION
 * Sistema principal de agendamento
 */

class App {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.currentView = 'geral';
        this.currentStoreId = null; // null = all stores
        this.initialized = false;
    }

    init() {
        if (this.initialized) {
            this.refresh();
            return;
        }

        this.bindEvents();
        this.initCalendar();
        this.loadStores();
        
        // If logged in as a store, show that store's name in sidebar and hide dropdown
        const loggedStoreId = dataService.currentStoreId;
        if (loggedStoreId) {
            // Get store directly from database to avoid any filtering issues
            const db = new Database();
            const data = db.getData();
            const store = data.stores.find(s => s.id === loggedStoreId);
            
            if (store) {
                const storeSelector = document.getElementById('store-selector');
                const indicator = storeSelector.querySelector('.store-indicator');
                const nameElement = storeSelector.querySelector('.store-name');
                
                // Update store indicator color and name
                indicator.style.background = store.color;
                nameElement.textContent = store.name;
                
                // Add logged-in class and hide chevron
                storeSelector.classList.add('logged-in');
                const chevron = document.querySelector('.store-chevron');
                if (chevron) chevron.style.display = 'none';
                
                this.currentStoreId = loggedStoreId;
            }
        }
        
        this.updateDateDisplay();
        this.renderSchedule();
        this.initialized = true;
    }

    refresh() {
        // Sincronizar com planilha se conectado
        if (sheetsService?.isConnected) {
            sheetsService.refresh().then(() => {
                this.renderCalendar();
                this.renderSchedule();
            });
        } else {
            this.renderCalendar();
            this.renderSchedule();
        }
    }

    // ==================
    // EVENT BINDING
    // ==================
    bindEvents() {
        // Calendar navigation
        document.getElementById('prev-month').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.navigateMonth(1));

        // View navigation
        document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view));
        });

        // Store selector - only enable if not logged in as a specific store
        document.getElementById('store-selector').addEventListener('click', () => {
            // Don't show dropdown if logged in as a store
            if (dataService.currentStoreId) return;
            document.getElementById('store-dropdown').classList.toggle('hidden');
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.sidebar-header')) {
                document.getElementById('store-dropdown').classList.add('hidden');
            }
        });

        // Today button
        document.getElementById('btn-today').addEventListener('click', () => {
            this.selectedDate = new Date();
            this.currentDate = new Date();
            this.updateDateDisplay();
            this.renderCalendar();
            this.renderSchedule();
        });

        // Refresh button
        document.getElementById('btn-refresh').addEventListener('click', () => this.refresh());

        // Appointment form
        document.getElementById('appointment-form').addEventListener('submit', (e) => this.handleAppointmentSubmit(e));

        // Modal close buttons
        document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Modal overlay close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => this.closeAllModals());
        });

        // Delete appointment
        document.getElementById('btn-delete-apt').addEventListener('click', () => this.deleteAppointment());

        // WhatsApp button
        document.getElementById('btn-whatsapp').addEventListener('click', () => this.sendWhatsApp());

        // User menu actions
        document.querySelectorAll('.user-dropdown a').forEach(link => {
            link.addEventListener('click', (e) => {
                const action = link.dataset.action;
                if (action === 'profile') {
                    e.preventDefault;
                    // Could show profile modal
                    this.showToast('Funcionalidade em desenvolvimento', 'info');
                }
            });
        });

        // Config button (Google Sheets)
        document.getElementById('btn-config').addEventListener('click', () => {
            this.openCalendarModal();
        });

        // Sheets modal events
        document.getElementById('btn-sheets-connect')?.addEventListener('click', async () => {
            const url = document.getElementById('sheets-url-input')?.value;
            if (!url) {
                this.showToast('Cole a URL do Apps Script', 'error');
                return;
            }
            
            if (sheetsService) {
                this.showToast('Conectando...', 'info');
                const result = await sheetsService.configure(url);
                if (result.success) {
                    this.showToast('✅ Conectado à planilha!', 'success');
                    sheetsService.updateUI();
                } else {
                    this.showToast('❌ ' + result.error, 'error');
                }
            }
        });

        document.getElementById('btn-sheets-disconnect')?.addEventListener('click', () => {
            if (sheetsService) {
                sheetsService.disconnect();
            }
        });

        document.getElementById('btn-sync-to-sheets')?.addEventListener('click', () => {
            if (sheetsService) {
                sheetsService.syncAllToSheets();
            }
        });

        document.getElementById('btn-sync-from-sheets')?.addEventListener('click', async () => {
            if (sheetsService) {
                const count = await sheetsService.syncFromSheets();
                if (count > 0) {
                    this.refresh();
                }
            }
        });
    }

    // ==================
    // CALENDAR
    // ==================
    initCalendar() {
        this.renderCalendar();
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Update month/year display
        const months = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
                       'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        document.getElementById('month-year').textContent = months[month];

        // Get days with full schedule (all slots booked)
        const datesWithFullSchedule = dataService.getFullDates(year, month + 1);

        // Calculate calendar days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const calendarDays = document.getElementById('calendar-days');
        calendarDays.innerHTML = '';

        const today = new Date();
        const selectedDay = this.selectedDate.getDate();
        const selectedMonth = this.selectedDate.getMonth();
        const selectedYear = this.selectedDate.getFullYear();

        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const dayEl = this.createCalendarDay(day, true, false, false, false);
            calendarDays.appendChild(dayEl);
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === selectedDay && month === selectedMonth && year === selectedYear;
            const isFull = datesWithFullSchedule.includes(day);
            
            const dayEl = this.createCalendarDay(day, false, isToday, isSelected, isFull);
            dayEl.addEventListener('click', () => this.selectDate(day));
            calendarDays.appendChild(dayEl);
        }

        // Next month days
        const totalDays = firstDay + daysInMonth;
        const remainingDays = totalDays <= 35 ? 35 - totalDays : 42 - totalDays;
        for (let day = 1; day <= remainingDays; day++) {
            const dayEl = this.createCalendarDay(day, true, false, false, false);
            calendarDays.appendChild(dayEl);
        }
    }

    createCalendarDay(day, isOtherMonth, isToday, isSelected, isFull) {
        const el = document.createElement('div');
        el.className = 'calendar-day';
        el.textContent = day;
        
        if (isOtherMonth) el.classList.add('other-month');
        if (isToday) el.classList.add('today');
        if (isSelected && !isToday) el.classList.add('selected');
        if (isFull) el.classList.add('full-schedule');
        
        return el;
    }

    navigateMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderCalendar();
    }

    selectDate(day) {
        this.selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
        this.updateDateDisplay();
        this.renderCalendar();
        this.renderSchedule();
    }

    updateDateDisplay() {
        const weekdays = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        const months = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        
        const day = this.selectedDate.getDate();
        const weekday = weekdays[this.selectedDate.getDay()];
        const monthName = months[this.selectedDate.getMonth()];
        const year = this.selectedDate.getFullYear();

        document.getElementById('display-day').textContent = day;
        document.getElementById('display-weekday').textContent = weekday;
        document.getElementById('display-month-name').textContent = monthName;
        document.getElementById('display-year').textContent = year;
    }

    // ==================
    // STORES
    // ==================
    loadStores() {
        const stores = dataService.getStores();
        const dropdown = document.getElementById('store-dropdown');
        const storeSelect = document.getElementById('apt-store');
        
        // Clear and rebuild dropdown
        dropdown.innerHTML = `
            <div class="store-dropdown-item" data-store-id="">
                <div class="store-color" style="background: #fff"></div>
                <span>Todas as Lojas</span>
            </div>
        `;

        stores.forEach(store => {
            const item = document.createElement('div');
            item.className = 'store-dropdown-item';
            item.dataset.storeId = store.id;
            item.innerHTML = `
                <div class="store-color" style="background: ${store.color}"></div>
                <span>${store.name}</span>
            `;
            dropdown.appendChild(item);
        });

        // Add click handlers
        dropdown.querySelectorAll('.store-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const storeId = item.dataset.storeId;
                this.selectStore(storeId ? parseInt(storeId) : null);
                dropdown.classList.add('hidden');
            });
        });

        // Update store select in appointment modal
        storeSelect.innerHTML = '';
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            storeSelect.appendChild(option);
        });

    }

    selectStore(storeId) {
        this.currentStoreId = storeId;
        
        const store = storeId ? dataService.getStore(storeId) : null;
        const selector = document.getElementById('store-selector');
        const indicator = selector.querySelector('.store-indicator');
        const name = selector.querySelector('.store-name');

        if (store) {
            indicator.style.background = store.color;
            name.textContent = store.name;
        } else {
            indicator.style.background = '#f44336';
            name.textContent = 'Todas as Lojas';
        }

        this.renderSchedule();
    }

    // ==================
    // SCHEDULE RENDERING
    // ==================
    renderSchedule() {
        if (this.currentView === 'geral') {
            this.renderGeralSchedule();
        } else if (this.currentView === 'simplificado') {
            this.renderSimplificadoSchedule();
        }
    }

    // Buscar agendamentos para uma data (dados locais)
    getAppointmentsForDate(dateStr) {
        return dataService.getAppointments(dateStr);
    }

    renderGeralSchedule() {
        const container = document.getElementById('schedule-geral');
        const stores = dataService.getStores();
        const dateStr = this.formatDateForDB(this.selectedDate);
        const timeSlots = dataService.getTimeSlots(dateStr);
        
        // USA DADOS DO CALENDAR COMO FONTE PRINCIPAL
        const appointments = this.getAppointmentsForDate(dateStr);

        // Check if closed (Sunday)
        if (timeSlots.length === 0) {
            container.innerHTML = `
                <div class="schedule-closed">
                    <i class="fas fa-calendar-times"></i>
                    <p>Fechado neste dia</p>
                </div>
            `;
            return;
        }

        // GERAL VIEW: Times as ROWS, Stores as COLUMNS (like the second image)
        const gridCols = `80px repeat(${stores.length}, 1fr)`;
        
        let html = `
            <div class="simplified-header" style="grid-template-columns: ${gridCols}">
                <div></div>
                ${stores.map(store => `<div>${store.name}</div>`).join('')}
            </div>
        `;

        timeSlots.forEach(time => {
            // Check if this time slot has ANY appointment (regardless of store)
            const timeSlotApt = appointments.find(a => a.time === time);
            
            // Check if Google Calendar has an event at this time (external events)
            const googleBusy = typeof calendarService !== 'undefined' && calendarService && 
                              calendarService.isTimeSlotBusy(dateStr, time);
            
            html += `
                <div class="simplified-row" style="grid-template-columns: ${gridCols}">
                    <div class="simplified-time">${time}</div>
                    ${stores.map(store => {
                        const apt = appointments.find(a => a.storeId === store.id && a.time === time);
                        if (apt) {
                            // This store has the appointment
                            return `
                                <div class="simplified-cell has-appointment">
                                    <div class="appointment-card-simp" data-apt-id="${apt.id}">
                                        <div class="appointment-name">${apt.clientName}</div>
                                        <div class="appointment-phone">(${apt.clientPhone.slice(0, 2)})${apt.clientPhone.slice(2, 6)}-${apt.clientPhone.slice(6)}</div>
                                    </div>
                                </div>
                            `;
                        } else if (timeSlotApt || googleBusy) {
                            // Another store/Google has an appointment at this time - block this cell
                            return `
                                <div class="simplified-cell blocked">
                                    <span class="blocked-indicator">${googleBusy && !timeSlotApt ? '📅' : '—'}</span>
                                </div>
                            `;
                        } else {
                            // No appointment at this time - allow adding
                            return `
                                <div class="simplified-cell empty" data-store-id="${store.id}" data-time="${time}">
                                    <button class="add-appointment-btn-geral" data-store-id="${store.id}" data-time="${time}">+</button>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            `;
        });

        container.innerHTML = html;
        this.bindScheduleEvents();
    }

    renderSimplificadoSchedule() {
        const container = document.getElementById('schedule-simplificado');
        const dateStr = this.formatDateForDB(this.selectedDate);
        const timeSlots = dataService.getTimeSlots(dateStr);
        
        // USA DADOS DO CALENDAR COMO FONTE PRINCIPAL
        const appointments = this.getAppointmentsForDate(dateStr);

        // Check if closed (Sunday)
        if (timeSlots.length === 0) {
            container.innerHTML = `
                <div class="schedule-closed">
                    <i class="fas fa-calendar-times"></i>
                    <p>Fechado neste dia</p>
                </div>
            `;
            return;
        }

        // Check day of week to determine layout
        const d = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = d.getDay();
        
        // Normal days (Mon-Thu) have two periods, split into two rows
        const isNormalDay = dayOfWeek >= 1 && dayOfWeek <= 4;
        
        let html = '';
        
        if (isNormalDay) {
            // Split slots into morning (9:00-12:30) and afternoon (14:00-18:00)
            const morningSlots = timeSlots.filter(t => {
                const hour = parseInt(t.split(':')[0]);
                return hour < 13;
            });
            const afternoonSlots = timeSlots.filter(t => {
                const hour = parseInt(t.split(':')[0]);
                return hour >= 14;
            });
            
            // Morning row
            html += this.renderSimplificadoPeriod('Manhã', morningSlots, appointments, 'sun', dateStr);
            
            // Afternoon row
            html += this.renderSimplificadoPeriod('Tarde', afternoonSlots, appointments, 'cloud-sun', dateStr);
        } else if (dayOfWeek === 5) {
            // Friday - afternoon only
            html += this.renderSimplificadoPeriod('Tarde', timeSlots, appointments, 'cloud-sun', dateStr);
        } else if (dayOfWeek === 6) {
            // Saturday - morning only
            html += this.renderSimplificadoPeriod('Manhã', timeSlots, appointments, 'sun', dateStr);
        } else {
            // Fallback
            html += this.renderSimplificadoPeriod('Horários', timeSlots, appointments, 'clock', dateStr);
        }
        
        container.innerHTML = html;
        this.bindScheduleEvents();
    }

    renderSimplificadoPeriod(label, timeSlots, appointments, icon = 'clock', dateStr = null) {
        if (timeSlots.length === 0) return '';
        
        const gridCols = `repeat(${timeSlots.length}, minmax(80px, 1fr))`;
        
        let html = '<div class="period-card">';
        
        if (label) {
            html += `<div class="period-label"><i class="fas fa-${icon}"></i> ${label}</div>`;
        }
        
        html += `<div class="period-content">
            <div class="schedule-header-geral" style="grid-template-columns: ${gridCols}">
                ${timeSlots.map(time => `
                    <div class="schedule-header-time-col">${time}</div>
                `).join('')}
            </div>
            <div class="schedule-body-geral" style="grid-template-columns: ${gridCols}">
        `;

        timeSlots.forEach(time => {
            const apt = appointments.find(a => a.time === time);
            
            html += `<div class="schedule-column" data-time="${time}">`;
            
            if (apt) {
                const store = dataService.getStore(apt.storeId);
                html += `
                    <div class="appointment-card-geral" data-apt-id="${apt.id}">
                        <div class="appointment-store">${store ? store.name : 'Loja'}</div>
                        <div class="appointment-name">${apt.clientName}</div>
                        <div class="appointment-phone">(${apt.clientPhone.slice(0, 2)})${apt.clientPhone.slice(2, 6)}-${apt.clientPhone.slice(6)}</div>
                    </div>
                `;
            } else {
                html += `
                    <button class="add-appointment-btn-geral" data-time="${time}">
                        <i class="fas fa-plus"></i>
                    </button>
                `;
            }
            
            html += `</div>`;
        });

        html += `</div></div></div>`;
        return html;
    }

    bindScheduleEvents() {
        const loggedStoreId = dataService.currentStoreId;
        
        // Click on empty cell to add appointment (Simplificado view)
        document.querySelectorAll('.simplified-cell.empty').forEach(cell => {
            cell.addEventListener('click', () => {
                const storeId = parseInt(cell.dataset.storeId);
                const time = cell.dataset.time;
                
                // Only allow adding to own store
                if (loggedStoreId && storeId !== loggedStoreId) {
                    authManager.showToast('Você só pode agendar na sua própria loja', 'error');
                    return;
                }
                
                this.openAppointmentModal(null, storeId, time);
            });
        });

        // Click on add button in Geral view
        document.querySelectorAll('.add-appointment-btn-geral').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const time = btn.dataset.time;
                const storeId = parseInt(btn.dataset.storeId);
                
                // Only allow adding to own store
                if (loggedStoreId && storeId && storeId !== loggedStoreId) {
                    authManager.showToast('Você só pode agendar na sua própria loja', 'error');
                    return;
                }
                
                this.openAppointmentModal(null, storeId || null, time);
            });
        });

        // Click on appointment card (all views)
        document.querySelectorAll('.appointment-card-geral, .appointment-card-simp').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const aptId = card.dataset.aptId;
                this.showAppointmentDetails(aptId);
            });
        });
    }

    showAppointmentDetails(aptId) {
        // Buscar agendamento nos dados locais
        const apt = dataService.getAppointment(parseInt(aptId));        
        if (!apt) return;

        const store = dataService.getStore(apt.storeId);
            
        const modal = document.getElementById('modal-appointment');
        const title = document.getElementById('modal-title');
        const btnText = document.getElementById('btn-apt-text');
        const deleteBtn = document.getElementById('btn-delete-apt');
        const submitBtn = document.querySelector('#modal-appointment .btn-submit');
        const timeSelect = document.getElementById('apt-time');
        
        const loggedStoreId = dataService.currentStoreId;
        const canEdit = !loggedStoreId || apt.storeId === loggedStoreId;

        title.textContent = canEdit ? 'Detalhes do Agendamento' : 'Visualizar Agendamento';
        btnText.textContent = 'Salvar';
        
        // Show/hide edit controls based on permission
        if (canEdit) {
            deleteBtn.classList.remove('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
            submitBtn.classList.add('hidden');
        }
        
        // Disable form fields if can't edit
        const formFields = modal.querySelectorAll('input, select, textarea');
        formFields.forEach(field => {
            field.disabled = !canEdit;
        });

        // Populate time slots dropdown
        const timeSlots = dataService.getTimeSlots(apt.date);
        timeSelect.innerHTML = '';
        timeSlots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = slot;
            timeSelect.appendChild(option);
        });

        document.getElementById('apt-id').value = apt.id;
        document.getElementById('apt-name').value = apt.clientName;
        document.getElementById('apt-phone').value = apt.clientPhone;
        document.getElementById('apt-date').value = this.formatDateDisplay(apt.date);
        document.getElementById('apt-time').value = apt.time;
        document.getElementById('apt-store').value = apt.storeId;
        document.getElementById('apt-notes').value = apt.notes || '';

        modal.classList.remove('hidden');
    }

    // ==================
    // VIEW SWITCHING
    // ==================
    switchView(view) {
        this.currentView = view;

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(`view-${view}`).classList.add('active');

        // Refresh content based on view
        if (view === 'geral' || view === 'simplificado') {
            this.renderSchedule();
        }
    }

    // ==================
    // APPOINTMENT MODAL
    // ==================
    openAppointmentModal(aptId = null, storeId = null, time = null) {
        const modal = document.getElementById('modal-appointment');
        const title = document.getElementById('modal-title');
        const btnText = document.getElementById('btn-apt-text');
        const deleteBtn = document.getElementById('btn-delete-apt');
        const timeSelect = document.getElementById('apt-time');

        // Reset form
        document.getElementById('appointment-form').reset();

        // Populate time slots dropdown
        const dateStr = this.formatDateForDB(this.selectedDate);
        const timeSlots = dataService.getTimeSlots(dateStr);
        timeSelect.innerHTML = '';
        timeSlots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = slot;
            timeSelect.appendChild(option);
        });

        if (aptId) {
            // Edit mode
            const apt = dataService.getAppointment(aptId);
            if (!apt) return;

            title.textContent = 'Editar Agendamento';
            btnText.textContent = 'Salvar';
            deleteBtn.classList.remove('hidden');

            document.getElementById('apt-id').value = apt.id;
            document.getElementById('apt-name').value = apt.clientName;
            document.getElementById('apt-phone').value = apt.clientPhone;
            document.getElementById('apt-date').value = this.formatDateDisplay(apt.date);
            document.getElementById('apt-time').value = apt.time;
            document.getElementById('apt-store').value = apt.storeId;
            document.getElementById('apt-notes').value = apt.notes || '';
        } else {
            // Create mode
            title.textContent = 'Novo Agendamento';
            btnText.textContent = 'Agendar';
            deleteBtn.classList.add('hidden');

            document.getElementById('apt-id').value = '';
            document.getElementById('apt-date').value = this.formatDateDisplay(this.formatDateForDB(this.selectedDate));
            document.getElementById('apt-time').value = time || (timeSlots.length > 0 ? timeSlots[0] : '09:00');
            
            // Set store - use logged-in store or passed storeId
            const loggedStoreId = dataService.currentStoreId;
            const targetStoreId = storeId || loggedStoreId;
            
            if (targetStoreId) {
                document.getElementById('apt-store').value = targetStoreId;
            }
            
            // Disable store selector if logged in as store
            const storeSelect = document.getElementById('apt-store');
            if (loggedStoreId) {
                storeSelect.value = loggedStoreId;
                storeSelect.disabled = true;
            } else {
                storeSelect.disabled = false;
            }
            
            // Enable all other form fields
            const formFields = document.querySelectorAll('#modal-appointment input:not(#apt-store), #modal-appointment select:not(#apt-store), #modal-appointment textarea');
            formFields.forEach(field => {
                field.disabled = false;
            });
            
            // Show submit button
            document.querySelector('#modal-appointment .btn-submit').classList.remove('hidden');
        }

        modal.classList.remove('hidden');
    }

    handleAppointmentSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('apt-id').value;
        const loggedStoreId = dataService.currentStoreId;
        
        let storeId = parseInt(document.getElementById('apt-store').value);
        if (loggedStoreId && !id) {
            storeId = loggedStoreId;
        }
        
        const store = dataService.getStore(storeId);
        
        const aptData = {
            clientName: document.getElementById('apt-name').value.trim(),
            clientPhone: document.getElementById('apt-phone').value.replace(/\D/g, ''),
            date: this.parseDateDisplay(document.getElementById('apt-date').value),
            time: document.getElementById('apt-time').value,
            storeId: storeId,
            storeName: store ? store.name : 'Loja ' + storeId,
            notes: document.getElementById('apt-notes').value.trim(),
            companyId: 1
        };

        if (!aptData.clientName || !aptData.clientPhone) {
            this.showToast('Preencha nome e telefone', 'error');
            return;
        }
        
        // Verificar permissão
        if (id && loggedStoreId) {
            const existingApt = dataService.getAppointment(parseInt(id));
            if (existingApt && existingApt.storeId !== loggedStoreId) {
                this.showToast('Sem permissão', 'error');
                return;
            }
        }

        // LÓGICA SIMPLES: Salva local + planilha
        this.closeAllModals();
        
        if (id) {
            // EDITAR
            dataService.updateAppointment(parseInt(id), aptData);
            if (sheetsService?.isConnected) {
                sheetsService.update(parseInt(id), aptData);
            }
        } else {
            // CRIAR
            const result = dataService.addAppointment(aptData);
            if (result.success && sheetsService?.isConnected) {
                sheetsService.create({ ...aptData, id: result.appointment.id });
            }
        }
        
        this.renderSchedule();
        this.renderCalendar();
    }

    deleteAppointment() {
        const id = document.getElementById('apt-id').value;
        if (!id) return;
        
        const loggedStoreId = dataService.currentStoreId;
        
        // Verificar permissão
        if (loggedStoreId) {
            const apt = dataService.getAppointment(parseInt(id));
            if (apt && apt.storeId !== loggedStoreId) {
                this.showToast('Sem permissão', 'error');
                return;
            }
        }

        if (confirm('Excluir este agendamento?')) {
            // Deletar local
            dataService.deleteAppointment(parseInt(id));
            
            // Deletar da planilha
            if (sheetsService?.isConnected) {
                sheetsService.delete(parseInt(id));
            }
            
            this.closeAllModals();
            this.renderSchedule();
            this.renderCalendar();
        }
    }

    sendWhatsApp() {
        const phone = document.getElementById('apt-phone').value.replace(/\D/g, '');
        const name = document.getElementById('apt-name').value;
        const date = document.getElementById('apt-date').value;
        const time = document.getElementById('apt-time').value;

        if (!phone) {
            this.showToast('Digite o telefone primeiro', 'warning');
            return;
        }

        const message = encodeURIComponent(
            `Olá ${name}! Confirmando seu agendamento para o dia ${date} às ${time}. Por favor, confirme sua presença.`
        );

        window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
    }

    resetData() {
        if (confirm('Isso irá resetar todos os dados para o estado inicial de demonstração. Deseja continuar?')) {
            dataService.resetData();
            this.showToast('Dados resetados com sucesso!', 'success');
            this.refresh();
            this.loadStores();
        }
    }

    // ==================
    // UTILITIES
    // ==================
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    openCalendarModal() {
        // Update sheets service UI state before showing
        if (typeof sheetsService !== 'undefined' && sheetsService) {
            sheetsService.updateUI();
        }
        document.getElementById('modal-calendar').classList.remove('hidden');
    }

    showToast(message, type = 'info') {
        if (authManager && authManager.showToast) {
            authManager.showToast(message, type);
        }
    }

    formatDateForDB(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDateDisplay(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return `${day} / ${month}`;
    }

    parseDateDisplay(displayStr) {
        const [day, month] = displayStr.split('/').map(s => s.trim().padStart(2, '0'));
        const year = this.selectedDate.getFullYear();
        return `${year}-${month}-${day}`;
    }

    formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        } else if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    }
}

// Initialize app instance
const app = new App();
