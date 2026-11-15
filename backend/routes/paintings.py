from recommendations.painting_recommender import get_recommender, load_paintings
from fastapi import APIRouter, HTTPException, Path, Query
import pandas as pd
from pydantic import BaseModel, Field

router = APIRouter(prefix="/paintings", tags=["Paintings"])

CSV_PATH = "data/dataset/paintings.csv"
RATINGS_PATH = "data/dataset/ratings.csv"


class Painting(BaseModel):
    id: str = Field(description="Id da obra na National Gallery of Art (ObjectID)", examples=["46"])
    title: str = Field(description="Título da pintura")
    artist: str = Field(description="Artista ou atribuição")
    date: str = Field(description="Data de exibição, em texto livre (ex.: 'c. 1310', '1650-1660')")
    medium: str = Field(description="Técnica e suporte (ex.: 'tempera on panel')")
    theme: str = Field(description="Temas separados por vírgula")
    style: str = Field(description="Estilo ou movimento (ex.: Gothic, Baroque)")
    keywords: str = Field(description="Palavras-chave separadas por vírgula")
    school: str = Field(description="Escola artística (ex.: Florentine)")
    nationality: str = Field(description="Nacionalidade do artista principal")
    url: str = Field(description="URL da imagem em 400 px")
    thumbnail: str = Field(description="URL da miniatura em 200 px")
    tdfidf_text: str = Field(description="Texto combinado usado para calcular a similaridade (TF-IDF)")


class PaintingRating(BaseModel):
    user_id: str = Field(description="Id do usuário que avaliou")
    painting_id: str = Field(description="Id da pintura avaliada")
    rating: int = Field(description="Nota de 1 (não gostei) a 5 (adorei)")


class Recommendation(Painting):
    score: float = Field(description="Similaridade de cosseno com a pintura de origem (0 a 1)")
    seed_painting_id: str | None = Field(
        None, description="Pintura que originou esta recomendação"
    )


ALLOWED_COLUMNS = {"tdfidf_text", "theme", "style", "keywords", "school",
                   "artist", "title", "medium", "nationality"}

COLUMNS_DESCRIPTION = (
    "Colunas usadas para calcular a similaridade. Repita o parâmetro para usar várias "
    "(ex.: `?columns=style&columns=theme`). "
    f"Valores aceitos: {', '.join(sorted(ALLOWED_COLUMNS))}."
)


def _check_columns(columns: list[str]) -> tuple[str, ...]:
    bad = set(columns) - ALLOWED_COLUMNS
    if bad:
        raise HTTPException(status_code=400, detail=f"Invalid columns: {sorted(bad)}")
    return tuple(sorted(columns))


def _records(frame: pd.DataFrame) -> list[dict]:
    return frame.astype(object).where(frame.notna(), None).to_dict(orient="records")


@router.get(
    "/",
    response_model=list[Painting],
    summary="Listar pinturas",
    response_description="Página de pinturas",
)
def list_paintings(
    limit: int = Query(20, ge=1, le=100, description="Quantidade de pinturas por página (1 a 100)"),
    offset: int = Query(0, ge=0, description="Quantas pinturas pular, para paginação"),
):
    """Lista as pinturas do catálogo de forma paginada."""
    df = load_paintings()
    return df.iloc[offset: offset + limit].to_dict(orient="records")


@router.get(
    "/{painting_id}",
    response_model=Painting,
    summary="Buscar pintura",
    response_description="Dados da pintura",
    responses={404: {"description": "Pintura não encontrada"}},
)
def get_painting(
    painting_id: str = Path(description="Id da pintura (ObjectID da NGA)"),
):
    df = load_paintings()
    painting = df[df["id"] == painting_id]
    if painting.empty:
        raise HTTPException(status_code=404, detail="Painting not found")
    return painting.to_dict(orient="records")[0]


@router.post(
    "/{painting_id}/ratings",
    response_model=PaintingRating,
    summary="Avaliar pintura",
    response_description="Avaliação registrada",
    responses={
        404: {"description": "Pintura não encontrada"},
        400: {"description": "O usuário já avaliou esta pintura"},
    },
)
def rate_painting(
    painting_id: str = Path(description="Id da pintura a ser avaliada"),
    user_id: str = Query(description="Id do usuário que está avaliando"),
    rating: int = Query(ge=1, le=5, description="Nota de 1 (não gostei) a 5 (adorei)"),
):
    if painting_id not in get_recommender().pos:
        raise HTTPException(status_code=404, detail="Painting not found")

    ratings_df = pd.read_csv(
        RATINGS_PATH,
        dtype={"user_id": str, "painting_id": str}
    )

    already_rated = (
        (ratings_df["user_id"] == user_id) &
        (ratings_df["painting_id"] == painting_id)
    ).any()

    if already_rated:
        raise HTTPException(status_code=400, detail="User has already rated this painting")

    new_rating = pd.DataFrame([{
        "user_id": user_id,
        "painting_id": painting_id,
        "rating": rating,
        "date": pd.Timestamp.today().strftime("%Y-%m-%d"),
    }])

    pd.concat([ratings_df, new_rating], ignore_index=True).to_csv(
        RATINGS_PATH, index=False
    )

    return PaintingRating(user_id=user_id, painting_id=painting_id, rating=rating)


@router.get(
    "/recommendations/{user_id}",
    response_model=list[Recommendation],
    summary="Recomendações para um usuário",
    response_description="Até 15 pinturas recomendadas",
    responses={404: {"description": "Usuário sem avaliações"}},
)
def get_recommendations(
    user_id: str = Path(description="Id do usuário"),
    columns: list[str] = Query(["tdfidf_text"], description=COLUMNS_DESCRIPTION),
):
    ratings_df = pd.read_csv(RATINGS_PATH, dtype={"user_id": str, "painting_id": str})

    if ratings_df[ratings_df["user_id"] == user_id].empty:
        raise HTTPException(status_code=404, detail="User has no ratings")

    recs = get_recommender().recommend_for_user(
        ratings_df, user_id, n_seeds=5, per_seed=3, columns=_check_columns(columns))
    return _records(recs)


@router.get(
    "/{painting_id}/recommendations",
    response_model=list[Recommendation],
    summary="Pinturas parecidas",
    response_description="10 pinturas mais parecidas com a pintura alvo",
    responses={
        404: {"description": "Pintura não encontrada"},
        400: {"description": "Coluna inválida em `columns`"},
    },
)
def get_similar_paintings(
    painting_id: str = Path(description="Id da pintura alvo"),
    columns: list[str] = Query(["tdfidf_text"], description=COLUMNS_DESCRIPTION),
):
    recommender = get_recommender()

    if painting_id not in recommender.pos:
        raise HTTPException(status_code=404, detail="Painting not found")

    return _records(recommender.recommend_for_target(
        painting_id, n=10, columns=_check_columns(columns)))