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
            await gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            });
            this.gapiInited = true;
            this.checkConnection();
        } catch (error) {
            console.error('Error initializing GAPI client:', error);
        }
    }

    // Initialize Google Identity Services
    initializeGisClient() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response) => this.handleAuthResponse(response),
        });
        this.gisInited = true;
        this.checkConnection();
    }

    checkConnection() {
        if (this.gapiInited && this.gisInited) {
            // Check if we have a valid token
            const token = gapi.client.getToken();
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
        if (response.error) {
            console.error('Auth error:', response);
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Erro ao conectar com Google', 'error');
            }
            return;
        }
        
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
        try {
            const response = await gapi.client.calendar.calendarList.list();
            this.calendars = response.result.items || [];
            this.populateCalendarSelect();
        } catch (error) {
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
            option.textContent = cal.summary;
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
    }

    async selectCalendar(calendarId) {
        if (calendarId === '__create__') {
            // Create a new calendar for Agenda Ótica
            try {
                const response = await gapi.client.calendar.calendars.insert({
                    resource: {
                        summary: 'Agenda Ótica',
                        description: 'Calendário de agendamentos - Todas as Lojas',
                        timeZone: 'America/Sao_Paulo'
                    }
                });
                
                calendarId = response.result.id;
                this.calendars.push({
                    id: calendarId,
                    summary: 'Agenda Ótica'
                });
                
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('Calendário criado com sucesso!', 'success');
                }
            } catch (error) {
                console.error('Error creating calendar:', error);
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('Erro ao criar calendário', 'error');
                }
                return;
            }
        }

        this.selectedCalendarId = calendarId;
        this.saveSettings();
        this.populateCalendarSelect();
        
        // Carregar eventos do calendário selecionado
        await this.loadGoogleEvents();
        
        if (typeof app !== 'undefined') {
            app.renderSchedule();
            app.renderCalendar();
        }
    }

    // Carregar eventos do Google Calendar
    async loadGoogleEvents() {
        if (!this.isConnected || !this.selectedCalendarId) {
            this.googleEvents = [];
            return;
        }

        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

            const response = await gapi.client.calendar.events.list({
                calendarId: this.selectedCalendarId,
                timeMin: thirtyDaysAgo.toISOString(),
                timeMax: ninetyDaysLater.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 500
            });

            this.googleEvents = response.result.items || [];
            console.log('Google events loaded:', this.googleEvents.length);
            
            // Atualizar UI
            if (typeof app !== 'undefined' && app.initialized) {
                app.renderSchedule();
                app.renderCalendar();
            }
        } catch (error) {
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
        if (!this.isConnected || !this.selectedCalendarId) {
            return false;
        }

        const store = dataService.getStore(appointment.storeId);
        const storeName = store ? store.name : 'Ótica';
        const storeColor = store ? store.color : '#999999';

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

        // Check if event already exists
        if (appointment.googleEventId) {
            try {
                await gapi.client.calendar.events.update({
                    calendarId: this.selectedCalendarId,
                    eventId: appointment.googleEventId,
                    resource: event
                });
                return true;
            } catch (error) {
                // Event might have been deleted, create new one
                const response = await gapi.client.calendar.events.insert({
                    calendarId: this.selectedCalendarId,
                    resource: event
                });
                this.updateAppointmentGoogleId(appointment.id, response.result.id);
                return true;
            }
        } else {
            try {
                const response = await gapi.client.calendar.events.insert({
                    calendarId: this.selectedCalendarId,
                    resource: event
                });
                this.updateAppointmentGoogleId(appointment.id, response.result.id);
                return true;
            } catch (error) {
                console.error('Error creating Google event:', error);
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

        if (!disconnected || !connected) return;

        if (this.isConnected) {
            disconnected.classList.add('hidden');
            connected.classList.remove('hidden');
            if (emailEl && this.userEmail) {
                emailEl.textContent = this.userEmail;
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
    gapi.load('client', async () => {
        if (!calendarService) {
            calendarService = new CalendarService();
        }
        await calendarService.initializeGapiClient();
    });
}

function gisLoaded() {
    if (!calendarService) {
        calendarService = new CalendarService();
    }
    calendarService.initializeGisClient();
}
