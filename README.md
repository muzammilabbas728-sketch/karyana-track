# Karyana Track

Point-of-sale and inventory management system for a karyana (grocery) store.

## Project Structure

```
karyana-track/
├── backend/          # FastAPI + SQLite
│   ├── app/          # Application package
│   │   ├── routers/  # Route modules (products, sales, reports, users)
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── auth.py
│   │   └── schema.sql
│   └── tests/
├── frontend/         # React UI
│   └── src/
│       ├── pages/
│       ├── components/
│       └── api/
```

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
python -c "from app.database import init_db; init_db()"
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```
