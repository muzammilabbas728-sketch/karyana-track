"""
Dedicated server entry point for packaging and running the FastAPI backend.
"""

import multiprocessing
import os
import sys
import uvicorn

from app.main import app

if __name__ == "__main__":
    multiprocessing.freeze_support()

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))

    print(f"Starting Karyana Track Backend on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")
