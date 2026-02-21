/**
 * ========================================
 * AGENDA ÓTICA - GOOGLE APPS SCRIPT
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
 * 
 * A planilha será criada automaticamente com as colunas corretas!
 */

// Nome da aba na planilha
const SHEET_NAME = 'Agendamentos';

// Colunas da planilha
const COLUMNS = ['ID', 'Data', 'Hora', 'Cliente', 'Telefone', 'Loja', 'LojaID', 'Observações', 'CriadoEm'];

// Inicializar planilha se necessário
function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Adicionar cabeçalho
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Ajustar largura das colunas
    sheet.setColumnWidth(1, 50);  // ID
    sheet.setColumnWidth(2, 100); // Data
    sheet.setColumnWidth(3, 60);  // Hora
    sheet.setColumnWidth(4, 200); // Cliente
    sheet.setColumnWidth(5, 120); // Telefone
    sheet.setColumnWidth(6, 100); // Loja
    sheet.setColumnWidth(7, 50);  // LojaID
    sheet.setColumnWidth(8, 250); // Observações
    sheet.setColumnWidth(9, 150); // CriadoEm
  }
  
  return sheet;
}

// Processar requisições GET
function doGet(e) {
  const action = e.parameter.action || 'test';
  
  let result;
  
  try {
    switch(action) {
      case 'test':
        result = { success: true, message: 'Conexão OK!' };
        break;
        
      case 'list':
        result = listAppointments();
        break;
        
      default:
        result = { success: false, error: 'Ação desconhecida' };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  
  // Retornar com CORS headers
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Processar requisições POST
function doPost(e) {
  let result;
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch(action) {
      case 'create':
        result = createAppointment(data.appointment);
        break;
        
      case 'update':
        result = updateAppointment(data.id, data.appointment);
        break;
        
      case 'delete':
        result = deleteAppointment(data.id);
        break;
        
      case 'syncAll':
        result = syncAllAppointments(data.appointments);
        break;
        
      default:
        result = { success: false, error: 'Ação desconhecida: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  
  // Retornar com CORS headers
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Listar todos os agendamentos
function listAppointments() {
  const sheet = initSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: true, appointments: [] };
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  
  const appointments = data.map(row => ({
    id: row[0],
    date: row[1],
    time: row[2],
    clientName: row[3],
    clientPhone: row[4],
    storeName: row[5],
    storeId: row[6],
    notes: row[7],
    createdAt: row[8],
    companyId: 1
  })).filter(apt => apt.id); // Filtrar linhas vazias
  
  return { success: true, appointments: appointments };
}

// Criar agendamento
function createAppointment(apt) {
  const sheet = initSheet();
  
  // Gerar ID único
  const id = new Date().getTime();
  
  const row = [
    id,
    apt.date,
    apt.time,
    apt.clientName,
    apt.clientPhone,
    apt.storeName || 'Loja ' + apt.storeId,
    apt.storeId,
    apt.notes || '',
    new Date().toISOString()
  ];
  
  sheet.appendRow(row);
  
  return { success: true, id: id };
}

// Atualizar agendamento
function updateAppointment(id, apt) {
  const sheet = initSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      const row = i + 1;
      sheet.getRange(row, 2).setValue(apt.date);
      sheet.getRange(row, 3).setValue(apt.time);
      sheet.getRange(row, 4).setValue(apt.clientName);
      sheet.getRange(row, 5).setValue(apt.clientPhone);
      sheet.getRange(row, 6).setValue(apt.storeName || 'Loja ' + apt.storeId);
      sheet.getRange(row, 7).setValue(apt.storeId);
      sheet.getRange(row, 8).setValue(apt.notes || '');
      
      return { success: true };
    }
  }
  
  return { success: false, error: 'Agendamento não encontrado' };
}

// Deletar agendamento
function deleteAppointment(id) {
  const sheet = initSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { success: false, error: 'Agendamento não encontrado' };
}

// Sincronizar todos os agendamentos (substitui tudo)
function syncAllAppointments(appointments) {
  const sheet = initSheet();
  
  // Limpar dados existentes (manter cabeçalho)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  // Adicionar todos os agendamentos
  if (appointments && appointments.length > 0) {
    const rows = appointments.map(apt => [
      apt.id || new Date().getTime() + Math.random(),
      apt.date,
      apt.time,
      apt.clientName,
      apt.clientPhone,
      apt.storeName || 'Loja ' + apt.storeId,
      apt.storeId,
      apt.notes || '',
      apt.createdAt || new Date().toISOString()
    ]);
    
    sheet.getRange(2, 1, rows.length, COLUMNS.length).setValues(rows);
  }
  
  return { success: true, count: appointments ? appointments.length : 0 };
}
