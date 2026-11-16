import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.categories import router as categories_router
from backend.routes.evaluation import router as evaluation_router
from backend.routes.paintings import router as painting_router
from backend.routes.users import router as user_router
from recommendations import profile_recommender


@asynccontextmanager
async def lifespan(app: FastAPI):
    profile_recommender.get_space()  # carrega catálogo e matriz de atributos na subida
    yield


app = FastAPI(title="Galeria Sugerida API", lifespan=lifespan)

# CORS liberado para qualquer porta de desenvolvimento local (Vite/React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

app.include_router(user_router)
app.include_router(painting_router)
app.include_router(categories_router)
app.include_router(evaluation_router)


@app.get("/")
def home():
    return {"message": "API funcionando!"}