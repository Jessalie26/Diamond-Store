// ============================================================
// DIAMOND STORE POS & INVENTORY SYSTEM
// GOOGLE APPS SCRIPT BACKEND
// DATABASE = EXISTING GOOGLE SHEET
// ============================================================

const STORE = {
  INVENTORY:      "Inventory",
  SALES:          "Sales",
  SALE_ITEMS:     "SaleItems",
  SUPPLIERS:      "Suppliers",
  SHIPMENTS:      "Shipments",
  SPOILAGE:       "Spoilage",
  SHIFTS:         "Shifts",
  LOGS:           "Logs",
  USERS:          "Users",
  LOGIN_ATTEMPTS: "LoginAttempts",   // brute-force tracking
  SACK_KG:        50
};

// Brute-force settings
const MAX_ATTEMPTS    = 5;           // lock after this many failures
const LOCKOUT_MINUTES = 15;          // lockout duration in minutes

// ============================================================
// WEB APP — GET
// ============================================================
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action)
      ? e.parameter.action
      : "health";

    switch (action) {
      case "health":
        return response({ success: true, message: "DIAMOND STORE API is running." });
      case "inventory":
        return response({ success: true, inventory: getInventory() });
      case "analytics":
        return response({ success: true, analytics: getAnalytics() });
      case "suppliers":
        return response({ success: true, suppliers: getSuppliers() });
      case "report":
        return response({ success: true, rows: getSalesReport() });
      default:
        return response({ success: false, message: "Unknown action." });
    }
  } catch (error) {
    return response({ success: false, message: error.message });
  }
}

// ============================================================
// WEB APP — POST
// ============================================================
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents || "{}");
    const action = data.action;

    switch (action) {
      case "login":          return response(login(data));
      case "createSale":     return response(createSale(data));
      case "updateInventory":return response(updateInventory(data));
      case "addInventory":   return response(addInventory(data));
      case "startShift":     return response(startShift(data));
      case "shiftSummary":   return response(getShiftSummary(data));
      case "closeShift":     return response(closeShift(data));
      case "addSupplier":    return response(addSupplier(data));
      case "saveShipment":   return response(saveShipment(data));
      case "recordSpoilage": return response(recordSpoilage(data));
      default:
        return response({ success: false, message: "Unknown action: " + action });
    }
  } catch (error) {
    return response({ success: false, message: error.message });
  }
}

// ============================================================
// RESPONSE HELPER
// ============================================================
function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SHEET HELPERS
// ============================================================
function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Sheet not found: " + name);
  return sheet;
}

function getRows(name) {
  const sheet  = getSheet(name);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(function(h) { return String(h).trim(); });

  return values.slice(1)
    .filter(function(row) {
      return row.some(function(cell) { return String(cell).trim() !== ""; });
    })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(header, index) { obj[header] = row[index]; });
      return obj;
    });
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(headers, names) {
  const normalizedHeaders = headers.map(normalize);
  for (let i = 0; i < names.length; i++) {
    const wanted = normalize(names[i]);
    const index  = normalizedHeaders.indexOf(wanted);
    if (index >= 0) return index;
  }
  return -1;
}

function generateId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

// ============================================================
// FEATURE 1 — LOGIN  (with brute-force lockout)
// ============================================================
function login(data) {
  const loginValue    = String(data.username || "").trim();
  const password      = String(data.password || "");
  const requestedRole = String(data.role     || "").trim().toLowerCase();

  if (!loginValue || !password || !requestedRole) {
    return { success: false, message: "User ID/Username, password and role are required." };
  }

  // ── 1. BRUTE-FORCE CHECK ──────────────────────────────────
  const lockStatus = checkLockout(loginValue);
  if (lockStatus.locked) {
    writeLog(loginValue, "", requestedRole, "LOGIN BLOCKED",
      "Account locked. " + lockStatus.minutesLeft + " min remaining.");
    return {
      success: false,
      message: "Account temporarily locked due to too many failed attempts. " +
               "Try again in " + lockStatus.minutesLeft + " minute(s)."
    };
  }

  // ── 2. LOOK UP USER ───────────────────────────────────────
  const sheet  = getSheet(STORE.USERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { success: false, message: "No user accounts found." };
  }

  const headers       = values[0].map(function(h) { return String(h).trim(); });
  const idIndex       = findColumn(headers, ["UserID","ID","UserId"]);
  const usernameIndex = findColumn(headers, ["Username","UserName","LoginUsername"]);
  const passwordIndex = findColumn(headers, ["PasswordHash","Password","password"]);
  const nameIndex     = findColumn(headers, ["FullName","Name"]);
  const roleIndex     = findColumn(headers, ["Role"]);
  const statusIndex   = findColumn(headers, ["Status","AccountStatus"]);

  for (let r = 1; r < values.length; r++) {
    const row            = values[r];
    const userId         = idIndex       >= 0 ? String(row[idIndex]       || "").trim() : "";
    const username       = usernameIndex >= 0 ? String(row[usernameIndex] || "").trim() : "";
    const storedPassword = passwordIndex >= 0 ? String(row[passwordIndex] || "")        : "";
    const fullName       = nameIndex     >= 0 ? String(row[nameIndex]     || "")        : username;
    const role           = roleIndex     >= 0 ? String(row[roleIndex]     || "").trim() : "";
    const status         = statusIndex   >= 0 ? String(row[statusIndex]   || "Active").trim() : "Active";

    const loginMatch    = userId.toLowerCase()   === loginValue.toLowerCase()
                       || username.toLowerCase() === loginValue.toLowerCase();
    const passwordMatch = storedPassword === password
                       || storedPassword === hashPassword(password);
    const roleMatch     = role.toLowerCase() === requestedRole;
    const active        = status.toLowerCase() !== "inactive";

    if (loginMatch && passwordMatch && roleMatch && active) {
      // ── SUCCESS: clear failed attempts ───────────────────
      clearAttempts(loginValue);
      writeLog(userId, fullName, role, "LOGIN", "Successful login");
      return {
        success: true,
        message: "Login successful.",
        user: { userId, username, fullName, role }
      };
    }

    // Username matched but credentials wrong — record failure
    if (loginMatch) {
      const attempts = recordFailedAttempt(loginValue);
      const remaining = MAX_ATTEMPTS - attempts;

      writeLog(userId || loginValue, fullName || loginValue, role || requestedRole,
        "LOGIN FAILED",
        "Failed attempt " + attempts + "/" + MAX_ATTEMPTS);

      if (attempts >= MAX_ATTEMPTS) {
        return {
          success: false,
          message: "Too many failed attempts. Account locked for " + LOCKOUT_MINUTES + " minutes."
        };
      }
      return {
        success: false,
        message: "Invalid credentials. " + remaining + " attempt(s) remaining."
      };
    }
  }

  // Username not found at all — still record attempt to prevent enumeration
  recordFailedAttempt(loginValue);
  return { success: false, message: "Invalid User ID/Username, password or role." };
}

// ============================================================
// PASSWORD HASH (SHA-256)
// ============================================================
function hashPassword(password) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );
  return digest.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

// ============================================================
// BRUTE-FORCE HELPERS
// Uses a "LoginAttempts" sheet with columns:
//   Username | FailCount | LastAttempt | LockedUntil
// ============================================================

function getAttemptsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STORE.LOGIN_ATTEMPTS);
  if (!sheet) {
    // Auto-create the sheet if missing
    sheet = ss.insertSheet(STORE.LOGIN_ATTEMPTS);
    sheet.appendRow(["Username", "FailCount", "LastAttempt", "LockedUntil"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findAttemptRow(sheet, username) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === username.toLowerCase()) {
      return { rowIndex: i + 1, data: values[i] };   // rowIndex is 1-based
    }
  }
  return null;
}

function checkLockout(username) {
  const sheet  = getAttemptsSheet();
  const found  = findAttemptRow(sheet, username);
  if (!found) { return { locked: false }; }

  const lockedUntil = found.data[3] ? new Date(found.data[3]) : null;
  if (lockedUntil && new Date() < lockedUntil) {
    const msLeft      = lockedUntil - new Date();
    const minutesLeft = Math.ceil(msLeft / 60000);
    return { locked: true, minutesLeft: minutesLeft };
  }
  return { locked: false };
}

function recordFailedAttempt(username) {
  const sheet = getAttemptsSheet();
  const found = findAttemptRow(sheet, username);
  const now   = new Date();

  if (found) {
    const currentCount = Number(found.data[1]) || 0;
    const newCount     = currentCount + 1;
    const lockedUntil  = newCount >= MAX_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_MINUTES * 60000)
      : "";

    sheet.getRange(found.rowIndex, 2).setValue(newCount);
    sheet.getRange(found.rowIndex, 3).setValue(now);
    sheet.getRange(found.rowIndex, 4).setValue(lockedUntil);
    return newCount;
  } else {
    // First failure for this username
    sheet.appendRow([username, 1, now, ""]);
    return 1;
  }
}

function clearAttempts(username) {
  const sheet = getAttemptsSheet();
  const found = findAttemptRow(sheet, username);
  if (found) {
    sheet.getRange(found.rowIndex, 2).setValue(0);
    sheet.getRange(found.rowIndex, 4).setValue("");
  }
}

// ============================================================
// FEATURE 3 — GET INVENTORY
// ============================================================
function getInventory() {
  const sheet  = getSheet(STORE.INVENTORY);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  // Column positions (A=0 … I=8)
  // A=InventoryID  B=RiceType  C=QuantitySacks  D=LooseKg
  // E=PricePerKg   F=PricePerSack  G=CostPerKg  H=Status  I=UpdatedAt
  return values.slice(1)
    .filter(function(row) { return String(row[0] || "").trim() !== ""; })
    .map(function(row) {
      const sacks    = Number(row[2]) || 0;
      const looseKg  = Number(row[3]) || 0;
      const totalKg  = (sacks * STORE.SACK_KG) + looseKg;
      const price    = Number(row[4]) || 0;
      const cost     = Number(row[6]) || 0;
      const lowLevel = Number(row[6]) || 10;

      return {
        inventoryId:   row[0],
        riceType:      row[1],
        quantitySacks: sacks,
        looseKg:       looseKg,
        totalKg:       totalKg,
        pricePerKg:    price,
        pricePerSack:  Number(row[5]) || 0,
        costPerKg:     cost,
        lowStockLevel: lowLevel,
        lowStock:      totalKg <= lowLevel,
        status:        row[7] || "Active"
      };
    });
}

// ============================================================
// ADD NEW RICE TYPE (Admin only)
// ============================================================
function addInventory(data) {
  if (String(data.role || "").toLowerCase() !== "admin") {
    return { success: false, message: "Only Admin can add inventory." };
  }

  const riceType = String(data.riceType || "").trim();
  if (!riceType) {
    return { success: false, message: "Rice type name is required." };
  }

  // Prevent duplicate rice types
  const sheet  = getSheet(STORE.INVENTORY);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === riceType.toLowerCase()) {
      return { success: false, message: riceType + " already exists in inventory." };
    }
  }

  const inventoryId  = generateId("INV");
  const sacks        = Number(data.quantitySacks) || 0;
  const looseKg      = Number(data.looseKg)       || 0;
  const pricePerKg   = Number(data.pricePerKg)    || 0;
  const pricePerSack = Number(data.pricePerSack)  || 0;
  const costPerKg    = Number(data.costPerKg)     || 0;

  // Append row matching column order:
  // A=InventoryID  B=RiceType  C=QuantitySacks  D=LooseKg
  // E=PricePerKg   F=PricePerSack  G=CostPerKg  H=Status  I=UpdatedAt
  sheet.appendRow([
    inventoryId,
    riceType,
    sacks,
    looseKg,
    pricePerKg,
    pricePerSack,
    costPerKg,
    "Active",
    new Date()
  ]);

  writeLog(
    data.userId   || "",
    data.userName || "",
    data.role     || "",
    "ADD INVENTORY",
    riceType
  );

  return {
    success:     true,
    message:     riceType + " added to inventory.",
    inventoryId: inventoryId
  };
}

// ============================================================
// UPDATE EXISTING INVENTORY (Admin only)
// ============================================================
function updateInventory(data) {
  if (String(data.role || "").toLowerCase() !== "admin") {
    return { success: false, message: "Only Admin can update inventory." };
  }

  const sheet  = getSheet(STORE.INVENTORY);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(data.inventoryId)) {
      sheet.getRange(i + 1, 2).setValue(data.riceType);
      sheet.getRange(i + 1, 3).setValue(Number(data.quantitySacks) || 0);
      sheet.getRange(i + 1, 4).setValue(Number(data.looseKg)       || 0);
      sheet.getRange(i + 1, 5).setValue(Number(data.pricePerKg)    || 0);
      sheet.getRange(i + 1, 9).setValue(new Date());
      writeLog(data.userId, data.userName, data.role, "UPDATE INVENTORY", String(data.riceType));
      return { success: true, message: "Inventory updated successfully." };
    }
  }

  return { success: false, message: "Inventory item not found." };
}

// ============================================================
// FEATURE 2 — POS SALE
// ============================================================
function createSale(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) return { success: false, message: "Cart is empty." };

  const cash = Number(data.cashReceived);
  if (isNaN(cash) || cash < 0) return { success: false, message: "Invalid cash amount." };

  const currentInventory = getInventory();
  let total = 0;
  const verifiedItems = [];

  items.forEach(function(item) {
    const stock = currentInventory.find(function(inv) {
      return String(inv.inventoryId) === String(item.inventoryId);
    });
    if (!stock) throw new Error("Rice item not found.");

    const quantity = Number(item.quantityKg);
    if (isNaN(quantity) || quantity <= 0) throw new Error("Invalid quantity.");
    if (quantity > stock.totalKg) throw new Error(stock.riceType + " has only " + stock.totalKg + " kg available.");

    const price    = Number(stock.pricePerKg) || 0;
    const cost     = Number(stock.costPerKg)  || 0;
    const subtotal = quantity * price;
    total += subtotal;

    verifiedItems.push({
      inventoryId: stock.inventoryId,
      riceType:    stock.riceType,
      quantityKg:  quantity,
      pricePerKg:  price,
      costPerKg:   cost,
      subtotal:    subtotal,
      profit:      quantity * (price - cost)
    });
  });

  if (cash < total) return { success: false, message: "Insufficient cash." };

  const change            = cash - total;
  const saleId            = generateId("SALE");
  const transactionNumber = "TXN-"
    + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss")
    + "-" + Math.floor(Math.random() * 1000);

  appendSale(saleId, transactionNumber, data, total, cash, change);
  verifiedItems.forEach(function(item) {
    appendSaleItem(saleId, item);
    deductInventory(item.inventoryId, item.quantityKg);
  });

  writeLog(
    data.cashier?.userId   || "",
    data.cashier?.fullName || "",
    data.cashier?.role     || "",
    "COMPLETE SALE",
    transactionNumber
  );

  return {
    success: true,
    message: "Sale completed successfully.",
    sale: { saleId, transactionNumber, totalAmount: total, cashReceived: cash, changeAmount: change }
  };
}

// ============================================================
// SAVE SALE ROW
// ============================================================
function appendSale(saleId, transactionNumber, data, total, cash, change) {
  const sheet   = getSheet(STORE.SALES);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(function(header) {
    const h = normalize(header);
    if (h === "saleid")            return saleId;
    if (h === "transactionnumber") return transactionNumber;
    if (h === "cashierid")         return (data.cashier?.userId   || "");
    if (h === "cashiername")       return (data.cashier?.fullName || "");
    if (h === "role")              return (data.cashier?.role     || "");
    if (h === "totalamount")       return total;
    if (h === "cashreceived")      return cash;
    if (h === "changeamount")      return change;
    if (h === "saledate")          return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (h === "saletime")          return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm:ss");
    if (h === "status")            return "Completed";
    return "";
  });

  sheet.appendRow(row);
}

// ============================================================
// SAVE SALE ITEM ROW
// ============================================================
function appendSaleItem(saleId, item) {
  const sheet   = getSheet(STORE.SALE_ITEMS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(function(header) {
    const h = normalize(header);
    if (h === "saleitemid") return generateId("ITEM");
    if (h === "saleid")     return saleId;
    if (h === "ricetype")   return item.riceType;
    if (h === "quantitykg") return item.quantityKg;
    if (h === "priceperkg") return item.pricePerKg;
    if (h === "costperkg")  return item.costPerKg;
    if (h === "subtotal")   return item.subtotal;
    return "";
  });

  sheet.appendRow(row);
}

// ============================================================
// DEDUCT INVENTORY STOCK
// ============================================================
function deductInventory(inventoryId, quantityKg) {
  const sheet  = getSheet(STORE.INVENTORY);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(inventoryId)) {
      const sacks  = Number(values[i][2]) || 0;
      const loose  = Number(values[i][3]) || 0;
      let   totalKg = sacks * STORE.SACK_KG + loose;
      totalKg -= Number(quantityKg);
      if (totalKg < 0) throw new Error("Insufficient stock.");

      const newSacks = Math.floor(totalKg / STORE.SACK_KG);
      const newLoose = totalKg % STORE.SACK_KG;

      sheet.getRange(i + 1, 3).setValue(newSacks);
      sheet.getRange(i + 1, 4).setValue(newLoose);
      sheet.getRange(i + 1, 9).setValue(new Date());
      return;
    }
  }
}

// ============================================================
// FEATURE 4 — SHIFT
// ============================================================
function startShift(data) {
  const sheet   = getSheet(STORE.SHIFTS);
  const shiftId = generateId("SHIFT");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now     = new Date();

  const row = headers.map(function(header) {
    const h = normalize(header);
    if (h === "shiftid")                      return shiftId;
    if (h === "cashierid")                    return data.cashierId;
    if (h === "cashiername")                  return data.cashierName;
    if (h === "openingcash")                  return Number(data.openingCash) || 0;
    if (h === "closigncash" || h === "closingcash") return 0;
    if (h === "totalsales")                   return 0;
    if (h === "starttime" || h === "startdate") return now;
    if (h === "status")                       return "OPEN";
    return "";
  });

  sheet.appendRow(row);
  return { success: true, shiftId: shiftId };
}

function getShiftSummary(data) {
  const shifts = getRows(STORE.SHIFTS);
  let shift = null;

  if (data.shiftId) {
    shift = shifts.find(function(s) { return String(s.ShiftID) === String(data.shiftId); });
  } else {
    shift = shifts.reverse().find(function(s) {
      return String(s.Status || "").toUpperCase() === "OPEN";
    });
  }

  if (!shift) return { success: true, shift: null, transactions: [] };

  const sales        = getRows(STORE.SALES);
  const transactions = sales.filter(function(s) {
    return String(s.CashierID || "") === String(shift.CashierID || "");
  });

  let totalSales = 0;
  transactions.forEach(function(s) { totalSales += Number(s.TotalAmount || 0); });

  return {
    success: true,
    shift: {
      cashierName: shift.CashierName,
      openingCash: Number(shift.OpeningCash || 0),
      totalSales:  totalSales,
      status:      shift.Status,
      shiftId:     shift.ShiftID
    },
    transactions: transactions.map(function(s) {
      return { transactionNumber: s.TransactionNumber, totalAmount: Number(s.TotalAmount || 0) };
    })
  };
}

function closeShift(data) {
  const sheet    = getSheet(STORE.SHIFTS);
  const values   = sheet.getDataRange().getValues();
  const headers  = values[0].map(normalize);

  const shiftIndex   = headers.indexOf("shiftid");
  const statusIndex  = headers.indexOf("status");
  const closingIndex = headers.indexOf("closingcash");
  const totalIndex   = headers.indexOf("totalsales");
  const endTimeIndex = headers.indexOf("endtime");

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][shiftIndex]) !== String(data.shiftId)) continue;

    const cashierId = values[i][headers.indexOf("cashierid")];
    const sales     = getRows(STORE.SALES);
    const totalSales = sales
      .filter(function(s) { return String(s.CashierID) === String(cashierId); })
      .reduce(function(sum, s) { return sum + Number(s.TotalAmount || 0); }, 0);

    if (closingIndex >= 0) sheet.getRange(i + 1, closingIndex + 1).setValue(Number(data.closingCash) || 0);
    if (totalIndex   >= 0) sheet.getRange(i + 1, totalIndex   + 1).setValue(totalSales);
    if (endTimeIndex >= 0) sheet.getRange(i + 1, endTimeIndex + 1).setValue(new Date());
    if (statusIndex  >= 0) sheet.getRange(i + 1, statusIndex  + 1).setValue("CLOSED");

    return { success: true, totalSales: totalSales, closingCash: Number(data.closingCash) || 0 };
  }

  return { success: false, message: "Shift not found." };
}

// ============================================================
// FEATURE 5 — SUPPLIERS & SHIPMENTS
// ============================================================
function getSuppliers() { return getRows(STORE.SUPPLIERS); }

function addSupplier(data) {
  const sheet      = getSheet(STORE.SUPPLIERS);
  const headers    = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const supplierId = generateId("SUP");

  const row = headers.map(function(header) {
    const h = normalize(header);
    if (h === "supplierid")    return supplierId;
    if (h === "suppliername")  return data.supplierName;
    if (h === "contactnumber") return data.contactNumber || "";
    if (h === "address")       return data.address       || "";
    if (h === "status")        return "Active";
    if (h === "createdat")     return new Date();
    return "";
  });

  sheet.appendRow(row);
  return { success: true, message: "Supplier added successfully.", supplierId: supplierId };
}

function saveShipment(data) {
  if (String(data.role || "").toLowerCase() !== "admin") {
    return { success: false, message: "Only Admin can save shipments." };
  }

  const sheet      = getSheet(STORE.SHIPMENTS);
  const headers    = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const shipmentId = generateId("SHIP");
  const sacks      = Number(data.sacksReceived) || 0;
  const totalCost  = Number(data.totalCost)     || 0;

  const row = headers.map(function(header) {
    const h = normalize(header);
    if (h === "shipmentid")   return shipmentId;
    if (h === "supplierid")   return data.supplierId   || "";
    if (h === "suppliername") return data.supplierName;
    if (h === "ricetype")     return data.riceType;
    if (h === "sacksreceived")return sacks;
    if (h === "kgreceived")   return sacks * STORE.SACK_KG;
    if (h === "totalcost")    return totalCost;
    if (h === "costperkg")    return (sacks > 0 ? totalCost / (sacks * STORE.SACK_KG) : 0);
    if (h === "shipmentdate") return new Date();
    if (h === "recordedby")   return data.userName || "";
    return "";
  });

  sheet.appendRow(row);
  addStock(data.riceType, sacks);

  return { success: true, message: "Shipment saved and inventory updated.", shipmentId: shipmentId };
}

function addStock(riceType, sacks) {
  const sheet  = getSheet(STORE.INVENTORY);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === String(riceType).toLowerCase()) {
      const oldSacks = Number(values[i][2]) || 0;
      sheet.getRange(i + 1, 3).setValue(oldSacks + Number(sacks));
      sheet.getRange(i + 1, 9).setValue(new Date());
      return;
    }
  }
}

// ============================================================
// FEATURE 6 — SPOILAGE
// ============================================================
function recordSpoilage(data) {
  if (String(data.role || "").toLowerCase() !== "admin") {
    return { success: false, message: "Only Admin can record spoilage." };
  }

  const damagedKg = Number(data.damagedKg) || 0;
  if (damagedKg <= 0) return { success: false, message: "Invalid damaged weight." };

  const inventory = getInventory();
  const item      = inventory.find(function(i) {
    return String(i.inventoryId) === String(data.inventoryId);
  });
  if (!item) return { success: false, message: "Inventory item not found." };
  if (damagedKg > item.totalKg) return { success: false, message: "Damaged weight exceeds available stock." };

  const estimatedLoss = damagedKg * Number(item.costPerKg);
  const sheet         = getSheet(STORE.SPOILAGE);
  const headers       = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(function(header) {
    const h = normalize(header);
    if (h === "spoilageid")                    return generateId("SPOIL");
    if (h === "inventoryid")                   return item.inventoryId;
    if (h === "ricetype")                      return item.riceType;
    if (h === "damagedkg")                     return damagedKg;
    if (h === "reason")                        return data.reason;
    if (h === "estimatedloss")                 return estimatedLoss;
    if (h === "daterecorded" || h === "date")  return new Date();
    if (h === "recordedby")                    return data.userName || "";
    return "";
  });

  sheet.appendRow(row);
  deductInventory(item.inventoryId, damagedKg);

  return { success: true, message: "Spoilage recorded and stock deducted.", estimatedLoss: estimatedLoss };
}

// ============================================================
// FEATURE 7 — ANALYTICS
// ============================================================
function getAnalytics() {
  const sales = getRows(STORE.SALES);
  const items = getRows(STORE.SALE_ITEMS);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  let dailyRevenue = 0;
  sales.forEach(function(sale) {
    if (String(sale.Status || "Completed").toLowerCase() !== "completed") return;
    if (String(sale.SaleDate || "") === today) {
      dailyRevenue += Number(sale.TotalAmount || 0);
    }
  });

  let totalProfit = 0;
  const productMap = {};

  items.forEach(function(item) {
    const riceType = String(item.RiceType || "");
    if (!riceType) return;

    const quantity = Number(item.QuantityKg || 0);
    const subtotal = Number(item.Subtotal   || 0);
    const cost     = Number(item.CostPerKg  || 0);
    const profit   = Number(item.Profit || (subtotal - (quantity * cost)));

    totalProfit += profit;

    if (!productMap[riceType]) {
      productMap[riceType] = { riceType, quantityKg: 0, revenue: 0, profit: 0 };
    }
    productMap[riceType].quantityKg += quantity;
    productMap[riceType].revenue    += subtotal;
    productMap[riceType].profit     += profit;
  });

  const products   = Object.values(productMap).sort(function(a, b) { return b.quantityKg - a.quantityKg; });
  const topSelling = products.length
    ? products[0].riceType + " (" + products[0].quantityKg + " kg)"
    : "-";

  return { dailyRevenue, totalProfit, topSelling, products };
}

// ============================================================
// EXPORT REPORT
// ============================================================
function getSalesReport() { return getRows(STORE.SALES); }

// ============================================================
// AUDIT LOG
// ============================================================
function writeLog(userId, userName, role, action, details) {
  try {
    const sheet   = getSheet(STORE.LOGS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const row = headers.map(function(header) {
      const h = normalize(header);
      if (h === "logid")                                   return generateId("LOG");
      if (h === "userid")                                  return userId   || "";
      if (h === "username" || h === "user")                return userName || "";
      if (h === "role")                                    return role     || "";
      if (h === "action")                                  return action   || "";
      if (h === "details")                                 return details  || "";
      if (h === "timestamp" || h === "datetime" || h === "date") return new Date();
      return "";
    });

    sheet.appendRow(row);
  } catch (error) {
    // Logging must never break a transaction
    console.error(error);
  }
}
