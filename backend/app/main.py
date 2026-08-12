"""FastAPI application entry-point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth, products, reports, sales

app = FastAPI(title="Karyana Track")

# Local development CORS settings. Restrict allow_origins to the real
# production frontend URL before deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://192.168.1.7:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(sales.router)
app.include_router(auth.router)
app.include_router(reports.router)
