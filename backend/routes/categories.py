from fastapi import APIRouter, Query

from recommendations import profile_recommender as pr

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get(
    "/",
    summary="Categorias para o onboarding",
    response_description="styles, themes, schools e artists, mais frequentes primeiro",
)
def get_categories(
    limit: int = Query(40, ge=1, le=200, description="Máximo de estilos/temas/escolas"),
    artists_limit: int = Query(50, ge=1, le=500, description="Máximo de artistas"),
):
    return pr.catalog(limit, artists_limit)


@router.get("/artists", response_model=list[str], summary="Buscar artistas por nome")
def search_artists(
    q: str = Query("", description="Trecho do nome"),
    limit: int = Query(5, ge=1, le=50),
):
    return pr.search_artists(q, limit)