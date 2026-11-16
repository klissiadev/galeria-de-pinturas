"""Leitura/escrita dos CSV/JSON de dados, com lock e escrita atômica."""
from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path

import pandas as pd

USERS_CSV = Path("data/dataset/users.csv")
RATINGS_CSV = Path("data/dataset/ratings.csv")
CATEGORIES_JSON = Path("data/dataset/user_categories.json")

LOCK = threading.RLock()  # use `with storage.LOCK:` em operações ler-modificar-gravar


def _atomic_write(path: Path, writer) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    os.close(fd)
    try:
        writer(tmp)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


# ---------- usuários ----------
def read_users() -> pd.DataFrame:
    if not USERS_CSV.exists():
        return pd.DataFrame(columns=["id", "username", "created_at"])
    df = pd.read_csv(USERS_CSV, dtype=str).rename(columns={"user_id": "id"})
    df["created_at"] = df["created_at"].fillna("")
    return df[["id", "username", "created_at"]]


def write_users(df: pd.DataFrame) -> None:
    out = df.rename(columns={"id": "user_id"})[["user_id", "username", "created_at"]]
    _atomic_write(USERS_CSV, lambda p: out.to_csv(p, index=False))


# ---------- avaliações ----------
def read_ratings() -> pd.DataFrame:
    if not RATINGS_CSV.exists():
        return pd.DataFrame(columns=["user_id", "painting_id", "rating", "date"])
    df = pd.read_csv(RATINGS_CSV, dtype={"user_id": str, "painting_id": str})
    if "date" not in df.columns:
        df["date"] = ""
    df["rating"] = pd.to_numeric(df["rating"], errors="coerce").fillna(0).astype(int)
    return df[["user_id", "painting_id", "rating", "date"]]


def write_ratings(df: pd.DataFrame) -> None:
    _atomic_write(RATINGS_CSV, lambda p: df.to_csv(p, index=False))


# ---------- categorias escolhidas por usuário ----------
def read_categories() -> dict[str, dict]:
    if not CATEGORIES_JSON.exists():
        return {}
    return json.loads(CATEGORIES_JSON.read_text(encoding="utf-8"))


def write_categories(data: dict[str, dict]) -> None:
    _atomic_write(
        CATEGORIES_JSON,
        lambda p: Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8"),
    )