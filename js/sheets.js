/**
 * AGENDA ÓTICA - GOOGLE SHEETS INTEGRATION
 * Sincronização simples com Google Sheets
 * 
 * SETUP (5 minutos):
 * 1. Crie uma planilha no Google Sheets
 * 2. Vá em Extensões > Apps Script
 * 3. Cole o código do arquivo SHEETS_SCRIPT.txt
 * 4. Clique em Implantar > Nova implantação
 * 5. Tipo: App da Web, Acesso: Qualquer pessoa
 * 6. Copie a URL e cole nas configurações do sistema
 */

class SheetsService {
    constructor() {
        this.scriptUrl = null;
        this.isConnected = false;
        this.lastSync = null;
        this.loadSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('agenda_otica_sheets');
        if (saved) {
            const settings = JSON.parse(saved);
            this.scriptUrl = settings.scriptUrl || null;
            this.isConnected = !!this.scriptUrl;
            this.lastSync = settings.lastSync || null;
        }
    }

    saveSettings() {
        localStorage.setItem('agenda_otica_sheets', JSON.stringify({
            scriptUrl: this.scriptUrl,
            lastSync: this.lastSync
        }));
    }

    // Configurar URL do Apps Script
    async configure(url) {
        if (!url || !url.includes('script.google.com')) {
            return { success: false, error: 'URL inválida. Use a URL do Apps Script.' };
        }

        this.scriptUrl = url;
        
        // Testar conexão
        try {
            const response = await this.testConnection();
            if (response.success) {
                this.isConnected = true;
                this.saveSettings();
                // Iniciar auto-sync ao conectar
                this.startAutoSync(30);
                return { success: true };
            } else {
                this.scriptUrl = null;
                return { success: false, error: response.error || 'Erro ao conectar' };
            }
        } catch (error) {
            this.scriptUrl = null;
            return { success: false, error: 'Erro de conexão: ' + error.message };
        }
    }

    // Testar conexão com a planilha
    async testConnection() {
        if (!this.scriptUrl) {
            return { success: false, error: 'URL não configurada' };
        }

        try {
            // Apps Script redireciona, precisamos seguir
            const response = await fetch(this.scriptUrl + '?action=test', {
                method: 'GET',
                redirect: 'follow'
            });
            const text = await response.text();
            console.log('Resposta do teste:', text);
            const data = JSON.parse(text);
            return data;
        } catch (error) {
            console.error('Erro ao testar conexão:', error);
            return { success: false, error: error.message };
        }
    }

    // Desconectar
    disconnect() {
        this.scriptUrl = null;
        this.isConnected = false;
        this.lastSync = null;
        this.stopAutoSync();
        localStorage.removeItem('agenda_otica_sheets');
        this.updateUI();
        
        if (typeof authManager !== 'undefined') {
            authManager.showToast('Desconectado da planilha', 'info');
        }
    }

    // ==================
    // CRUD OPERATIONS
    // ==================

    // Buscar todos os agendamentos
    async getAppointments() {
        if (!this.isConnected) return [];

        try {
            const response = await fetch(this.scriptUrl + '?action=list', {
                method: 'GET',
                redirect: 'follow'
            });
            const text = await response.text();
            const data = JSON.parse(text);
            
            if (data.success) {
                this.lastSync = new Date().toISOString();
                this.saveSettings();
                return data.appointments || [];
            }
            return [];
        } catch (error) {
            console.error('Erro ao buscar agendamentos:', error);
            return [];
        }
    }

    // Criar agendamento
    async createAppointment(appointment) {
        if (!this.isConnected) {
            return { success: false, error: 'Não conectado à planilha' };
        }

        try {
            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'create',
                    appointment: appointment
                })
            });
            const text = await response.text();
            const data = JSON.parse(text);
            
            if (data.success) {
                this.lastSync = new Date().toISOString();
                this.saveSettings();
                
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('✅ Salvo na planilha!', 'success');
                }
            }
            return data;
        } catch (error) {
            console.error('Erro ao criar agendamento:', error);
            if (typeof authManager !== 'undefined') {
                authManager.showToast('❌ Erro ao salvar na planilha', 'error');
            }
            return { success: false, error: error.message };
        }
    }

    // Atualizar agendamento
    async updateAppointment(id, appointment) {
        if (!this.isConnected) {
            return { success: false, error: 'Não conectado à planilha' };
        }

        try {
            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'update',
                    id: id,
                    appointment: appointment
                })
            });
            const text = await response.text();
            const data = JSON.parse(text);
            
            if (data.success) {
                this.lastSync = new Date().toISOString();
                this.saveSettings();
            }
            return data;
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            return { success: false, error: error.message };
        }
    }

    // Deletar agendamento
    async deleteAppointment(id) {
        if (!this.isConnected) {
            return { success: false, error: 'Não conectado à planilha' };
        }

        try {
            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'delete',
                    id: id
                })
            });
            const text = await response.text();
            const data = JSON.parse(text);
            
            if (data.success) {
                this.lastSync = new Date().toISOString();
                this.saveSettings();
            }
            return data;
        } catch (error) {
            console.error('Erro ao deletar:', error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar todos os dados locais para a planilha
    async syncAllToSheets() {
        if (!this.isConnected) {
            if (typeof authManager !== 'undefined') {
                authManager.showToast('Configure a planilha primeiro', 'error');
            }
            return;
        }

        try {
            const data = new Database().getData();
            const appointments = data.appointments || [];

            if (typeof authManager !== 'undefined') {
                authManager.showToast('Sincronizando ' + appointments.length + ' agendamentos...', 'info');
            }

            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'syncAll',
                    appointments: appointments
                })
            });
            const text = await response.text();
            const result = JSON.parse(text);

            if (result.success) {
                this.lastSync = new Date().toISOString();
                this.saveSettings();
                this.updateUI();
                
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('✅ ' + appointments.length + ' agendamentos sincronizados!', 'success');
                }
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('Erro ao sincronizar:', error);
            if (typeof authManager !== 'undefined') {
                authManager.showToast('❌ Erro: ' + error.message, 'error');
            }
        }
    }

    // Importar da planilha para o local
    async syncFromSheets() {
        if (!this.isConnected) return;

        try {
            const appointments = await this.getAppointments();
            
            if (appointments.length > 0) {
                // Atualizar dados locais
                const db = new Database();
                const data = db.getData();
                
                // Mesclar ou substituir
                data.appointments = appointments.map(apt => ({
                    id: apt.id || db.generateId('appointments'),
                    companyId: apt.companyId || 1,
                    storeId: parseInt(apt.storeId) || 1,
                    clientName: apt.clientName,
                    clientPhone: apt.clientPhone,
                    date: apt.date,
                    time: apt.time,
                    notes: apt.notes || '',
                    createdAt: apt.createdAt || new Date().toISOString()
                }));
                
                db.saveData(data);
                
                if (typeof app !== 'undefined') {
                    app.refresh();
                }
                
                if (typeof authManager !== 'undefined') {
                    authManager.showToast('✅ ' + appointments.length + ' agendamentos importados!', 'success');
                }
            }
            
            return appointments.length;
        } catch (error) {
            console.error('Erro ao importar:', error);
            return 0;
        }
    }

    // ==================
    // UI
    // ==================
    updateUI() {
        const disconnected = document.getElementById('sheets-status-disconnected');
        const connected = document.getElementById('sheets-status-connected');
        const lastSyncEl = document.getElementById('sheets-last-sync');

        if (disconnected && connected) {
            if (this.isConnected) {
                disconnected.classList.add('hidden');
                connected.classList.remove('hidden');
            } else {
                disconnected.classList.remove('hidden');
                connected.classList.add('hidden');
            }
        }

        if (lastSyncEl) {
            if (this.lastSync) {
                lastSyncEl.textContent = new Date(this.lastSync).toLocaleString('pt-BR');
            } else {
                lastSyncEl.textContent = 'Nunca';
            }
        }
    }
    
    // ==================
    // AUTO-SYNC
    // ==================
    
    // Iniciar sincronização automática
    startAutoSync(intervalSeconds = 30) {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }
        
        // Sync inicial
        this.autoSyncFromSheets();
        
        // Sync periódico
        this.autoSyncInterval = setInterval(() => {
            this.autoSyncFromSheets();
        }, intervalSeconds * 1000);
        
        console.log(`📊 Auto-sync iniciado (a cada ${intervalSeconds}s)`);
    }
    
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    }
    
    // Sync silencioso (sem toasts)
    async autoSyncFromSheets() {
        if (!this.isConnected) return;

        try {
            console.log('📊 Buscando dados da planilha...');
            const appointments = await this.getAppointments();
            console.log('📊 Recebido:', appointments.length, 'agendamentos');
            
            if (appointments.length >= 0) {
                const db = new Database();
                const data = db.getData();
                
                // Converter para comparação
                const oldData = JSON.stringify(data.appointments?.map(a => `${a.date}-${a.time}-${a.clientName}`) || []);
                
                data.appointments = appointments.map(apt => ({
                    id: apt.id || db.generateId('appointments'),
                    companyId: apt.companyId || 1,
                    storeId: parseInt(apt.storeId) || 1,
                    clientName: apt.clientName,
                    clientPhone: String(apt.clientPhone || ''),
                    date: apt.date,
                    time: apt.time,
                    notes: apt.notes || '',
                    createdAt: apt.createdAt || new Date().toISOString()
                }));
                
                db.saveData(data);
                
                // Verificar se os dados mudaram (não só a quantidade)
                const newData = JSON.stringify(data.appointments.map(a => `${a.date}-${a.time}-${a.clientName}`));
                
                if (oldData !== newData && typeof app !== 'undefined' && app.initialized) {
                    console.log('📊 Dados mudaram, atualizando tela...');
                    app.renderSchedule();
                    app.renderCalendar();
                }
                
                this.lastSync = new Date().toISOString();
                this.saveSettings();
                this.updateUI();
            }
        } catch (error) {
            console.error('📊 Auto-sync error:', error);
        }
    }
}

// Instância global
let sheetsService;

document.addEventListener('DOMContentLoaded', () => {
    sheetsService = new SheetsService();
    
    // Iniciar auto-sync se já estiver conectado
    setTimeout(() => {
        if (sheetsService && sheetsService.isConnected) {
            sheetsService.startAutoSync(30); // Sync a cada 30 segundos
        }
    }, 2000);
});

