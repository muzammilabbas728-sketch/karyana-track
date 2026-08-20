"""FastAPI application entry-point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import admin, auth, cash, customers, investments, license, products, purchases, reports, sales, suppliers, users

app = FastAPI(title="Karyana Track")

# Local development CORS settings. Restrict allow_origins to the real
# production frontend URL before deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.1.6:5173",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(license.router)
app.include_router(cash.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(customers.router)
app.include_router(investments.router)
app.include_router(purchases.router)
app.include_router(suppliers.router)
app.include_router(admin.router)

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

