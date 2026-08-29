// ============================================================
// DIAMOND STORE FRONTEND
// ============================================================

const API = "/api/appscript";

let currentUser = null;

let inventory = [];

let cart = [];

let suppliers = [];

let currentShiftId = null;


// ============================================================
// API REQUEST
// ============================================================

async function api(action, data = {}) {

    const response = await fetch(API, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            action: action,
            ...data
        })

    });


    const result = await response.json();

    return result;
}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(function(page) {

            page.classList.add("hidden");

        });


    document
        .getElementById(pageId)
        .classList.remove("hidden");
}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;

    const role =
        document.getElementById("role").value;


    const message =
        document.getElementById("loginMessage");


    message.textContent = "Logging in...";


    const result =
        await api("login", {

            username: username,

            password: password,

            role: role

        });


    if (!result.success) {

        message.textContent =
            result.message;

        return;
    }


    currentUser =
        result.user;


    localStorage.setItem(
        "diamondUser",
        JSON.stringify(currentUser)
    );


    document.getElementById(
        "userDisplay"
    ).textContent =
        currentUser.fullName +
        " (" +
        currentUser.role +
        ")";


    configureRole();


    await loadInventory();

    await loadAnalytics();


    showPage("dashboardPage");
}


// ============================================================
// ROLE CONTROL
// ============================================================

function configureRole() {

    const admin =
        currentUser &&
        currentUser.role.toLowerCase() === "admin";


    document
        .getElementById("shiftButton")
        .style.display =
        admin ? "block" : "block";


    document
        .getElementById("supplierButton")
        .style.display =
        admin ? "block" : "none";


    document
        .getElementById("spoilageButton")
        .style.display =
        admin ? "block" : "none";


    document
        .getElementById("analyticsButton")
        .style.display =
        admin ? "block" : "none";


    document
        .getElementById("adminStockEditor")
        .style.display =
        admin ? "block" : "none";
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    currentUser = null;

    localStorage.removeItem(
        "diamondUser"
    );

    cart = [];

    showPage("loginPage");
}


// ============================================================
// LOAD INVENTORY
// ============================================================

async function loadInventory() {

    const result =
        await api("inventory");


    if (!result.success) {

        alert(result.message);

        return;
    }


    inventory =
        result.inventory;


    renderInventory();

    populateRiceSelects();

    renderCart();
}


// ============================================================
// RENDER INVENTORY
// ============================================================

function renderInventory() {

    const container =
        document.getElementById(
            "inventoryList"
        );


    if (!container) return;


    container.innerHTML = "";


    inventory.forEach(function(item) {

        const card =
            document.createElement("div");


        card.className =
            "inventory-card" +
            (item.lowStock
                ? " low-stock"
                : "");


        card.innerHTML = `

            <h3>${escapeHtml(item.riceType)}</h3>

            <div class="inventory-details">

                <div>
                    <strong>Stock</strong><br>
                    ${item.sacks} sacks
                </div>

                <div>
                    <strong>Loose</strong><br>
                    ${item.looseKg} kg
                </div>

                <div>
                    <strong>Total</strong><br>
                    ${item.totalKg} kg
                </div>

            </div>

            <p>
                Price:
                P${money(item.pricePerKg)}
                / kg
            </p>

            <p>
                Status:
                ${
                    item.lowStock
                    ? "LOW STOCK"
                    : "Available"
                }
            </p>
        `;


        container.appendChild(card);

    });
}


// ============================================================
// RICE SELECTS
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
            document.getElementById(id);


        if (!select) return;


        select.innerHTML = "";


        inventory.forEach(function(item) {

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

    updateStockFields();
}


// ============================================================
// POS PRICE
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

            updateStockFields();
        }
    }
);


function updatePOSPrice() {

    const id =
        document.getElementById(
            "posRice"
        ).value;


    const item =
        inventory.find(function(x) {

            return String(x.inventoryId) ===
                String(id);

        });


    if (item) {

        document.getElementById(
            "posPrice"
        ).value =
            "P" +
            money(item.pricePerKg) +
            " / kg";
    }
}


// ============================================================
// STOCK EDIT FIELDS
// ============================================================

function updateStockFields() {

    const select =
        document.getElementById(
            "stockRice"
        );


    if (!select || !select.value) return;


    const item =
        inventory.find(function(x) {

            return String(x.inventoryId) ===
                String(select.value);

        });


    if (!item) return;


    document.getElementById(
        "stockSacks"
    ).value =
        item.sacks;


    document.getElementById(
        "stockLoose"
    ).value =
        item.looseKg;


    document.getElementById(
        "stockPrice"
    ).value =
        item.pricePerKg;
}


// ============================================================
// ADD TO CART
// ============================================================

function addToCart() {

    const inventoryId =
        document.getElementById(
            "posRice"
        ).value;


    const quantity =
        Number(
            document.getElementById(
                "posQuantity"
            ).value
        );


    const item =
        inventory.find(function(x) {

            return String(x.inventoryId) ===
                String(inventoryId);

        });


    if (!item) {

        alert("Select a rice type.");

        return;
    }


    if (!quantity || quantity <= 0) {

        alert("Enter a valid quantity.");

        return;
    }


    if (quantity > item.totalKg) {

        alert(
            "Only " +
            item.totalKg +
            " kg available."
        );

        return;
    }


    const existing =
        cart.find(function(x) {

            return String(x.inventoryId) ===
                String(inventoryId);

        });


    if (existing) {

        existing.quantityKg +=
            quantity;

    } else {

        cart.push({

            inventoryId:
                item.inventoryId,

            riceType:
                item.riceType,

            quantityKg:
                quantity,

            pricePerKg:
                item.pricePerKg

        });
    }


    renderCart();
}


// ============================================================
// RENDER CART
// ============================================================

function renderCart() {

    const container =
        document.getElementById(
            "cartList"
        );


    if (!container) return;


    container.innerHTML = "";


    let total = 0;


    cart.forEach(function(item, index) {

        const subtotal =
            item.quantityKg *
            item.pricePerKg;


        total += subtotal;


        const row =
            document.createElement("div");


        row.className =
            "cart-item";


        row.innerHTML = `

            <span>
                ${escapeHtml(item.riceType)}
                (${item.quantityKg} kg
                @ P${money(item.pricePerKg)}/kg)
            </span>

            <span>
                P${money(subtotal)}

                <button
                    onclick="removeCartItem(${index})"
                >
                    REMOVE
                </button>
            </span>

        `;


        container.appendChild(row);

    });


    document.getElementById(
        "cartTotal"
    ).textContent =
        "P" +
        money(total);


    calculateChange();
}


// ============================================================
// REMOVE CART ITEM
// ============================================================

function removeCartItem(index) {

    cart.splice(index, 1);

    renderCart();
}


// ============================================================
// CHANGE
// ============================================================

function calculateChange() {

    let total = 0;


    cart.forEach(function(item) {

        total +=
            item.quantityKg *
            item.pricePerKg;

    });


    const cash =
        Number(
            document.getElementById(
                "cashReceived"
            ).value
        ) || 0;


    const change =
        cash - total;


    document.getElementById(
        "changeAmount"
    ).value =
        change >= 0
            ? "P" + money(change)
            : "Insufficient cash";
}


// ============================================================
// COMPLETE SALE
// ============================================================

async function completeSale() {

    if (!currentUser) {

        alert("Please login.");

        return;
    }


    if (cart.length === 0) {

        alert("Cart is empty.");

        return;
    }


    const cash =
        Number(
            document.getElementById(
                "cashReceived"
            ).value
        ) || 0;


    const result =
        await api("createSale", {

            cashier: {

                userId:
                    currentUser.userId,

                fullName:
                    currentUser.fullName

            },

            items: cart,

            cashReceived: cash

        });


    const message =
        document.getElementById(
            "posMessage"
        );


    message.textContent =
        result.message;


    if (!result.success) return;


    alert(

        "SALE COMPLETED\n\n" +

        "Transaction: " +
        result.sale.transactionNumber +

        "\n\nTotal: P" +
        money(result.sale.totalAmount) +

        "\nCash: P" +
        money(result.sale.cashReceived) +

        "\nChange: P" +
        money(result.sale.changeAmount)

    );


    cart = [];


    document.getElementById(
        "cashReceived"
    ).value = 0;


    renderCart();


    await loadInventory();

    await loadAnalytics();
}


// ============================================================
// UPDATE STOCK
// ============================================================

async function updateStock() {

    if (
        !currentUser ||
        currentUser.role.toLowerCase() !==
        "admin"
    ) {

        alert("Admin only.");

        return;
    }


    const inventoryId =
        document.getElementById(
            "stockRice"
        ).value;


    const riceType =
        document.getElementById(
            "stockRice"
        ).selectedOptions[0]
        .textContent;


    const sacks =
        Number(
            document.getElementById(
                "stockSacks"
            ).value
        );


    const looseKg =
        Number(
            document.getElementById(
                "stockLoose"
            ).value
        );


    const pricePerKg =
        Number(
            document.getElementById(
                "stockPrice"
            ).value
        );


    const result =
        await api(
            "updateInventory",
            {

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName,

                inventoryId:
                    inventoryId,

                riceType:
                    riceType,

                sacks:
                    sacks,

                looseKg:
                    looseKg,

                pricePerKg:
                    pricePerKg

            }
        );


    document.getElementById(
        "stockMessage"
    ).textContent =
        result.message;


    if (result.success) {

        await loadInventory();
    }
}


// ============================================================
// START SHIFT
// ============================================================

async function startShift() {

    if (!currentUser) return;


    const openingCash =
        Number(
            document.getElementById(
                "openingCash"
            ).value
        ) || 0;


    const result =
        await api(
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


    document.getElementById(
        "shiftInfo"
    ).textContent =
        result.message;


    if (result.success) {

        currentShiftId =
            result.shiftId;

        localStorage.setItem(
            "diamondShiftId",
            currentShiftId
        );
    }
}


// ============================================================
// CLOSE SHIFT
// ============================================================

async function closeCurrentShift() {

    if (!currentShiftId) {

        currentShiftId =
            localStorage.getItem(
                "diamondShiftId"
            );
    }


    if (!currentShiftId) {

        alert(
            "No active shift found."
        );

        return;
    }


    const closingCash =
        Number(
            document.getElementById(
                "closingCash"
            ).value
        ) || 0;


    const result =
        await api(
            "closeShift",
            {

                shiftId:
                    currentShiftId,

                closingCash:
                    closingCash

            }
        );


    document.getElementById(
        "shiftInfo"
    ).textContent =
        result.message;


    if (result.success) {

        localStorage.removeItem(
            "diamondShiftId"
        );

        currentShiftId = null;


        alert(

            "SHIFT CLOSED\n\n" +

            "Total Sales: P" +
            money(result.totalSales) +

            "\nClosing Cash: P" +
            money(result.closingCash)

        );
    }
}


// ============================================================
// SUPPLIER
// ============================================================

async function saveSupplier() {

    if (!isAdmin()) {

        alert("Admin only.");

        return;
    }


    const supplierName =
        document.getElementById(
            "supplierName"
        ).value.trim();


    const contactNumber =
        document.getElementById(
            "supplierContact"
        ).value.trim();


    const address =
        document.getElementById(
            "supplierAddress"
        ).value.trim();


    const result =
        await api(
            "addSupplier",
            {

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName,

                supplierName:
                    supplierName,

                contactNumber:
                    contactNumber,

                address:
                    address

            }
        );


    document.getElementById(
        "supplierMessage"
    ).textContent =
        result.message;


    if (result.success) {

        document.getElementById(
            "supplierName"
        ).value = "";

        document.getElementById(
            "supplierContact"
        ).value = "";

        document.getElementById(
            "supplierAddress"
        ).value = "";
    }
}


// ============================================================
// SHIPMENT
// ============================================================

async function saveShipment() {

    if (!isAdmin()) {

        alert("Admin only.");

        return;
    }


    const supplierName =
        document.getElementById(
            "supplierName"
        ).value.trim();


    const riceSelect =
        document.getElementById(
            "shipmentRice"
        );


    const riceType =
        riceSelect.selectedOptions[0]
            .textContent;


    const sacksReceived =
        Number(
            document.getElementById(
                "shipmentSacks"
            ).value
        );


    const totalCost =
        Number(
            document.getElementById(
                "shipmentCost"
            ).value
        );


    if (!supplierName) {

        alert(
            "Enter supplier name first."
        );

        return;
    }


    const result =
        await api(
            "saveShipment",
            {

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName,

                supplierName:
                    supplierName,

                riceType:
                    riceType,

                sacksReceived:
                    sacksReceived,

                kgReceived:
                    sacksReceived * 50,

                totalCost:
                    totalCost

            }
        );


    document.getElementById(
        "supplierMessage"
    ).textContent =
        result.message;


    if (result.success) {

        await loadInventory();
    }
}


// ============================================================
// SPOILAGE
// ============================================================

async function recordSpoilage() {

    if (!isAdmin()) {

        alert("Admin only.");

        return;
    }


    const select =
        document.getElementById(
            "spoilageRice"
        );


    const riceType =
        select.selectedOptions[0]
            .textContent;


    const damagedKg =
        Number(
            document.getElementById(
                "damagedKg"
            ).value
        );


    const reason =
        document.getElementById(
            "spoilageReason"
        ).value.trim();


    const result =
        await api(
            "recordSpoilage",
            {

                role:
                    currentUser.role,

                userId:
                    currentUser.userId,

                userName:
                    currentUser.fullName,

                riceType:
                    riceType,

                damagedKg:
                    damagedKg,

                reason:
                    reason

            }
        );


    document.getElementById(
        "spoilageMessage"
    ).textContent =
        result.message;


    if (result.success) {

        await loadInventory();

        document.getElementById(
            "damagedKg"
        ).value = "";

        document.getElementById(
            "spoilageReason"
        ).value = "";
    }
}


// ============================================================
// ANALYTICS
// ============================================================

async function loadAnalytics() {

    const result =
        await api("analytics");


    if (!result.success) return;


    const analytics =
        result.analytics;


    document.getElementById(
        "dashRevenue"
    ).textContent =
        "P" +
        money(analytics.dailyRevenue);


    document.getElementById(
        "dashProfit"
    ).textContent =
        "P" +
        money(analytics.totalProfit);


    document.getElementById(
        "dashTop"
    ).textContent =
        analytics.topSellingRice ||
        "-";


    const revenue =
        document.getElementById(
            "analyticsRevenue"
        );


    if (revenue) {

        revenue.textContent =
            "P" +
            money(analytics.dailyRevenue);

        document.getElementById(
            "analyticsProfit"
        ).textContent =
            "P" +
            money(analytics.totalProfit);

        document.getElementById(
            "analyticsTop"
        ).textContent =
            analytics.topSellingRice ||
            "-";
    }


    renderProductAnalytics(
        analytics.products
    );
}


// ============================================================
// PRODUCT ANALYTICS
// ============================================================

function renderProductAnalytics(products) {

    const container =
        document.getElementById(
            "productAnalytics"
        );


    if (!container) return;


    container.innerHTML = "";


    Object.keys(products).forEach(function(name) {

        const product =
            products[name];


        const row =
            document.createElement("div");


        row.className =
            "product-row";


        row.innerHTML = `

            <span>
                <strong>
                    ${escapeHtml(name)}
                </strong>

                <br>

                ${product.quantity} kg sold
            </span>

            <span>

                Sales:
                P${money(product.sales)}

                <br>

                Profit:
                P${money(product.profit)}

            </span>

        `;


        container.appendChild(row);

    });
}


// ============================================================
// EXPORT REPORT
// ============================================================

function exportReport() {

    const result =
        document.getElementById(
            "productAnalytics"
        );


    if (!result) return;


    const text =
        result.innerText;


    const blob =
        new Blob(
            [text],
            {
                type: "text/plain"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const a =
        document.createElement("a");


    a.href = url;

    a.download =
        "diamond-store-sales-report.txt";


    a.click();


    URL.revokeObjectURL(url);
}


// ============================================================
// BUTTON HELPERS
// ============================================================

function showStock() {

    showPage("stockPage");

    loadInventory();
}


function showShift() {

    showPage("shiftPage");
}


function showSupplier() {

    showPage("supplierPage");
}


function showSpoilage() {

    showPage("spoilagePage");
}


function showAnalytics() {

    showPage("analyticsPage");

    loadAnalytics();
}


function isAdmin() {

    return (
        currentUser &&
        currentUser.role.toLowerCase() ===
        "admin"
    );
}


// ============================================================
// FORMAT
// ============================================================

function money(value) {

    return Number(value || 0)
        .toLocaleString(
            "en-PH",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// RESTORE LOGIN
// ============================================================

window.addEventListener(
    "load",
    async function() {

        const saved =
            localStorage.getItem(
                "diamondUser"
            );


        if (!saved) {

            showPage("loginPage");

            return;
        }


        try {

            currentUser =
                JSON.parse(saved);


            document.getElementById(
                "userDisplay"
            ).textContent =
                currentUser.fullName +
                " (" +
                currentUser.role +
                ")";


            configureRole();


            await loadInventory();

            await loadAnalytics();


            showPage(
                "dashboardPage"
            );


        } catch {

            localStorage.removeItem(
                "diamondUser"
            );

            showPage("loginPage");
        }
    }
);
