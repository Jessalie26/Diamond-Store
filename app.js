// ============================================================
// DIAMOND STORE FRONTEND
// POS & INVENTORY SYSTEM
// ============================================================

// IMPORTANT:
// This is your deployed Google Apps Script Web App URL.
const API =
  "https://script.google.com/macros/s/AKfycbxjL6Mrnzk9rnHvSM3bBjlOcB8_jl5786YSRFhKtyk6aZf4V--6c-xNfWA6bdE0wW64oQ/exec";


// ============================================================
// GLOBAL DATA
// ============================================================

let currentUser = null;

let inventory = [];

let cart = [];

let suppliers = [];

let currentShiftId = null;


// ============================================================
// API REQUEST
// ============================================================

async function apiRequest(action, data = {}) {

  try {

    const response = await fetch(API, {

      method: "POST",

      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },

      body: JSON.stringify({

        action: action,

        ...data

      })

    });


    const result =
      await response.json();


    return result;


  } catch (error) {

    console.error(error);

    return {

      success: false,

      message:
        "Unable to connect to Google Apps Script."

    };
  }
}


// ============================================================
// GET API
// ============================================================

async function apiGet(action) {

  try {

    const response =
      await fetch(
        API +
        "?action=" +
        encodeURIComponent(action)
      );


    return await response.json();


  } catch (error) {

    console.error(error);

    return {

      success: false,

      message:
        "Unable to connect to Google Apps Script."

    };
  }
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(
  username,
  password,
  role
) {

  const result =
    await apiRequest(
      "login",
      {

        username:
          username,

        password:
          password,

        role:
          role

      }
    );


  if (!result.success) {

    alert(
      result.message ||
      "Login failed."
    );

    return false;
  }


  currentUser =
    result.user;


  localStorage.setItem(
    "diamondStoreUser",
    JSON.stringify(currentUser)
  );


  alert(
    "Welcome, " +
    currentUser.fullName +
    "!"
  );


  return true;
}


// ============================================================
// LOGOUT
// ============================================================

function logoutUser() {

  currentUser = null;

  currentShiftId = null;

  cart = [];

  localStorage.removeItem(
    "diamondStoreUser"
  );

  window.location.reload();
}


// ============================================================
// RESTORE SESSION
// ============================================================

function restoreSession() {

  const saved =
    localStorage.getItem(
      "diamondStoreUser"
    );


  if (!saved) {
    return null;
  }


  try {

    currentUser =
      JSON.parse(saved);


    return currentUser;

  } catch (error) {

    localStorage.removeItem(
      "diamondStoreUser"
    );

    return null;
  }
}


// ============================================================
// CHECK ROLE
// ============================================================

function isAdmin() {

  return (

    currentUser &&

    String(currentUser.role)
      .toLowerCase()
      ===
      "admin"

  );
}


function isCashier() {

  return (

    currentUser &&

    String(currentUser.role)
      .toLowerCase()
      ===
      "cashier"

  );
}


// ============================================================
// FEATURE 3
// STOCK TRACKER
// ============================================================

async function loadInventory() {

  const result =
    await apiGet(
      "inventory"
    );


  if (!result.success) {

    alert(
      result.message ||
      "Unable to load inventory."
    );

    return [];
  }


  inventory =
    result.inventory || [];


  return inventory;
}


// ============================================================
// FIND INVENTORY
// ============================================================

function findInventory(
  inventoryId
) {

  return inventory.find(
    item =>
      String(item.inventoryId)
      ===
      String(inventoryId)
  );
}


// ============================================================
// FORMAT MONEY
// ============================================================

function money(value) {

  return (

    "P" +

    Number(value || 0)
      .toLocaleString(
        "en-PH",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )

  );
}


// ============================================================
// FEATURE 2
// ADD TO CART
// ============================================================

function addToCart(
  inventoryId,
  quantityKg
) {

  const item =
    findInventory(
      inventoryId
    );


  if (!item) {

    alert(
      "Rice type not found."
    );

    return false;
  }


  const quantity =
    Number(quantityKg);


  if (
    isNaN(quantity) ||
    quantity <= 0
  ) {

    alert(
      "Please enter a valid quantity."
    );

    return false;
  }


  const existing =
    cart.find(
      cartItem =>
        String(cartItem.inventoryId)
        ===
        String(inventoryId)
    );


  const existingQuantity =
    existing
      ? Number(existing.quantityKg)
      : 0;


  if (
    existingQuantity +
    quantity
    >
    Number(item.totalKg)
  ) {

    alert(

      item.riceType +
      " only has " +
      item.totalKg +
      " kg available."

    );

    return false;
  }


  if (existing) {

    existing.quantityKg +=
      quantity;

    existing.subtotal =
      existing.quantityKg *
      existing.pricePerKg;

  } else {

    cart.push({

      inventoryId:
        item.inventoryId,

      riceType:
        item.riceType,

      quantityKg:
        quantity,

      pricePerKg:
        Number(item.pricePerKg),

      subtotal:
        quantity *
        Number(item.pricePerKg)

    });
  }


  return true;
}


// ============================================================
// REMOVE CART ITEM
// ============================================================

function removeFromCart(
  inventoryId
) {

  cart =
    cart.filter(
      item =>
        String(item.inventoryId)
        !==
        String(inventoryId)
    );
}


// ============================================================
// CLEAR CART
// ============================================================

function clearCart() {

  cart = [];
}


// ============================================================
// GET CART TOTAL
// ============================================================

function getCartTotal() {

  return cart.reduce(

    function(total, item) {

      return (
        total +
        Number(item.subtotal || 0)
      );

    },

    0
  );
}


// ============================================================
// CALCULATE CHANGE
// ============================================================

function calculateChange(
  cashReceived
) {

  const total =
    getCartTotal();


  const cash =
    Number(cashReceived);


  if (
    isNaN(cash)
  ) {

    return 0;
  }


  return cash - total;
}


// ============================================================
// FEATURE 2
// COMPLETE SALE
// ============================================================

async function completeSale(
  cashReceived
) {

  if (!currentUser) {

    alert(
      "Please login first."
    );

    return false;
  }


  if (
    cart.length === 0
  ) {

    alert(
      "Cart is empty."
    );

    return false;
  }


  const cash =
    Number(cashReceived);


  if (
    isNaN(cash)
  ) {

    alert(
      "Please enter valid cash."
    );

    return false;
  }


  const total =
    getCartTotal();


  if (
    cash < total
  ) {

    alert(
      "Insufficient cash."
    );

    return false;
  }


  const result =
    await apiRequest(

      "createSale",

      {

        cashier: {

          userId:
            currentUser.userId,

          fullName:
            currentUser.fullName,

          role:
            currentUser.role

        },

        items:
          cart,

        cashReceived:
          cash

      }

    );


  if (!result.success) {

    alert(
      result.message ||
      "Sale failed."
    );

    return false;
  }


  alert(

    "SALE COMPLETED\n\n" +

    "Transaction: " +
    result.sale.transactionNumber +
    "\n" +

    "Total: " +
    money(result.sale.totalAmount) +
    "\n" +

    "Cash: " +
    money(result.sale.cashReceived) +
    "\n" +

    "Change: " +
    money(result.sale.changeAmount)

  );


  clearCart();


  await loadInventory();


  return result;
}


// ============================================================
// FEATURE 3
// ADMIN UPDATE STOCK
// ============================================================

async function updateStock(
  inventoryId,
  riceType,
  pricePerKg
) {

  if (!isAdmin()) {

    alert(
      "Only Admin can update stock."
    );

    return false;
  }


  const result =
    await apiRequest(

      "updateInventory",

      {

        inventoryId:
          inventoryId,

        riceType:
          riceType,

        pricePerKg:
          Number(pricePerKg),

        role:
          currentUser.role,

        userId:
          currentUser.userId,

        userName:
          currentUser.fullName

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return false;
  }


  alert(
    "Stock information updated."
  );


  await loadInventory();


  return true;
}


// ============================================================
// FEATURE 4
// START SHIFT
// ============================================================

async function startShift(
  openingCash
) {

  if (!currentUser) {

    alert(
      "Please login first."
    );

    return false;
  }


  const result =
    await apiRequest(

      "startShift",

      {

        cashierId:
          currentUser.userId,

        cashierName:
          currentUser.fullName,

        openingCash:
          Number(openingCash) || 0

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return false;
  }


  currentShiftId =
    result.shiftId;


  localStorage.setItem(
    "diamondStoreShiftId",
    currentShiftId
  );


  alert(
    "Shift started successfully."
  );


  return true;
}


// ============================================================
// RESTORE SHIFT
// ============================================================

function restoreShift() {

  currentShiftId =
    localStorage.getItem(
      "diamondStoreShiftId"
    );


  return currentShiftId;
}


// ============================================================
// FEATURE 4
// GET SHIFT SUMMARY
// ============================================================

async function getShiftSummary(
  shiftId = null
) {

  const result =
    await apiRequest(

      "shiftSummary",

      {

        shiftId:
          shiftId

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return [];
  }


  return result.shifts || [];
}


// ============================================================
// FEATURE 4
// SHIFT TRANSACTIONS
// ============================================================

async function getShiftTransactions() {

  const result =
    await apiRequest(

      "shiftTransactions",

      {

        cashierId:
          currentUser
            ? currentUser.userId
            : ""

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return [];
  }


  return result.transactions || [];
}


// ============================================================
// FEATURE 4
// CLOSE SHIFT
// ============================================================

async function closeShift(
  closingCash
) {

  if (!currentShiftId) {

    alert(
      "No active shift."
    );

    return false;
  }


  const result =
    await apiRequest(

      "closeShift",

      {

        shiftId:
          currentShiftId,

        closingCash:
          Number(closingCash) || 0

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return false;
  }


  alert(

    "SHIFT CLOSED\n\n" +

    "Total Sales: " +
    money(result.totalSales) +
    "\n" +

    "Closing Cash: " +
    money(result.closingCash)

  );


  currentShiftId = null;


  localStorage.removeItem(
    "diamondStoreShiftId"
  );


  return true;
}


// ============================================================
// FEATURE 5
// GET SUPPLIERS
// ============================================================

async function loadSuppliers() {

  const result =
    await apiGet(
      "suppliers"
    );


  if (!result.success) {

    alert(
      result.message
    );

    return [];
  }


  suppliers =
    result.suppliers || [];


  return suppliers;
}


// ============================================================
// FEATURE 5
// ADD SUPPLIER
// ============================================================

async function addSupplier(
  supplierName,
  contactNumber = "",
  address = ""
) {

  if (!isAdmin()) {

    alert(
      "Only Admin can add suppliers."
    );

    return false;
  }


  const result =
    await apiRequest(

      "addSupplier",

      {

        supplierName:
          supplierName,

        contactNumber:
          contactNumber,

        address:
          address,

        role:
          currentUser.role,

        userId:
          currentUser.userId,

        userName:
          currentUser.fullName

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return false;
  }


  alert(
    "Supplier added successfully."
  );


  await loadSuppliers();


  return true;
}


// ============================================================
// FEATURE 5
// SAVE SHIPMENT
// ============================================================

async function saveShipment(
  supplierId,
  supplierName,
  riceType,
  sacksReceived,
  totalCost
) {

  if (!isAdmin()) {

    alert(
      "Only Admin can save shipments."
    );

    return false;
  }


  const result =
    await apiRequest(

      "saveShipment",

      {

        supplierId:
          supplierId,

        supplierName:
          supplierName,

        riceType:
          riceType,

        sacksReceived:
          Number(sacksReceived),

        totalCost:
          Number(totalCost),

        role:
          currentUser.role,

        userId:
          currentUser.userId,

        userName:
          currentUser.fullName

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return false;
  }


  alert(
    "Shipment saved and stock updated."
  );


  await loadInventory();


  return true;
}


// ============================================================
// FEATURE 6
// SPOILAGE
// ============================================================

async function recordSpoilage(
  riceType,
  damagedKg,
  reason
) {

  if (!isAdmin()) {

    alert(
      "Only Admin can record spoilage."
    );

    return false;
  }


  const result =
    await apiRequest(

      "recordSpoilage",

      {

        riceType:
          riceType,

        damagedKg:
          Number(damagedKg),

        reason:
          reason,

        role:
          currentUser.role,

        userId:
          currentUser.userId,

        userName:
          currentUser.fullName

      }

    );


  if (!result.success) {

    alert(
      result.message
    );

    return false;
  }


  alert(

    "Spoilage recorded.\n\n" +

    "Estimated Loss: " +
    money(result.estimatedLoss)

  );


  await loadInventory();


  return true;
}


// ============================================================
// FEATURE 7
// ANALYTICS
// ============================================================

async function loadAnalytics() {

  const result =
    await apiGet(
      "analytics"
    );


  if (!result.success) {

    alert(
      result.message
    );

    return null;
  }


  return result.analytics;
}


// ============================================================
// EXPORT SALES REPORT
// ============================================================

async function exportSalesReport() {

  const analytics =
    await loadAnalytics();


  if (!analytics) {
    return;
  }


  const transactions =
    await getShiftTransactions();


  let csv =
    "Transaction Number,Cashier,Total,Cash,Change,Date,Time\n";


  transactions.forEach(
    function(transaction) {

      csv +=

        '"' +
        transaction.transactionNumber +
        '",' +

        '"' +
        transaction.cashierName +
        '",' +

        transaction.totalAmount +
        "," +

        transaction.cashReceived +
        "," +

        transaction.changeAmount +
        "," +

        '"' +
        transaction.saleDate +
        '",' +

        '"' +
        transaction.saleTime +
        '"\n';

    }
  );


  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    "Diamond-Store-Sales-Report.csv";


  document.body.appendChild(
    link
  );


  link.click();


  document.body.removeChild(
    link
  );


  URL.revokeObjectURL(
    url
  );
}


// ============================================================
// INITIALIZE APPLICATION
// ============================================================

async function initializeDiamondStore() {

  restoreSession();

  restoreShift();


  await loadInventory();


  if (isAdmin()) {

    await loadSuppliers();

  }


  console.log(
    "DIAMOND STORE initialized."
  );


  console.log(
    "Current User:",
    currentUser
  );


  console.log(
    "Inventory:",
    inventory
  );
}


// ============================================================
// AUTO START
// ============================================================

document.addEventListener(

  "DOMContentLoaded",

  function() {

    initializeDiamondStore();

  }

);
