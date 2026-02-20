/**
 * AGENDA ÓTICA - GOOGLE CALENDAR INTEGRATION
 * Sincronização com Google Calendar
 */

// Google API Configuration
// IMPORTANT: Replace these with your own credentials from Google Cloud Console
const GOOGLE_CLIENT_ID = '207625189929-1r9lqkcsud6m5i1kt62ng967cg5b66eg.apps.googleusercontent.com';
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
        this.storeCalendarMap = {}; // storeId -> calendarId mapping
        
        this.loadSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('agenda_otica_calendar');
        if (saved) {
            const settings = JSON.parse(saved);
            this.storeCalendarMap = settings.storeCalendarMap || {};
            this.isConnected = settings.isConnected || false;
            this.userEmail = settings.userEmail || null;
        }
    }

    saveSettings() {
        localStorage.setItem('agenda_otica_calendar', JSON.stringify({
            storeCalendarMap: this.storeCalendarMap,
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

        const storeId = dataService.currentStoreId;
        const currentCalendarId = this.storeCalendarMap[storeId] || '';

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
        createOption.textContent = '+ Criar novo calendário para esta loja';
        select.appendChild(createOption);
    }

    async selectCalendar(calendarId) {
        const storeId = dataService.currentStoreId;
        if (!storeId) return;

        if (calendarId === '__create__') {
            // Create a new calendar for this store
            const store = dataService.getStore(storeId);
            const storeName = store ? store.name : `Loja ${storeId}`;
            
            try {
                const response = await gapi.client.calendar.calendars.insert({
                    resource: {
                        summary: `Agenda Ótica - ${storeName}`,
                        description: 'Calendário de agendamentos da ótica',
                        timeZone: 'America/Sao_Paulo'
                    }
                });
                
                calendarId = response.result.id;
                this.calendars.push({
                    id: calendarId,
                    summary: `Agenda Ótica - ${storeName}`
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

        this.storeCalendarMap[storeId] = calendarId;
        this.saveSettings();
        this.populateCalendarSelect();
    }

    // Sync appointments to Google Calendar
    async syncToGoogle() {
        const storeId = dataService.currentStoreId;
        if (!storeId || !this.isConnected) return;

        const calendarId = this.storeCalendarMap[storeId];
        if (!calendarId) {
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Selecione um calendário primeiro', 'error');
            }
            return;
        }

        try {
            // Get all appointments for this store
            const data = new Database().getData();
            const appointments = data.appointments.filter(a => a.storeId === storeId);

            let synced = 0;
            for (const apt of appointments) {
                await this.createOrUpdateEvent(calendarId, apt);
                synced++;
            }

            // Save last sync time
            const lastSyncKey = `lastSync_${storeId}`;
            localStorage.setItem(lastSyncKey, new Date().toISOString());
            this.updateLastSyncTime();

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

    // Sync from Google Calendar to local
    async syncFromGoogle() {
        const storeId = dataService.currentStoreId;
        if (!storeId || !this.isConnected) return;

        const calendarId = this.storeCalendarMap[storeId];
        if (!calendarId) return;

        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const response = await gapi.client.calendar.events.list({
                calendarId: calendarId,
                timeMin: thirtyDaysAgo.toISOString(),
                timeMax: thirtyDaysLater.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            const events = response.result.items || [];
            let imported = 0;

            for (const event of events) {
                // Check if this event has our metadata
                if (event.extendedProperties?.private?.agendaOticaId) {
                    // Already synced from our app
                    continue;
                }

                // Import event as new appointment
                const start = new Date(event.start.dateTime || event.start.date);
                const date = start.toISOString().split('T')[0];
                const time = start.toTimeString().slice(0, 5);

                // Check if appointment already exists at this time
                const existing = dataService.getAppointments(date).find(a => a.time === time);
                if (existing) continue;

                // Create appointment
                const aptData = {
                    clientName: event.summary || 'Cliente',
                    clientPhone: this.extractPhone(event.description) || '',
                    date: date,
                    time: time,
                    storeId: storeId,
                    notes: event.description || '',
                    googleEventId: event.id
                };

                dataService.addAppointment(aptData);
                imported++;
            }

            if (imported > 0 && typeof app !== 'undefined') {
                app.renderSchedule();
                app.renderCalendar();
            }

            return imported;
        } catch (error) {
            console.error('Error syncing from Google:', error);
            throw error;
        }
    }

    extractPhone(description) {
        if (!description) return '';
        const phoneMatch = description.match(/\d{10,11}/);
        return phoneMatch ? phoneMatch[0] : '';
    }

    async createOrUpdateEvent(calendarId, appointment) {
        const store = dataService.getStore(appointment.storeId);
        const storeName = store ? store.name : 'Ótica';

        const startDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000); // 30 min

        const event = {
            summary: `${appointment.clientName} - ${storeName}`,
            description: `Telefone: ${appointment.clientPhone}\n${appointment.notes || ''}`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Sao_Paulo'
            },
            extendedProperties: {
                private: {
                    agendaOticaId: String(appointment.id),
                    storeId: String(appointment.storeId)
                }
            }
        };

        // Check if event already exists
        if (appointment.googleEventId) {
            try {
                await gapi.client.calendar.events.update({
                    calendarId: calendarId,
                    eventId: appointment.googleEventId,
                    resource: event
                });
            } catch (error) {
                // Event might have been deleted, create new one
                const response = await gapi.client.calendar.events.insert({
                    calendarId: calendarId,
                    resource: event
                });
                this.updateAppointmentGoogleId(appointment.id, response.result.id);
            }
        } else {
            const response = await gapi.client.calendar.events.insert({
                calendarId: calendarId,
                resource: event
            });
            this.updateAppointmentGoogleId(appointment.id, response.result.id);
        }
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
        if (!appointment.googleEventId || !this.isConnected) return;

        const storeId = appointment.storeId;
        const calendarId = this.storeCalendarMap[storeId];
        if (!calendarId) return;

        try {
            await gapi.client.calendar.events.delete({
                calendarId: calendarId,
                eventId: appointment.googleEventId
            });
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
        const storeId = dataService.currentStoreId;
        const lastSyncEl = document.getElementById('last-sync');
        if (!lastSyncEl) return;

        const lastSyncKey = `lastSync_${storeId}`;
        const lastSync = localStorage.getItem(lastSyncKey);
        
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
