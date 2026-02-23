/**
 * =============================================
 *  SISTEMA ÓTICA - APP PRINCIPAL
 *  Controla tudo: login, calendário, grade, modais
 * =============================================
 */

const STORES = [
  { id: 1, name: 'Loja 1', color: 'var(--store1)', pwd: 'Fabrica3631' },
  { id: 2, name: 'Loja 2', color: 'var(--store2)', pwd: 'Fabrica0232' },
  { id: 3, name: 'Loja 3', color: 'var(--store3)', pwd: 'Fabrica3' },
  { id: 4, name: 'Loja 4', color: 'var(--store4)', pwd: 'Oslo123' },
  { id: 5, name: 'Loja 5', color: 'var(--store5)', pwd: 'Spasso123' },
];

const TIMES = [
  '08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00'
];

/* Horários por dia da semana: 5=sexta, 6=sábado */
const TIMES_SEXTA  = ['14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];
const TIMES_SABADO = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30'];

function getTimesForDate(date) {
  const dow = date.getDay();
  if (dow === 5) return TIMES_SEXTA;
  if (dow === 6) return TIMES_SABADO;
  return TIMES;
}

const WEEKDAYS = ['DOMINGO','SEGUNDA-FEIRA','TERÇA-FEIRA','QUARTA-FEIRA','QUINTA-FEIRA','SEXTA-FEIRA','SÁBADO'];
const MONTHS   = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

/* =============================================
   APP OBJECT
   ============================================= */
const App = {
  ready: false,
  store: null,     // loja logada { id, name, color }
  viewerMode: false, // modo visualização (somente leitura)
  today: new Date(),
  selDate: new Date(),
  calDate: new Date(),
  viewMode: 'geral', // 'geral' ou 'simplificado'

  /* ── Boot ── */
  async boot() {
    // Check session
    const sid = localStorage.getItem('otica_store');
    const isViewer = localStorage.getItem('otica_viewer');
    if (sid) {
      this.store = STORES.find(s => s.id === parseInt(sid));
    } else if (isViewer) {
      this.viewerMode = true;
      this.store = { id: 0, name: 'Visitante', color: 'var(--text2)' };
    }

    if (this.store) {
      this.showApp();
    } else {
      this.showLogin();
    }

    this.bindGlobal();
  },

  /* ── LOGIN ── */
  showLogin() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');

    this.renderStoreButtons();
  },

  renderStoreButtons() {
    const grid = document.getElementById('stores-grid');
    grid.innerHTML = STORES.map(s => `
      <button class="store-btn" data-id="${s.id}">
        <span class="dot" style="background:${s.color}"></span>
        ${s.name}
      </button>
    `).join('');

    let selectedId = null;

    grid.querySelectorAll('.store-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.store-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedId = parseInt(btn.dataset.id);
        document.getElementById('pwd-section').classList.remove('hidden');
        document.getElementById('pwd-input').focus();
      });
    });

    // Use onclick (replaces, not stacks) to avoid duplicate handlers
    document.getElementById('btn-enter').onclick = () => {
      if (!selectedId) { this.toast('Selecione uma loja', 'error'); return; }
      const pwd = document.getElementById('pwd-input').value;
      const store = STORES.find(s => s.id === selectedId);
      if (pwd.toLowerCase() === store.pwd.toLowerCase()) {
        this.store = store;
        localStorage.setItem('otica_store', store.id);
        document.getElementById('pwd-input').value = '';
        this.showApp();
      } else {
        this.toast('Senha incorreta', 'error');
      }
    };

    document.getElementById('pwd-input').onkeydown = (e) => {
      if (e.key === 'Enter') document.getElementById('btn-enter').click();
    };

    // Viewer button (no password)
    document.getElementById('btn-viewer').onclick = () => {
      this.viewerMode = true;
      this.store = { id: 0, name: 'Visitante', color: 'var(--text2)' };
      localStorage.setItem('otica_viewer', '1');
      this.showApp();
    };
  },

  logout() {
    this.store = null;
    this.viewerMode = false;
    this.ready = false;
    this._eventsBound = false;
    localStorage.removeItem('otica_store');
    localStorage.removeItem('otica_viewer');
    document.body.classList.remove('viewer-mode');
    DB.stopSync();
    this.showLogin();
  },

  /* ── MAIN APP ── */
  async showApp() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Store badge
    const badge = document.getElementById('store-badge');
    badge.querySelector('.dot').style.background = this.store.color;
    badge.querySelector('span:last-child').textContent = this.store.name;

    // Viewer mode: hide config, add body class
    if (this.viewerMode) {
      document.body.classList.add('viewer-mode');
      document.getElementById('nav-config').style.display = 'none';
    } else {
      document.body.classList.remove('viewer-mode');
      document.getElementById('nav-config').style.display = '';
    }

    this.bindEvents();
    this.ready = true;

    // Init sheets
    this.log('Sistema iniciado', 'info');
    this.log('Loja: ' + this.store.name, 'info');
    if (DB.connected) {
      this.log('Conectando à planilha...', 'info');
      const ok = await DB.refresh();
      if (ok) {
        this.log('✅ Planilha conectada - ' + DB.data.length + ' agendamentos', 'success');
        DB.startSync();
      } else {
        this.log('❌ Falha ao carregar planilha', 'error');
      }
    } else {
      this.log('⚠️ Planilha não configurada - clique em Configurar', 'warn');
    }

    this.render();
    this.updateConnStatus();
  },

  /* ── Render tudo ── */
  render() {
    this.renderDateHeader();
    this.renderCalendar();

    // Viewer mobile: layout especial com calendário inline + lista
    if (this.viewerMode && this.isMobile()) {
      this.renderViewerMobile();
    } else if (this.viewMode === 'simplificado') {
      this.renderSimplified();
    } else {
      this.renderSchedule();
    }
    this.updateConnStatus();
  },

  /* ── Check mobile ── */
  isMobile() {
    return window.innerWidth <= 768;
  },

  /* ── Date header ── */
  renderDateHeader() {
    const d = this.selDate;
    document.getElementById('h-day').textContent = String(d.getDate()).padStart(2,'0');
    document.getElementById('h-weekday').textContent = WEEKDAYS[d.getDay()];
    document.getElementById('h-monthyear').textContent = MONTHS[d.getMonth()] + ' ' + d.getFullYear();

    // Mobile viewer date
    const vmDate = document.getElementById('vm-date');
    if (vmDate) {
      vmDate.textContent = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + ' — ' + WEEKDAYS[d.getDay()].slice(0,3);
    }
  },

  /* ── Mini calendar ── */
  renderCalendar() {
    const y = this.calDate.getFullYear();
    const m = this.calDate.getMonth();

    document.getElementById('cal-title').textContent = MONTHS[m] + ' ' + y;

    const first   = new Date(y, m, 1).getDay();
    const days    = new Date(y, m+1, 0).getDate();
    const prevD   = new Date(y, m, 0).getDate();
    const today   = this.today;
    const sel     = this.selDate;

    // Quais dias tem agendamento?
    const aptsMonth = DB.getByMonth(y, m + 1);
    const daysWithApt = new Set(aptsMonth.map(a => parseInt(a.date.split('-')[2])));

    let html = '';

    // Prev month
    for (let i = first - 1; i >= 0; i--) {
      html += `<div class="cal-day other">${prevD - i}</div>`;
    }

    // Current month
    for (let d = 1; d <= days; d++) {
      const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
      const isSel   = d === sel.getDate() && m === sel.getMonth() && y === sel.getFullYear();
      const hasApt  = daysWithApt.has(d);
      let cls = 'cal-day';
      if (isToday) cls += ' today';
      if (isSel && !isToday) cls += ' selected';
      if (hasApt) cls += ' has-apt';
      html += `<div class="${cls}" data-day="${d}">${d}</div>`;
    }

    // Next month fill
    const total = first + days;
    const fill = total <= 35 ? 35 - total : 42 - total;
    for (let d = 1; d <= fill; d++) {
      html += `<div class="cal-day other">${d}</div>`;
    }

    const container = document.getElementById('cal-days');
    container.innerHTML = html;

    // Click days
    container.querySelectorAll('.cal-day:not(.other)').forEach(el => {
      el.addEventListener('click', () => {
        const day = parseInt(el.dataset.day);
        this.selDate = new Date(y, m, day);
        this.render();
        // Close sidebar on mobile after selecting a day
        document.getElementById('sidebar').classList.remove('open');
      });
    });
  },

  /* ── Schedule Grid ── */
  renderSchedule() {
    const wrap = document.getElementById('schedule');
    const dateStr = this.fmtDate(this.selDate);
    const isSunday = this.selDate.getDay() === 0;

    let banner = '';
    if (!DB.connected) {
      banner = `
        <div class="conn-banner">
          <i class="fas fa-plug"></i>
          <span>Planilha não conectada — clique em <strong>Configurar</strong> no menu lateral</span>
          <button class="btn btn-green btn-sm" id="banner-config"><i class="fas fa-cog"></i> Configurar</button>
        </div>`;
    }

    if (isSunday) {
      wrap.innerHTML = `
        <div class="closed-msg">
          <i class="fas fa-moon"></i>
          <p>Fechado aos domingos</p>
        </div>`;
      return;
    }

    const apts = DB.connected ? DB.getAll(dateStr) : [];
    const cols = STORES.length;
    const gridCols = `70px repeat(${cols}, 1fr)`;
    const times = getTimesForDate(this.selDate);

    let html = `<div class="schedule-grid" style="grid-template-columns:${gridCols}">`;

    // Header row
    html += `<div class="grid-corner">Hora</div>`;
    STORES.forEach(s => {
      html += `<div class="grid-store-header"><span class="dot" style="background:${s.color}"></span>${s.name}</div>`;
    });

    // Time rows
    times.forEach(time => {
      html += `<div class="grid-time">${time}</div>`;
      // Verifica se já existe agendamento neste horário em QUALQUER loja
      const timeOccupied = apts.some(a => a.time === time && a.storeId > 0);
      STORES.forEach(s => {
        const apt = apts.find(a => a.time === time && a.storeId === s.id);
        if (apt) {
          const phone = this.fmtPhone(apt.phone);
          html += `
            <div class="grid-cell" data-apt-id="${apt.id}">
              <div class="apt-card store-${s.id}">
                <div class="apt-name">${this.esc(apt.client)}</div>
                <div class="apt-phone">${phone}</div>
                <div class="apt-store">${this.esc(apt.store)}</div>
              </div>
            </div>`;
        } else {
          // Pode agendar? Só na própria loja (nunca em viewer) E apenas se o horário NÃO está ocupado em nenhuma loja
          const canAdd = !this.viewerMode && s.id === this.store.id && !timeOccupied;
          html += `
            <div class="grid-cell${canAdd ? ' can-add' : ''}" data-store="${s.id}" data-time="${time}">
              ${canAdd ? '<span class="add-icon">+</span>' : ''}
            </div>`;
        }
      });
    });

    html += '</div>';
    wrap.innerHTML = banner + html;

    // Banner config button
    document.getElementById('banner-config')?.addEventListener('click', () => this.openConfig());

    // Events: click card
    wrap.querySelectorAll('[data-apt-id]').forEach(el => {
      el.addEventListener('click', () => this.openDetail(el.dataset.aptId));
    });

    // Events: click entire cell to add
    wrap.querySelectorAll('.grid-cell.can-add').forEach(cell => {
      cell.addEventListener('click', () => {
        if (!DB.connected) { this.toast('Conecte à planilha primeiro', 'error'); return; }
        this.openNew(parseInt(cell.dataset.store), cell.dataset.time);
      });
    });
  },

  /* ── Simplified View ── */
  renderSimplified() {
    const wrap = document.getElementById('schedule');
    const dateStr = this.fmtDate(this.selDate);
    const isSunday = this.selDate.getDay() === 0;
    const dow = this.selDate.getDay();

    let banner = '';
    if (!DB.connected) {
      banner = `
        <div class="conn-banner">
          <i class="fas fa-plug"></i>
          <span>Planilha não conectada — clique em <strong>Configurar</strong> no menu lateral</span>
          <button class="btn btn-green btn-sm" id="banner-config"><i class="fas fa-cog"></i> Configurar</button>
        </div>`;
    }

    if (isSunday) {
      wrap.innerHTML = `
        <div class="closed-msg">
          <i class="fas fa-moon"></i>
          <p>Fechado aos domingos</p>
        </div>`;
      return;
    }

    let apts = DB.connected ? DB.getAll(dateStr) : [];
    apts = apts.filter(a => a.storeId > 0);
    const allTimes = getTimesForDate(this.selDate);

    const needsSplit = dow >= 1 && dow <= 4;
    let sections = [];

    if (needsSplit) {
      const morning = allTimes.filter(t => parseInt(t.split(':')[0]) < 13);
      const afternoon = allTimes.filter(t => parseInt(t.split(':')[0]) >= 13);
      sections.push({ label: 'Manhã', icon: 'fa-sun', times: morning });
      sections.push({ label: 'Tarde', icon: 'fa-cloud-sun', times: afternoon });
    } else {
      const label = dow === 5 ? 'Tarde' : 'Manhã';
      const icon = dow === 5 ? 'fa-cloud-sun' : 'fa-sun';
      sections.push({ label, icon, times: allTimes });
    }

    const isViewer = this.viewerMode;
    const canAdd = !isViewer;
    let html = '<div class="simplified-view">';

    sections.forEach(sec => {
      html += `<div class="simp-section">`;
      html += `<div class="simp-label-premium"><i class="fas ${sec.icon}"></i><span>${sec.label}</span></div>`;
      html += `<div class="simp-table-wrap"><table class="simp-table">`;
      html += `<thead><tr>`;
      sec.times.forEach(t => { html += `<th class="simp-th">${t}</th>`; });
      html += `</tr></thead><tbody><tr>`;

      sec.times.forEach(time => {
        const apt = apts.find(a => a.time === time);
        const timeOccupied = apt ? true : false;
        if (apt) {
          const store = STORES.find(s => s.id === apt.storeId);
          html += `<td class="simp-td simp-filled" data-apt-id="${apt.id}">
            <div class="simp-card store-${apt.storeId}">
              <span class="simp-card-store">${store ? store.name : ''}</span>
              <span class="simp-card-name">${this.esc(apt.client)}</span>
              <span class="simp-card-phone">${apt.phone || ''}</span>
            </div>
          </td>`;
        } else if (canAdd) {
          html += `<td class="simp-td simp-empty" data-store="${this.store.id}" data-time="${time}"><span class="simp-add">+</span></td>`;
        } else {
          html += `<td class="simp-td simp-empty-viewer"></td>`;
        }
      });

      html += `</tr></tbody></table></div></div>`;
    });

    html += '</div>';
    wrap.innerHTML = banner + html;

    document.getElementById('banner-config')?.addEventListener('click', () => this.openConfig());

    wrap.querySelectorAll('[data-apt-id]').forEach(el => {
      el.addEventListener('click', () => this.openDetail(el.dataset.aptId));
    });

    wrap.querySelectorAll('.simp-empty').forEach(cell => {
      cell.addEventListener('click', () => {
        if (!DB.connected) { this.toast('Conecte à planilha primeiro', 'error'); return; }
        this.openNew(parseInt(cell.dataset.store), cell.dataset.time);
      });
    });
  },

  /* ── Viewer Mobile: Cal + Geral + Simplificado + Lista ── */
  renderViewerMobile() {
    const wrap = document.getElementById('schedule');
    const dateStr = this.fmtDate(this.selDate);
    const isSunday = this.selDate.getDay() === 0;
    const d = this.selDate;
    const dow = d.getDay();
    const y = this.calDate.getFullYear();
    const m = this.calDate.getMonth();

    // ── Calendário ──
    const first = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevD = new Date(y, m, 0).getDate();
    const today = this.today;
    const sel = this.selDate;
    const aptsMonth = DB.getByMonth(y, m + 1);
    const daysWithApt = new Set(aptsMonth.map(a => parseInt(a.date.split('-')[2])));

    let calHtml = '';
    for (let i = first - 1; i >= 0; i--) calHtml += `<div class="vm-day other">${prevD - i}</div>`;
    for (let dd = 1; dd <= daysInMonth; dd++) {
      const isToday = dd === today.getDate() && m === today.getMonth() && y === today.getFullYear();
      const isSel = dd === sel.getDate() && m === sel.getMonth() && y === sel.getFullYear();
      let cls = 'vm-day';
      if (isToday) cls += ' today';
      if (isSel && !isToday) cls += ' sel';
      if (daysWithApt.has(dd)) cls += ' has';
      calHtml += `<div class="${cls}" data-day="${dd}">${dd}</div>`;
    }
    const total = first + daysInMonth;
    const fill = total <= 35 ? 35 - total : 42 - total;
    for (let dd = 1; dd <= fill; dd++) calHtml += `<div class="vm-day other">${dd}</div>`;

    const dayName = WEEKDAYS[dow];
    const dateDisplay = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();

    // ── Body ──
    let body = '';
    if (isSunday) {
      body = `<div class="vm-closed"><i class="fas fa-moon"></i><span>Fechado aos domingos</span></div>`;
    } else {
      const apts = DB.connected ? DB.getAll(dateStr) : [];
      const times = getTimesForDate(this.selDate);

      // ═══ GERAL (tabela HTML pura, 100% width) ═══
      body += `<div class="vm-sec"><div class="vm-sec-title"><i class="fas fa-th"></i> Agenda Geral</div>`;
      body += `<div class="vm-tbl-wrap"><table class="vm-tbl"><thead><tr><th class="vm-th vm-th-time">Hora</th>`;
      STORES.forEach(s => {
        body += `<th class="vm-th"><span class="dot" style="background:${s.color}"></span>${s.name}</th>`;
      });
      body += `</tr></thead><tbody>`;
      times.forEach(time => {
        body += `<tr>`;
        body += `<td class="vm-td vm-td-time">${time}</td>`;
        STORES.forEach(s => {
          const apt = apts.find(a => a.time === time && a.storeId === s.id);
          if (apt) {
            body += `<td class="vm-td vm-td-apt" data-apt-id="${apt.id}"><div class="vm-apt store-${s.id}"><span>${this.esc(apt.client)}</span></div></td>`;
          } else {
            body += `<td class="vm-td"></td>`;
          }
        });
        body += `</tr>`;
      });
      body += `</tbody></table></div></div>`;

      // ═══ SIMPLIFICADO (manhã + tarde em dias normais) ═══
      body += `<div class="vm-sec"><div class="vm-sec-title"><i class="fas fa-columns"></i> Simplificado</div>`;
      const simpNeedsSplit = dow >= 1 && dow <= 4;
      let simpSections = [];
      if (simpNeedsSplit) {
        simpSections.push({ label: 'Manhã', times: times.filter(t => parseInt(t.split(':')[0]) < 13) });
        simpSections.push({ label: 'Tarde', times: times.filter(t => parseInt(t.split(':')[0]) >= 13) });
      } else {
        const simpLabel = dow === 5 ? 'Tarde (Sexta)' : 'Manhã (Sábado)';
        simpSections.push({ label: simpLabel, times: times });
      }
      simpSections.forEach(sec => {
        body += `<div class="vm-simp-label">${sec.label}</div>`;
        body += `<div class="vm-tbl-wrap"><table class="vm-tbl"><thead><tr>`;
        sec.times.forEach(t => { body += `<th class="vm-th">${t}</th>`; });
        body += `</tr></thead><tbody><tr>`;
        sec.times.forEach(time => {
          const aptsAt = apts.filter(a => a.time === time);
          if (aptsAt.length > 0) {
            body += `<td class="vm-td vm-td-stack">`;
            aptsAt.forEach(apt => {
              const st = STORES.find(s => s.id === apt.storeId);
              body += `<div class="vm-apt store-${apt.storeId}" data-apt-id="${apt.id}"><span class="vm-apt-store">${st ? st.name : apt.store}</span><span>${this.esc(apt.client)}</span></div>`;
            });
            body += `</td>`;
          } else {
            body += `<td class="vm-td"></td>`;
          }
        });
        body += `</tr></tbody></table></div>`;
      });
      body += `</div>`;

      // ═══ LISTA ═══
      const sorted = [...apts].sort((a, b) => a.time.localeCompare(b.time));
      body += `<div class="vm-sec"><div class="vm-sec-title"><i class="fas fa-list"></i> Agendamentos</div>`;
      if (sorted.length > 0) {
        body += `<div class="vm-list">`;
        sorted.forEach(apt => {
          const store = STORES.find(s => s.id === apt.storeId);
          body += `<div class="vm-li" data-apt-id="${apt.id}">
            <div class="vm-li-time">${apt.time}</div>
            <div class="vm-li-info"><div class="vm-li-name">${this.esc(apt.client)}</div><div class="vm-li-phone">${this.fmtPhone(apt.phone)}</div></div>
            <div class="vm-li-store"><span class="dot" style="background:${store ? store.color : 'var(--text2)'}"></span>${store ? store.name : apt.store}</div>
          </div>`;
        });
        body += `</div>`;
      } else {
        body += `<div class="vm-empty"><i class="fas fa-calendar-check"></i><span>Nenhum agendamento</span></div>`;
      }
      body += `</div>`;
    }

    wrap.innerHTML = `
      <div class="vm-zoom-bar">
        <label>Tamanho: <span id="vm-zoom-val">100%</span></label>
        <input type="range" id="vm-zoom-slider" min="50" max="200" value="100" step="5" style="width:100%">
      </div>
      <div class="vm-layout">
        <div class="vm-cal">
          <div class="vm-cal-card">
            <div class="vm-cal-nav">
              <button id="vm-prev"><i class="fas fa-chevron-left"></i></button>
              <span id="vm-cal-tog">${MONTHS[m]} ${y} <i class="fas fa-chevron-down vm-tog-icon"></i></span>
              <button id="vm-next"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="vm-cal-grid" id="vm-cal-grid">
              <div class="vm-wk"><span class="vm-dom">D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
              <div class="vm-days">${calHtml}</div>
            </div>
          </div>
        </div>
        <div class="vm-date">${dayName} — ${dateDisplay}</div>
        <div class="vm-body">${body}</div>
        <button class="vm-out" id="vm-out"><i class="fas fa-sign-out-alt"></i> Sair</button>
      </div>`;

    document.getElementById('vm-cal-tog').onclick = () => document.getElementById('vm-cal-grid').classList.toggle('hide');
    document.getElementById('vm-prev').onclick = () => { this.calDate.setMonth(this.calDate.getMonth() - 1); this.render(); };
    document.getElementById('vm-next').onclick = () => { this.calDate.setMonth(this.calDate.getMonth() + 1); this.render(); };
    wrap.querySelectorAll('.vm-day:not(.other)').forEach(el => {
      el.addEventListener('click', () => { this.selDate = new Date(y, m, parseInt(el.dataset.day)); this.render(); });
    });
    wrap.querySelectorAll('[data-apt-id]').forEach(el => {
      el.addEventListener('click', () => this.openDetail(el.dataset.aptId));
    });
    document.getElementById('vm-out').onclick = () => this.logout();

    // Slider de tamanho – aplica zoom CSS no layout
    const slider = document.getElementById('vm-zoom-slider');
    const valSpan = document.getElementById('vm-zoom-val');
    if (slider) {
      slider.oninput = () => {
        const pct = parseInt(slider.value);
        valSpan.textContent = pct + '%';
        const layout = document.querySelector('.vm-layout');
        layout.style.zoom = (pct / 100);
      };
    }
  },

  /* ── Connection status ── */
  updateConnStatus() {
    const el = document.getElementById('conn-status');
    if (DB.connected) {
      el.className = 'conn-status online';
      el.innerHTML = '<span class="pulse"></span>Online';
    } else {
      el.className = 'conn-status offline';
      el.innerHTML = '<span class="pulse"></span>Offline';
    }
  },

  /* ── Events ── */
  bindGlobal() {
    // Close modals on ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  bindEvents() {
    // Guard: only bind once
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Calendar nav
    document.getElementById('cal-prev').onclick = () => {
      this.calDate.setMonth(this.calDate.getMonth() - 1);
      this.renderCalendar();
    };
    document.getElementById('cal-next').onclick = () => {
      this.calDate.setMonth(this.calDate.getMonth() + 1);
      this.renderCalendar();
    };

    // Header buttons
    document.getElementById('btn-today').onclick = () => {
      this.selDate = new Date();
      this.calDate = new Date();
      this.render();
    };

    document.getElementById('btn-refresh').onclick = async () => {
      if (!DB.connected) { this.toast('Conecte à planilha', 'error'); return; }
      this.toast('Atualizando...', 'info');
      await DB.refresh();
      this.render();
      this.toast('Atualizado!', 'success');
    };

    // Theme toggle
    document.getElementById('btn-theme').onclick = () => {
      const html = document.documentElement;
      const isLight = html.getAttribute('data-theme') === 'light';
      if (isLight) {
        html.removeAttribute('data-theme');
        document.getElementById('btn-theme').innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('otica_theme', 'dark');
      } else {
        html.setAttribute('data-theme', 'light');
        document.getElementById('btn-theme').innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.removeItem('otica_theme');
      }
    };

    // Load saved theme (light is default)
    if (localStorage.getItem('otica_theme') === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      document.getElementById('btn-theme').innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.getElementById('btn-theme').innerHTML = '<i class="fas fa-moon"></i>';
    }

    // Sidebar nav
    document.getElementById('nav-config').onclick = () => this.openConfig();
    document.getElementById('btn-logout').onclick = () => this.logout();

    // Mobile viewer bar
    const vmMenu = document.getElementById('vm-menu');
    const vmToday = document.getElementById('vm-today');
    const vmLogout = document.getElementById('vm-logout');
    if (vmMenu) {
      vmMenu.onclick = () => {
        document.getElementById('sidebar').classList.toggle('open');
      };
    }
    if (vmToday) {
      vmToday.onclick = () => {
        this.selDate = new Date();
        this.calDate = new Date();
        this.render();
      };
    }
    if (vmLogout) {
      vmLogout.onclick = () => this.logout();
    }

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.dataset.view;
        this.render();
      });
    });
  },

  /* ── MODAIS ── */
  openModal(html) {
    this.closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal';
    overlay.innerHTML = `<div class="modal-box">${html}</div>`;
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });

    // Close button
    overlay.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
  },

  closeModal() {
    document.getElementById('modal')?.remove();
  },

  /* ── New appointment modal ── */
  openNew(storeId, time) {
    const dateDisplay = this.fmtDateDisplay(this.selDate);
    const store = STORES.find(s => s.id === storeId);

    this.openModal(`
      <div class="modal-head">
        <h3>Novo Agendamento</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Cliente</label>
          <input type="text" id="f-client" placeholder="Nome completo" autofocus>
        </div>
        <div class="field">
          <label>Telefone</label>
          <div class="phone-row">
            <input type="tel" id="f-phone" placeholder="19912345678">
            <button class="btn-wpp" id="f-wpp" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Data</label>
            <input type="text" id="f-date" value="${dateDisplay}" readonly>
          </div>
          <div class="field">
            <label>Horário</label>
            <select id="f-time">
              ${TIMES.map(t => `<option value="${t}" ${t===time?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>Loja</label>
          <input type="text" value="${store.name}" readonly style="opacity:.7">
          <input type="hidden" id="f-store-id" value="${storeId}">
          <input type="hidden" id="f-store-name" value="${store.name}">
        </div>
        <div class="field">
          <label>Observações</label>
          <textarea id="f-notes" placeholder="Opcional..."></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="f-save">Agendar</button>
      </div>
    `);

    document.getElementById('f-save').addEventListener('click', () => this.saveNew());
    document.getElementById('f-wpp').addEventListener('click', () => {
      const phone = document.getElementById('f-phone').value.replace(/\D/g,'');
      if (phone) window.open('https://wa.me/55'+phone, '_blank');
    });
    document.getElementById('f-client').focus();
  },

  async saveNew() {
    const client = document.getElementById('f-client').value.trim();
    const phone  = document.getElementById('f-phone').value.replace(/\D/g,'');
    const time   = document.getElementById('f-time').value;
    const storeId = parseInt(document.getElementById('f-store-id').value);
    const store  = document.getElementById('f-store-name').value;
    const notes  = document.getElementById('f-notes').value.trim();
    const date   = this.fmtDate(this.selDate);

    if (!client) { this.toast('Digite o nome do cliente', 'error'); return; }
    if (!phone)  { this.toast('Digite o telefone', 'error'); return; }

    // Check conflict: impede agendamento duplicado entre geral e lojas
    const existing = DB.getAll(date).find(a => a.time === time && (a.storeId === storeId || a.storeId === 0 || storeId === 0));
    if (existing) { this.toast('Horário já ocupado em outra loja ou agenda geral!', 'error'); return; }

    this.closeModal();
    this.toast('Salvando...', 'info');

    const r = await DB.create({ date, time, client, phone, store, storeId, notes });
    if (r.ok) {
      this.toast('Agendamento criado!', 'success');
      this.render();
    } else {
      this.toast('Erro: ' + r.err, 'error');
    }
  },

  /* ── Detail modal ── */
  openDetail(id) {
    const apt = DB.getOne(id);
    if (!apt) return;

    const canEdit = !this.viewerMode && apt.storeId === this.store.id;
    const store = STORES.find(s => s.id === apt.storeId);
    const dateDisplay = apt.date ? apt.date.split('-').reverse().join('/') : '';

    this.openModal(`
      <div class="modal-head">
        <h3>${canEdit ? 'Editar' : 'Visualizar'} Agendamento</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Cliente</label>
          <input type="text" id="d-client" value="${this.esc(apt.client)}" ${canEdit?'':'disabled'}>
        </div>
        <div class="field">
          <label>Telefone</label>
          <div class="phone-row">
            <input type="tel" id="d-phone" value="${apt.phone}" ${canEdit?'':'disabled'}>
            <button class="btn-wpp" id="d-wpp" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Data</label>
            <input type="text" value="${dateDisplay}" readonly>
          </div>
          <div class="field">
            <label>Horário</label>
            <select id="d-time" ${canEdit?'':'disabled'}>
              ${TIMES.map(t => `<option value="${t}" ${t===apt.time?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>Loja</label>
          <input type="text" value="${store?.name || apt.store}" readonly style="opacity:.7">
        </div>
        <div class="field">
          <label>Observações</label>
          <textarea id="d-notes" ${canEdit?'':'disabled'}>${this.esc(apt.notes||'')}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        ${canEdit ? '<button class="btn btn-danger" id="d-delete"><i class="fas fa-trash"></i> Excluir</button>' : ''}
        <button class="btn btn-secondary modal-close">Fechar</button>
        ${canEdit ? '<button class="btn btn-primary" id="d-save">Salvar</button>' : ''}
      </div>
    `);

    document.getElementById('d-wpp')?.addEventListener('click', () => {
      const phone = document.getElementById('d-phone').value.replace(/\D/g,'');
      if (phone) {
        const name = document.getElementById('d-client').value;
        const msg = encodeURIComponent(`Olá ${name}! Sua consulta está confirmada. Até breve!`);
        window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
      }
    });

    document.getElementById('d-save')?.addEventListener('click', async () => {
      const updated = {
        ...apt,
        client: document.getElementById('d-client').value.trim(),
        phone:  document.getElementById('d-phone').value.replace(/\D/g,''),
        time:   document.getElementById('d-time').value,
        notes:  document.getElementById('d-notes').value.trim()
      };
      this.closeModal();
      this.toast('Salvando...', 'info');
      const r = await DB.update(updated);
      if (r.ok) { this.toast('Atualizado!', 'success'); this.render(); }
      else { this.toast('Erro: ' + r.err, 'error'); }
    });

    document.getElementById('d-delete')?.addEventListener('click', async () => {
      if (!confirm('Excluir este agendamento?')) return;
      this.closeModal();
      this.toast('Excluindo...', 'info');
      const r = await DB.remove(apt.id);
      if (r.ok) { this.toast('Excluído!', 'success'); this.render(); }
      else { this.toast('Erro: ' + r.err, 'error'); }
    });
  },

  /* ── Config modal ── */
  openConfig() {
    const lastSync = DB.lastSync ? DB.lastSync.toLocaleTimeString('pt-BR') : 'Nunca';
    const currentUrl = DB.url || '';
    const urlShort = currentUrl.length > 50 ? currentUrl.substring(0, 50) + '...' : currentUrl;

    this.openModal(`
      <div class="modal-head">
        <h3><i class="fas fa-cog"></i> Configurações</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="config-section">
          <h4><i class="fas fa-table"></i> Google Sheets</h4>
          
          <div class="config-status ok">
            <i class="fas fa-check-circle"></i>
            <div>
              <strong>Conectado</strong>
              <div style="font-size:.75rem;color:var(--text2);margin-top:2px">URL: ${urlShort}</div>
              <div style="font-size:.75rem;color:var(--text2);margin-top:2px">Última sync: ${lastSync}</div>
            </div>
          </div>

          <div style="margin-top:16px">
            <button class="btn btn-secondary" id="cfg-refresh" style="width:100%;margin-bottom:8px"><i class="fas fa-sync"></i> Atualizar Agora</button>
            <button class="btn btn-secondary" id="cfg-change-url" style="width:100%"><i class="fas fa-link"></i> Alterar URL</button>
          </div>
        </div>
      </div>
    `);

    // Refresh
    document.getElementById('cfg-refresh')?.addEventListener('click', async () => {
      await DB.refresh();
      this.toast('Atualizado!', 'success');
      this.closeModal();
      this.render();
    });

    // Change URL (requires password)
    document.getElementById('cfg-change-url')?.addEventListener('click', () => {
      this.closeModal();
      this.openConfigUrlChange();
    });
  },

  /* ── Config: alterar URL (protegido por senha) ── */
  openConfigUrlChange() {
    this.openModal(`
      <div class="modal-head">
        <h3><i class="fas fa-lock"></i> Alterar URL</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Senha de Administrador</label>
          <input type="password" id="cfg-pwd" placeholder="Digite a senha">
        </div>
        <div class="field">
          <label>Nova URL do Apps Script</label>
          <input type="url" id="cfg-new-url" placeholder="https://script.google.com/macros/s/...">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary modal-close">Cancelar</button>
        <button class="btn btn-primary" id="cfg-save-url">Salvar</button>
      </div>
    `);

    document.getElementById('cfg-save-url')?.addEventListener('click', async () => {
      const pwd = document.getElementById('cfg-pwd').value;
      const url = document.getElementById('cfg-new-url').value.trim();
      if (pwd !== CONFIG_PWD) { this.toast('Senha incorreta', 'error'); return; }
      if (!url) { this.toast('Cole a nova URL', 'error'); return; }
      const btn = document.getElementById('cfg-save-url');
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
      btn.disabled = true;
      DB.stopSync();
      const r = await DB.connect(url);
      if (r.ok) {
        this.toast('URL alterada com sucesso!', 'success');
        this.closeModal();
        this.render();
      } else {
        this.toast(r.err || 'Erro na conexão', 'error');
        btn.innerHTML = 'Salvar';
        btn.disabled = false;
      }
    });
  },

  /* ── Toast ── */
  toast(msg, type = 'info') {
    const wrap = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<i class="fas fa-${type==='success'?'check':type==='error'?'exclamation-triangle':'info-circle'}"></i>${msg}`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },

  /* ── Debug Console ── */
  log(msg, type = 'info') {
    const panel = document.getElementById('debug-log');
    if (!panel) return;
    const time = new Date().toLocaleTimeString('pt-BR');
    const colors = { info: '#6366f1', success: '#22c55e', error: '#ef4444', warn: '#f59e0b' };
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `<span style="color:var(--text2)">[${time}]</span> <span style="color:${colors[type]||colors.info}">${msg}</span>`;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  },

  toggleConsole() {
    const c = document.getElementById('debug-console');
    c.classList.toggle('hidden');
  },

  clearConsole() {
    document.getElementById('debug-log').innerHTML = '';
  },

  /* ── Helpers ── */
  fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },

  fmtDateDisplay(d) {
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  },

  fmtPhone(p) {
    if (!p) return '';
    p = p.replace(/\D/g,'');
    if (p.length === 11) return `(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`;
    if (p.length === 10) return `(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}`;
    return p;
  },

  esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
};

/* ── Start ── */
document.addEventListener('DOMContentLoaded', () => App.boot());
