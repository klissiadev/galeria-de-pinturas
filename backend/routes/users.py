from fastapi import APIRouter, HTTPException, Query
from fastapi import APIRouter, HTTPException
import pandas as pd
from pydantic import BaseModel
from backend.routes.paintings import Painting
from recommendations.painting_recommender import load_paintings

router = APIRouter(prefix="/users", tags=["Users"])

from functools import lru_cache

USERS_CSV = "data/dataset/users.csv"
RATINGS_PATH = "data/dataset/ratings.csv"


class User(BaseModel):
    id: str
    username: str
    created_at: str | None = None

class HistoryItem(Painting):
    rating: int
    rated_at: str | None = None


@lru_cache(maxsize=1)
def load_users() -> pd.DataFrame:
    df = pd.read_csv(USERS_CSV).rename(columns={"user_id": "id"})
    df["id"] = df["id"].astype(str)
    df["created_at"] = df["created_at"].fillna("").astype(str)
    return df


@router.get("/", response_model=list[User])
def list_user(limit: int = 
              Query(20, ge=1, le=100),
              offset: int = Query(0, ge=0)):
    return load_users().iloc[offset: offset + limit].to_dict(orient="records")


@router.get("/{user_id}", response_model=User)
def search_user(user_id: str):
    df = load_users()
    usuario = df[df["id"] == user_id]

    if usuario.empty:
        raise HTTPException(status_code=404, detail="User not found")

    return usuario.to_dict(orient="records")[0]


@router.get("/{user_id}/history", response_model=list[HistoryItem])
def get_user_history(user_id: str):
    ratings_df = pd.read_csv(
        RATINGS_PATH,
        dtype={"user_id": str, "painting_id": str}
    )
    history = ratings_df[ratings_df["user_id"] == user_id].copy()

    if history.empty:
        raise HTTPException(status_code=404, detail="User has no ratings")

    if "date" in history.columns:
        history = history.rename(columns={"date": "rated_at"})
        history = history.sort_values("rated_at", ascending=False, kind="stable")
    else:
        history = history.iloc[::-1] 

    merged = history.merge(
        load_paintings(), left_on="painting_id", right_on="id", how="inner"
    ).drop(columns=["user_id", "painting_id"])

    return merged.astype(object).where(merged.notna(), None).to_dict(orient="records")

@router.post("/", response_model=User)
def create_user(user: User):
    users_df = load_users()

    if user.id in users_df["id"].values:
        raise HTTPException(status_code=400, detail="User ID already exists")

    new_user = pd.DataFrame([{
        "id": user.id,
        "username": user.username,
        "created_at": user.created_at or pd.Timestamp.now().strftime("%Y-%m-%d")
    }])

    pd.concat([users_df, new_user], ignore_index=True).to_csv(
        USERS_CSV, index=False
    )

    return user