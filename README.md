# Diamond Store — POS & Inventory System

A web-based Point-of-Sale and inventory management system for a rice retail store.

| Layer      | Technology |
|------------|------------|
| Frontend   | `index.html` + `app.js` (vanilla HTML/CSS/JS, single-page) |
| Backend    | Google Apps Script Web App (REST API) |
| Database   | Google Sheets |
| Hosting    | Vercel (static) |
| Repository | GitHub |

---

## Seven Features

| # | Feature | Access |
|---|---------|--------|
| 1 | **Role Login** — Cashier / Admin, session via `localStorage`, RBAC | All |
| 2 | **POS Checkout** — rice selection, cart, payment, change, sale record | All |
| 3 | **Stock Tracker** — live inventory view; Admin can edit quantities & price | All (edit: Admin) |
| 4 | **Shift Sales Summary** — open/close shift, transaction list, drawer total | Admin |
| 5 | **Supplier & Shipments** — add suppliers, log incoming stock (updates inventory) | Admin |
| 6 | **Spoilage Logger** — record damaged stock, deduct from inventory | Admin |
| 7 | **Sales Analytics** — daily revenue, profit, top-selling rice, CSV export | Admin |

---

## File Structure

```
Diamond-Store/
├── index.html      HTML shell + CSS (no inline JavaScript)
├── app.js          All JavaScript (single source of truth)
├── vercel.json     Vercel static deployment config
├── package.json    Project metadata
└── README.md       This file
```

---

## Google Apps Script Setup

1. Open your Google Sheets workbook → **Extensions → Apps Script**.
2. Deploy as a **Web App**:
   - Execute as: *Me*
   - Who has access: *Anyone*
3. Copy the deployment URL — it looks like:
   ```
   https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
   ```
4. Paste it into `app.js` at the top:
   ```js
   var API = "https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec";
   ```
5. Every time you redeploy the Apps Script, create a **new deployment** and update `API` in `app.js`.

### Expected Apps Script Actions (POST `action` field)

| action | Description |
|--------|-------------|
| `login` | Authenticate user — returns `{ success, user }` |
| `inventory` (GET) | Return all inventory rows |
| `updateInventory` | Update sacks / loose kg / price for one row |
| `createSale` | Record a completed sale, deduct stock |
| `startShift` | Open a new shift — returns `{ shiftId }` |
| `shiftSummary` | Return shift data + transactions |
| `closeShift` | Close shift — returns totals |
| `addSupplier` | Save a supplier record |
| `saveShipment` | Record incoming stock, add to inventory |
| `recordSpoilage` | Deduct damaged stock |
| `analytics` (GET) | Return `{ dailyRevenue, totalProfit, topSelling, products[] }` |
| `report` (GET) | Return `{ rows[] }` for CSV export |

---

## Vercel Deployment

The project is a fully static site — no build step required.

```bash
# From the project root, after pushing to GitHub:
# 1. Go to https://vercel.com/new
# 2. Import the GitHub repository
# 3. Leave Framework Preset as "Other"
# 4. Click Deploy
```

Or via Vercel CLI:

```bash
npm i -g vercel
vercel --prod
```

---

## Local Development

No build tools needed. Open `index.html` directly in a browser **or** use any static server:

```bash
# Python (if installed)
python -m http.server 8080

# Node (if installed)
npx serve .
```

Then open `http://localhost:8080` and log in.

---

## Google Sheets Structure

| Sheet | Key Columns |
|-------|-------------|
| `Users` | `userId`, `username`, `password`, `fullName`, `role` |
| `Inventory` | `inventoryId`, `riceType`, `quantitySacks`, `looseKg`, `pricePerKg`, `costPerKg`, `totalKg`, `lowStock` |
| `Sales` | `transactionNumber`, `date`, `cashierId`, `totalAmount`, `cashReceived`, `changeAmount` |
| `SaleItems` | `transactionNumber`, `inventoryId`, `riceType`, `quantityKg`, `pricePerKg`, `subtotal` |
| `Shifts` | `shiftId`, `cashierId`, `cashierName`, `openingCash`, `closingCash`, `totalSales`, `status` |
| `Suppliers` | `supplierId`, `supplierName`, `contactNumber`, `address` |
| `Shipments` | `shipmentId`, `supplierName`, `riceType`, `sacksReceived`, `totalCost`, `date` |
| `Spoilage` | `spoilageId`, `inventoryId`, `riceType`, `damagedKg`, `reason`, `estimatedLoss`, `date` |

---

## PowerShell — Test & Push

```powershell
# From project root:

# Check for syntax errors in app.js (requires Node.js)
node --check app.js

# Verify JSON files
node -e "require('./vercel.json'); require('./package.json'); console.log('JSON OK')"

# Git status
git status

# Stage and commit
git add index.html app.js vercel.json package.json README.md
git commit -m "fix: consolidate JS to app.js, fix all function refs and null checks"

# Push to GitHub (new branch — do NOT push directly to main without review)
git push origin HEAD
```
