from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Query
from pydantic import BaseModel

from recommendations.evaluator import RecommenderEvaluator, get_cached_or_run_eval

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


class EvaluationRunParams(BaseModel):
    seed: int = 42
    min_ratings: int = 5


@router.get("/metrics")
def get_metrics() -> dict[str, Any]:
    """Retorna os resultados da avaliação offline: métricas de precisão, recall, nDCG, cobertura, diversidade e novidade."""
    data = get_cached_or_run_eval()
    return {
        "metadata": data.get("metadata", {}),
        "models": data.get("models", {}),
    }


@router.get("/qualitative")
def get_qualitative_cases() -> list[dict[str, Any]]:
    """Retorna os casos qualitativos detalhados (sucessos e discussão de erro/limitação)."""
    data = get_cached_or_run_eval()
    return data.get("qualitative_cases", [])


@router.post("/run")
def run_evaluation(params: EvaluationRunParams | None = None) -> dict[str, Any]:
    """Executa novamente a avaliação experimental offline sob demanda."""
    seed = params.seed if params else 42
    min_ratings = params.min_ratings if params else 5
    evaluator = RecommenderEvaluator(seed=seed, min_ratings=min_ratings)
    return evaluator.run_all(k_list=[5, 10])
