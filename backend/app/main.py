import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import paintings, users
from recommendations.painting_recommender import get_recommender


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Carrega o catálogo e o TF-IDF padrão na inicialização (evita 1ª requisição lenta)
    get_recommender()._matrix(("tdfidf_text",))
    yield


app = FastAPI(
    title="Museum API",
    description="API de pinturas da National Gallery of Art com recomendações por similaridade (TF-IDF).",
    version="1.0.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(paintings.router)
app.include_router(users.router)


@app.get("/health", tags=["Health"], summary="Verificar se a API está no ar")
def health():
    return {"status": "ok"}