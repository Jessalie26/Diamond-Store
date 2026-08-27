const APP_CONFIG = {
  SHEET_INVENTORY: "Inventory",
  SHEET_STOCKIN: "StockIn",
  SHEET_STOCKOUT: "StockOut",
  SHEET_USERS: "Users",
  APP_TITLE: "Diamond Store"
};

// ========== SERVE THE WEB APP ==========
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_CONFIG)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ========== INITIALIZE SHEETS (RUN ONCE MANUALLY) ==========
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Inventory Sheet
  let invSheet = ss.getSheetByName(APP_CONFIG.SHEET_INVENTORY) || ss.insertSheet(APP_CONFIG.SHEET_INVENTORY);
  invSheet.clearContents().clearFormats();
  invSheet.getRange(1, 1, 1, 6).setValues([["ID", "Item Name", "Category", "Quantity (kg)", "Unit Price (₱)", "Reorder Level"]]);
  
  // Create Stock-In Sheet
  let inSheet = ss.getSheetByName(APP_CONFIG.SHEET_STOCKIN) || ss.insertSheet(APP_CONFIG.SHEET_STOCKIN);
  inSheet.clearContents().clearFormats();
  inSheet.getRange(1, 1, 1, 7).setValues([["Date", "RefNo", "ItemID", "ItemName", "QtyIn", "Supplier", "User"]]);
  
  // Create Stock-Out Sheet
  let outSheet = ss.getSheetByName(APP_CONFIG.SHEET_STOCKOUT) || ss.insertSheet(APP_CONFIG.SHEET_STOCKOUT);
  outSheet.clearContents().clearFormats();
  outSheet.getRange(1, 1, 1, 7).setValues([["Date", "RefNo", "ItemID", "ItemName", "QtyOut", "Total Amount", "User"]]);
  
  // Create Users Sheet (with Reset Code column)
  let userSheet = ss.getSheetByName(APP_CONFIG.SHEET_USERS) || ss.insertSheet(APP_CONFIG.SHEET_USERS);
  userSheet.clearContents().clearFormats();
  userSheet.getRange(1, 1, 1, 5).setValues([["Email", "PasswordHash", "Role", "Created", "ResetCode"]]);
  
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ System Ready!");
  return { success: true };
}

// ========== LOGIN / AUTHENTICATION ==========
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

// ========== CREATE NEW ACCOUNT (PUBLIC) ==========
function createAccount(email, password, name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  email = email.toLowerCase().trim();
  
  // Check if email already exists
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return { success: false, message: "Email already registered!" };
    }
  }
  
  // First user = Admin, others = Staff
  const role = data.length <= 1 ? "admin" : "staff";
  sheet.appendRow([email, password, role, new Date(), ""]);
  return { success: true, role: role, message: "Account created successfully! You can now login." };
}

// ========== FORGOT PASSWORD — SEND RESET CODE ==========
function sendResetCode(email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  email = email.toLowerCase().trim();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      // Generate 6-digit reset code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const rowNum = i + 1;
      sheet.getRange(rowNum, 5).setValue(code); // Save code in column E
      
      // Send email with reset code
      try {
        GmailApp.sendEmail(email, "🔑 Diamond Store — Password Reset Code", 
          `Hello,\n\nYou requested to reset your password for Diamond Store.\n\nYour reset code is: ${code}\n\nEnter this code in the app to set a new password.\n\nIf you did not request this, please ignore this email.\n\n— Diamond Store System`
        );
        return { success: true, message: "Reset code sent to your email!" };
      } catch (e) {
        return { success: false, message: "Email sent failed. Check email address." };
      }
    }
  }
  return { success: false, message: "Email not found in our records." };
}

// ========== RESET PASSWORD USING CODE ==========
function resetPasswordWithCode(email, code, newPassword) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  email = email.toLowerCase().trim();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][4] === code) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(newPassword);      // Update password
      sheet.getRange(rowNum, 5).setValue("");                // Clear reset code
      return { success: true, message: "Password reset successful! Please login." };
    }
  }
  return { success: false, message: "Invalid or expired reset code." };
}

// ========== ADD USER (Admin only) ==========
function addUser(email, password, role = "staff") {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  sheet.appendRow([email.toLowerCase().trim(), password, role, new Date(), ""]);
  return { success: true };
}

// ========== INVENTORY CRUD OPERATIONS ==========
function getInventory() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
}

function addInventory(item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const id = "ITEM-" + new Date().getTime();
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

// ========== STOCK-IN (PURCHASE) ==========
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
  return { success: false, message: "Item not found" };
}

// ========== STOCK-OUT (SALE) ==========
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
  return { success: false, message: "Item not found" };
}

// ========== GET RECORDS FOR REPORTS ==========
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
