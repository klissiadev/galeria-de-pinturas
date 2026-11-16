from __future__ import annotations

import uuid
from typing import Any
import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from backend.app import storage
from backend.routes.paintings import Painting
from recommendations import profile_recommender as pr
from recommendations.painting_recommender import load_paintings

router = APIRouter(prefix="/users", tags=["Users"])


class User(BaseModel):
    id: str
    username: str
    created_at: str | None = None


class UserDetail(User):
    categories: dict = Field(default_factory=dict)


class ProfileCreate(BaseModel):
    username: str
    categories: dict = Field(default_factory=dict)


class RatingUpdate(BaseModel):
    rating: int = Field(ge=1, le=5)


class HistoryItem(Painting):
    rating: int
    rated_at: str | None = None


class MatchedFeature(BaseModel):
    name: str
    type: str
    origin: str
    contribution: float


class UserRecommendation(BaseModel):
    painting_id: str
    score: float
    painting: Painting
    matched_features: list[MatchedFeature]
    most_similar_history_item_id: str | None = None
    similarity_to_history_item: float | None = None


class TasteItem(BaseModel):
    name: str
    type: str
    weight: float


def _get_painting_lookup() -> dict[str, dict[str, Any]]:
    df = load_paintings()
    records = df.astype(object).where(df.notna(), None).to_dict(orient="records")
    return {str(r["id"]): r for r in records}


@router.get("/", response_model=list[User])
def list_users(
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    df = storage.read_users()
    start = offset if isinstance(offset, int) else 0
    count = limit if isinstance(limit, int) else 500
    return df.iloc[start : start + count].to_dict(orient="records")


@router.get("/{user_id}", response_model=UserDetail)
def get_user(user_id: str):
    df = storage.read_users()
    user_row = df[df["id"] == user_id]
    if user_row.empty:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user_row.iloc[0].to_dict()
    categories_map = storage.read_categories()
    user_data["categories"] = categories_map.get(
        user_id, {"styles": [], "themes": [], "schools": [], "artists": []}
    )
    return user_data


@router.get("/{user_id}/history", response_model=list[HistoryItem])
def get_user_history(user_id: str):
    ratings_df = storage.read_ratings()
    history = ratings_df[ratings_df["user_id"] == user_id].copy()
    if history.empty:
        return []

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
    with storage.LOCK:
        df = storage.read_users()
        if user.id in df["id"].values:
            raise HTTPException(status_code=400, detail="User ID already exists")

        new_user = pd.DataFrame(
            [
                {
                    "id": user.id,
                    "username": user.username,
                    "created_at": user.created_at
                    or pd.Timestamp.now().strftime("%Y-%m-%d"),
                }
            ]
        )
        updated = pd.concat([df, new_user], ignore_index=True)
        storage.write_users(updated)
    return user


@router.post("/profiles", response_model=dict)
def create_profile(profile: ProfileCreate):
    with storage.LOCK:
        df = storage.read_users()
        user_id = f"user_{uuid.uuid4().hex[:6]}"
        new_user = pd.DataFrame(
            [
                {
                    "id": user_id,
                    "username": profile.username,
                    "created_at": pd.Timestamp.now().strftime("%Y-%m-%d"),
                }
            ]
        )
        updated = pd.concat([df, new_user], ignore_index=True)
        storage.write_users(updated)

        cat_map = storage.read_categories()
        cat_map[user_id] = profile.categories
        storage.write_categories(cat_map)

    return {"id": user_id}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str):
    with storage.LOCK:
        df = storage.read_users()
        if user_id not in df["id"].values:
            raise HTTPException(status_code=404, detail="User not found")

        df = df[df["id"] != user_id]
        storage.write_users(df)

        ratings_df = storage.read_ratings()
        ratings_df = ratings_df[ratings_df["user_id"] != user_id]
        storage.write_ratings(ratings_df)

        cat_map = storage.read_categories()
        if user_id in cat_map:
            del cat_map[user_id]
            storage.write_categories(cat_map)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{user_id}/categories")
def update_categories(user_id: str, categories: dict):
    with storage.LOCK:
        df = storage.read_users()
        if user_id not in df["id"].values:
            raise HTTPException(status_code=404, detail="User not found")

        cat_map = storage.read_categories()
        cat_map[user_id] = categories
        storage.write_categories(cat_map)
    return categories


@router.put("/{user_id}/ratings/{painting_id}")
def upsert_rating(user_id: str, painting_id: str, payload: RatingUpdate):
    painting_lookup = _get_painting_lookup()
    if painting_id not in painting_lookup:
        raise HTTPException(status_code=404, detail="Painting not found")

    with storage.LOCK:
        ratings_df = storage.read_ratings()
        match = (ratings_df["user_id"] == user_id) & (
            ratings_df["painting_id"] == painting_id
        )

        today_str = pd.Timestamp.today().strftime("%Y-%m-%d")
        if match.any():
            ratings_df.loc[match, "rating"] = payload.rating
            ratings_df.loc[match, "date"] = today_str
        else:
            new_row = pd.DataFrame(
                [
                    {
                        "user_id": user_id,
                        "painting_id": painting_id,
                        "rating": payload.rating,
                        "date": today_str,
                    }
                ]
            )
            ratings_df = pd.concat([ratings_df, new_row], ignore_index=True)

        storage.write_ratings(ratings_df)

    return {
        "status": "ok",
        "user_id": user_id,
        "painting_id": painting_id,
        "rating": payload.rating,
    }


@router.delete("/{user_id}/ratings/{painting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rating(user_id: str, painting_id: str):
    with storage.LOCK:
        ratings_df = storage.read_ratings()
        match = (ratings_df["user_id"] == user_id) & (
            ratings_df["painting_id"] == painting_id
        )
        if match.any():
            ratings_df = ratings_df[~match]
            storage.write_ratings(ratings_df)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _build_user_profile(user_id: str) -> pr.Profile:
    ratings_df = storage.read_ratings()
    user_ratings = ratings_df[ratings_df["user_id"] == user_id]
    rating_pairs = [
        (str(row["painting_id"]), int(row["rating"]))
        for _, row in user_ratings.iterrows()
    ]
    categories_map = storage.read_categories()
    categories = categories_map.get(user_id, {})
    return pr.build_profile(rating_pairs, categories)


@router.get("/{user_id}/recommendations", response_model=list[UserRecommendation])
def get_user_recommendations(
    user_id: str,
    n: int = Query(10, ge=1, le=50),
    diversify: bool = Query(False),
):
    n_val = n if isinstance(n, int) else 10
    div_val = bool(diversify) if isinstance(diversify, bool) else False
    profile = _build_user_profile(user_id)
    raw_recs = pr.recommend(profile, n=n_val, diversify=div_val)
    painting_lookup = _get_painting_lookup()

    output = []
    for rec in raw_recs:
        pid = str(rec["painting_id"])
        painting_data = painting_lookup.get(pid)
        if not painting_data:
            continue

        output.append(
            {
                "painting_id": pid,
                "score": rec["score"],
                "painting": painting_data,
                "matched_features": rec["matched_features"],
                "most_similar_history_item_id": rec["most_similar_history_item_id"],
                "similarity_to_history_item": rec["similarity_to_history_item"],
            }
        )
    return output


@router.get("/{user_id}/taste-profile", response_model=list[TasteItem])
def get_taste_profile(user_id: str):
    profile = _build_user_profile(user_id)
    return pr.taste_profile(profile, top=5)


@router.post("/taste-profile-preview", response_model=list[TasteItem])
def preview_taste_profile(categories: dict):
    profile = pr.build_profile([], categories)
    return pr.taste_profile(profile, top=5)
