/**
 * ========================================
 * AGENDA ÓTICA - GOOGLE APPS SCRIPT
 * VERSÃO 2.0 - PLANILHA COMO BANCO ÚNICO
 * ========================================
 * 
 * INSTRUÇÕES:
 * 1. Crie uma nova planilha no Google Sheets
 * 2. Vá em Extensões > Apps Script
 * 3. Apague todo o código e cole ESTE arquivo inteiro
 * 4. Salve (Ctrl+S)
 * 5. Clique em "Implantar" > "Nova implantação"
 * 6. Configure:
 *    - Tipo: "App da Web"
 *    - Executar como: "Eu"
 *    - Quem pode acessar: "Qualquer pessoa"
 * 7. Clique em "Implantar"
 * 8. Copie a URL gerada
 * 9. Cole a URL nas configurações do Agenda Ótica
 */

// ==================
// CONFIGURAÇÃO
// ==================

const SHEET_NAME = 'Agendamentos';
const COLUMNS = ['ID', 'Data', 'Hora', 'Cliente', 'Telefone', 'Loja', 'LojaID', 'Observacoes', 'CriadoEm'];

// ==================
// INICIALIZAÇÃO
// ==================

function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// ==================
// HANDLERS
// ==================

function doGet(e) {
  const action = e.parameter.action || 'test';
  let result;
  
  try {
    switch(action) {
      case 'test':
        initSheet();
        result = { success: true, message: 'Conexão OK!' };
        break;
        
      case 'list':
        result = listAll();
        break;
        
      default:
        result = { success: false, error: 'Ação desconhecida: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result;
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Verificar se tem action no body ou no query
    const action = data.action || e.parameter.action;
    
    if (!action) {
      // Se não tem action, assumir que é um create com os dados direto
      result = createAppointment(data);
    } else {
      switch(action) {
        case 'create':
          result = createAppointment(data.appointment || data);
          break;
          
        case 'update':
          result = updateAppointment(data);
          break;
          
        case 'delete':
          result = deleteAppointment(data.id);
          break;
          
        case 'clear':
          result = clearAll();
          break;
          
        default:
          result = { success: false, error: 'Ação desconhecida: ' + action };
      }
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================
// CRUD
// ==================

// LISTAR TODOS
function listAll() {
  const sheet = initSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: true, appointments: [] };
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  
  const appointments = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    // Pular linhas vazias
    if (!row[0]) continue;
    
    appointments.push({
      id: row[0],
      date: formatDate(row[1]),
      time: formatTime(row[2]),
      clientName: String(row[3] || ''),
      clientPhone: String(row[4] || ''),
      storeName: String(row[5] || ''),
      storeId: parseInt(row[6]) || 1,
      notes: String(row[7] || ''),
      createdAt: String(row[8] || ''),
      companyId: 1
    });
  }
  
  return { success: true, appointments: appointments };
}

// CRIAR
function createAppointment(apt) {
  if (!apt) {
    return { success: false, error: 'Dados não fornecidos' };
  }
  
  const sheet = initSheet();
  
  const row = [
    apt.id || Date.now(),
    apt.date || '',
    apt.time || '',
    apt.clientName || '',
    apt.clientPhone || '',
    apt.storeName || 'Loja 1',
    apt.storeId || 1,
    apt.notes || '',
    apt.createdAt || new Date().toISOString()
  ];
  
  sheet.appendRow(row);
  
  return { success: true, id: row[0] };
}

// ATUALIZAR
function updateAppointment(apt) {
  if (!apt || !apt.id) {
    return { success: false, error: 'ID não fornecido' };
  }
  
  const sheet = initSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: false, error: 'Nenhum agendamento encontrado' };
  }
  
  // Buscar linha pelo ID
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let rowIndex = -1;
  
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(apt.id)) {
      rowIndex = i + 2; // +2 porque começa na linha 2
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'Agendamento não encontrado' };
  }
  
  // Atualizar linha
  const row = [
    apt.id,
    apt.date || '',
    apt.time || '',
    apt.clientName || '',
    apt.clientPhone || '',
    apt.storeName || '',
    apt.storeId || 1,
    apt.notes || '',
    apt.createdAt || ''
  ];
  
  sheet.getRange(rowIndex, 1, 1, COLUMNS.length).setValues([row]);
  
  return { success: true };
}

// DELETAR
function deleteAppointment(id) {
  if (!id) {
    return { success: false, error: 'ID não fornecido' };
  }
  
  const sheet = initSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: false, error: 'Nenhum agendamento encontrado' };
  }
  
  // Buscar linha pelo ID
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { success: true };
    }
  }
  
  return { success: false, error: 'Agendamento não encontrado' };
}

// LIMPAR TUDO
function clearAll() {
  const sheet = initSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  return { success: true };
}

// ==================
// HELPERS
// ==================

function formatDate(value) {
  if (!value) return '';
  
  // Se já é string no formato correto
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return value;
    }
    // Tentar converter
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
    return value;
  }
  
  // Se é objeto Date
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return String(value);
}

function formatTime(value) {
  if (!value) return '';
  
  // Se já é string no formato HH:MM
  if (typeof value === 'string') {
    if (value.match(/^\d{2}:\d{2}$/)) {
      return value;
    }
    // Tentar extrair hora
    const match = value.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return String(match[1]).padStart(2, '0') + ':' + match[2];
    }
    return value;
  }
  
  // Se é objeto Date
  if (value instanceof Date) {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  return String(value);
}

// ==================
// TESTE
// ==================

function testScript() {
  Logger.log('Testando script...');
  
  const sheet = initSheet();
  Logger.log('Planilha: ' + sheet.getName());
  
  const result = listAll();
  Logger.log('Agendamentos: ' + result.appointments.length);
  
  Logger.log('Script OK!');
}
