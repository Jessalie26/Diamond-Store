# RiceKeeper POS & Inventory Management System

A mobile-based Rice Inventory and POS application built using **MIT App Inventor** and **Google AppsScript / Sheets Backend**.

## 🚀 Key Features

### Cashier Access
1. **Role-Based Login System**: Secure login distinguishing Cashier and Admin permissions.
2. **POS Checkout Counter**: Quick rice transaction processing by weight (kg) or whole sacks with automatic change computation.
3. **Stock & Variety Tracker**: Real-time read-only inventory lookup for daily selling operations.

### Admin Access
4. **Shift Sales Summary**: Track individual cashier active drawer totals and daily shift logs.
5. **Supplier & Batch Management**: Log wholesale grain shipments, batch orders, and delivery costs.
6. **Spoilage & Loss Logger**: Write off wet, damaged, or pest-affected rice stock to maintain accurate inventory counts.
7. **Master Sales Analytics**: Monitor shop revenue, profit margins, and top-selling rice varieties.

## 📁 System Architecture
* **Frontend**: MIT App Inventor (Mobile App UI & Blocks Logic)
* **Backend**: Google AppsScript (RESTful API Web Service)
* **Database**: Google Sheets (Data persistence for Users, Inventory, Sales, Suppliers, Spoilage)

## 🛠️ Deployment Steps
1. Deploy `Code.gs` in Google AppsScript as a Web App (Access: *Anyone*).
2. Copy the Web App URL into MIT App Inventor `Web.Url` component properties.
3. Build `.apk` package in MIT App Inventor.
