/**
 * AGENDA ÓTICA - DATA MANAGEMENT SYSTEM
 * Sistema de gerenciamento de dados para SaaS
 */

// ============================================
// DATABASE CLASS - SIMULATES API/BACKEND
// ============================================
class Database {
    constructor() {
        this.storageKey = 'agenda_otica_db';
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.storageKey)) {
            this.seedData();
        } else {
            // Migration: add passwords to stores if missing
            this.migrateStorePasswords();
            // Migration: remove duplicate stores
            this.removeDuplicateStores();
        }
    }
    
    migrateStorePasswords() {
        const data = this.getData();
        let needsSave = false;
        
        if (data && data.stores) {
            data.stores.forEach(store => {
                if (!store.password) {
                    store.password = '1234'; // Default password
                    needsSave = true;
                }
            });
            
            if (needsSave) {
                this.saveData(data);
            }
        }
    }
    
    removeDuplicateStores() {
        const data = this.getData();
        if (data && data.stores) {
            // Keep only unique stores by companyId and id
            const seen = new Set();
            const uniqueStores = data.stores.filter(store => {
                const key = `${store.companyId}-${store.id}`;
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });
            
            if (uniqueStores.length !== data.stores.length) {
                data.stores = uniqueStores;
                this.saveData(data);
            }
        }
    }

    // Get all data
    getData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : null;
    }

    // Save all data
    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    // Seed initial data
    seedData() {
        const initialData = {
            users: [
                {
                    id: 1,
                    email: 'admin@otica.com',
                    password: '123456', // In production, use hashed passwords
                    name: 'Administrador',
                    role: 'admin',
                    companyId: 1
                }
            ],
            companies: [
                {
                    id: 1,
                    name: 'Ótica Vision',
                    phone: '(19) 99999-9999',
                    createdAt: new Date().toISOString()
                }
            ],
            stores: [
                { id: 1, companyId: 1, name: 'Loja 1', color: '#f44336', password: '1234', active: true },
                { id: 2, companyId: 1, name: 'Loja 2', color: '#4CAF50', password: '1234', active: true },
                { id: 3, companyId: 1, name: 'Loja 3', color: '#2196F3', password: '1234', active: true },
                { id: 4, companyId: 1, name: 'Loja 4', color: '#FF9800', password: '1234', active: true },
                { id: 5, companyId: 1, name: 'Loja 5', color: '#9C27B0', password: '1234', active: true }
            ],
            clients: [
                {
                    id: 1,
                    companyId: 1,
                    name: 'Cliente Silva',
                    phone: '19912345678',
                    email: 'cliente@email.com',
                    cpf: '123.456.789-00',
                    notes: '',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 2,
                    companyId: 1,
                    name: 'Maria Santos',
                    phone: '19987654321',
                    email: 'maria@email.com',
                    cpf: '987.654.321-00',
                    notes: 'Cliente VIP',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 3,
                    companyId: 1,
                    name: 'João Oliveira',
                    phone: '19955556666',
                    email: 'joao@email.com',
                    cpf: '555.666.777-88',
                    notes: '',
                    createdAt: new Date().toISOString()
                }
            ],
            appointments: [
                {
                    id: 1,
                    companyId: 1,
                    storeId: 1,
                    clientName: 'Cliente Silva',
                    clientPhone: '19912345678',
                    date: '2026-02-21',
                    time: '09:00',
                    notes: '',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 2,
                    companyId: 1,
                    storeId: 4,
                    clientName: 'Cliente Silva',
                    clientPhone: '19912345678',
                    date: '2026-02-21',
                    time: '09:30',
                    notes: '',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 3,
                    companyId: 1,
                    storeId: 5,
                    clientName: 'Cliente Silva',
                    clientPhone: '19912345678',
                    date: '2026-02-21',
                    time: '10:00',
                    notes: '',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 4,
                    companyId: 1,
                    storeId: 2,
                    clientName: 'Cliente Silva',
                    clientPhone: '19912345678',
                    date: '2026-02-21',
                    time: '10:30',
                    notes: '',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 5,
                    companyId: 1,
                    storeId: 3,
                    clientName: 'Cliente Silva',
                    clientPhone: '19912345678',
                    date: '2026-02-21',
                    time: '11:30',
                    notes: '',
                    createdAt: new Date().toISOString()
                }
            ],
            settings: {
                1: { // companyId
                    startTime: '08:00',
                    endTime: '18:00',
                    interval: 30 // minutes
                }
            }
        };

        this.saveData(initialData);
    }

    // Generate unique ID (usando timestamp para compatibilidade com Google Sheets)
    generateId(collection) {
        return new Date().getTime() + Math.floor(Math.random() * 1000);
    }
}

// ============================================
// DATA SERVICE CLASS
// ============================================
class DataService {
    constructor() {
        this.db = new Database();
        this.currentUser = null;
        this.currentCompanyId = 1; // Default company
        this.currentStoreId = null; // Logged-in store
    }

    // ==================
    // AUTH METHODS
    // ==================
    loginByStore(storeId, password) {
        const data = this.db.getData();
        const store = data.stores.find(s => s.id === storeId && s.password === password);
        
        if (store) {
            this.currentStoreId = store.id;
            this.currentCompanyId = store.companyId;
            this.currentUser = { name: store.name, storeId: store.id };
            sessionStorage.setItem('currentStore', JSON.stringify(store));
            return { success: true, store };
        }
        
        return { success: false, error: 'Senha incorreta' };
    }

    login(email, password) {
        const data = this.db.getData();
        const user = data.users.find(u => u.email === email && u.password === password);
        
        if (user) {
            this.currentUser = user;
            this.currentCompanyId = user.companyId;
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            return { success: true, user };
        }
        
        return { success: false, error: 'E-mail ou senha inválidos' };
    }

    register(companyName, userName, email, password) {
        const data = this.db.getData();
        
        // Check if email exists
        if (data.users.find(u => u.email === email)) {
            return { success: false, error: 'E-mail já cadastrado' };
        }

        // Create company
        const companyId = this.db.generateId('companies');
        const company = {
            id: companyId,
            name: companyName,
            phone: '',
            createdAt: new Date().toISOString()
        };
        data.companies.push(company);

        // Create user
        const userId = this.db.generateId('users');
        const user = {
            id: userId,
            email,
            password,
            name: userName,
            role: 'admin',
            companyId
        };
        data.users.push(user);

        // Create default stores
        for (let i = 1; i <= 3; i++) {
            data.stores.push({
                id: this.db.generateId('stores') + i - 1,
                companyId,
                name: `Loja ${i}`,
                color: ['#f44336', '#4CAF50', '#2196F3'][i - 1],
                active: true
            });
        }

        // Create default settings
        data.settings[companyId] = {
            startTime: '08:00',
            endTime: '18:00',
            interval: 30
        };

        this.db.saveData(data);

        this.currentUser = user;
        this.currentCompanyId = companyId;
        sessionStorage.setItem('currentUser', JSON.stringify(user));

        return { success: true, user };
    }

    logout() {
        this.currentUser = null;
        this.currentCompanyId = null;
        this.currentStoreId = null;
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentStore');
    }

    checkSession() {
        const savedStore = sessionStorage.getItem('currentStore');
        if (savedStore) {
            const store = JSON.parse(savedStore);
            this.currentStoreId = store.id;
            this.currentCompanyId = store.companyId;
            this.currentUser = { name: store.name, storeId: store.id };
            return true;
        }
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.currentCompanyId = this.currentUser.companyId;
            return true;
        }
        return false;
    }

    // ==================
    // STORES METHODS
    // ==================
    getStores() {
        const data = this.db.getData();
        return data.stores.filter(s => s.companyId === this.currentCompanyId && s.active);
    }

    getStore(id) {
        const data = this.db.getData();
        return data.stores.find(s => s.id === id && s.companyId === this.currentCompanyId);
    }

    addStore(name, color) {
        const data = this.db.getData();
        const store = {
            id: this.db.generateId('stores'),
            companyId: this.currentCompanyId,
            name,
            color,
            active: true
        };
        data.stores.push(store);
        this.db.saveData(data);
        return store;
    }

    updateStore(id, updates) {
        const data = this.db.getData();
        const index = data.stores.findIndex(s => s.id === id && s.companyId === this.currentCompanyId);
        if (index !== -1) {
            data.stores[index] = { ...data.stores[index], ...updates };
            this.db.saveData(data);
            return data.stores[index];
        }
        return null;
    }

    deleteStore(id) {
        const data = this.db.getData();
        const index = data.stores.findIndex(s => s.id === id && s.companyId === this.currentCompanyId);
        if (index !== -1) {
            data.stores[index].active = false;
            this.db.saveData(data);
            return true;
        }
        return false;
    }

    // ==================
    // CLIENTS METHODS
    // ==================
    getClients() {
        const data = this.db.getData();
        return data.clients.filter(c => c.companyId === this.currentCompanyId);
    }

    getClient(id) {
        const data = this.db.getData();
        return data.clients.find(c => c.id === id && c.companyId === this.currentCompanyId);
    }

    searchClients(query) {
        const clients = this.getClients();
        const lowerQuery = query.toLowerCase();
        return clients.filter(c => 
            c.name.toLowerCase().includes(lowerQuery) ||
            c.phone.includes(query) ||
            (c.email && c.email.toLowerCase().includes(lowerQuery))
        );
    }

    addClient(clientData) {
        const data = this.db.getData();
        const client = {
            id: this.db.generateId('clients'),
            companyId: this.currentCompanyId,
            ...clientData,
            createdAt: new Date().toISOString()
        };
        data.clients.push(client);
        this.db.saveData(data);
        return client;
    }

    updateClient(id, updates) {
        const data = this.db.getData();
        const index = data.clients.findIndex(c => c.id === id && c.companyId === this.currentCompanyId);
        if (index !== -1) {
            data.clients[index] = { ...data.clients[index], ...updates };
            this.db.saveData(data);
            return data.clients[index];
        }
        return null;
    }

    deleteClient(id) {
        const data = this.db.getData();
        const index = data.clients.findIndex(c => c.id === id && c.companyId === this.currentCompanyId);
        if (index !== -1) {
            data.clients.splice(index, 1);
            this.db.saveData(data);
            return true;
        }
        return false;
    }

    // ==================
    // APPOINTMENTS METHODS
    // ==================
    getAppointments(date = null, storeId = null) {
        const data = this.db.getData();
        let appointments = data.appointments.filter(a => a.companyId === this.currentCompanyId);
        
        if (date) {
            appointments = appointments.filter(a => a.date === date);
        }
        
        if (storeId) {
            appointments = appointments.filter(a => a.storeId === storeId);
        }
        
        return appointments;
    }

    getAppointment(id) {
        const data = this.db.getData();
        return data.appointments.find(a => a.id === id && a.companyId === this.currentCompanyId);
    }

    getAppointmentsByMonth(year, month) {
        const data = this.db.getData();
        const monthStr = String(month).padStart(2, '0');
        return data.appointments.filter(a => 
            a.companyId === this.currentCompanyId &&
            a.date.startsWith(`${year}-${monthStr}`)
        );
    }

    getDatesWithAppointments(year, month) {
        const appointments = this.getAppointmentsByMonth(year, month);
        const dates = [...new Set(appointments.map(a => a.date))];
        return dates.map(d => parseInt(d.split('-')[2]));
    }

    getFullDates(year, month) {
        const monthStr = String(month).padStart(2, '0');
        const daysInMonth = new Date(year, month, 0).getDate();
        const fullDates = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
            const timeSlots = this.getTimeSlots(dateStr);
            
            // Skip closed days (no slots)
            if (timeSlots.length === 0) continue;
            
            const appointments = this.getAppointments(dateStr);
            
            // Day is full if all slots have appointments
            if (appointments.length >= timeSlots.length) {
                fullDates.push(day);
            }
        }
        
        return fullDates;
    }

    addAppointment(appointmentData) {
        const data = this.db.getData();
        
        // Check for conflicts - only 1 appointment per time slot (regardless of store)
        const conflict = data.appointments.find(a =>
            a.companyId === this.currentCompanyId &&
            a.date === appointmentData.date &&
            a.time === appointmentData.time
        );
        
        if (conflict) {
            return { success: false, error: 'Já existe um agendamento neste horário' };
        }

        const appointment = {
            id: this.db.generateId('appointments'),
            companyId: this.currentCompanyId,
            ...appointmentData,
            createdAt: new Date().toISOString()
        };
        data.appointments.push(appointment);
        this.db.saveData(data);
        
        // Auto-create client if doesn't exist
        this.autoCreateClient(appointmentData.clientName, appointmentData.clientPhone);
        
        return { success: true, appointment };
    }

    autoCreateClient(name, phone) {
        const data = this.db.getData();
        const exists = data.clients.find(c => 
            c.companyId === this.currentCompanyId && c.phone === phone
        );
        
        if (!exists) {
            this.addClient({ name, phone, email: '', cpf: '', notes: '' });
        }
    }

    updateAppointment(id, updates) {
        const data = this.db.getData();
        const index = data.appointments.findIndex(a => a.id === id && a.companyId === this.currentCompanyId);
        
        if (index !== -1) {
            // Check for conflicts if changing date or time - only 1 appointment per time slot
            if (updates.date || updates.time) {
                const targetDate = updates.date || data.appointments[index].date;
                const targetTime = updates.time || data.appointments[index].time;
                
                const conflict = data.appointments.find(a =>
                    a.id !== id &&
                    a.companyId === this.currentCompanyId &&
                    a.date === targetDate &&
                    a.time === targetTime
                );
                
                if (conflict) {
                    return { success: false, error: 'Já existe um agendamento neste horário' };
                }
            }
            
            data.appointments[index] = { ...data.appointments[index], ...updates };
            this.db.saveData(data);
            return { success: true, appointment: data.appointments[index] };
        }
        return { success: false, error: 'Agendamento não encontrado' };
    }

    deleteAppointment(id) {
        const data = this.db.getData();
        const index = data.appointments.findIndex(a => a.id === id && a.companyId === this.currentCompanyId);
        if (index !== -1) {
            data.appointments.splice(index, 1);
            this.db.saveData(data);
            return true;
        }
        return false;
    }

    // ==================
    // SETTINGS METHODS
    // ==================
    getSettings() {
        const data = this.db.getData();
        return data.settings[this.currentCompanyId] || {
            startTime: '08:00',
            endTime: '18:00',
            interval: 30
        };
    }

    updateSettings(updates) {
        const data = this.db.getData();
        data.settings[this.currentCompanyId] = {
            ...data.settings[this.currentCompanyId],
            ...updates
        };
        this.db.saveData(data);
        return data.settings[this.currentCompanyId];
    }

    // ==================
    // COMPANY METHODS
    // ==================
    getCompany() {
        const data = this.db.getData();
        return data.companies.find(c => c.id === this.currentCompanyId);
    }

    updateCompany(updates) {
        const data = this.db.getData();
        const index = data.companies.findIndex(c => c.id === this.currentCompanyId);
        if (index !== -1) {
            data.companies[index] = { ...data.companies[index], ...updates };
            this.db.saveData(data);
            return data.companies[index];
        }
        return null;
    }

    // ==================
    // STATS METHODS
    // ==================
    getStats() {
        const data = this.db.getData();
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const today = now.toISOString().split('T')[0];

        const allAppointments = data.appointments.filter(a => a.companyId === this.currentCompanyId);
        const monthAppointments = allAppointments.filter(a => a.date.startsWith(currentMonth));
        const todayAppointments = allAppointments.filter(a => a.date === today);
        const clients = data.clients.filter(c => c.companyId === this.currentCompanyId);
        const stores = data.stores.filter(s => s.companyId === this.currentCompanyId && s.active);

        // Appointments by store
        const appointmentsByStore = {};
        stores.forEach(store => {
            appointmentsByStore[store.id] = {
                name: store.name,
                count: monthAppointments.filter(a => a.storeId === store.id).length
            };
        });

        return {
            totalAppointments: monthAppointments.length,
            todayAppointments: todayAppointments.length,
            totalClients: clients.length,
            totalStores: stores.length,
            appointmentsByStore
        };
    }

    // ==================
    // TIME SLOTS
    // ==================
    getTimeSlots(date = null) {
        const settings = this.getSettings();
        const interval = settings.interval;
        const slots = [];
        
        // Determine day of week (0=Sunday, 5=Friday, 6=Saturday)
        let dayOfWeek = null;
        if (date) {
            const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
            dayOfWeek = d.getDay();
        }
        
        // Define time ranges based on day
        let timeRanges = [];
        
        if (dayOfWeek === 6) {
            // Saturday: 9:00 - 12:30
            timeRanges = [{ start: '09:00', end: '12:30' }];
        } else if (dayOfWeek === 5) {
            // Friday: 14:00 - 18:00
            timeRanges = [{ start: '14:00', end: '18:00' }];
        } else if (dayOfWeek === 0) {
            // Sunday: closed
            timeRanges = [];
        } else {
            // Monday to Thursday: 9:00 - 12:30 and 14:00 - 18:00
            timeRanges = [
                { start: '09:00', end: '12:30' },
                { start: '14:00', end: '18:00' }
            ];
        }
        
        // Generate slots for each time range
        timeRanges.forEach(range => {
            const [startHour, startMin] = range.start.split(':').map(Number);
            const [endHour, endMin] = range.end.split(':').map(Number);
            
            let currentHour = startHour;
            let currentMin = startMin;
            
            while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
                slots.push(
                    `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
                );
                
                currentMin += interval;
                if (currentMin >= 60) {
                    currentHour += Math.floor(currentMin / 60);
                    currentMin = currentMin % 60;
                }
            }
        });
        
        return slots;
    }

    // ==================
    // RESET DATA (for testing)
    // ==================
    resetData() {
        this.db.seedData();
    }
}

// Export singleton instance
const dataService = new DataService();
