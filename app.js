// ============================================================
// DIAMOND STORE POS & INVENTORY SYSTEM
// FULL FRONTEND JAVASCRIPT
// GitHub + Vercel + Google Apps Script + Google Sheets
// ============================================================


// ============================================================
// GOOGLE APPS SCRIPT WEB APP URL
// ============================================================

const API =
    "https://script.google.com/macros/s/AKfycbxt7gvro_J4zyqp-L5mXiF--TE90TpbVVrYRl5QtyNC6XlE2Mmp_Albo2nJqO0ssuXvAg/exec";


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;

let inventory = [];

let cart = [];

let suppliers = [];

let currentShiftId = null;


// ============================================================
// API POST
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


        if (!response.ok) {

            throw new Error(
                "HTTP error " + response.status
            );
        }


        const result =
            await response.json();


        return result;


    } catch (error) {

        console.error(
            "API ERROR:",
            error
        );


        return {

            success: false,

            message:
                "Unable to connect to Google Apps Script."
        };
    }
}


// ============================================================
// API GET
// ============================================================

async function apiGet(action) {

    try {

        const response =
            await fetch(
                API +
                "?action=" +
                encodeURIComponent(action)
            );


        if (!response.ok) {

            throw new Error(
                "HTTP error " +
                response.status
            );
        }


        return await response.json();


    } catch (error) {

        console.error(
            "GET API ERROR:",
            error
        );


        return {

            success: false,

            message:
                "Unable to connect to Google Apps Script."
        };
    }
}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function hideAllPages() {

    document
        .querySelectorAll(".page")
        .forEach(function(page) {

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


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ============================================================
// ROLE HELPERS
// ============================================================

function isAdmin() {

    return (
        currentUser &&
        String(currentUser.role)
            .toLowerCase() === "admin"
    );
}


function isCashier() {

    return (
        currentUser &&
        String(currentUser.role)
            .toLowerCase() === "cashier"
    );
}


// ============================================================
// MONEY FORMAT
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
// HTML SAFETY
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
// SESSION
// ============================================================

function restoreSession() {

    const saved =
        localStorage.getItem(
            "diamondStoreUser"
        );


    if (!saved) {

        currentUser = null;

        return null;
    }


    try {

        currentUser =
            JSON.parse(saved);


        return currentUser;


    } catch (error) {

        console.error(error);

        localStorage.removeItem(
            "diamondStoreUser"
        );

        currentUser = null;

        return null;
    }
}


// ============================================================
// SHIFT SESSION
// ============================================================

function restoreShift() {

    currentShiftId =
        localStorage.getItem(
            "diamondStoreShiftId"
        );


    return currentShiftId;
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


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Invalid User ID/Username, password or role."
        );

        return false;
    }


    currentUser =
        result.user;


    localStorage.setItem(
        "diamondStoreUser",
        JSON.stringify(currentUser)
    );


    return true;
}


// ============================================================
// LOGIN BUTTON
// ============================================================

async function login() {

    const usernameInput =
        document.getElementById(
            "username"
        );


    const passwordInput =
        document.getElementById(
            "password"
        );


    const roleInput =
        document.getElementById(
            "role"
        );


    const message =
        document.getElementById(
            "loginMessage"
        );


    if (
        !usernameInput ||
        !passwordInput ||
        !roleInput
    ) {

        console.error(
            "Login fields not found."
        );

        return;
    }


    const username =
        usernameInput.value.trim();


    const password =
        passwordInput.value;


    const role =
        roleInput.value;


    if (!username) {

        if (message) {

            message.textContent =
                "Please enter User ID or Username.";
        }

        return;
    }


    if (!password) {

        if (message) {

            message.textContent =
                "Please enter your password.";
        }

        return;
    }


    if (message) {

        message.textContent =
            "Logging in...";
    }


    const success =
        await loginUser(
            username,
            password,
            role
        );


    if (!success) {

        if (message) {

            message.textContent =
                "Login failed.";
        }

        return;
    }


    updateUserDisplay();


    configureRoleAccess();


    showPage(
        "dashboardPage"
    );


    await loadInventory();

    await loadDashboardAnalytics();


    if (message) {

        message.textContent =
            "";
    }
}


// ============================================================
// USER DISPLAY
// ============================================================

function updateUserDisplay() {

    const display =
        document.getElementById(
            "userDisplay"
        );


    if (
        display &&
        currentUser
    ) {

        display.textContent =
            currentUser.fullName +
            " (" +
            currentUser.role +
            ")";
    }
}


// ============================================================
// ROLE ACCESS
// ============================================================

function configureRoleAccess() {

    const admin =
        isAdmin();


    const shiftButton =
        document.getElementById(
            "shiftButton"
        );


    const supplierButton =
        document.getElementById(
            "supplierButton"
        );


    const spoilageButton =
        document.getElementById(
            "spoilageButton"
        );


    const analyticsButton =
        document.getElementById(
            "analyticsButton"
        );


    const editor =
        document.getElementById(
            "adminStockEditor"
        );


    if (shiftButton) {

        shiftButton.style.display =
            admin ? "block" : "none";
    }


    if (supplierButton) {

        supplierButton.style.display =
            admin ? "block" : "none";
    }


    if (spoilageButton) {

        spoilageButton.style.display =
            admin ? "block" : "none";
    }


    if (analyticsButton) {

        analyticsButton.style.display =
            admin ? "block" : "none";
    }


    if (editor) {

        editor.style.display =
            admin ? "block" : "none";
    }
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    currentUser = null;

    inventory = [];

    cart = [];

    suppliers = [];

    currentShiftId = null;


    localStorage.removeItem(
        "diamondStoreUser"
    );


    localStorage.removeItem(
        "diamondStoreShiftId"
    );


    showPage(
        "loginPage"
    );


    const username =
        document.getElementById(
            "username"
        );


    const password =
        document.getElementById(
            "password"
        );


    const message =
        document.getElementById(
            "loginMessage"
        );


    if (username) {
        username.value = "";
    }


    if (password) {
        password.value = "";
    }


    if (message) {
        message.textContent = "";
    }
}


// ============================================================
// FEATURE 3
// LOAD INVENTORY
// ============================================================

async function loadInventory() {

    const result =
        await apiGet(
            "inventory"
        );


    if (
        !result ||
        !result.success
    ) {

        console.error(
            result?.message ||
            "Inventory loading failed."
        );

        return [];
    }


    inventory =
        Array.isArray(
            result.inventory
        )
            ? result.inventory
            : [];


    renderInventory();


    populateRiceSelects();


    return inventory;
}


// ============================================================
// FIND INVENTORY ITEM
// ============================================================

function findInventory(
    inventoryId
) {

    return inventory.find(
        function(item) {

            return String(
                item.inventoryId
            ) === String(
                inventoryId
            );

        }
    );
}


// ============================================================
// GET AVAILABLE KG
// ============================================================

function getAvailableKg(item) {

    if (!item) {
        return 0;
    }


    if (
        item.totalKg !== undefined
    ) {

        return Number(
            item.totalKg
        ) || 0;
    }


    const sacks =
        Number(
            item.quantitySacks ||
            item.sacks ||
            0
        );


    const loose =
        Number(
            item.looseKg ||
            0
        );


    /*
     * 1 sack = 50 kg
     */

    return (
        sacks * 50 +
        loose
    );
}


// ============================================================
// RENDER INVENTORY
// ============================================================

function renderInventory() {

    const container =
        document.getElementById(
            "inventoryList"
        );


    if (!container) {
        return;
    }


    if (!inventory.length) {

        container.innerHTML =
            "<p>No inventory data available.</p>";

        return;
    }


    container.innerHTML =
        inventory
            .map(function(item) {

                const sacks =
                    Number(
                        item.quantitySacks ??
                        item.sacks ??
                        0
                    );


                const loose =
                    Number(
                        item.looseKg ??
                        0
                    );


                const price =
                    Number(
                        item.pricePerKg ??
                        0
                    );


                const totalKg =
                    getAvailableKg(item);


                const lowStock =
                    item.lowStock === true;


                return `

                    <div class="inventory-card
                        ${lowStock ? "low-stock" : ""}">

                        <h3>
                            ${escapeHtml(
                                item.riceType
                            )}
                        </h3>

                        <div class="inventory-details">

                            <div>
                                <strong>
                                    Sacks
                                </strong>
                                <br>
                                ${sacks}
                            </div>

                            <div>
                                <strong>
                                    Loose
                                </strong>
                                <br>
                                ${loose} kg
                            </div>

                            <div>
                                <strong>
                                    Total
                                </strong>
                                <br>
                                ${totalKg} kg
                            </div>

                        </div>

                        <p>
                            Price:
                            ${money(price)}
                            / kg
                        </p>

                        <p>
                            ${
                                lowStock
                                ? "LOW STOCK"
                                : "Available"
                            }
                        </p>

                    </div>
                `;

            })
            .join("");
}


// ============================================================
// POPULATE RICE SELECTS
// ============================================================

function populateRiceSelects() {

    const ids = [

        "posRice",

        "stockRice",

        "shipmentRice",

        "spoilageRice"

    ];


    ids.forEach(function(id) {

        const select =
            document.getElementById(
                id
            );


        if (!select) {
            return;
        }


        const previousValue =
            select.value;


        select.innerHTML =
            '<option value="">Select rice</option>';


        inventory.forEach(
            function(item) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    item.inventoryId;


                option.textContent =
                    item.riceType;


                select.appendChild(
                    option
                );
            }
        );


        if (
            previousValue &&
            findInventory(previousValue)
        ) {

            select.value =
                previousValue;
        }

    });


    updatePOSPrice();

    updateStockEditorFields();
}


// ============================================================
// POS PRICE
// ============================================================

function updatePOSPrice() {

    const select =
        document.getElementById(
            "posRice"
        );


    const priceField =
        document.getElementById(
            "posPrice"
        );


    if (
        !select ||
        !priceField
    ) {
        return;
    }


    const item =
        findInventory(
            select.value
        );


    if (!item) {

        priceField.value =
            "";

        return;
    }


    priceField.value =
        money(
            item.pricePerKg
        );
}


// ============================================================
// STOCK EDITOR FIELDS
// ============================================================

function updateStockEditorFields() {

    const select =
        document.getElementById(
            "stockRice"
        );


    if (
        !select ||
        !select.value
    ) {
        return;
    }


    const item =
        findInventory(
            select.value
        );


    if (!item) {
        return;
    }


    const sacks =
        document.getElementById(
            "stockSacks"
        );


    const loose =
        document.getElementById(
            "stockLoose"
        );


    const price =
        document.getElementById(
            "stockPrice"
        );


    if (sacks) {

        sacks.value =
            Number(
                item.quantitySacks ??
                item.sacks ??
                0
            );
    }


    if (loose) {

        loose.value =
            Number(
                item.looseKg ??
                0
            );
    }


    if (price) {

        price.value =
            Number(
                item.pricePerKg ??
                0
            );
    }
}


// ============================================================
// SELECT CHANGE
// ============================================================

document.addEventListener(
    "change",
    function(event) {

        if (
            event.target.id ===
            "posRice"
        ) {

            updatePOSPrice();
        }


        if (
            event.target.id ===
            "stockRice"
        ) {

            updateStockEditorFields();
        }

    }
);


// ============================================================
// FEATURE 2
// ADD TO CART
// ============================================================

function addToCart() {

    const select =
        document.getElementById(
            "posRice"
        );


    const quantityInput =
        document.getElementById(
            "posQuantity"
        );


    if (
        !select ||
        !quantityInput
    ) {
        return;
    }


    const inventoryId =
        select.value;


    const quantity =
        Number(
            quantityInput.value
        );


    const item =
        findInventory(
            inventoryId
        );


    if (!item) {

        alert(
            "Please select a rice type."
        );

        return;
    }


    if (
        isNaN(quantity) ||
        quantity <= 0
    ) {

        alert(
            "Please enter a valid quantity."
        );

        return;
    }


    const available =
        getAvailableKg(item);


    const existing =
        cart.find(
            function(cartItem) {

                return String(
                    cartItem.inventoryId
                ) === String(
                    inventoryId
                );

            }
        );


    const existingQuantity =
        existing
            ? Number(
                existing.quantityKg
            )
            : 0;


    if (
        available > 0 &&
        (
            existingQuantity +
            quantity
        ) > available
    ) {

        alert(

            item.riceType +
            " only has " +
            available +
            " kg available."

        );

        return;
    }


    const price =
        Number(
            item.pricePerKg
        ) || 0;


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
                price,

            costPerKg:
                Number(
                    item.costPerKg
                ) || 0,

            subtotal:
                quantity *
                price
        });
    }


    renderCart();


    quantityInput.value =
        1;
}


// ============================================================
// CART
// ============================================================

function renderCart() {

    const container =
        document.getElementById(
            "cartList"
        );


    const totalElement =
        document.getElementById(
            "cartTotal"
        );


    if (!container) {
        return;
    }


    if (!cart.length) {

        container.innerHTML =
            "<p>Cart is empty.</p>";

    } else {

        container.innerHTML =
            cart.map(
                function(item, index) {

                    return `

                        <div class="cart-item">

                            <span>

                                <strong>
                                    ${escapeHtml(
                                        item.riceType
                                    )}
                                </strong>

                                <br>

                                ${item.quantityKg}
                                kg @
                                ${money(
                                    item.pricePerKg
                                )}
                                /kg

                            </span>

                            <span>

                                ${money(
                                    item.subtotal
                                )}

                                <button
                                    type="button"
                                    onclick="removeFromCart(${index})"
                                >
                                    REMOVE
                                </button>

                            </span>

                        </div>

                    `;
                }
            ).join("");
    }


    if (totalElement) {

        totalElement.textContent =
            money(
                getCartTotal()
            );
    }


    calculateChange();
}


// ============================================================
// REMOVE CART ITEM
// ============================================================

function removeFromCart(index) {

    if (
        index < 0 ||
        index >= cart.length
    ) {
        return;
    }


    cart.splice(
        index,
        1
    );


    renderCart();
}


// ============================================================
// CART TOTAL
// ============================================================

function getCartTotal() {

    return cart.reduce(

        function(total, item) {

            return (
                total +
                (
                    Number(
                        item.subtotal
                    ) || 0
                )
            );
        },

        0
    );
}


// ============================================================
// CLEAR CART
// ============================================================

function clearCart() {

    cart = [];

    renderCart();
}


// ============================================================
// CHANGE
// ============================================================

function calculateChange() {

    const cashInput =
        document.getElementById(
            "cashReceived"
        );


    const changeOutput =
        document.getElementById(
            "changeAmount"
        );


    if (
        !cashInput ||
        !changeOutput
    ) {
        return;
    }


    const cash =
        Number(
            cashInput.value
        ) || 0;


    const total =
        getCartTotal();


    const change =
        cash - total;


    if (change < 0) {

        changeOutput.value =
            "Insufficient cash";

    } else {

        changeOutput.value =
            money(change);
    }
}


// ============================================================
// FEATURE 2
// COMPLETE SALE
// ============================================================

async function completeSale() {

    if (!currentUser) {

        alert(
            "Please login first."
        );

        return;
    }


    if (!cart.length) {

        alert(
            "Cart is empty."
        );

        return;
    }


    const cashInput =
        document.getElementById(
            "cashReceived"
        );


    const cash =
        Number(
            cashInput?.value
        );


    const total =
        getCartTotal();


    if (
        isNaN(cash) ||
        cash <= 0
    ) {

        alert(
            "Please enter cash handed."
        );

        return;
    }


    if (cash < total) {

        alert(
            "Insufficient cash."
        );

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


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Sale could not be completed."
        );

        return;
    }


    const sale =
        result.sale || {};


    alert(

        "SALE COMPLETED\n\n" +

        "Transaction: " +
        (
            sale.transactionNumber ||
            "-"
        ) +

        "\n\nTotal: " +
        money(
            sale.totalAmount
        ) +

        "\nCash: " +
        money(
            sale.cashReceived
        ) +

        "\nChange: " +
        money(
            sale.changeAmount
        )

    );


    clearCart();


    if (cashInput) {

        cashInput.value =
            "0";
    }


    const change =
        document.getElementById(
            "changeAmount"
        );


    if (change) {

        change.value =
            money(0);
    }


    await loadInventory();

    await loadDashboardAnalytics();
}


// ============================================================
// OPEN POS
// ============================================================

function showPOS() {

    showPage(
        "posPage"
    );


    loadInventory();
}


// ============================================================
// FEATURE 3
// STOCK TRACKER
// ============================================================

async function showStock() {

    showPage(
        "stockPage"
    );


    await loadInventory();


    const editor =
        document.getElementById(
            "adminStockEditor"
        );


    if (editor) {

        editor.style.display =
            isAdmin()
                ? "block"
                : "none";
    }
}


// ============================================================
// UPDATE STOCK
// ============================================================

async function updateStock() {

    if (!isAdmin()) {

        alert(
            "Only Admin can update stock."
        );

        return;
    }


    const select =
        document.getElementById(
            "stockRice"
        );


    const item =
        findInventory(
            select?.value
        );


    if (!item) {

        alert(
            "Please select a rice type."
        );

        return;
    }


    const sacks =
        Number(
            document.getElementById(
                "stockSacks"
            )?.value
        );


    const looseKg =
        Number(
            document.getElementById(
                "stockLoose"
            )?.value
        );


    const pricePerKg =
        Number(
            document.getElementById(
                "stockPrice"
            )?.value
        );


    if (
        isNaN(sacks) ||
        sacks < 0 ||
        isNaN(looseKg) ||
        looseKg < 0 ||
        isNaN(pricePerKg) ||
        pricePerKg < 0
    ) {

        alert(
            "Please enter valid stock information."
        );

        return;
    }


    const result =
        await apiRequest(
            "updateInventory",
            {

                inventoryId:
                    item.inventoryId,

                riceType:
                    item.riceType,

                quantitySacks:
                    sacks,

                looseKg:
                    looseKg,

                pricePerKg:
                    pricePerKg,

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName
            }
        );


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Stock update failed."
        );

        return;
    }


    alert(
        "Inventory updated successfully."
    );


    await loadInventory();
}


// ============================================================
// FEATURE 4
// SHIFT SALES
// ============================================================

async function showShift() {

    if (!isAdmin()) {

        alert(
            "Shift Sales is Admin only."
        );

        return;
    }


    showPage(
        "shiftPage"
    );


    await loadShiftSummary();
}


// ============================================================
// START SHIFT
// ============================================================

async function startShift() {

    if (!currentUser) {

        alert(
            "Please login first."
        );

        return;
    }


    const openingCash =
        Number(
            document.getElementById(
                "openingCash"
            )?.value
        );


    if (
        isNaN(openingCash) ||
        openingCash < 0
    ) {

        alert(
            "Please enter valid opening cash."
        );

        return;
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
                    openingCash
            }
        );


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Unable to start shift."
        );

        return;
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


    await loadShiftSummary();
}


// ============================================================
// LOAD SHIFT SUMMARY
// ============================================================

async function loadShiftSummary() {

    const container =
        document.getElementById(
            "shiftInfo"
        );


    if (!container) {
        return;
    }


    const result =
        await apiRequest(
            "shiftSummary",
            {
                shiftId:
                    currentShiftId || ""
            }
        );


    if (
        !result ||
        !result.success
    ) {

        container.innerHTML =
            "<p>" +
            escapeHtml(
                result?.message ||
                "Unable to load shift."
            ) +
            "</p>";

        return;
    }


    const shift =
        result.shift;


    const transactions =
        Array.isArray(
            result.transactions
        )
            ? result.transactions
            : [];


    if (!shift) {

        container.innerHTML =
            "<p>No active shift.</p>";

        return;
    }


    const openingCash =
        Number(
            shift.OpeningCash ??
            shift.openingCash ??
            0
        );


    const totalSales =
        Number(
            shift.totalSales ??
            shift.TotalSales ??
            0
        );


    const status =
        shift.Status ??
        shift.status ??
        "OPEN";


    container.innerHTML = `

        <div class="summary-card">

            <strong>
                Cashier Name
            </strong>

            <p>
                ${escapeHtml(
                    shift.CashierName ??
                    shift.cashierName ??
                    ""
                )}
            </p>

            <strong>
                Cash Drawer Total
            </strong>

            <p>
                ${money(totalSales)}
            </p>

            <p>
                Opening Cash:
                ${money(openingCash)}
            </p>

            <p>
                Status:
                ${escapeHtml(
                    status
                )}
            </p>

        </div>

        <h3>
            SHIFT TRANSACTIONS
        </h3>

        <div class="cart-list">

            ${
                transactions.length

                ? transactions
                    .map(
                        function(transaction) {

                            return `

                                <div class="cart-item">

                                    <span>
                                        ${escapeHtml(
                                            transaction.transactionNumber ||
                                            transaction.TransactionNumber ||
                                            ""
                                        )}
                                    </span>

                                    <strong>
                                        ${money(
                                            transaction.totalAmount ||
                                            transaction.TotalAmount ||
                                            0
                                        )}
                                    </strong>

                                </div>
                            `;
                        }
                    )
                    .join("")

                : "<p>No transactions yet.</p>"
            }

        </div>
    `;
}


// ============================================================
// CLOSE SHIFT
// ============================================================

async function closeCurrentShift() {

    if (!currentShiftId) {

        alert(
            "No active shift."
        );

        return;
    }


    const closingCash =
        Number(
            document.getElementById(
                "closingCash"
            )?.value
        );


    if (
        isNaN(closingCash) ||
        closingCash < 0
    ) {

        alert(
            "Please enter valid closing cash."
        );

        return;
    }


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


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Unable to close shift."
        );

        return;
    }


    alert(

        "SHIFT CLOSED\n\n" +

        "Total Sales: " +
        money(
            result.totalSales
        ) +

        "\nClosing Cash: " +
        money(
            result.closingCash
        )

    );


    currentShiftId =
        null;


    localStorage.removeItem(
        "diamondStoreShiftId"
    );


    await loadShiftSummary();
}


// ============================================================
// FEATURE 5
// SUPPLIER
// ============================================================

async function showSupplier() {

    if (!isAdmin()) {

        alert(
            "Suppliers is Admin only."
        );

        return;
    }


    showPage(
        "supplierPage"
    );


    await loadSuppliers();
}


// ============================================================
// LOAD SUPPLIERS
// ============================================================

async function loadSuppliers() {

    const result =
        await apiGet(
            "suppliers"
        );


    if (
        !result ||
        !result.success
    ) {

        console.error(
            result?.message ||
            "Unable to load suppliers."
        );

        return [];
    }


    suppliers =
        Array.isArray(
            result.suppliers
        )
            ? result.suppliers
            : [];


    return suppliers;
}


// ============================================================
// ADD SUPPLIER
// ============================================================

async function saveSupplier() {

    if (!isAdmin()) {

        alert(
            "Only Admin can add suppliers."
        );

        return;
    }


    const name =
        document.getElementById(
            "supplierName"
        )?.value.trim();


    const contact =
        document.getElementById(
            "supplierContact"
        )?.value.trim();


    const address =
        document.getElementById(
            "supplierAddress"
        )?.value.trim();


    if (!name) {

        alert(
            "Supplier name is required."
        );

        return;
    }


    const result =
        await apiRequest(
            "addSupplier",
            {

                supplierName:
                    name,

                contactNumber:
                    contact,

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


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Unable to add supplier."
        );

        return;
    }


    alert(
        "Supplier added successfully."
    );


    const message =
        document.getElementById(
            "supplierMessage"
        );


    if (message) {

        message.textContent =
            "Supplier saved successfully.";
    }


    const nameField =
        document.getElementById(
            "supplierName"
        );


    const contactField =
        document.getElementById(
            "supplierContact"
        );


    const addressField =
        document.getElementById(
            "supplierAddress"
        );


    if (nameField) {
        nameField.value = "";
    }


    if (contactField) {
        contactField.value = "";
    }


    if (addressField) {
        addressField.value = "";
    }


    await loadSuppliers();
}


// ============================================================
// SAVE SHIPMENT
// ============================================================

async function saveShipment() {

    if (!isAdmin()) {

        alert(
            "Only Admin can save shipments."
        );

        return;
    }


    const supplierName =
        document.getElementById(
            "supplierName"
        )?.value.trim();


    const riceSelect =
        document.getElementById(
            "shipmentRice"
        );


    const riceItem =
        findInventory(
            riceSelect?.value
        );


    const sacks =
        Number(
            document.getElementById(
                "shipmentSacks"
            )?.value
        );


    const totalCost =
        Number(
            document.getElementById(
                "shipmentCost"
            )?.value
        );


    if (!supplierName) {

        alert(
            "Enter supplier name."
        );

        return;
    }


    if (!riceItem) {

        alert(
            "Select rice type."
        );

        return;
    }


    if (
        isNaN(sacks) ||
        sacks <= 0
    ) {

        alert(
            "Enter valid sacks received."
        );

        return;
    }


    if (
        isNaN(totalCost) ||
        totalCost < 0
    ) {

        alert(
            "Enter valid total cost."
        );

        return;
    }


    const result =
        await apiRequest(
            "saveShipment",
            {

                supplierId:
                    "",

                supplierName:
                    supplierName,

                riceType:
                    riceItem.riceType,

                sacksReceived:
                    sacks,

                totalCost:
                    totalCost,

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName
            }
        );


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Unable to save shipment."
        );

        return;
    }


    alert(
        "Shipment saved and inventory updated."
    );


    const sacksField =
        document.getElementById(
            "shipmentSacks"
        );


    const costField =
        document.getElementById(
            "shipmentCost"
        );


    if (sacksField) {
        sacksField.value = "";
    }


    if (costField) {
        costField.value = "";
    }


    const message =
        document.getElementById(
            "supplierMessage"
        );


    if (message) {

        message.textContent =
            "Shipment saved successfully.";
    }


    await loadInventory();
}


// ============================================================
// FEATURE 6
// SPOILAGE
// ============================================================

async function showSpoilage() {

    if (!isAdmin()) {

        alert(
            "Spoilage is Admin only."
        );

        return;
    }


    showPage(
        "spoilagePage"
    );


    await loadInventory();
}


// ============================================================
// RECORD SPOILAGE
// ============================================================

async function recordSpoilage() {

    if (!isAdmin()) {

        alert(
            "Only Admin can record spoilage."
        );

        return;
    }


    const select =
        document.getElementById(
            "spoilageRice"
        );


    const item =
        findInventory(
            select?.value
        );


    const damagedKg =
        Number(
            document.getElementById(
                "damagedKg"
            )?.value
        );


    const reason =
        document.getElementById(
            "spoilageReason"
        )?.value.trim();


    if (!item) {

        alert(
            "Select rice type."
        );

        return;
    }


    if (
        isNaN(damagedKg) ||
        damagedKg <= 0
    ) {

        alert(
            "Enter valid damaged weight."
        );

        return;
    }


    const available =
        getAvailableKg(item);


    if (
        available > 0 &&
        damagedKg > available
    ) {

        alert(

            "Cannot deduct " +
            damagedKg +
            " kg. Available stock is " +
            available +
            " kg."

        );

        return;
    }


    if (!reason) {

        alert(
            "Please enter the reason."
        );

        return;
    }


    const result =
        await apiRequest(
            "recordSpoilage",
            {

                inventoryId:
                    item.inventoryId,

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


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Unable to record spoilage."
        );

        return;
    }


    alert(

        "Spoilage recorded.\n\n" +

        "Estimated Loss: " +

        money(
            result.estimatedLoss
        )

    );


    const damagedField =
        document.getElementById(
            "damagedKg"
        );


    const reasonField =
        document.getElementById(
            "spoilageReason"
        );


    if (damagedField) {
        damagedField.value = "";
    }


    if (reasonField) {
        reasonField.value = "";
    }


    const message =
        document.getElementById(
            "spoilageMessage"
        );


    if (message) {

        message.textContent =
            "Spoilage recorded successfully.";
    }


    await loadInventory();

    await loadDashboardAnalytics();
}


// ============================================================
// FEATURE 7
// ANALYTICS
// ============================================================

async function showAnalytics() {

    if (!isAdmin()) {

        alert(
            "Sales Analytics is Admin only."
        );

        return;
    }


    showPage(
        "analyticsPage"
    );


    await loadAnalytics();
}


// ============================================================
// LOAD ANALYTICS
// ============================================================

async function loadAnalytics() {

    const result =
        await apiGet(
            "analytics"
        );


    if (
        !result ||
        !result.success
    ) {

        console.error(
            result?.message ||
            "Analytics loading failed."
        );

        return null;
    }


    const data =
        result.analytics ||
        {};


    const revenue =
        document.getElementById(
            "analyticsRevenue"
        );


    const profit =
        document.getElementById(
            "analyticsProfit"
        );


    const top =
        document.getElementById(
            "analyticsTop"
        );


    if (revenue) {

        revenue.textContent =
            money(
                data.dailyRevenue
            );
    }


    if (profit) {

        profit.textContent =
            money(
                data.totalProfit
            );
    }


    if (top) {

        top.textContent =
            data.topSelling ||
            "-";
    }


    renderProductAnalytics(
        data.products
    );


    return data;
}


// ============================================================
// PRODUCT ANALYTICS
// ============================================================

function renderProductAnalytics(
    products
) {

    const container =
        document.getElementById(
            "productAnalytics"
        );


    if (!container) {
        return;
    }


    if (
        !products ||
        typeof products !== "object" ||
        Array.isArray(products) &&
        products.length === 0
    ) {

        container.innerHTML =
            "<p>No sales data yet.</p>";

        return;
    }


    let items = [];


    if (Array.isArray(products)) {

        items =
            products;

    } else {

        items =
            Object.keys(
                products
            ).map(
                function(name) {

                    const item =
                        products[name];


                    return {

                        riceType:
                            item.riceType ||
                            name,

                        quantityKg:
                            Number(
                                item.quantityKg ??
                                item.quantity ??
                                0
                            ),

                        revenue:
                            Number(
                                item.revenue ??
                                item.sales ??
                                0
                            ),

                        profit:
                            Number(
                                item.profit ??
                                0
                            )
                    };
                }
            );
    }


    if (!items.length) {

        container.innerHTML =
            "<p>No sales data yet.</p>";

        return;
    }


    container.innerHTML =
        items
            .map(
                function(item) {

                    return `

                        <div class="summary-card">

                            <strong>
                                ${escapeHtml(
                                    item.riceType ||
                                    "Unknown"
                                )}
                            </strong>

                            <p>
                                Quantity Sold:
                                ${Number(
                                    item.quantityKg ||
                                    0
                                )}
                                kg
                            </p>

                            <p>
                                Revenue:
                                ${money(
                                    item.revenue
                                )}
                            </p>

                            <p>
                                Profit:
                                ${money(
                                    item.profit
                                )}
                            </p>

                        </div>
                    `;
                }
            )
            .join("");
}


// ============================================================
// DASHBOARD ANALYTICS
// ============================================================

async function loadDashboardAnalytics() {

    const result =
        await apiGet(
            "analytics"
        );


    if (
        !result ||
        !result.success
    ) {
        return;
    }


    const data =
        result.analytics ||
        {};


    const revenue =
        document.getElementById(
            "dashRevenue"
        );


    const profit =
        document.getElementById(
            "dashProfit"
        );


    const top =
        document.getElementById(
            "dashTop"
        );


    if (revenue) {

        revenue.textContent =
            money(
                data.dailyRevenue
            );
    }


    if (profit) {

        profit.textContent =
            money(
                data.totalProfit
            );
    }


    if (top) {

        top.textContent =
            data.topSelling ||
            "-";
    }
}


// ============================================================
// EXPORT SALES REPORT
// ============================================================

async function exportReport() {

    const result =
        await apiGet(
            "report"
        );


    if (
        !result ||
        !result.success
    ) {

        alert(
            result?.message ||
            "Unable to export report."
        );

        return;
    }


    const rows =
        Array.isArray(
            result.rows
        )
            ? result.rows
            : [];


    if (!rows.length) {

        alert(
            "No sales records available."
        );

        return;
    }


    const headers =
        Object.keys(
            rows[0]
        );


    let csv =
        headers.join(",") +
        "\n";


    rows.forEach(
        function(row) {

            csv +=

                headers
                    .map(
                        function(header) {

                            return (
                                '"' +
                                String(
                                    row[header] ??
                                    ""
                                )
                                    .replace(
                                        /"/g,
                                        '""'
                                    ) +
                                '"'
                            );
                        }
                    )
                    .join(",") +

                "\n";
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
// COMPATIBILITY
// ============================================================

function exportSalesReport() {

    return exportReport();
}


// ============================================================
// INITIALIZE
// ============================================================

async function initializeDiamondStore() {

    restoreSession();

    restoreShift();


    if (!currentUser) {

        showPage(
            "loginPage"
        );

        return;
    }


    updateUserDisplay();

    configureRoleAccess();


    showPage(
        "dashboardPage"
    );


    await loadInventory();

    await loadDashboardAnalytics();
}


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        initializeDiamondStore();

    }
);
