// ============================================================
// DIAMOND STORE POS & INVENTORY SYSTEM
// FRONTEND - GITHUB / VERCEL
// ============================================================

// YOUR CURRENT GOOGLE APPS SCRIPT WEB APP
const API =
"https://script.google.com/macros/s/AKfycbwpFhKXUYPCcY2QjQGb0RiHJwU9mzPmGvA_SRUZRG_LomapABO9dkjc4S8MvZb3-EJF/exec";

let currentUser = null;
let inventory = [];
let cart = [];
let suppliers = [];
let currentShiftId = null;


// ============================================================
// API
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

        return await response.json();

    } catch (error) {

        console.error(error);

        return {
            success: false,
            message: "Unable to connect to Google Sheets."
        };
    }
}


async function apiGet(action) {

    try {

        const response = await fetch(
            API + "?action=" + encodeURIComponent(action)
        );

        return await response.json();

    } catch (error) {

        console.error(error);

        return {
            success: false,
            message: "Unable to connect to Google Sheets."
        };
    }
}


// ============================================================
// MONEY
// ============================================================

function money(value) {

    return "P" +
        Number(value || 0).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
}


// ============================================================
// SESSION
// ============================================================

function isAdmin() {

    return currentUser &&
        String(currentUser.role).toLowerCase() === "admin";
}


function isCashier() {

    return currentUser &&
        String(currentUser.role).toLowerCase() === "cashier";
}


function restoreSession() {

    const saved =
        localStorage.getItem("diamondStoreUser");

    if (!saved) {
        return;
    }

    try {

        currentUser = JSON.parse(saved);

    } catch (error) {

        localStorage.removeItem("diamondStoreUser");
    }
}


function restoreShift() {

    currentShiftId =
        localStorage.getItem("diamondStoreShiftId");
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(username, password, role) {

    const result = await apiRequest("login", {
        username: username,
        password: password,
        role: role
    });

    if (!result.success) {

        alert(
            result.message ||
            "Invalid username, password or role."
        );

        return false;
    }

    currentUser = result.user;

    localStorage.setItem(
        "diamondStoreUser",
        JSON.stringify(currentUser)
    );

    return true;
}


async function login() {

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;

    const role =
        document.getElementById("role").value;

    if (!username || !password) {

        alert("Please enter username and password.");

        return;
    }

    const success =
        await loginUser(
            username,
            password,
            role
        );

    if (!success) {
        return;
    }

    const userDisplay =
        document.getElementById("userDisplay");

    if (userDisplay) {

        userDisplay.textContent =
            currentUser.fullName +
            " (" +
            currentUser.role +
            ")";
    }

    showPage("dashboardPage");

    await loadInventory();
    await loadDashboardAnalytics();
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    currentUser = null;
    inventory = [];
    cart = [];
    currentShiftId = null;

    localStorage.removeItem("diamondStoreUser");
    localStorage.removeItem("diamondStoreShiftId");

    showPage("loginPage");
}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function hideAllPages() {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.add("hidden");

        });
}


function showPage(pageId) {

    hideAllPages();

    const page =
        document.getElementById(pageId);

    if (!page) {

        console.error(
            "Page not found:",
            pageId
        );

        return;
    }

    page.classList.remove("hidden");

    window.scrollTo(0, 0);
}


// ============================================================
// FEATURE 1 / 3
// INVENTORY
// ============================================================

async function loadInventory() {

    const result =
        await apiGet("inventory");

    if (!result.success) {

        console.error(result.message);

        return [];
    }

    inventory =
        result.inventory || [];

    renderInventory();
    populateRiceSelects();

    return inventory;
}


function findInventory(inventoryId) {

    return inventory.find(item =>
        String(item.inventoryId) ===
        String(inventoryId)
    );
}


function renderInventory() {

    const container =
        document.getElementById("inventoryList");

    if (!container) {
        return;
    }

    if (inventory.length === 0) {

        container.innerHTML =
            "<p>No inventory data.</p>";

        return;
    }

    container.innerHTML =
        inventory.map(item => {

            return `
                <div class="summary-card">

                    <strong>
                        ${escapeHtml(item.riceType)}
                    </strong>

                    <p>
                        Stock:
                        ${Number(item.quantitySacks || 0)}
                        Sacks |
                        ${Number(item.looseKg || item.quantityKg || 0)}
                        kg Loose
                    </p>

                    <p>
                        Price:
                        ${money(item.pricePerKg)} / kg
                    </p>

                </div>
            `;

        }).join("");
}


function populateRiceSelects() {

    const selects = [
        "posRice",
        "stockRice",
        "shipmentRice",
        "spoilageRice"
    ];

    selects.forEach(id => {

        const select =
            document.getElementById(id);

        if (!select) {
            return;
        }

        select.innerHTML = "";

        inventory.forEach(item => {

            const option =
                document.createElement("option");

            option.value =
                item.inventoryId;

            option.textContent =
                item.riceType;

            select.appendChild(option);
        });
    });

    updatePOSPrice();
}


function updatePOSPrice() {

    const select =
        document.getElementById("posRice");

    const price =
        document.getElementById("posPrice");

    if (!select || !price) {
        return;
    }

    const item =
        findInventory(select.value);

    price.value =
        item ? money(item.pricePerKg) : "";
}


// ============================================================
// STOCK PAGE
// ============================================================

async function showStock() {

    showPage("stockPage");

    await loadInventory();

    const editor =
        document.getElementById("adminStockEditor");

    if (editor) {

        editor.style.display =
            isAdmin() ? "block" : "none";
    }
}


// ============================================================
// UPDATE STOCK
// ============================================================

async function updateStock() {

    if (!isAdmin()) {

        alert("Only Admin can update stock.");

        return;
    }

    const inventoryId =
        document.getElementById("stockRice").value;

    const item =
        findInventory(inventoryId);

    if (!item) {

        alert("Please select rice type.");

        return;
    }

    const sacks =
        Number(
            document.getElementById("stockSacks").value
        );

    const looseKg =
        Number(
            document.getElementById("stockLoose").value
        );

    const price =
        Number(
            document.getElementById("stockPrice").value
        );

    const result =
        await apiRequest(
            "updateInventory",
            {
                inventoryId: inventoryId,
                riceType: item.riceType,
                quantitySacks: sacks,
                looseKg: looseKg,
                pricePerKg: price,
                role: currentUser.role,
                userId: currentUser.userId,
                userName: currentUser.fullName
            }
        );

    if (!result.success) {

        alert(result.message);

        return;
    }

    alert("Inventory updated successfully.");

    await loadInventory();
}


// ============================================================
// POS
// ============================================================

function addToCart() {

    const inventoryId =
        document.getElementById("posRice").value;

    const quantity =
        Number(
            document.getElementById("posQuantity").value
        );

    const item =
        findInventory(inventoryId);

    if (!item) {

        alert("Rice type not found.");

        return;
    }

    if (!quantity || quantity <= 0) {

        alert("Enter a valid quantity.");

        return;
    }

    const available =
        Number(
            item.totalKg ||
            item.quantityKg ||
            item.looseKg ||
            0
        );

    if (available > 0 && quantity > available) {

        alert(
            item.riceType +
            " only has " +
            available +
            " kg available."
        );

        return;
    }

    const existing =
        cart.find(x =>
            String(x.inventoryId) ===
            String(inventoryId)
        );

    if (existing) {

        existing.quantityKg += quantity;

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

    renderCart();
}


function renderCart() {

    const list =
        document.getElementById("cartList");

    const totalElement =
        document.getElementById("cartTotal");

    if (!list) {
        return;
    }

    if (cart.length === 0) {

        list.innerHTML =
            "<p>Cart is empty.</p>";

    } else {

        list.innerHTML =
            cart.map((item, index) => {

                return `
                    <div class="summary-card">

                        <strong>
                            ${escapeHtml(item.riceType)}
                        </strong>

                        <p>
                            ${item.quantityKg}
                            kg ×
                            ${money(item.pricePerKg)}
                        </p>

                        <strong>
                            ${money(item.subtotal)}
                        </strong>

                        <button
                            onclick="removeFromCart(${index})"
                        >
                            REMOVE
                        </button>

                    </div>
                `;

            }).join("");
    }

    if (totalElement) {

        totalElement.textContent =
            money(getCartTotal());
    }

    calculateChange();
}


function removeFromCart(index) {

    cart.splice(index, 1);

    renderCart();
}


function clearCart() {

    cart = [];

    renderCart();
}


function getCartTotal() {

    return cart.reduce(
        (total, item) =>
            total + Number(item.subtotal || 0),
        0
    );
}


// ============================================================
// CHANGE
// ============================================================

function calculateChange() {

    const cash =
        Number(
            document.getElementById("cashReceived")?.value || 0
        );

    const change =
        cash - getCartTotal();

    const output =
        document.getElementById("changeAmount");

    if (output) {

        output.value =
            money(change > 0 ? change : 0);
    }

    return change;
}


// ============================================================
// COMPLETE SALE
// ============================================================

async function completeSale() {

    if (!currentUser) {

        alert("Please login first.");

        return;
    }

    if (cart.length === 0) {

        alert("Cart is empty.");

        return;
    }

    const cash =
        Number(
            document.getElementById("cashReceived").value
        );

    const total =
        getCartTotal();

    if (!cash || cash < total) {

        alert("Insufficient cash.");

        return;
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

        alert(result.message);

        return;
    }

    alert(
        "SALE COMPLETED\n\n" +
        "Transaction: " +
        result.sale.transactionNumber +
        "\nTotal: " +
        money(result.sale.totalAmount) +
        "\nCash: " +
        money(result.sale.cashReceived) +
        "\nChange: " +
        money(result.sale.changeAmount)
    );

    clearCart();

    document.getElementById("cashReceived").value = 0;
    document.getElementById("changeAmount").value = money(0);

    await loadInventory();
    await loadDashboardAnalytics();
}


// ============================================================
// SHIFT SALES
// ============================================================

async function showShift() {

    showPage("shiftPage");

    if (!isAdmin()) {

        alert("Shift Sales is Admin only.");

        showPage("dashboardPage");

        return;
    }

    await loadShiftSummary();
}


async function startShift() {

    if (!currentUser) {

        alert("Please login first.");

        return;
    }

    const openingCash =
        Number(
            document.getElementById("openingCash").value
        ) || 0;

    const result =
        await apiRequest(
            "startShift",
            {
                cashierId:
                    currentUser.userId,

                cashierName:
                    currentUser.fullName,

                openingCash:
                    openingCash
            }
        );

    if (!result.success) {

        alert(result.message);

        return;
    }

    currentShiftId =
        result.shiftId;

    localStorage.setItem(
        "diamondStoreShiftId",
        currentShiftId
    );

    alert("Shift started successfully.");

    await loadShiftSummary();
}


async function loadShiftSummary() {

    const result =
        await apiRequest(
            "shiftSummary",
            {
                shiftId:
                    currentShiftId || ""
            }
        );

    const container =
        document.getElementById("shiftInfo");

    if (!container) {
        return;
    }

    if (!result.success) {

        container.innerHTML =
            "<p>" +
            escapeHtml(result.message) +
            "</p>";

        return;
    }

    const shift =
        result.shift || null;

    const transactions =
        result.transactions || [];

    if (!shift) {

        container.innerHTML =
            "<p>No shift record found.</p>";

        return;
    }

    container.innerHTML = `

        <div class="summary-card">

            <strong>
                Cashier:
            </strong>

            ${escapeHtml(shift.cashierName || "")}

            <p>
                Opening Cash:
                ${money(shift.openingCash)}
            </p>

            <p>
                Sales:
                ${money(shift.totalSales)}
            </p>

            <p>
                Status:
                ${escapeHtml(shift.status || "")}
            </p>

        </div>

        <h3>SHIFT TRANSACTIONS</h3>

        ${
            transactions.length
            ? transactions.map(t => `
                <div class="summary-card">
                    ${escapeHtml(t.transactionNumber)}
                    —
                    ${money(t.totalAmount)}
                </div>
            `).join("")
            : "<p>No transactions.</p>"
        }
    `;
}


async function closeCurrentShift() {

    if (!currentShiftId) {

        alert("No active shift.");

        return;
    }

    const closingCash =
        Number(
            document.getElementById("closingCash").value
        ) || 0;

    const result =
        await apiRequest(
            "closeShift",
            {
                shiftId:
                    currentShiftId,

                closingCash:
                    closingCash
            }
        );

    if (!result.success) {

        alert(result.message);

        return;
    }

    alert(
        "SHIFT CLOSED\n\n" +
        "Total Sales: " +
        money(result.totalSales)
    );

    currentShiftId = null;

    localStorage.removeItem(
        "diamondStoreShiftId"
    );

    await loadShiftSummary();
}


// ============================================================
// SUPPLIERS
// ============================================================

async function showSupplier() {

    if (!isAdmin()) {

        alert("Suppliers is Admin only.");

        return;
    }

    showPage("supplierPage");

    await loadSuppliers();
}


async function loadSuppliers() {

    const result =
        await apiGet("suppliers");

    if (!result.success) {

        console.error(result.message);

        return [];
    }

    suppliers =
        result.suppliers || [];

    return suppliers;
}


async function saveSupplier() {

    if (!isAdmin()) {

        alert("Only Admin can add suppliers.");

        return;
    }

    const name =
        document.getElementById("supplierName").value.trim();

    const contact =
        document.getElementById("supplierContact").value.trim();

    const address =
        document.getElementById("supplierAddress").value.trim();

    if (!name) {

        alert("Enter supplier name.");

        return;
    }

    const result =
        await apiRequest(
            "addSupplier",
            {
                supplierName: name,
                contactNumber: contact,
                address: address,

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName
            }
        );

    if (!result.success) {

        alert(result.message);

        return;
    }

    alert("Supplier added successfully.");

    document.getElementById("supplierName").value = "";
    document.getElementById("supplierContact").value = "";
    document.getElementById("supplierAddress").value = "";

    await loadSuppliers();
}


async function saveShipment() {

    if (!isAdmin()) {

        alert("Only Admin can save shipments.");

        return;
    }

    const riceSelect =
        document.getElementById("shipmentRice");

    const item =
        findInventory(riceSelect.value);

    const sacks =
        Number(
            document.getElementById("shipmentSacks").value
        );

    const cost =
        Number(
            document.getElementById("shipmentCost").value
        );

    if (!item || sacks <= 0) {

        alert("Enter valid shipment information.");

        return;
    }

    const supplierName =
        document.getElementById("supplierName").value.trim();

    const result =
        await apiRequest(
            "saveShipment",
            {
                supplierId: "",
                supplierName:
                    supplierName,

                riceType:
                    item.riceType,

                sacksReceived:
                    sacks,

                totalCost:
                    cost,

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName
            }
        );

    if (!result.success) {

        alert(result.message);

        return;
    }

    alert(
        "Shipment saved and inventory updated."
    );

    document.getElementById("shipmentSacks").value = "";
    document.getElementById("shipmentCost").value = "";

    await loadInventory();
}


// ============================================================
// SPOILAGE
// ============================================================

async function showSpoilage() {

    if (!isAdmin()) {

        alert("Spoilage is Admin only.");

        return;
    }

    showPage("spoilagePage");

    await loadInventory();
}


async function recordSpoilage() {

    if (!isAdmin()) {

        alert("Only Admin can record spoilage.");

        return;
    }

    const inventoryId =
        document.getElementById("spoilageRice").value;

    const item =
        findInventory(inventoryId);

    const damagedKg =
        Number(
            document.getElementById("damagedKg").value
        );

    const reason =
        document.getElementById("spoilageReason").value.trim();

    if (!item || damagedKg <= 0 || !reason) {

        alert("Complete all spoilage fields.");

        return;
    }

    const result =
        await apiRequest(
            "recordSpoilage",
            {
                inventoryId:
                    inventoryId,

                riceType:
                    item.riceType,

                damagedKg:
                    damagedKg,

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

        alert(result.message);

        return;
    }

    alert(
        "Spoilage recorded.\nEstimated Loss: " +
        money(result.estimatedLoss)
    );

    document.getElementById("damagedKg").value = "";
    document.getElementById("spoilageReason").value = "";

    await loadInventory();
    await loadDashboardAnalytics();
}


// ============================================================
// ANALYTICS
// ============================================================

async function showAnalytics() {

    if (!isAdmin()) {

        alert("Sales Analytics is Admin only.");

        return;
    }

    showPage("analyticsPage");

    await loadAnalytics();
}


async function loadAnalytics() {

    const result =
        await apiGet("analytics");

    if (!result.success) {

        alert(result.message);

        return null;
    }

    const analytics =
        result.analytics || {};

    const revenue =
        document.getElementById("analyticsRevenue");

    const profit =
        document.getElementById("analyticsProfit");

    const top =
        document.getElementById("analyticsTop");

    if (revenue)
        revenue.textContent =
            money(analytics.dailyRevenue);

    if (profit)
        profit.textContent =
            money(analytics.totalProfit);

    if (top)
        top.textContent =
            analytics.topSelling || "-";

    renderProductAnalytics(
        analytics.products || []
    );

    return analytics;
}


function renderProductAnalytics(products) {

    const container =
        document.getElementById("productAnalytics");

    if (!container) {
        return;
    }

    if (!products.length) {

        container.innerHTML =
            "<p>No sales data yet.</p>";

        return;
    }

    container.innerHTML =
        products.map(item => {

            return `
                <div class="summary-card">

                    <strong>
                        ${escapeHtml(item.riceType)}
                    </strong>

                    <p>
                        Sold:
                        ${Number(item.quantityKg || 0)}
                        kg
                    </p>

                    <p>
                        Revenue:
                        ${money(item.revenue)}
                    </p>

                    <p>
                        Profit:
                        ${money(item.profit)}
                    </p>

                </div>
            `;

        }).join("");
}


// ============================================================
// DASHBOARD ANALYTICS
// ============================================================

async function loadDashboardAnalytics() {

    const result =
        await apiGet("analytics");

    if (!result.success) {
        return;
    }

    const a =
        result.analytics || {};

    const revenue =
        document.getElementById("dashRevenue");

    const profit =
        document.getElementById("dashProfit");

    const top =
        document.getElementById("dashTop");

    if (revenue)
        revenue.textContent =
            money(a.dailyRevenue);

    if (profit)
        profit.textContent =
            money(a.totalProfit);

    if (top)
        top.textContent =
            a.topSelling || "-";
}


// ============================================================
// EXPORT
// ============================================================

async function exportReport() {

    const result =
        await apiGet("report");

    if (!result.success) {

        alert(result.message);

        return;
    }

    const rows =
        result.rows || [];

    if (!rows.length) {

        alert("No sales records to export.");

        return;
    }

    const headers =
        Object.keys(rows[0]);

    let csv =
        headers.join(",") + "\n";

    rows.forEach(row => {

        csv +=
            headers.map(h => {

                return '"' +
                    String(row[h] ?? "")
                        .replace(/"/g, '""') +
                    '"';

            }).join(",") +
            "\n";
    });

    const blob =
        new Blob(
            [csv],
            { type: "text/csv;charset=utf-8;" }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "Diamond-Store-Sales-Report.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}


// Keep compatibility with existing HTML
function exportSalesReport() {
    exportReport();
}


// ============================================================
// POS EVENTS
// ============================================================

document.addEventListener(
    "change",
    function(event) {

        if (event.target.id === "posRice") {

            updatePOSPrice();
        }
    }
);


// ============================================================
// SECURITY / DISPLAY HELPER
// ============================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        restoreSession();
        restoreShift();

        if (currentUser) {

            const display =
                document.getElementById("userDisplay");

            if (display) {

                display.textContent =
                    currentUser.fullName +
                    " (" +
                    currentUser.role +
                    ")";
            }

            showPage("dashboardPage");

            await loadInventory();
            await loadDashboardAnalytics();

        } else {

            showPage("loginPage");
        }
    }
);
