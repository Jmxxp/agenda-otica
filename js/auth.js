/**
 * AGENDA ÓTICA - AUTHENTICATION SYSTEM
 * Sistema de autenticação para Óticas
 */

class AuthManager {
    constructor() {
        this.loginScreen = document.getElementById('login-screen');
        this.mainApp = document.getElementById('main-app');
        this.loadingScreen = document.getElementById('loading-screen');
        this.selectedStoreId = null;

        this.init();
    }

    init() {
        this.loadStores();
        this.bindEvents();
        this.checkSession();
    }

    loadStores() {
        // Load stores from database - filter by companyId 1 (default)
        const db = new Database();
        const data = db.getData();
        const stores = data.stores.filter(s => s.active && s.companyId === 1);
        
        const grid = document.getElementById('store-selector-grid');
        if (!grid) return;
        
        grid.innerHTML = stores.map(store => `
            <button class="store-card" data-store-id="${store.id}" style="--store-color: ${store.color}">
                <div class="store-card-icon">
                    <i class="fas fa-store"></i>
                </div>
                <span class="store-card-name">${store.name}</span>
            </button>
        `).join('');
    }

    bindEvents() {
        // Store selection
        const storeGrid = document.getElementById('store-selector-grid');
        if (storeGrid) {
            storeGrid.addEventListener('click', (e) => {
                const storeCard = e.target.closest('.store-card');
                if (storeCard) {
                    this.selectStore(parseInt(storeCard.dataset.storeId));
                }
            });
        }

        // Change store button
        const changeStoreBtn = document.getElementById('btn-change-store');
        if (changeStoreBtn) {
            changeStoreBtn.addEventListener('click', () => this.showStoreSelector());
        }

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Toggle password visibility
        const toggleButtons = document.querySelectorAll('.toggle-password');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.parentElement.querySelector('input');
                const icon = btn.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });

        // Logout buttons
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
    }

    selectStore(storeId) {
        this.selectedStoreId = storeId;
        
        const db = new Database();
        const data = db.getData();
        const store = data.stores.find(s => s.id === storeId);
        
        if (store) {
            // Update UI
            document.getElementById('selected-store-name').textContent = store.name;
            const badge = document.getElementById('selected-store-badge');
            badge.style.setProperty('--store-color', store.color);
            
            // Show password section
            document.getElementById('store-selector-grid').classList.add('hidden');
            document.getElementById('store-password-section').classList.remove('hidden');
            
            // Focus password input
            setTimeout(() => {
                document.getElementById('login-password').focus();
            }, 100);
        }
    }

    showStoreSelector() {
        this.selectedStoreId = null;
        document.getElementById('store-selector-grid').classList.remove('hidden');
        document.getElementById('store-password-section').classList.add('hidden');
        document.getElementById('login-password').value = '';
    }

    checkSession() {
        // Simulate loading
        setTimeout(() => {
            if (dataService.checkSession()) {
                this.showApp();
            } else {
                this.showScreen('login');
            }
        }, 800);
    }

    showScreen(screen) {
        this.loadingScreen.classList.add('hidden');
        this.loginScreen.classList.add('hidden');
        this.mainApp.classList.add('hidden');

        if (screen === 'login') {
            this.loginScreen.classList.remove('hidden');
            this.showStoreSelector();
        }
    }

    showApp() {
        this.loadingScreen.classList.add('hidden');
        this.loginScreen.classList.add('hidden');
        this.mainApp.classList.remove('hidden');

        // Initialize the app
        if (typeof app !== 'undefined') {
            app.init();
        }
    }

    handleLogin(e) {
        e.preventDefault();

        if (!this.selectedStoreId) {
            this.showToast('Selecione uma loja', 'error');
            return;
        }

        const password = document.getElementById('login-password').value;

        if (!password) {
            this.showToast('Digite a senha', 'error');
            return;
        }

        const result = dataService.loginByStore(this.selectedStoreId, password);

        if (result.success) {
            this.showToast('Login realizado com sucesso!', 'success');
            setTimeout(() => {
                this.showApp();
            }, 500);
        } else {
            this.showToast(result.error, 'error');
        }
    }

    handleLogout() {
        dataService.logout();
        this.showToast('Você saiu do sistema', 'info');
        setTimeout(() => {
            this.showScreen('login');
            document.getElementById('login-password').value = '';
        }, 500);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="${icons[type]}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);

        // Manual close
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        });
    }
}

// Initialize auth manager when DOM is ready
let authManager;
document.addEventListener('DOMContentLoaded', () => {
    authManager = new AuthManager();
});
