

const APP_CONFIG = {
  SHEET_INVENTORY: "Inventory",
  SHEET_STOCKIN: "StockIn",
  SHEET_STOCKOUT: "StockOut",
  SHEET_USERS: "Users",
  APP_TITLE: "Rice Inventory System"
};

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_CONFIG)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let invSheet = ss.getSheetByName(APP_CONFIG.SHEET_INVENTORY) || ss.insertSheet(APP_CONFIG.SHEET_INVENTORY);
  invSheet.clearContents().clearFormats();
  invSheet.getRange(1, 1, 1, 6).setValues([["ID", "Rice Variety", "Category", "Quantity (kg)", "Unit Price (₱)", "Reorder Level"]]);
  
  let inSheet = ss.getSheetByName(APP_CONFIG.SHEET_STOCKIN) || ss.insertSheet(APP_CONFIG.SHEET_STOCKIN);
  inSheet.clearContents().clearFormats();
  inSheet.getRange(1, 1, 1, 7).setValues([["Date", "RefNo", "RiceID", "RiceName", "QtyIn", "Supplier", "User"]]);
  
  let outSheet = ss.getSheetByName(APP_CONFIG.SHEET_STOCKOUT) || ss.insertSheet(APP_CONFIG.SHEET_STOCKOUT);
  outSheet.clearContents().clearFormats();
  outSheet.getRange(1, 1, 1, 7).setValues([["Date", "RefNo", "RiceID", "RiceName", "QtyOut", "Total Amount", "User"]]);
  
  let userSheet = ss.getSheetByName(APP_CONFIG.SHEET_USERS) || ss.insertSheet(APP_CONFIG.SHEET_USERS);
  userSheet.clearContents().clearFormats();
  userSheet.getRange(1, 1, 1, 4).setValues([["Email", "PasswordHash", "Role", "Created"]]);
  
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ System Ready!");
  return { success: true };
}

function validateUser(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  email = email.toLowerCase().trim();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === password) {
      return { success: true, email: data[i][0], role: data[i][2] || "staff" };
    }
  }
  return { success: false, message: "Invalid email or password" };
}

function addUser(email, password, role = "staff") {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  sheet.appendRow([email.toLowerCase().trim(), password, role, new Date()]);
  return { success: true };
}

function getInventory() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
}

function addInventory(item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const id = "RICE-" + new Date().getTime();
  sheet.appendRow([id, item.name, item.category, Number(item.qty), Number(item.price), Number(item.reorder)]);
  return { success: true, id: id };
}

function updateInventory(id, item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 2, 1, 5).setValues([[item.name, item.category, Number(item.qty), Number(item.price), Number(item.reorder)]]);
      return { success: true };
    }
  }
  return { success: false };
}

function deleteInventory(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}

function stockIn(riceId, qty, supplier, user) {
  const invSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const inSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_STOCKIN);
  const qtyNum = Number(qty);
  const data = invSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === riceId) {
      const newQty = Number(data[i][3]) + qtyNum;
      invSheet.getRange(i + 1, 4).setValue(newQty);
      const refNo = "IN-" + new Date().getTime();
      inSheet.appendRow([new Date(), refNo, riceId, data[i][1], qtyNum, supplier, user]);
      return { success: true, refNo: refNo, newQty: newQty };
    }
  }
  return { success: false, message: "Rice item not found" };
}

function stockOut(riceId, qty, priceOverride, user) {
  const invSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const outSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_STOCKOUT);
  const qtyNum = Number(qty);
  const data = invSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === riceId) {
      const currentQty = Number(data[i][3]);
      const unitPrice = priceOverride ? Number(priceOverride) : Number(data[i][4]);
      if (currentQty < qtyNum) return { success: false, message: "Insufficient stock" };
      const newQty = currentQty - qtyNum;
      const total = qtyNum * unitPrice;
      invSheet.getRange(i + 1, 4).setValue(newQty);
      const refNo = "OUT-" + new Date().getTime();
      outSheet.appendRow([new Date(), refNo, riceId, data[i][1], qtyNum, total, user]);
      return { success: true, refNo: refNo, newQty: newQty, total: total };
    }
  }
  return { success: false, message: "Rice item not found" };
}

function getStockInRecords() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_STOCKIN);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
}

function getStockOutRecords() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_STOCKOUT);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
}
