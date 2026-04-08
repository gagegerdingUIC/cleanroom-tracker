"""
main.py — FastAPI application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.models import Base  # imports all models, registers metadata

from app.api.wafers import router as wafers_router
from app.api.steps import router as steps_router
from app.api.machines import router as machines_router
from app.api.recipes import router as recipes_router
from app.api.consumables import router as consumables_router
from app.api.runs import router as runs_router
from app.api.folders import router as folders_router
from app.api.presets import router as presets_router
from app.api.measurements import router as measurements_router
from app.api.carriers import router as carriers_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.DEBUG:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Cleanroom process tracking for nanofabrication workflows.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wafers_router)
app.include_router(steps_router)
app.include_router(machines_router)
app.include_router(recipes_router)
app.include_router(consumables_router)
app.include_router(runs_router)
app.include_router(folders_router)
app.include_router(presets_router)
app.include_router(measurements_router)
app.include_router(carriers_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
