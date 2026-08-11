# Karyana Track

A local-network point-of-sale and inventory system built for small grocery store owners who can't justify the cost or complexity of enterprise retail software.

## Why this exists

Most small grocery shops track sales and stock on paper or basic spreadsheets. Karyana Track gives owners real-time profit tracking, inventory management, and role-separated access (owner vs. staff) — without requiring an internet connection or expensive infrastructure.

## Key design decisions

- **Offline-first, local network architecture**: runs entirely on the shop's local Wi-Fi. The backend (FastAPI + SQLite) runs on one device; staff and the owner connect from separate devices (tablet, laptop, phone) over the local network — no internet dependency, no recurring cloud costs.
- **Atomic, price-snapshotted sales**: every sale is wrapped in a single database transaction. Prices and costs are snapshotted at the time of sale, so historical profit reports stay accurate even after prices change later — a common bug in naive POS implementations.
- **Concurrency-safe by design**: SQLite is configured with WAL mode and `BEGIN IMMEDIATE` transactions to correctly handle multiple devices reading and writing at the same time (e.g., a cashier checking out while the owner restocks).
- **Role-based access control**: owner and staff accounts have different permissions enforced server-side (not just hidden UI) — staff can process sales and restock, but only the owner can see profit margins, run reports, or make manual stock corrections.
- **Full audit trail**: every stock change (sale, restock, damage, correction) is logged with who made it and when.

## Tech stack

**Backend:** Python, FastAPI, SQLite, Pydantic, bcrypt (via passlib)
**Frontend:** React, Vite

## Features

- Product catalog with barcode support
- Point-of-sale checkout with live cart and stock validation
- Owner dashboard: daily/date-range sales and profit reports, low-stock alerts
- Inventory management: add/edit/delete products, stock adjustments with reason tracking, adjustment history
- Role-based authentication (owner / staff) with session tokens

## Running locally

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
python -c "from app.database import init_db; init_db()"
uvicorn app.main:app --reload
```
Backend runs at `http://127.0.0.1:8000`. Interactive API docs at `http://127.0.0.1:8000/docs`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

## Project structure

```
karyana-track/
├── backend/
│   ├── app/
│   │   ├── routers/       # API endpoints (products, sales, auth, reports)
│   │   ├── database.py    # SQLite connection, transaction management
│   │   ├── models.py      # Pydantic request/response schemas
│   │   └── schema.sql     # Database schema
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/          # LoginPage, SalesScreen, OwnerDashboard, InventoryPage
        └── api/client.js   # API client wrapper
```

## Status

Core functionality complete and tested: authentication, sales processing, inventory management, and reporting. Built as a portfolio project demonstrating full-stack design, transactional data integrity, and role-based security.

