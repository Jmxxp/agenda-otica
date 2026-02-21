/**
 * AGENDA ÓTICA - GOOGLE CALENDAR INTEGRATION
 * Sincronização com Google Calendar
 * CONTA GLOBAL - Uma única conta para todas as lojas
 */

// Google API Configuration
const GOOGLE_CLIENT_ID = '207625189929-70scedcud0bomuge9hd21t45b08koubf.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyCYYKg8xzhp5COad5HKHjzrzojAzBek3tc';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

// DEBUG MODE - Mostra logs detalhados
const DEBUG_CALENDAR = true;

function debugLog(message, data = null) {
    if (!DEBUG_CALENDAR) return;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[📅 ${timestamp}] ${message}`, data || '');
    
    // Também salva no localStorage para ver depois
    const logs = JSON.parse(localStorage.getItem('calendar_debug_logs') || '[]');
    logs.push({ time: timestamp, message, data: data ? JSON.stringify(data) : null });
    if (logs.length > 100) logs.shift(); // Mantém apenas últimos 100 logs
    localStorage.setItem('calendar_debug_logs', JSON.stringify(logs));
}

class CalendarService {
    constructor() {
        this.tokenClient = null;
        this.gapiInited = false;
        this.gisInited = false;
        this.isConnected = false;
        this.userEmail = null;
        this.calendars = [];
        this.selectedCalendarId = null; // GLOBAL - um calendário para todas as lojas
        this.googleEvents = []; // Cache dos eventos do Google
        
        this.loadSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('agenda_otica_calendar_global');
        if (saved) {
            const settings = JSON.parse(saved);
            this.selectedCalendarId = settings.selectedCalendarId || null;
            this.isConnected = settings.isConnected || false;
            this.userEmail = settings.userEmail || null;
        }
    }

    saveSettings() {
        localStorage.setItem('agenda_otica_calendar_global', JSON.stringify({
            selectedCalendarId: this.selectedCalendarId,
            isConnected: this.isConnected,
            userEmail: this.userEmail
        }));
    }

    // Initialize Google API client
    async initializeGapiClient() {
        try {
            debugLog('Inicializando Google API client...');
            await gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            });
            this.gapiInited = true;
            debugLog('✅ Google API client inicializado!');
            this.checkConnection();
        } catch (error) {
            debugLog('❌ ERRO ao inicializar GAPI:', error);
            console.error('Error initializing GAPI client:', error);
        }
    }

    // Initialize Google Identity Services
    initializeGisClient() {
        debugLog('Inicializando Google Identity Services...');
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response) => this.handleAuthResponse(response),
        });
        this.gisInited = true;
        debugLog('✅ Google Identity Services inicializado!');
        this.checkConnection();
    }

    checkConnection() {
        debugLog('Verificando conexão...', { gapiInited: this.gapiInited, gisInited: this.gisInited });
        if (this.gapiInited && this.gisInited) {
            // Check if we have a valid token
            const token = gapi.client.getToken();
            debugLog('Token atual:', token ? 'EXISTS' : 'NULL');
            if (token) {
                this.isConnected = true;
                this.updateUI();
                this.loadCalendars();
                // Carregar eventos automaticamente ao conectar
                this.loadGoogleEvents();
            } else if (this.isConnected) {
                // Try to restore connection
                this.connect(true);
            }
        }
    }

    handleAuthResponse(response) {
        debugLog('handleAuthResponse chamado', response);
        if (response.error) {
            debugLog('❌ ERRO de autenticação:', response);
            console.error('Auth error:', response);
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Erro ao conectar com Google: ' + response.error, 'error');
            }
            return;
        }
        
        debugLog('✅ Autenticação bem sucedida!');
        this.isConnected = true;
        this.getUserInfo();
        this.loadCalendars();
        this.loadGoogleEvents(); // Carregar eventos ao conectar
        this.updateUI();
        this.saveSettings();
        
        if (typeof authManager !== 'undefined') {
            authManager.showToast('Conectado ao Google Calendar!', 'success');
        }
    }

    async getUserInfo() {
        try {
            const response = await gapi.client.request({
                path: 'https://www.googleapis.com/oauth2/v2/userinfo'
            });
            this.userEmail = response.result.email;
            this.saveSettings();
            this.updateUI();
        } catch (error) {
            console.error('Error getting user info:', error);
        }
    }

    connect(silent = false) {
        if (!this.tokenClient) {
            console.error('Token client not initialized');
            return;
        }

        if (silent) {
            this.tokenClient.requestAccessToken({ prompt: '' });
        } else {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    }

    disconnect() {
        const token = gapi.client.getToken();
        if (token) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken(null);
        }
        
        this.isConnected = false;
        this.userEmail = null;
        this.calendars = [];
        this.saveSettings();
        this.updateUI();
        
        if (typeof authManager !== 'undefined') {
            authManager.showToast('Desconectado do Google Calendar', 'info');
        }
    }

    async loadCalendars() {
        debugLog('Carregando lista de calendários...');
        try {
            const response = await gapi.client.calendar.calendarList.list();
            this.calendars = response.result.items || [];
            debugLog('✅ Calendários carregados:', this.calendars.map(c => c.summary));
            this.populateCalendarSelect();
        } catch (error) {
            debugLog('❌ ERRO ao carregar calendários:', error);
            console.error('Error loading calendars:', error);
        }
    }

    populateCalendarSelect() {
        const select = document.getElementById('calendar-select');
        if (!select) return;

        // Usar calendário global (não por loja)
        const currentCalendarId = this.selectedCalendarId || '';

        select.innerHTML = '<option value="">-- Selecione um calendário --</option>';
        
        this.calendars.forEach(cal => {
            const option = document.createElement('option');
            option.value = cal.id;
            // Mostrar se é primário para facilitar identificação
            const isPrimary = cal.primary ? ' ⭐ (Principal)' : '';
            const accessRole = cal.accessRole === 'owner' ? '' : ` [${cal.accessRole}]`;
            option.textContent = cal.summary + isPrimary + accessRole;
            if (cal.id === currentCalendarId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Add "Create new calendar" option
        const createOption = document.createElement('option');
        createOption.value = '__create__';
        createOption.textContent = '+ Criar novo calendário "Agenda Ótica"';
        select.appendChild(createOption);
        
        // Mostrar nome do calendário selecionado na área de info
        this.updateSelectedCalendarInfo();
    }
    
    updateSelectedCalendarInfo() {
        // Mostrar info do calendário selecionado abaixo do select
        let infoEl = document.getElementById('selected-calendar-info');
        if (!infoEl) {
            const select = document.getElementById('calendar-select');
            if (select) {
                infoEl = document.createElement('div');
                infoEl.id = 'selected-calendar-info';
                infoEl.style.cssText = 'font-size: 0.8rem; margin-top: 5px; padding: 5px; background: #1a1f3d; border-radius: 4px;';
                select.parentElement.appendChild(infoEl);
            }
        }
        
        if (infoEl && this.selectedCalendarId) {
            const cal = this.calendars.find(c => c.id === this.selectedCalendarId);
            if (cal) {
                infoEl.innerHTML = `<i class="fas fa-calendar-check" style="color: #4CAF50;"></i> <strong>${cal.summary}</strong>`;
            }
        } else if (infoEl) {
            infoEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #ff9800;"></i> <em>Nenhum calendário selecionado</em>';
        }
    }

    async selectCalendar(calendarId) {
        debugLog('selectCalendar chamado:', calendarId);
        if (calendarId === '__create__') {
            // Create a new calendar for Agenda Ótica
            debugLog('Criando novo calendário...');
            try {
                const response = await gapi.client.calendar.calendars.insert({
                    resource: {
                        summary: 'Agenda Ótica',
                        description: 'Calendário de agendamentos - Todas as Lojas',
                        timeZone: 'America/Sao_Paulo'
                    }
                });
                
                calendarId = response.result.id;
                debugLog('✅ Calendário criado:', calendarId);
                this.calendars.push({
                    id: calendarId,
                    summary: 'Agenda Ótica'
                });
                
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('Calendário criado com sucesso!', 'success');
                }
            } catch (error) {
                debugLog('❌ ERRO ao criar calendário:', error);
                console.error('Error creating calendar:', error);
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('Erro ao criar calendário: ' + (error.result?.error?.message || error), 'error');
                }
                return;
            }
        }

        this.selectedCalendarId = calendarId;
        debugLog('Calendário selecionado:', calendarId);
        this.saveSettings();
        this.populateCalendarSelect();
        this.updateUI(); // Atualizar UI para esconder aviso
        
        // Carregar eventos do calendário selecionado
        await this.loadGoogleEvents();
        
        if (typeof app !== 'undefined') {
            app.renderSchedule();
            app.renderCalendar();
        }
    }

    // Carregar eventos do Google Calendar
    async loadGoogleEvents() {
        debugLog('loadGoogleEvents chamado', { isConnected: this.isConnected, calendarId: this.selectedCalendarId });
        if (!this.isConnected || !this.selectedCalendarId) {
            debugLog('⚠️ Não conectado ou calendário não selecionado');
            this.googleEvents = [];
            return;
        }

        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

            debugLog('Buscando eventos do Calendar...', { calendarId: this.selectedCalendarId });
            const response = await gapi.client.calendar.events.list({
                calendarId: this.selectedCalendarId,
                timeMin: thirtyDaysAgo.toISOString(),
                timeMax: ninetyDaysLater.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 500
            });

            this.googleEvents = response.result.items || [];
            debugLog('✅ Eventos carregados do Calendar:', this.googleEvents.length);
            
            // Log dos eventos da Agenda Ótica
            const agendaEvents = this.googleEvents.filter(e => e.extendedProperties?.private?.agendaOtica === 'true');
            debugLog('Eventos da Agenda Ótica:', agendaEvents.length);
            
            // Atualizar UI
            if (typeof app !== 'undefined' && app.initialized) {
                app.renderSchedule();
                app.renderCalendar();
            }
        } catch (error) {
            debugLog('❌ ERRO ao carregar eventos:', error);
            console.error('Error loading Google events:', error);
            this.googleEvents = [];
        }
    }

    // Verificar se um horário está ocupado no Google Calendar
    isTimeSlotBusy(dateStr, time) {
        if (!this.googleEvents.length) return false;
        
        const slotStart = new Date(`${dateStr}T${time}:00`);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
        
        return this.googleEvents.some(event => {
            // Ignorar eventos criados pela nossa app (esses são mostrados como agendamentos)
            if (event.extendedProperties?.private?.agendaOtica === 'true') {
                return false;
            }
            
            const eventStart = new Date(event.start.dateTime || event.start.date);
            const eventEnd = new Date(event.end.dateTime || event.end.date);
            
            // Verificar sobreposição
            return (slotStart < eventEnd && slotEnd > eventStart);
        });
    }

    // Retorna eventos do Google Calendar para uma data
    getGoogleEventsForDate(dateStr) {
        return this.googleEvents.filter(event => {
            const eventDate = event.start.dateTime || event.start.date;
            return eventDate.startsWith(dateStr);
        });
    }

    // NOVO: Converter eventos do Google Calendar em agendamentos
    // Isso permite que qualquer dispositivo veja os mesmos dados
    getAppointmentsFromCalendar(dateStr = null) {
        const appointments = [];
        
        for (const event of this.googleEvents) {
            // Só processar eventos da Agenda Ótica
            const props = event.extendedProperties?.private;
            if (!props || props.agendaOtica !== 'true') continue;
            
            const eventDate = (event.start.dateTime || event.start.date).split('T')[0];
            
            // Filtrar por data se especificada
            if (dateStr && eventDate !== dateStr) continue;
            
            const startTime = new Date(event.start.dateTime || event.start.date);
            const time = startTime.toTimeString().slice(0, 5);
            
            appointments.push({
                id: event.id, // Usar googleEventId como ID
                googleEventId: event.id,
                clientName: props.clientName || event.summary?.split(' - ')[0] || 'Cliente',
                clientPhone: props.clientPhone || '',
                date: eventDate,
                time: time,
                storeId: parseInt(props.storeId) || 1,
                storeName: props.storeName || 'Loja',
                storeColor: props.storeColor || '#999999',
                notes: props.notes || '',
                fromCalendar: true // Marca que veio do Calendar
            });
        }
        
        return appointments;
    }

    // Mapear cor da loja para colorId do Google Calendar
    getGoogleColorId(hexColor) {
        // Google Calendar colors: 1-11
        // Mapeamento aproximado
        const colorMap = {
            '#f44336': '11', // Vermelho
            '#e91e63': '4',  // Rosa
            '#9c27b0': '3',  // Roxo
            '#673ab7': '9',  // Roxo escuro
            '#3f51b5': '9',  // Indigo
            '#2196F3': '1',  // Azul
            '#03a9f4': '7',  // Azul claro
            '#00bcd4': '7',  // Cyan
            '#009688': '2',  // Teal
            '#4CAF50': '10', // Verde
            '#8bc34a': '2',  // Verde claro
            '#cddc39': '5',  // Lime
            '#ffeb3b': '5',  // Amarelo
            '#ffc107': '5',  // Amber
            '#ff9800': '6',  // Laranja
            '#ff5722': '6',  // Laranja escuro
        };
        
        // Encontrar a cor mais próxima
        const lowerColor = hexColor?.toLowerCase();
        return colorMap[lowerColor] || '1';
    }

    // Sync appointments to Google Calendar (ALL stores)
    async syncToGoogle() {
        if (!this.isConnected) {
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Conecte ao Google Calendar primeiro', 'error');
            }
            return;
        }

        if (!this.selectedCalendarId) {
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Selecione um calendário primeiro', 'error');
            }
            return;
        }

        try {
            // Get ALL appointments (todas as lojas)
            const data = new Database().getData();
            const appointments = data.appointments;

            let synced = 0;
            for (const apt of appointments) {
                await this.createOrUpdateEvent(apt);
                synced++;
            }

            // Save last sync time
            localStorage.setItem('lastSync_global', new Date().toISOString());
            this.updateLastSyncTime();

            // Recarregar eventos do Google
            await this.loadGoogleEvents();

            if (typeof authManager !== 'undefined') {
                authManager.showToast(`${synced} agendamentos sincronizados!`, 'success');
            }
        } catch (error) {
            console.error('Error syncing to Google:', error);
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Erro ao sincronizar', 'error');
            }
        }
    }

    // Sync from Google Calendar to local (importar eventos externos)
    async syncFromGoogle() {
        if (!this.isConnected || !this.selectedCalendarId) {
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Selecione um calendário primeiro', 'error');
            }
            return 0;
        }

        try {
            await this.loadGoogleEvents();
            
            // Apenas recarrega a interface - agendamentos são carregados do Calendar
            if (typeof app !== 'undefined') {
                app.renderSchedule();
                app.renderCalendar();
            }

            // Retorna quantidade de eventos externos (não da Agenda Ótica)
            return this.googleEvents.filter(e => e.extendedProperties?.private?.agendaOtica !== 'true').length;
        } catch (error) {
            console.error('Error syncing from Google:', error);
            throw error;
        }
    }

    // Criar ou atualizar evento no Google Calendar
    // SALVA TODOS OS DADOS NO EVENTO para sincronização entre dispositivos
    async createOrUpdateEvent(appointment) {
        debugLog('createOrUpdateEvent chamado', appointment);
        
        if (!this.isConnected || !this.selectedCalendarId) {
            debugLog('⚠️ Não pode criar evento: não conectado ou calendário não selecionado', { 
                isConnected: this.isConnected, 
                calendarId: this.selectedCalendarId 
            });
            if (typeof authManager !== 'undefined') {
                authManager.showToast('❌ Calendário não configurado! Vá em Configurações e selecione um calendário.', 'error');
            }
            return false;
        }

        const store = dataService.getStore(appointment.storeId);
        const storeName = store ? store.name : 'Ótica';
        const storeColor = store ? store.color : '#999999';
        
        // Log para debug - mostra exatamente onde o evento será criado
        const calendarName = this.calendars.find(c => c.id === this.selectedCalendarId)?.summary || this.selectedCalendarId;
        debugLog(`📅 Criando evento no calendário "${calendarName}" para ${appointment.date} às ${appointment.time}`);
        console.log(`📅 GOOGLE CALENDAR: Criando evento no calendário "${calendarName}" para ${appointment.date} às ${appointment.time}`);
        
        debugLog('Store encontrada:', { storeId: appointment.storeId, storeName, storeColor });

        const startDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000); // 30 min

        // TODOS os dados são salvos no evento para sincronização completa
        const event = {
            summary: `${appointment.clientName} - ${storeName}`,
            description: `📞 ${appointment.clientPhone}\n🏪 ${storeName}\n${appointment.notes ? '📝 ' + appointment.notes : ''}`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Sao_Paulo'
            },
            colorId: this.getGoogleColorId(storeColor),
            extendedProperties: {
                private: {
                    // DADOS COMPLETOS para sincronização
                    agendaOtica: 'true',
                    clientName: appointment.clientName,
                    clientPhone: appointment.clientPhone,
                    storeId: String(appointment.storeId),
                    storeName: storeName,
                    storeColor: storeColor,
                    notes: appointment.notes || '',
                    localId: String(appointment.id || 0)
                }
            }
        };
        
        debugLog('Evento a ser criado/atualizado:', event);

        // Check if event already exists
        if (appointment.googleEventId) {
            debugLog('Atualizando evento existente:', appointment.googleEventId);
            try {
                const updateResponse = await gapi.client.calendar.events.update({
                    calendarId: this.selectedCalendarId,
                    eventId: appointment.googleEventId,
                    resource: event
                });
                debugLog('✅ Evento atualizado com sucesso!', updateResponse.result.id);
                return true;
            } catch (error) {
                debugLog('⚠️ Erro ao atualizar, tentando criar novo...', error);
                // Event might have been deleted, create new one
                try {
                    const response = await gapi.client.calendar.events.insert({
                        calendarId: this.selectedCalendarId,
                        resource: event
                    });
                    debugLog('✅ Novo evento criado:', response.result.id);
                    this.updateAppointmentGoogleId(appointment.id, response.result.id);
                    return true;
                } catch (insertError) {
                    debugLog('❌ ERRO ao criar evento:', insertError);
                    return false;
                }
            }
        } else {
            debugLog('Criando novo evento...');
            try {
                const response = await gapi.client.calendar.events.insert({
                    calendarId: this.selectedCalendarId,
                    resource: event
                });
                const calendarName = this.calendars.find(c => c.id === this.selectedCalendarId)?.summary || 'Calendar';
                debugLog('✅ Evento criado com sucesso!', response.result.id);
                console.log(`✅ SUCESSO: Evento criado no Google Calendar "${calendarName}" - ID: ${response.result.id}`);
                console.log(`   📍 Verifique em: https://calendar.google.com`);
                this.updateAppointmentGoogleId(appointment.id, response.result.id);
                return true;
            } catch (error) {
                debugLog('❌ ERRO ao criar evento:', error);
                console.error('❌ ERRO ao criar evento no Google Calendar:', error);
                const errorMsg = error.result?.error?.message || error.message || String(error);
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('❌ Erro ao salvar no Calendar: ' + errorMsg, 'error');
                }
                return false;
            }
        }
    }

    // Sincronizar UM único agendamento (chamado ao criar/editar)
    async syncSingleAppointment(appointment) {
        if (!this.isConnected || !this.selectedCalendarId) {
            return false;
        }
        
        const result = await this.createOrUpdateEvent(appointment);
        if (result) {
            // Recarregar eventos para atualizar cache
            await this.loadGoogleEvents();
        }
        return result;
    }

    updateAppointmentGoogleId(aptId, googleEventId) {
        const data = new Database().getData();
        const apt = data.appointments.find(a => a.id === aptId);
        if (apt) {
            apt.googleEventId = googleEventId;
            new Database().saveData(data);
        }
    }

    async deleteEvent(appointment) {
        if (!appointment.googleEventId || !this.isConnected || !this.selectedCalendarId) return;

        try {
            await gapi.client.calendar.events.delete({
                calendarId: this.selectedCalendarId,
                eventId: appointment.googleEventId
            });
            // Recarregar eventos
            await this.loadGoogleEvents();
        } catch (error) {
            console.error('Error deleting event from Google:', error);
        }
    }

    updateUI() {
        const disconnected = document.getElementById('status-disconnected');
        const connected = document.getElementById('status-connected');
        const emailEl = document.getElementById('connected-email');
        const calendarSelect = document.getElementById('calendar-select');

        if (!disconnected || !connected) return;

        if (this.isConnected) {
            disconnected.classList.add('hidden');
            connected.classList.remove('hidden');
            if (emailEl && this.userEmail) {
                emailEl.textContent = this.userEmail;
            }
            
            // Mostrar aviso se calendário não selecionado
            let warningEl = document.getElementById('calendar-warning');
            if (!this.selectedCalendarId) {
                if (!warningEl) {
                    warningEl = document.createElement('div');
                    warningEl.id = 'calendar-warning';
                    warningEl.style.cssText = 'background: #ff980020; border: 1px solid #ff9800; border-radius: 8px; padding: 10px; margin: 10px 0; text-align: center;';
                    warningEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #ff9800;"></i> <strong style="color: #ff9800;">Selecione um calendário acima para sincronizar!</strong>';
                    calendarSelect?.parentElement?.after(warningEl);
                }
                warningEl.classList.remove('hidden');
            } else if (warningEl) {
                warningEl.classList.add('hidden');
            }
        } else {
            disconnected.classList.remove('hidden');
            connected.classList.add('hidden');
        }

        this.updateLastSyncTime();
    }

    updateLastSyncTime() {
        const lastSyncEl = document.getElementById('last-sync');
        if (!lastSyncEl) return;

        const lastSync = localStorage.getItem('lastSync_global');
        
        if (lastSync) {
            const date = new Date(lastSync);
            lastSyncEl.textContent = date.toLocaleString('pt-BR');
        } else {
            lastSyncEl.textContent = 'Nunca';
        }
    }

    // Full sync (both directions)
    async fullSync() {
        if (!this.isConnected) return;

        try {
            // First sync from Google to get any new events
            const imported = await this.syncFromGoogle();
            
            // Then sync local appointments to Google
            await this.syncToGoogle();

            if (typeof authManager !== 'undefined') {
                authManager.showToast('Sincronização completa!', 'success');
            }
        } catch (error) {
            console.error('Error in full sync:', error);
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Erro na sincronização', 'error');
            }
        }
    }
}

// Global instance
let calendarService;

// Callbacks for Google API loading
function gapiLoaded() {
    debugLog('gapiLoaded callback chamado');
    gapi.load('client', async () => {
        if (!calendarService) {
            calendarService = new CalendarService();
        }
        await calendarService.initializeGapiClient();
    });
}

function gisLoaded() {
    debugLog('gisLoaded callback chamado');
    if (!calendarService) {
        calendarService = new CalendarService();
    }
    calendarService.initializeGisClient();
}

// =============================================
// FUNÇÕES DE DEBUG - Use no console do navegador
// =============================================

// Ver todos os logs
window.verLogs = function() {
    const logs = JSON.parse(localStorage.getItem('calendar_debug_logs') || '[]');
    console.table(logs);
    return logs;
};

// Ver status da conexão
window.verStatus = function() {
    if (!calendarService) {
        console.log('❌ CalendarService não inicializado');
        return;
    }
    console.log('📊 STATUS DO CALENDAR SERVICE:');
    console.log('   Conectado:', calendarService.isConnected);
    console.log('   Email:', calendarService.userEmail);
    console.log('   Calendário:', calendarService.selectedCalendarId);
    console.log('   Eventos carregados:', calendarService.googleEvents?.length || 0);
    console.log('   GAPI init:', calendarService.gapiInited);
    console.log('   GIS init:', calendarService.gisInited);
    return {
        isConnected: calendarService.isConnected,
        userEmail: calendarService.userEmail,
        selectedCalendarId: calendarService.selectedCalendarId,
        eventsCount: calendarService.googleEvents?.length || 0
    };
};

// Ver eventos carregados
window.verEventos = function() {
    if (!calendarService) {
        console.log('❌ CalendarService não inicializado');
        return;
    }
    console.log('📅 EVENTOS DO CALENDAR:');
    console.log('Total:', calendarService.googleEvents?.length || 0);
    
    const eventos = calendarService.googleEvents?.map(e => ({
        id: e.id,
        titulo: e.summary,
        inicio: e.start?.dateTime || e.start?.date,
        agendaOtica: e.extendedProperties?.private?.agendaOtica || 'false',
        cliente: e.extendedProperties?.private?.clientName || '-'
    }));
    console.table(eventos);
    return eventos;
};

// Limpar logs
window.limparLogs = function() {
    localStorage.removeItem('calendar_debug_logs');
    console.log('✅ Logs limpos!');
};

// Testar criação de evento
window.testarEvento = async function() {
    if (!calendarService || !calendarService.isConnected) {
        console.log('❌ Não conectado ao Calendar');
        return;
    }
    
    console.log('🧪 Testando criação de evento...');
    const testEvent = {
        id: 999999,
        clientName: 'TESTE DEBUG',
        clientPhone: '19999999999',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        storeId: 1,
        notes: 'Evento de teste - pode deletar'
    };
    
    const result = await calendarService.createOrUpdateEvent(testEvent);
    console.log('Resultado:', result ? '✅ SUCESSO' : '❌ FALHA');
    return result;
};

console.log('📅 DEBUG CALENDAR ATIVO - Comandos disponíveis:');
console.log('   verStatus()  - Ver status da conexão');
console.log('   verLogs()    - Ver todos os logs');
console.log('   verEventos() - Ver eventos carregados');
console.log('   testarEvento() - Criar evento de teste');
console.log('   limparLogs() - Limpar logs');
