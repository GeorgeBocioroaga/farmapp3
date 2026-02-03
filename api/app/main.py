import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from db import engine
from models import Base
from routers import auth, cf, parcels, works, inventory, harvests, soil, catalog, raster, applications, reports
from services.inventory_views import ensure_inventory_views
from services.db_migrate import ensure_schema_extensions

app = FastAPI(title="Agri API")

RATE_LIMIT = int(os.getenv("RATE_LIMIT_PER_MIN", "300"))
_rate_state = {}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60
    entry = _rate_state.get(ip)
    if not entry or now - entry[1] > window:
        _rate_state[ip] = [1, now]
    else:
        entry[0] += 1
        if entry[0] > RATE_LIMIT:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    return await call_next(request)


origins = os.getenv("CORS_ORIGINS", "http://localhost,http://localhost:80,http://localhost:5173")
origins_list = [o.strip() for o in origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    _wait_for_db()
    ensure_schema_extensions(engine)
    Base.metadata.create_all(bind=engine)
    ensure_inventory_views(engine)
    if os.getenv("AUTO_SEED") == "1":
        from seed import seed_all
        seed_all()


def _wait_for_db(max_attempts: int = 30, delay: float = 2.0):
    for _ in range(max_attempts):
        try:
            with engine.connect() as conn:
                conn.exec_driver_sql("SELECT 1")
            return
        except Exception:
            time.sleep(delay)
    with engine.connect() as conn:
        conn.exec_driver_sql("SELECT 1")


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(auth.router)
app.include_router(cf.router)
app.include_router(parcels.router)
app.include_router(works.router)
app.include_router(inventory.router)
app.include_router(harvests.router)
app.include_router(soil.router)
app.include_router(catalog.router)
app.include_router(raster.router)
app.include_router(applications.router)
app.include_router(reports.router)
