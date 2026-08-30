// ============================================================
// DIAMOND STORE — POS & INVENTORY SYSTEM
// Single JavaScript source of truth
// Frontend: index.html + app.js (this file)
// Backend:  Google Apps Script Web App
// Database: Google Sheets
// Hosting:  Vercel
// ============================================================


// ============================================================
// GOOGLE APPS SCRIPT WEB APP URL  (single source of truth)
// ============================================================

var API =
    "https://script.google.com/macros/s/AKfycbzpBzXUkj53EbrVvs4-KSmtvKfufLUiyv08JtR956uPCcSOGu6BwG5XfR3QHeHUlv2xtQ/exec";


// ============================================================
// GLOBAL STATE
// ============================================================

var currentUser =
    JSON.parse(localStorage.getItem("diamondStoreUser") || "null");

var currentShiftId =
    localStorage.getItem("diamondStoreShiftId") || "";

var inventory = [];
var cart      = [];


// ============================================================
// UTILITY — HTML ESCAPE  (defined first; used everywhere)
// ============================================================

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#039;");
}


// ============================================================
// UTILITY — MONEY FORMAT  (Philippine Peso)
// ============================================================

function money(value) {
    return "P" + Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


// ============================================================
// UTILITY — SHOW STATUS MESSAGE
// ============================================================

function setMessage(elementId, text, isError) {
    var el = document.getElementById(elementId);
    if (!el) { return; }
    el.textContent = text || "";
    el.style.color = isError ? "#c00" : "#007700";
}


// ============================================================
// ROLE HELPER
// ============================================================

function isAdmin() {
    return (
        currentUser != null &&
        String(currentUser.role).toLowerCase() === "admin"
    );
}


// ============================================================
// API — POST  (text/plain avoids CORS preflight on Apps Script)
// ============================================================

async function apiPost(action, data) {
    data = data || {};
    try {
        var response = await fetch(API, {
            method:  "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body:    JSON.stringify({ action: action, ...data })
        });
        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }
        return await response.json();
    } catch (err) {
        console.error("apiPost [" + action + "]:", err);
        return { success: false, message: "Network error: " + err.message };
    }
}


// ============================================================
// API — GET
// ============================================================

async function apiGet(action) {
    try {
        var response = await fetch(
            API + "?action=" + encodeURIComponent(action)
        );
        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }
        return await response.json();
    } catch (err) {
        console.error("apiGet [" + action + "]:", err);
        return { success: false, message: "Network error: " + err.message };
    }
}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function hidePages() {
    document.querySelectorAll(".page").forEach(function (p) {
        p.classList.add("hidden");
    });
}

function showPage(id) {
    hidePages();
    var page = document.getElementById(id);
    if (page) {
        page.classList.remove("hidden");
        window.scrollTo(0, 0);
    } else {
        console.error("showPage: element not found —", id);
    }
}

function showDashboard() {
    showPage("dashboardPage");
}

function openPOS() {
    showPage("posPage");
    setMessage("posMessage", "");
    loadInventory();
}

function openStock() {
    showPage("stockPage");
    setMessage("stockMessage", "");
    loadInventory();
}

function openShift() {
    if (!isAdmin()) { alert("Shift Sales is Admin only."); return; }
    showPage("shiftPage");
    loadShiftSummary();
}

function openSuppliers() {
    if (!isAdmin()) { alert("Suppliers is Admin only."); return; }
    showPage("supplierPage");
    setMessage("supplierMessage", "");
    loadInventory();
}

function openSpoilage() {
    if (!isAdmin()) { alert("Spoilage is Admin only."); return; }
    showPage("spoilagePage");
    setMessage("spoilageMessage", "");
    loadInventory();
}

function openAnalytics() {
    if (!isAdmin()) { alert("Sales Analytics is Admin only."); return; }
    showPage("analyticsPage");
    loadAnalytics();
}


// ============================================================
// USER DISPLAY
// ============================================================

function updateUserDisplay() {
    var el = document.getElementById("userDisplay");
    if (el && currentUser) {
        el.textContent =
            escapeHtml(currentUser.fullName) +
            " (" + escapeHtml(currentUser.role) + ")";
    }
}


// ============================================================
// RBAC — configure which buttons/sections are visible
// ============================================================

function configureRole() {
    var admin = isAdmin();

    var ids = {
        shiftButton:      admin,
        supplierButton:   admin,
        spoilageButton:   admin,
        analyticsButton:  admin,
        adminStockEditor: admin
    };

    Object.keys(ids).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.style.display = ids[id] ? "" : "none";
        }
    });
}


// ============================================================
// LOGIN
// ============================================================

async function login() {
    var usernameInput = document.getElementById("username");
    var passwordInput = document.getElementById("password");
    var roleInput     = document.getElementById("role");

    if (!usernameInput || !passwordInput || !roleInput) {
        console.error("login(): form elements missing");
        return;
    }

    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    var role     = roleInput.value;

    if (!username || !password) {
        setMessage("loginMessage",
            "Please enter your User ID/Username and password.", true);
        return;
    }

    setMessage("loginMessage", "Logging in...");

    var result = await apiPost("login", {
        username: username,
        password: password,
        role:     role
    });

    if (!result || !result.success) {
        setMessage("loginMessage",
            result.message || "Invalid credentials. Please try again.", true);
        return;
    }

    // Store session
    currentUser = result.user;
    localStorage.setItem("diamondStoreUser", JSON.stringify(currentUser));

    setMessage("loginMessage", "");

    updateUserDisplay();
    configureRole();
    showDashboard();

    // Preload data — errors in these must not break the login flow
    loadInventory().catch(function (e) { console.error(e); });
    loadDashboardAnalytics().catch(function (e) { console.error(e); });
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {
    currentUser    = null;
    currentShiftId = "";
    inventory      = [];
    cart           = [];

    localStorage.removeItem("diamondStoreUser");
    localStorage.removeItem("diamondStoreShiftId");

    var username = document.getElementById("username");
    var password = document.getElementById("password");
    if (username) { username.value = ""; }
    if (password) { password.value = ""; }
    setMessage("loginMessage", "");

    showPage("loginPage");
}


// ============================================================
// INVENTORY — LOAD FROM BACKEND
// ============================================================

async function loadInventory() {
    var result = await apiGet("inventory");

    if (!result || !result.success) {
        console.error("loadInventory:", result && result.message);
        var container = document.getElementById("inventoryList");
        if (container) {
            container.innerHTML =
                "<p>Could not load inventory. Check your connection.</p>";
        }
        return [];
    }

    inventory = Array.isArray(result.inventory) ? result.inventory : [];

    renderInventory();
    populateRiceSelects();
    return inventory;
}


// ============================================================
// INVENTORY — FIND ITEM BY ID
// ============================================================

function findInventory(inventoryId) {
    if (!inventoryId) { return null; }
    return inventory.find(function (item) {
        return String(item.inventoryId) === String(inventoryId);
    }) || null;
}


// ============================================================
// INVENTORY — COMPUTE AVAILABLE KG
// (supports both totalKg field and sacks+loose)
// ============================================================

function getAvailableKg(item) {
    if (!item) { return 0; }
    if (item.totalKg != null) { return Number(item.totalKg) || 0; }
    var sacks = Number(item.quantitySacks != null ? item.quantitySacks
                     : item.sacks != null        ? item.sacks : 0);
    var loose = Number(item.looseKg || 0);
    return sacks * 50 + loose;   // 1 sack = 50 kg
}


// ============================================================
// INVENTORY — RENDER CARDS
// ============================================================

function renderInventory() {
    var container = document.getElementById("inventoryList");
    if (!container) { return; }

    if (!inventory.length) {
        container.innerHTML = "<p>No inventory data available.</p>";
        return;
    }

    container.innerHTML = inventory.map(function (item) {
        var sacks    = Number(item.quantitySacks != null ? item.quantitySacks
                            : item.sacks || 0);
        var loose    = Number(item.looseKg || 0);
        var price    = Number(item.pricePerKg || 0);
        var totalKg  = getAvailableKg(item);
        var lowStock = item.lowStock === true || item.lowStock === "true";

        return (
            '<div class="inventory-card' + (lowStock ? " low-stock" : "") + '">' +
            "<h3>" + escapeHtml(item.riceType) + "</h3>" +
            '<div class="inventory-details">' +
            "<div><strong>Sacks</strong><br>" + sacks + "</div>" +
            "<div><strong>Loose</strong><br>" + loose + " kg</div>" +
            "<div><strong>Total</strong><br>" + totalKg + " kg</div>" +
            "</div>" +
            "<p>Price: " + money(price) + " / kg</p>" +
            "<p>" + (lowStock ? "&#9888; LOW STOCK" : "Available") + "</p>" +
            "</div>"
        );
    }).join("");
}


// ============================================================
// INVENTORY — POPULATE ALL RICE <select> ELEMENTS
// ============================================================

function populateRiceSelects() {
    ["posRice", "stockRice", "shipmentRice", "spoilageRice"].forEach(function (id) {
        var select = document.getElementById(id);
        if (!select) { return; }

        var prev = select.value;
        select.innerHTML = '<option value="">-- Select rice --</option>';

        inventory.forEach(function (item) {
            var opt = document.createElement("option");
            opt.value       = item.inventoryId;
            opt.textContent = item.riceType;
            select.appendChild(opt);
        });

        // Restore previous selection if it still exists
        if (prev && findInventory(prev)) {
            select.value = prev;
        }
    });

    updatePOSPrice();
    loadStockFields();
}


// ============================================================
// POS — UPDATE PRICE DISPLAY ON RICE CHANGE
// ============================================================

function updatePOSPrice() {
    var select = document.getElementById("posRice");
    var field  = document.getElementById("posPrice");
    if (!select || !field) { return; }

    var item = findInventory(select.value);
    field.value = item ? money(item.pricePerKg) : "";
}


// ============================================================
// STOCK EDITOR — POPULATE FIELDS ON RICE CHANGE
// ============================================================

function loadStockFields() {
    var select = document.getElementById("stockRice");
    if (!select || !select.value) { return; }

    var item = findInventory(select.value);
    if (!item) { return; }

    var sacksField = document.getElementById("stockSacks");
    var looseField = document.getElementById("stockLoose");
    var priceField = document.getElementById("stockPrice");

    if (sacksField) {
        sacksField.value = Number(
            item.quantitySacks != null ? item.quantitySacks : item.sacks || 0
        );
    }
    if (looseField) { looseField.value = Number(item.looseKg  || 0); }
    if (priceField) { priceField.value = Number(item.pricePerKg || 0); }
}


// ============================================================
// POS — ADD ITEM TO CART
// ============================================================

function addToCart() {
    var select        = document.getElementById("posRice");
    var quantityInput = document.getElementById("posQuantity");
    if (!select || !quantityInput) { return; }

    var inventoryId = select.value;
    var quantity    = Number(quantityInput.value);
    var item        = findInventory(inventoryId);

    if (!item) {
        alert("Please select a rice type.");
        return;
    }

    if (isNaN(quantity) || quantity <= 0) {
        alert("Please enter a valid quantity (greater than 0).");
        return;
    }

    var available = getAvailableKg(item);
    var existing  = cart.find(function (c) {
        return String(c.inventoryId) === String(inventoryId);
    });
    var alreadyInCart = existing ? Number(existing.quantityKg) : 0;

    if (available > 0 && (alreadyInCart + quantity) > available) {
        alert(
            escapeHtml(item.riceType) +
            " only has " + available + " kg available. " +
            "You already have " + alreadyInCart + " kg in the cart."
        );
        return;
    }

    if (existing) {
        existing.quantityKg += quantity;
        existing.subtotal    = existing.quantityKg * existing.pricePerKg;
    } else {
        cart.push({
            inventoryId: item.inventoryId,
            riceType:    item.riceType,
            quantityKg:  quantity,
            pricePerKg:  Number(item.pricePerKg) || 0,
            costPerKg:   Number(item.costPerKg)  || 0,
            subtotal:    quantity * (Number(item.pricePerKg) || 0)
        });
    }

    renderCart();
    quantityInput.value = 1;
    setMessage("posMessage", "");
}


// ============================================================
// POS — REMOVE CART ITEM
// ============================================================

function removeCart(index) {
    if (index < 0 || index >= cart.length) { return; }
    cart.splice(index, 1);
    renderCart();
}


// ============================================================
// POS — RENDER CART
// ============================================================

function renderCart() {
    var container    = document.getElementById("cartList");
    var totalElement = document.getElementById("cartTotal");
    if (!container) { return; }

    if (!cart.length) {
        container.innerHTML = "<p>Cart is empty.</p>";
    } else {
        container.innerHTML = cart.map(function (item, index) {
            return (
                '<div class="cart-item">' +
                "<span><strong>" + escapeHtml(item.riceType) + "</strong>" +
                "<br>" + item.quantityKg + " kg @ " +
                money(item.pricePerKg) + " / kg</span>" +
                '<span><strong>' + money(item.subtotal) + '</strong>' +
                ' <button type="button" onclick="removeCart(' + index +
                ')">REMOVE</button></span>' +
                "</div>"
            );
        }).join("");
    }

    if (totalElement) {
        totalElement.textContent = money(getCartTotal());
    }

    calculateChange();
}


// ============================================================
// POS — TOTAL
// ============================================================

function getCartTotal() {
    return cart.reduce(function (sum, item) {
        return sum + (Number(item.subtotal) || 0);
    }, 0);
}

// Alias used by calculateChange and completeSale
function getTotal() { return getCartTotal(); }


// ============================================================
// POS — CALCULATE CHANGE
// ============================================================

function calculateChange() {
    var cashInput    = document.getElementById("cashReceived");
    var changeOutput = document.getElementById("changeAmount");
    if (!cashInput || !changeOutput) { return; }

    var cash   = Number(cashInput.value) || 0;
    var change = cash - getCartTotal();

    changeOutput.value = change >= 0 ? money(change) : "Insufficient cash";
}


// ============================================================
// POS — COMPLETE SALE
// ============================================================

async function completeSale() {
    if (!currentUser) {
        alert("Please log in first.");
        return;
    }

    if (!cart.length) {
        alert("Cart is empty. Add items before completing a sale.");
        return;
    }

    var cashInput = document.getElementById("cashReceived");
    var cash      = Number(cashInput ? cashInput.value : 0);
    var total     = getCartTotal();

    if (isNaN(cash) || cash <= 0) {
        setMessage("posMessage", "Please enter the cash amount handed.", true);
        return;
    }

    if (cash < total) {
        setMessage("posMessage",
            "Cash is insufficient. Total is " + money(total) + ".", true);
        return;
    }

    setMessage("posMessage", "Processing sale...");

    var result = await apiPost("createSale", {
        cashier: {
            userId:   currentUser.userId,
            fullName: currentUser.fullName,
            role:     currentUser.role
        },
        items:        cart,
        cashReceived: cash
    });

    if (!result || !result.success) {
        setMessage("posMessage",
            result.message || "Sale could not be completed.", true);
        return;
    }

    var sale = result.sale || {};

    alert(
        "SALE COMPLETED\n\n" +
        "Transaction: " + (sale.transactionNumber || "-") +
        "\nTotal:       " + money(sale.totalAmount) +
        "\nCash:        " + money(sale.cashReceived) +
        "\nChange:      " + money(sale.changeAmount)
    );

    cart = [];
    if (cashInput) { cashInput.value = "0"; }
    var changeField = document.getElementById("changeAmount");
    if (changeField) { changeField.value = money(0); }
    renderCart();
    setMessage("posMessage", "Sale recorded successfully.");

    loadInventory().catch(function (e) { console.error(e); });
    loadDashboardAnalytics().catch(function (e) { console.error(e); });
}


// ============================================================
// STOCK — UPDATE (Admin only)
// ============================================================

async function updateStock() {
    if (!isAdmin()) {
        alert("Only Admin can update stock.");
        return;
    }

    var select = document.getElementById("stockRice");
    var item   = findInventory(select ? select.value : null);

    if (!item) {
        alert("Please select a rice type.");
        return;
    }

    var sacksEl = document.getElementById("stockSacks");
    var looseEl = document.getElementById("stockLoose");
    var priceEl = document.getElementById("stockPrice");

    var sacks  = Number(sacksEl ? sacksEl.value : 0);
    var loose  = Number(looseEl ? looseEl.value : 0);
    var price  = Number(priceEl ? priceEl.value : 0);

    if (isNaN(sacks) || sacks < 0) {
        alert("Sacks must be 0 or greater.");
        return;
    }
    if (isNaN(loose) || loose < 0) {
        alert("Loose kg must be 0 or greater.");
        return;
    }
    if (isNaN(price) || price < 0) {
        alert("Price per kg must be 0 or greater.");
        return;
    }

    setMessage("stockMessage", "Updating...");

    var result = await apiPost("updateInventory", {
        inventoryId:   item.inventoryId,
        riceType:      item.riceType,
        quantitySacks: sacks,
        looseKg:       loose,
        pricePerKg:    price,
        role:          currentUser.role,
        userId:        currentUser.userId,
        userName:      currentUser.fullName
    });

    if (!result || !result.success) {
        setMessage("stockMessage",
            result.message || "Stock update failed.", true);
        alert(result.message || "Stock update failed.");
        return;
    }

    setMessage("stockMessage", "Inventory updated successfully.");
    await loadInventory();
}


// ============================================================
// SHIFT — START
// ============================================================

async function startShift() {
    if (!currentUser) { alert("Please log in first."); return; }

    var openingCashEl = document.getElementById("openingCash");
    var openingCash   = Number(openingCashEl ? openingCashEl.value : 0) || 0;

    var result = await apiPost("startShift", {
        cashierId:   currentUser.userId,
        cashierName: currentUser.fullName,
        openingCash: openingCash
    });

    if (!result || !result.success) {
        alert(result.message || "Unable to start shift.");
        return;
    }

    currentShiftId = result.shiftId || "";
    localStorage.setItem("diamondStoreShiftId", currentShiftId);

    alert("Shift started successfully.");
    await loadShiftSummary();
}


// ============================================================
// SHIFT — LOAD SUMMARY
// ============================================================

async function loadShiftSummary() {
    var container = document.getElementById("shiftInfo");
    if (!container) { return; }

    container.innerHTML = "<p>Loading...</p>";

    var result = await apiPost("shiftSummary", {
        shiftId: currentShiftId || ""
    });

    if (!result || !result.success || !result.shift) {
        container.innerHTML = "<p>No active shift.</p>";
        return;
    }

    var shift        = result.shift;
    var transactions = Array.isArray(result.transactions)
        ? result.transactions : [];

    var openingCash = Number(shift.openingCash != null
        ? shift.openingCash : shift.OpeningCash || 0);
    var totalSales  = Number(shift.totalSales  != null
        ? shift.totalSales  : shift.TotalSales  || 0);
    var status      = shift.status      || shift.Status      || "OPEN";
    var cashierName = shift.cashierName || shift.CashierName || "";

    var txHtml = transactions.length
        ? transactions.map(function (t) {
            return (
                '<div class="cart-item">' +
                "<span>" + escapeHtml(
                    t.transactionNumber || t.TransactionNumber || "-"
                ) + "</span>" +
                "<strong>" + money(t.totalAmount || t.TotalAmount || 0) + "</strong>" +
                "</div>"
            );
        }).join("")
        : "<p>No transactions yet.</p>";

    container.innerHTML =
        '<div class="summary-card">' +
        "<span>Cashier</span><strong>" + escapeHtml(cashierName) + "</strong>" +
        "<span>Status</span><strong>" + escapeHtml(String(status)) + "</strong>" +
        "<span>Opening Cash</span><strong>" + money(openingCash) + "</strong>" +
        "<span>Total Sales</span><strong>" + money(totalSales) + "</strong>" +
        "</div>" +
        "<h3>TRANSACTIONS</h3>" +
        txHtml;
}


// ============================================================
// SHIFT — CLOSE
// ============================================================

async function closeShiftNow() {
    if (!currentShiftId) {
        alert("No active shift to close.");
        return;
    }

    var closingCashEl = document.getElementById("closingCash");
    var closingCash   = Number(closingCashEl ? closingCashEl.value : 0) || 0;

    var result = await apiPost("closeShift", {
        shiftId:     currentShiftId,
        closingCash: closingCash
    });

    if (!result || !result.success) {
        alert(result.message || "Unable to close shift.");
        return;
    }

    alert(
        "SHIFT CLOSED\n\n" +
        "Total Sales:  " + money(result.totalSales)  + "\n" +
        "Closing Cash: " + money(result.closingCash)
    );

    currentShiftId = "";
    localStorage.removeItem("diamondStoreShiftId");

    await loadShiftSummary();
}


// ============================================================
// SUPPLIER — ADD
// ============================================================

async function addSupplier() {
    if (!isAdmin()) { alert("Only Admin can add suppliers."); return; }

    var nameEl    = document.getElementById("supplierName");
    var contactEl = document.getElementById("supplierContact");
    var addressEl = document.getElementById("supplierAddress");

    var name    = nameEl    ? nameEl.value.trim()    : "";
    var contact = contactEl ? contactEl.value.trim() : "";
    var address = addressEl ? addressEl.value.trim() : "";

    if (!name) {
        setMessage("supplierMessage", "Supplier name is required.", true);
        return;
    }

    setMessage("supplierMessage", "Saving...");

    var result = await apiPost("addSupplier", {
        supplierName:  name,
        contactNumber: contact,
        address:       address,
        role:          currentUser.role,
        userId:        currentUser.userId,
        userName:      currentUser.fullName
    });

    if (!result || !result.success) {
        setMessage("supplierMessage",
            result.message || "Unable to add supplier.", true);
        return;
    }

    if (nameEl)    { nameEl.value    = ""; }
    if (contactEl) { contactEl.value = ""; }
    if (addressEl) { addressEl.value = ""; }

    setMessage("supplierMessage", "Supplier saved successfully.");
}


// ============================================================
// SUPPLIER — SAVE SHIPMENT
// ============================================================

async function saveShipment() {
    if (!isAdmin()) { alert("Only Admin can save shipments."); return; }

    var nameEl   = document.getElementById("supplierName");
    var riceEl   = document.getElementById("shipmentRice");
    var sacksEl  = document.getElementById("shipmentSacks");
    var costEl   = document.getElementById("shipmentCost");

    var supplierName = nameEl  ? nameEl.value.trim() : "";
    var riceItem     = findInventory(riceEl ? riceEl.value : null);
    var sacks        = Number(sacksEl ? sacksEl.value : 0);
    var totalCost    = Number(costEl  ? costEl.value  : 0);

    if (!supplierName) {
        setMessage("supplierMessage", "Enter the supplier name.", true);
        return;
    }
    if (!riceItem) {
        setMessage("supplierMessage", "Select a rice type.", true);
        return;
    }
    if (isNaN(sacks) || sacks <= 0) {
        setMessage("supplierMessage",
            "Enter valid sacks received (greater than 0).", true);
        return;
    }
    if (isNaN(totalCost) || totalCost < 0) {
        setMessage("supplierMessage", "Enter a valid total cost.", true);
        return;
    }

    setMessage("supplierMessage", "Saving shipment...");

    var result = await apiPost("saveShipment", {
        supplierId:    "",
        supplierName:  supplierName,
        riceType:      riceItem.riceType,
        sacksReceived: sacks,
        totalCost:     totalCost,
        role:          currentUser.role,
        userId:        currentUser.userId,
        userName:      currentUser.fullName
    });

    if (!result || !result.success) {
        setMessage("supplierMessage",
            result.message || "Unable to save shipment.", true);
        return;
    }

    if (sacksEl) { sacksEl.value = ""; }
    if (costEl)  { costEl.value  = ""; }

    setMessage("supplierMessage", "Shipment saved and inventory updated.");

    loadInventory().catch(function (e) { console.error(e); });
}


// ============================================================
// SPOILAGE — RECORD
// ============================================================

async function recordSpoilage() {
    if (!isAdmin()) { alert("Only Admin can record spoilage."); return; }

    var riceEl   = document.getElementById("spoilageRice");
    var kgEl     = document.getElementById("damagedKg");
    var reasonEl = document.getElementById("spoilageReason");

    var item      = findInventory(riceEl ? riceEl.value : null);
    var damagedKg = Number(kgEl ? kgEl.value : 0);
    var reason    = reasonEl ? reasonEl.value.trim() : "";

    if (!item) {
        setMessage("spoilageMessage", "Select a rice type.", true);
        return;
    }
    if (isNaN(damagedKg) || damagedKg <= 0) {
        setMessage("spoilageMessage",
            "Enter a valid damaged weight (greater than 0 kg).", true);
        return;
    }

    var available = getAvailableKg(item);
    if (available > 0 && damagedKg > available) {
        setMessage("spoilageMessage",
            "Cannot deduct " + damagedKg + " kg. " +
            "Only " + available + " kg available.", true);
        return;
    }

    if (!reason) {
        setMessage("spoilageMessage", "Please enter the reason.", true);
        return;
    }

    setMessage("spoilageMessage", "Recording spoilage...");

    var result = await apiPost("recordSpoilage", {
        inventoryId: item.inventoryId,
        riceType:    item.riceType,
        damagedKg:   damagedKg,
        reason:      reason,
        role:        currentUser.role,
        userId:      currentUser.userId,
        userName:    currentUser.fullName
    });

    if (!result || !result.success) {
        setMessage("spoilageMessage",
            result.message || "Unable to record spoilage.", true);
        return;
    }

    setMessage("spoilageMessage",
        "Spoilage recorded. Estimated loss: " +
        money(result.estimatedLoss || 0));

    alert(
        "Spoilage recorded.\n\n" +
        "Rice: "           + item.riceType + "\n" +
        "Deducted: "       + damagedKg + " kg\n" +
        "Estimated Loss: " + money(result.estimatedLoss || 0)
    );

    if (kgEl)     { kgEl.value     = ""; }
    if (reasonEl) { reasonEl.value = ""; }

    loadInventory().catch(function (e) { console.error(e); });
}


// ============================================================
// ANALYTICS — DASHBOARD SUMMARY ONLY
// (called after login, completeSale, spoilage; safe on any page)
// ============================================================

async function loadDashboardAnalytics() {
    var result = await apiGet("analytics");
    if (!result || !result.success) { return; }

    var data = result.analytics || {};

    var dashRevenue = document.getElementById("dashRevenue");
    var dashProfit  = document.getElementById("dashProfit");
    var dashTop     = document.getElementById("dashTop");

    if (dashRevenue) { dashRevenue.textContent = money(data.dailyRevenue); }
    if (dashProfit)  { dashProfit.textContent  = money(data.totalProfit);  }
    if (dashTop)     { dashTop.textContent     = data.topSelling || "-";   }
}


// ============================================================
// ANALYTICS — FULL PAGE
// (called only when analyticsPage is open)
// ============================================================

async function loadAnalytics() {
    var result = await apiGet("analytics");

    if (!result || !result.success) {
        console.error("loadAnalytics:", result && result.message);
        var pa = document.getElementById("productAnalytics");
        if (pa) { pa.innerHTML = "<p>Unable to load analytics data.</p>"; }
        return;
    }

    var data = result.analytics || {};

    // Update dashboard summary cards (safe — may not be visible)
    var dashRevenue = document.getElementById("dashRevenue");
    var dashProfit  = document.getElementById("dashProfit");
    var dashTop     = document.getElementById("dashTop");
    if (dashRevenue) { dashRevenue.textContent = money(data.dailyRevenue); }
    if (dashProfit)  { dashProfit.textContent  = money(data.totalProfit);  }
    if (dashTop)     { dashTop.textContent     = data.topSelling || "-";   }

    // Update analytics page cards
    var analyticsRevenue = document.getElementById("analyticsRevenue");
    var analyticsProfit  = document.getElementById("analyticsProfit");
    var analyticsTop     = document.getElementById("analyticsTop");
    if (analyticsRevenue) {
        analyticsRevenue.textContent = money(data.dailyRevenue);
    }
    if (analyticsProfit) {
        analyticsProfit.textContent = money(data.totalProfit);
    }
    if (analyticsTop) {
        analyticsTop.textContent = data.topSelling || "-";
    }

    renderProductAnalytics(data.products || []);
}


// ============================================================
// ANALYTICS — PRODUCT PERFORMANCE TABLE
// ============================================================

function renderProductAnalytics(products) {
    var container = document.getElementById("productAnalytics");
    if (!container) { return; }

    // Normalise: backend may return array or object map
    var items = [];
    if (Array.isArray(products)) {
        items = products;
    } else if (products && typeof products === "object") {
        items = Object.keys(products).map(function (key) {
            var p = products[key];
            return {
                riceType:   p.riceType  || key,
                quantityKg: Number(p.quantityKg  || p.quantity || 0),
                revenue:    Number(p.revenue     || p.sales    || 0),
                profit:     Number(p.profit      || 0)
            };
        });
    }

    if (!items.length) {
        container.innerHTML = "<p>No sales data yet.</p>";
        return;
    }

    container.innerHTML = items.map(function (item) {
        return (
            '<div class="summary-card">' +
            "<strong>" + escapeHtml(item.riceType || "Unknown") + "</strong>" +
            "<p>Qty Sold: " + Number(item.quantityKg || 0) + " kg</p>" +
            "<p>Revenue: " + money(item.revenue) + "</p>" +
            "<p>Profit: "  + money(item.profit)  + "</p>" +
            "</div>"
        );
    }).join("");
}


// ============================================================
// EXPORT — SALES REPORT CSV
// ============================================================

async function exportReport() {
    var result = await apiGet("report");

    if (!result || !result.success) {
        alert(result.message || "Unable to export report.");
        return;
    }

    var rows = Array.isArray(result.rows) ? result.rows : [];

    if (!rows.length) {
        alert("No sales records found.");
        return;
    }

    var headers = Object.keys(rows[0]);
    var csv = headers.join(",") + "\n";

    rows.forEach(function (row) {
        csv += headers.map(function (h) {
            return '"' + String(row[h] == null ? "" : row[h])
                             .replace(/"/g, '""') + '"';
        }).join(",") + "\n";
    });

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url  = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href     = url;
    link.download = "Diamond-Store-Sales-Report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


// ============================================================
// INITIALIZE — on page load
// ============================================================

window.addEventListener("load", function () {
    if (currentUser) {
        // Returning visitor with a saved session
        updateUserDisplay();
        configureRole();
        showDashboard();
        loadInventory().catch(function (e) { console.error(e); });
        loadDashboardAnalytics().catch(function (e) { console.error(e); });
    } else {
        showPage("loginPage");
    }
});
