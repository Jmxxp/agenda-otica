# Agenda Ótica - Sistema de Agendamento Premium

Sistema completo de agendamento para óticas, desenvolvido como SaaS (Software as a Service).

## Funcionalidades

### Gestão de Agendamentos
- 📅 Calendário interativo com navegação por mês
- 🕐 Visualização por horários (grade de tempo x lojas)
- 📊 Duas visualizações: **Geral** (com nome da loja) e **Simplificado**
- ➕ Adicionar agendamentos com um clique
- ✏️ Editar e excluir agendamentos
- 📱 Integração com WhatsApp para confirmações

### Multi-Lojas
- 🏪 Suporte a múltiplas lojas/unidades
- 🎨 Cores personalizadas por loja
- 🔄 Filtro por loja ou visualização geral

### Gestão de Clientes
- 👥 Cadastro completo de clientes
- 🔍 Busca por nome, telefone ou e-mail
- 📋 Histórico de informações

### Relatórios
- 📈 Total de agendamentos por período
- 📊 Gráfico de agendamentos por loja
- 📉 Estatísticas em tempo real

### Configurações
- ⚙️ Horário de funcionamento personalizável
- ⏱️ Intervalos configuráveis (15, 30 ou 60 minutos)
- 🏢 Dados da empresa

### Sistema SaaS
- 🔐 Login e registro de usuários
- 🏢 Multi-tenant (cada empresa com seus dados)
- 💾 Dados persistentes via LocalStorage

## Como Usar

### Instalação
1. Clone ou baixe o projeto
2. Abra `index.html` no navegador

### Credenciais de Demo
- **E-mail:** admin@otica.com
- **Senha:** 123456

### Criar Nova Conta
1. Na tela de login, clique em "Criar conta"
2. Preencha os dados da empresa
3. Comece a usar!

## Estrutura do Projeto

```
agenda_otica/
├── index.html          # Página principal
├── README.md           # Documentação
├── css/
│   └── styles.css      # Estilos premium
└── js/
    ├── data.js         # Sistema de dados/API
    ├── auth.js         # Autenticação
    └── app.js          # Aplicação principal
```

## Tecnologias

- **HTML5** - Estrutura semântica
- **CSS3** - Design responsivo e moderno
- **JavaScript ES6+** - Lógica e interatividade
- **LocalStorage** - Persistência de dados
- **Font Awesome** - Ícones
- **Google Fonts (Inter)** - Tipografia

## Características Premium

- 🎨 Design dark mode premium
- ✨ Animações suaves
- 📱 Totalmente responsivo
- 🚀 Rápido e leve
- 💎 Interface intuitiva

## Próximas Funcionalidades

- [ ] Backend com Node.js/Express
- [ ] Banco de dados PostgreSQL/MongoDB
- [ ] Notificações por e-mail
- [ ] Lembretes automáticos
- [ ] Relatórios exportáveis (PDF/Excel)
- [ ] App mobile (PWA)
- [ ] Integração com calendário Google

## Licença

Este projeto foi desenvolvido como demonstração SaaS para óticas.

---

Desenvolvido com ❤️ para modernizar a gestão de óticas.
