/**
 * AGENDA ÓTICA - GOOGLE SHEETS DATABASE
 * 
 * A PLANILHA É O ÚNICO BANCO DE DADOS!
 * - Sem localStorage para agendamentos
 * - Todas as operações vão direto para planilha
 * - Cache em memória apenas para performance
 */

class SheetsDatabase {
    constructor() {
        this.scriptUrl = null;
        this.isConnected = false;
        this.lastSync = null;
        
        // CACHE EM MEMÓRIA (não localStorage!)
        this.appointments = [];
        
        // Carregar apenas URL da planilha
        this.loadConfig();
    }

    // ==================
    // CONFIGURAÇÃO
    // ==================
    
    loadConfig() {
        try {
            const saved = localStorage.getItem('sheets_config');
            if (saved) {
                const config = JSON.parse(saved);
                this.scriptUrl = config.url || null;
                this.isConnected = !!this.scriptUrl;
            }
        } catch (e) {
            console.error('Erro ao carregar config:', e);
        }
    }

    saveConfig() {
        localStorage.setItem('sheets_config', JSON.stringify({
            url: this.scriptUrl
        }));
    }

    // ==================
    // CONEXÃO
    // ==================
    
    async connect(url) {
        console.log('🔌 Conectando à planilha...');
        
        if (!url || !url.includes('script.google.com')) {
            return { success: false, error: 'URL inválida' };
        }

        this.scriptUrl = url;
        
        // Testar conexão
        const test = await this.request('test');
        
        if (test.success) {
            this.isConnected = true;
            this.saveConfig();
            
            // Carregar dados iniciais
            await this.loadAll();
            
            // Iniciar auto-refresh
            this.startAutoRefresh();
            
            this.updateUI();
            console.log('✅ Conectado!');
            return { success: true };
        } else {
            this.scriptUrl = null;
            console.error('❌ Falha na conexão:', test.error);
            return { success: false, error: test.error || 'Erro ao conectar' };
        }
    }

    disconnect() {
        console.log('🔌 Desconectando...');
        this.scriptUrl = null;
        this.isConnected = false;
        this.appointments = [];
        this.stopAutoRefresh();
        localStorage.removeItem('sheets_config');
        this.updateUI();
        
        // Atualizar tela
        if (typeof app !== 'undefined' && app.initialized) {
            app.renderSchedule();
            app.renderCalendar();
        }
    }

    // ==================
    // COMUNICAÇÃO COM PLANILHA
    // ==================
    
    async request(action, data = null) {
        if (!this.scriptUrl) {
            return { success: false, error: 'Não conectado' };
        }

        try {
            let url = this.scriptUrl + '?action=' + action;
            let options = {
                method: 'GET',
                redirect: 'follow'
            };

            // Se tem dados, usar POST
            if (data) {
                options.method = 'POST';
                options.headers = { 'Content-Type': 'text/plain' };
                options.body = JSON.stringify(data);
            }

            console.log(`📡 ${action}...`);
            const response = await fetch(url, options);
            const text = await response.text();
            
            try {
                return JSON.parse(text);
            } catch {
                console.error('Resposta inválida:', text);
                return { success: false, error: 'Resposta inválida' };
            }
        } catch (error) {
            console.error(`❌ Erro em ${action}:`, error);
            return { success: false, error: error.message };
        }
    }

    // ==================
    // CRUD - AGENDAMENTOS
    // ==================
    
    // CARREGAR TODOS DA PLANILHA
    async loadAll() {
        console.log('📊 Carregando todos os agendamentos...');
        
        const result = await this.request('list');
        
        if (result.success) {
            this.appointments = result.appointments || [];
            this.lastSync = new Date().toISOString();
            console.log(`✅ ${this.appointments.length} agendamentos carregados`);
            return true;
        } else {
            console.error('❌ Erro ao carregar:', result.error);
            return false;
        }
    }

    // OBTER AGENDAMENTOS (do cache)
    getAppointments(date = null, storeId = null) {
        let filtered = [...this.appointments];
        
        if (date) {
            filtered = filtered.filter(a => a.date === date);
        }
        
        if (storeId) {
            filtered = filtered.filter(a => a.storeId === storeId);
        }
        
        return filtered;
    }

    // OBTER UM AGENDAMENTO
    getAppointment(id) {
        return this.appointments.find(a => a.id === id || a.id === String(id));
    }

    // OBTER POR MÊS
    getAppointmentsByMonth(year, month) {
        const monthStr = String(month).padStart(2, '0');
        return this.appointments.filter(a => 
            a.date && a.date.startsWith(`${year}-${monthStr}`)
        );
    }

    // CRIAR AGENDAMENTO
    async createAppointment(appointment) {
        console.log('📝 Criando agendamento...');
        
        // Gerar ID único
        const id = Date.now();
        const apt = {
            id: id,
            clientName: appointment.clientName || '',
            clientPhone: String(appointment.clientPhone || ''),
            date: appointment.date,
            time: appointment.time,
            storeId: parseInt(appointment.storeId) || 1,
            storeName: appointment.storeName || 'Loja 1',
            notes: appointment.notes || '',
            createdAt: new Date().toISOString()
        };

        // ENVIAR PARA PLANILHA PRIMEIRO
        const result = await this.request('create', apt);
        
        if (result.success) {
            // Adicionar ao cache local
            this.appointments.push(apt);
            console.log('✅ Agendamento criado:', apt.clientName);
            return { success: true, appointment: apt };
        } else {
            console.error('❌ Erro ao criar:', result.error);
            return { success: false, error: result.error };
        }
    }

    // ATUALIZAR AGENDAMENTO
    async updateAppointment(id, updates) {
        console.log('📝 Atualizando agendamento', id);
        
        const index = this.appointments.findIndex(a => 
            a.id === id || a.id === String(id)
        );
        
        if (index === -1) {
            return { success: false, error: 'Agendamento não encontrado' };
        }

        const apt = { ...this.appointments[index], ...updates };
        
        // ENVIAR PARA PLANILHA
        const result = await this.request('update', apt);
        
        if (result.success) {
            // Atualizar cache
            this.appointments[index] = apt;
            console.log('✅ Agendamento atualizado');
            return { success: true };
        } else {
            console.error('❌ Erro ao atualizar:', result.error);
            return { success: false, error: result.error };
        }
    }

    // DELETAR AGENDAMENTO
    async deleteAppointment(id) {
        console.log('🗑️ Deletando agendamento', id);
        
        // DELETAR DA PLANILHA
        const result = await this.request('delete', { id: id });
        
        if (result.success) {
            // Remover do cache
            this.appointments = this.appointments.filter(a => 
                a.id !== id && a.id !== String(id)
            );
            console.log('✅ Agendamento deletado');
            return { success: true };
        } else {
            console.error('❌ Erro ao deletar:', result.error);
            return { success: false, error: result.error };
        }
    }

    // LIMPAR TODOS
    async clearAll() {
        console.log('🗑️ Limpando todos os agendamentos...');
        
        const result = await this.request('clear');
        
        if (result.success) {
            this.appointments = [];
            console.log('✅ Todos os agendamentos removidos');
            return { success: true };
        } else {
            console.error('❌ Erro ao limpar:', result.error);
            return { success: false, error: result.error };
        }
    }

    // ==================
    // AUTO-REFRESH
    // ==================
    
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        // Atualizar a cada 30 segundos
        this.refreshInterval = setInterval(async () => {
            if (this.isConnected) {
                console.log('🔄 Auto-refresh...');
                await this.loadAll();
                
                // Atualizar tela
                if (typeof app !== 'undefined' && app.initialized) {
                    app.renderSchedule();
                    app.renderCalendar();
                }
                
                this.updateUI();
            }
        }, 30000);
        
        console.log('⏰ Auto-refresh iniciado (30s)');
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('⏰ Auto-refresh parado');
        }
    }

    // ==================
    // UI
    // ==================
    
    updateUI() {
        const statusDisconnected = document.getElementById('sheets-status-disconnected');
        const statusConnected = document.getElementById('sheets-status-connected');
        const lastSyncEl = document.getElementById('sheets-last-sync');

        if (this.isConnected) {
            statusDisconnected?.classList.add('hidden');
            statusConnected?.classList.remove('hidden');
            
            if (lastSyncEl && this.lastSync) {
                const date = new Date(this.lastSync);
                lastSyncEl.textContent = date.toLocaleTimeString('pt-BR');
            }
        } else {
            statusDisconnected?.classList.remove('hidden');
            statusConnected?.classList.add('hidden');
        }
    }

    // ==================
    // INICIALIZAÇÃO
    // ==================
    
    async init() {
        console.log('🚀 Inicializando SheetsDatabase...');
        
        if (this.isConnected && this.scriptUrl) {
            // Carregar dados
            await this.loadAll();
            
            // Iniciar auto-refresh
            this.startAutoRefresh();
            
            this.updateUI();
            console.log('✅ SheetsDatabase pronto');
        } else {
            console.log('⚠️ Planilha não conectada');
        }
    }
}

// ==================
// INSTÂNCIA GLOBAL
// ==================

const sheetsDB = new SheetsDatabase();

// Inicializar quando página carregar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        sheetsDB.init();
    }, 500);
});

// ==================
// EVENTOS DA UI
// ==================

document.addEventListener('DOMContentLoaded', () => {
    // Botão conectar
    document.getElementById('btn-sheets-connect')?.addEventListener('click', async () => {
        const urlInput = document.getElementById('sheets-url-input');
        const url = urlInput?.value?.trim();
        
        if (!url) {
            alert('Digite a URL do Apps Script');
            return;
        }
        
        const btn = document.getElementById('btn-sheets-connect');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
        btn.disabled = true;
        
        const result = await sheetsDB.connect(url);
        
        btn.innerHTML = originalText;
        btn.disabled = false;
        
        if (result.success) {
            if (typeof app !== 'undefined') {
                app.showToast('Conectado à planilha!', 'success');
                app.renderSchedule();
                app.renderCalendar();
            }
        } else {
            alert('Erro ao conectar: ' + (result.error || 'Verifique a URL'));
        }
    });

    // Botão desconectar
    document.getElementById('btn-sheets-disconnect')?.addEventListener('click', () => {
        if (confirm('Desconectar da planilha?')) {
            sheetsDB.disconnect();
            if (typeof app !== 'undefined') {
                app.showToast('Desconectado', 'info');
            }
        }
    });

    // Botão atualizar
    document.getElementById('btn-sync-from-sheets')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-sync-from-sheets');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
        btn.disabled = true;
        
        await sheetsDB.loadAll();
        
        if (typeof app !== 'undefined') {
            app.renderSchedule();
            app.renderCalendar();
            app.showToast('Dados atualizados!', 'success');
        }
        
        sheetsDB.updateUI();
        btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Atualizar Agora';
        btn.disabled = false;
    });

    // Botão limpar
    document.getElementById('btn-clear-sheets')?.addEventListener('click', async () => {
        if (!confirm('⚠️ Limpar TODOS os agendamentos da planilha?')) return;
        if (!confirm('🚨 CONFIRMAÇÃO: Esta ação é irreversível!')) return;
        
        const result = await sheetsDB.clearAll();
        
        if (result.success) {
            if (typeof app !== 'undefined') {
                app.renderSchedule();
                app.renderCalendar();
                app.showToast('Planilha limpa!', 'success');
            }
        } else {
            alert('Erro: ' + result.error);
        }
    });

    // Botão enviar tudo (não faz mais sentido, mas manter por compatibilidade)
    document.getElementById('btn-sync-to-sheets')?.addEventListener('click', async () => {
        alert('Os dados são salvos diretamente na planilha. Não é necessário enviar.');
    });
});
