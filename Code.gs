const APP_CONFIG = {
  SHEET_INVENTORY: "Inventory",
  SHEET_STOCKIN: "StockIn",
  SHEET_STOCKOUT: "StockOut",
  SHEET_USERS: "Users",
  APP_TITLE: "Diamond Store"
};

// ==========================================
// SERVE WEB APP
// ==========================================
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_CONFIG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ==========================================
// FEATURE 0: INITIALIZE DATABASE TABLES
// ==========================================
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Inventory Table
  let invSheet = ss.getSheetByName(APP_CONFIG.SHEET_INVENTORY) || ss.insertSheet(APP_CONFIG.SHEET_INVENTORY);
  invSheet.clearContents().clearFormats();
  invSheet.getRange(1, 1, 1, 6).setValues([["ID", "RiceName", "Category", "QuantityKG", "PricePerKG", "ReorderLevelKG"]]);
  
  // Stock-In Table
  let inSheet = ss.getSheetByName(APP_CONFIG.SHEET_STOCKIN) || ss.insertSheet(APP_CONFIG.SHEET_STOCKIN);
  inSheet.clearContents().clearFormats();
  inSheet.getRange(1, 1, 1, 7).setValues([["Date", "RefNo", "RiceID", "RiceName", "QtyInKG", "Supplier", "UserEmail"]]);
  
  // Stock-Out Table
  let outSheet = ss.getSheetByName(APP_CONFIG.SHEET_STOCKOUT) || ss.insertSheet(APP_CONFIG.SHEET_STOCKOUT);
  outSheet.clearContents().clearFormats();
  outSheet.getRange(1, 1, 1, 7).setValues([["Date", "RefNo", "RiceID", "RiceName", "QtyOutKG", "TotalAmount", "UserEmail"]]);
  
  // Users Table (with Reset Code column)
  let userSheet = ss.getSheetByName(APP_CONFIG.SHEET_USERS) || ss.insertSheet(APP_CONFIG.SHEET_USERS);
  userSheet.clearContents().clearFormats();
  userSheet.getRange(1, 1, 1, 5).setValues([["Email", "Password", "Role", "CreatedDate", "ResetCode"]]);
  
  SpreadsheetApp.getActiveSpreadsheet().toast("✅ System Ready!");
  return { success: true };
}

// ==========================================
// FEATURE 1: 🔐 LOGIN / AUTHENTICATION
// ==========================================
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

// ==========================================
// FEATURE 1A: ✍️ CREATE NEW ACCOUNT (PUBLIC)
// ==========================================
function createAccount(email, password, fullName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  email = email.toLowerCase().trim();
  
  // Check if email already exists
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return { success: false, message: "Email already registered!" };
    }
  }
  
  // First account = Admin, others = Staff
  const role = data.length <= 1 ? "admin" : "staff";
  sheet.appendRow([email, password, role, new Date(), ""]);
  return { success: true, role: role, message: "Account created successfully! You can now login." };
}

// ==========================================
// FEATURE 1B: 🔑 FORGOT PASSWORD — SEND CODE
// ==========================================
function sendResetCode(email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  email = email.toLowerCase().trim();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      sheet.getRange(i + 1, 5).setValue(code);
      
      try {
        GmailApp.sendEmail(email, "🔑 Diamond Store — Password Reset",
          `Hello,\n\nYou requested to reset your password for Diamond Store Rice Inventory System.\n\nYour 6-digit reset code is: ${code}\n\nEnter this code in the app to create a new password.\n\n— Diamond Store System`
        );
        return { success: true, message: "Reset code sent to your email!" };
      } catch (e) {
        return { success: false, message: "Failed to send email. Check your email address." };
      }
    }
  }
  return { success: false, message: "Email not found in our records." };
}

// ==========================================
// FEATURE 1C: 🔑 RESET PASSWORD WITH CODE
// ==========================================
function resetPasswordWithCode(email, code, newPassword) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  email = email.toLowerCase().trim();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][4] === code) {
      sheet.getRange(i + 1, 2).setValue(newPassword);
      sheet.getRange(i + 1, 5).setValue("");
      return { success: true, message: "Password reset successful! Please login." };
    }
  }
  return { success: false, message: "Invalid or expired reset code." };
}

// ==========================================
// FEATURE 3: 📦 INVENTORY MANAGEMENT
// ==========================================
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

// ==========================================
// FEATURE 4: 📥 STOCK-IN / PURCHASES
// ==========================================
function stockIn(riceId, qtyKG, supplier, userEmail) {
  const invSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const inSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_STOCKIN);
  const data = invSheet.getDataRange().getValues();
  const qty = Number(qtyKG);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === riceId) {
      const newQty = Number(data[i][3]) + qty;
      invSheet.getRange(i + 1, 4).setValue(newQty);
      const refNo = "IN-" + new Date().getTime();
      inSheet.appendRow([new Date(), refNo, riceId, data[i][1], qty, supplier, userEmail]);
      return { success: true, refNo: refNo, newQty: newQty };
    }
  }
  return { success: false, message: "Rice variety not found." };
}

// ==========================================
// FEATURE 5: 📤 STOCK-OUT / SALES
// ==========================================
function stockOut(riceId, qtyKG, priceOverride, userEmail) {
  const invSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_INVENTORY);
  const outSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_STOCKOUT);
  const data = invSheet.getDataRange().getValues();
  const qty = Number(qtyKG);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === riceId) {
      const currentQty = Number(data[i][3]);
      const pricePerKG = priceOverride ? Number(priceOverride) : Number(data[i][4]);
      
      if (currentQty < qty) {
        return { success: false, message: "Insufficient stock available!" };
      }
      
      const newQty = currentQty - qty;
      const totalAmount = qty * pricePerKG;
      invSheet.getRange(i + 1, 4).setValue(newQty);
      const refNo = "OUT-" + new Date().getTime();
      outSheet.appendRow([new Date(), refNo, riceId, data[i][1], qty, totalAmount, userEmail]);
      return { success: true, refNo: refNo, newQty: newQty, total: totalAmount };
    }
  }
  return { success: false, message: "Rice variety not found." };
}

// ==========================================
// FEATURE 6: 📈 REPORTS & HISTORY
// ==========================================
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

// ==========================================
// FEATURE 7: ⚙️ SETTINGS — ADD USER
// ==========================================
function addUser(email, password, role = "staff") {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SHEET_USERS);
  sheet.appendRow([email.toLowerCase().trim(), password, role, new Date(), ""]);
  return { success: true, message: "User added successfully!" };
}
