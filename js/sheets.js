/**
 * AGENDA ÓTICA - GOOGLE SHEETS (VERSÃO ROBUSTA)
 * 
 * LÓGICA SIMPLES:
 * - Planilha é a ÚNICA fonte de verdade
 * - Criar/Editar/Deletar SEMPRE vai para planilha primeiro
 * - Tela SEMPRE mostra dados da planilha
 * - Sem sync automático complicado
 */

class SheetsService {
    constructor() {
        this.scriptUrl = null;
        this.isConnected = false;
        this.lastSync = null;
        this.cache = [];
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

    // ==================
    // CONFIGURAÇÃO
    // ==================
    
    async configure(url) {
        if (!url || !url.includes('script.google.com')) {
            return { success: false, error: 'URL inválida' };
        }

        this.scriptUrl = url;
        
        const result = await this.testConnection();
        if (result.success) {
            this.isConnected = true;
            this.saveSettings();
            this.updateUI();
            
            // Carregar dados da planilha
            await this.refresh();
            
            return { success: true };
        } else {
            this.scriptUrl = null;
            return { success: false, error: result.error || 'Erro ao conectar' };
        }
    }

    async testConnection() {
        if (!this.scriptUrl) {
            return { success: false, error: 'URL não configurada' };
        }

        try {
            const response = await fetch(this.scriptUrl + '?action=test', {
                method: 'GET',
                redirect: 'follow'
            });
            const text = await response.text();
            console.log('📊 Teste:', text);
            return JSON.parse(text);
        } catch (error) {
            console.error('📊 Erro no teste:', error);
            return { success: false, error: error.message };
        }
    }

    disconnect() {
        this.scriptUrl = null;
        this.isConnected = false;
        this.lastSync = null;
        this.cache = [];
        localStorage.removeItem('agenda_otica_sheets');
        this.updateUI();
    }

    // ==================
    // OPERAÇÕES CRUD
    // ==================

    // BUSCAR TODOS (da planilha)
    async getAll() {
        if (!this.isConnected) {
            return this.getLocalAppointments();
        }

        try {
            console.log('📊 Buscando da planilha...');
            const response = await fetch(this.scriptUrl + '?action=list', {
                method: 'GET',
                redirect: 'follow'
            });
            const text = await response.text();
            const data = JSON.parse(text);
            
            if (data.success) {
                console.log('📊 Recebido:', data.appointments?.length || 0);
                this.cache = data.appointments || [];
                this.lastSync = new Date().toISOString();
                this.saveSettings();
                return this.cache;
            } else {
                console.error('📊 Erro:', data.error);
                return this.cache;
            }
        } catch (error) {
            console.error('📊 Erro ao buscar:', error);
            return this.cache;
        }
    }

    // CRIAR (na planilha)
    async create(appointment) {
        console.log('📊 Criando:', appointment.clientName);
        
        const id = Date.now();
        const aptWithId = { ...appointment, id };

        if (!this.isConnected) {
            return this.saveLocal(aptWithId);
        }

        try {
            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'create',
                    appointment: aptWithId
                })
            });
            
            const text = await response.text();
            console.log('📊 Resposta:', text);
            const result = JSON.parse(text);
            
            if (result.success) {
                this.showToast('✅ Salvo!', 'success');
                return { success: true, id: result.id || id };
            } else {
                this.saveLocal(aptWithId);
                this.showToast('⚠️ Salvo localmente', 'warning');
                return { success: true, id, local: true };
            }
        } catch (error) {
            console.error('📊 Erro:', error);
            this.saveLocal(aptWithId);
            this.showToast('⚠️ Erro - salvo localmente', 'warning');
            return { success: true, id, local: true };
        }
    }

    // ATUALIZAR (na planilha)
    async update(id, appointment) {
        console.log('📊 Atualizando:', id);

        if (!this.isConnected) {
            return this.updateLocal(id, appointment);
        }

        try {
            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'update',
                    id: id,
                    appointment: { ...appointment, id }
                })
            });
            
            const text = await response.text();
            console.log('📊 Resposta:', text);
            const result = JSON.parse(text);
            
            if (result.success) {
                this.showToast('✅ Atualizado!', 'success');
                return { success: true };
            } else {
                this.showToast('❌ Erro', 'error');
                return { success: false, error: result.error };
            }
        } catch (error) {
            this.showToast('❌ Erro de conexão', 'error');
            return { success: false, error: error.message };
        }
    }

    // DELETAR (da planilha)
    async delete(id) {
        console.log('📊 Deletando:', id);

        if (!this.isConnected) {
            return this.deleteLocal(id);
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
            console.log('📊 Resposta:', text);
            const result = JSON.parse(text);
            
            if (result.success) {
                this.showToast('✅ Excluído!', 'success');
                return { success: true };
            } else {
                this.showToast('❌ Erro', 'error');
                return { success: false, error: result.error };
            }
        } catch (error) {
            this.showToast('❌ Erro', 'error');
            return { success: false, error: error.message };
        }
    }

    // ==================
    // FALLBACK LOCAL
    // ==================
    
    getLocalAppointments() {
        const db = new Database();
        const data = db.getData();
        return data.appointments || [];
    }

    saveLocal(appointment) {
        const db = new Database();
        const data = db.getData();
        data.appointments = data.appointments || [];
        data.appointments.push({
            ...appointment,
            companyId: 1
        });
        db.saveData(data);
        return { success: true, id: appointment.id, local: true };
    }

    updateLocal(id, appointment) {
        const db = new Database();
        const data = db.getData();
        const idx = data.appointments?.findIndex(a => String(a.id) === String(id));
        if (idx >= 0) {
            data.appointments[idx] = { ...data.appointments[idx], ...appointment };
            db.saveData(data);
        }
        return { success: true };
    }

    deleteLocal(id) {
        const db = new Database();
        const data = db.getData();
        data.appointments = (data.appointments || []).filter(a => String(a.id) !== String(id));
        db.saveData(data);
        return { success: true };
    }

    // ==================
    // SYNC
    // ==================

    // Atualizar tela com dados da planilha
    async refresh() {
        console.log('📊 Atualizando dados...');
        
        if (!this.isConnected) {
            console.log('📊 Não conectado');
            return;
        }
        
        try {
            const appointments = await this.getAll();
            
            // Salvar no banco local
            const db = new Database();
            const data = db.getData();
            
            data.appointments = appointments.map(apt => ({
                id: apt.id,
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
            console.log('📊 Sincronizado:', appointments.length, 'agendamentos');
            
            // Atualizar tela
            if (typeof app !== 'undefined' && app.initialized) {
                app.renderSchedule();
                app.renderCalendar();
            }
            
            this.updateUI();
        } catch (error) {
            console.error('📊 Erro ao atualizar:', error);
        }
    }

    // Enviar dados locais para planilha
    async pushToSheets() {
        if (!this.isConnected) {
            this.showToast('Conecte primeiro', 'error');
            return;
        }

        const localApts = this.getLocalAppointments();
        
        if (localApts.length === 0) {
            this.showToast('Nenhum dado local', 'info');
            return;
        }

        this.showToast('Enviando...', 'info');

        try {
            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'syncAll',
                    appointments: localApts.map(apt => ({
                        ...apt,
                        storeName: 'Loja ' + apt.storeId,
                        clientPhone: String(apt.clientPhone || '')
                    }))
                })
            });
            
            const text = await response.text();
            const result = JSON.parse(text);
            
            if (result.success) {
                this.showToast('✅ Enviados!', 'success');
                await this.refresh();
            } else {
                this.showToast('❌ Erro', 'error');
            }
        } catch (error) {
            this.showToast('❌ Erro', 'error');
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

    showToast(message, type = 'info') {
        if (typeof authManager !== 'undefined' && authManager.showToast) {
            authManager.showToast(message, type);
        } else {
            console.log('📊', message);
        }
    }
}

// ==================
// INSTÂNCIA GLOBAL
// ==================

let sheetsService;

document.addEventListener('DOMContentLoaded', () => {
    sheetsService = new SheetsService();
    setTimeout(() => sheetsService?.updateUI(), 500);
});
