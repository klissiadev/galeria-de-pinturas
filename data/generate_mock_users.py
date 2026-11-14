from pathlib import Path
import numpy as np
import pandas as pd

SEED = 42
N_USERS = 200
MIN_RATINGS, MAX_RATINGS = 10, 40
SHARE_FROM_TASTE = 0.7     

SCRIPT_DIR = Path(__file__).resolve().parent
DATASET_DIR = SCRIPT_DIR / "dataset"

paintings = pd.read_csv(DATASET_DIR / "paintings.csv")
rng = np.random.default_rng(SEED)
all_ids = paintings["ObjectID"].to_numpy()


def build_term_index(col, min_count=15, top=25):
    """{ 'Style:Baroque': [ids...] } só para termos com pinturas suficientes."""
    terms = paintings[col].fillna("").map(
        lambda s: [t.strip() for t in s.split(",") if t.strip()])
    exploded = pd.DataFrame({"id": paintings["ObjectID"], "term": terms}).explode("term").dropna()
    groups = exploded.groupby("term")["id"].apply(list)
    groups = groups[groups.map(len) >= min_count]
    groups = groups.sort_values(key=lambda s: s.map(len), ascending=False).head(top)
    return {f"{col}:{term}": ids for term, ids in groups.items()}


taste_pools = {**build_term_index("Style"), **build_term_index("Theme")}
pool_names = list(taste_pools)
print(f"Gostos possíveis: {len(pool_names)}")

users, ratings = [], []
today = pd.Timestamp.today().normalize()

for uid in range(1, N_USERS + 1):
    users.append({
        "user_id": uid,
        "username": f"user_{uid:03d}",
        "created_at": (today - pd.Timedelta(days=int(rng.integers(30, 730)))).strftime("%Y-%m-%d"),
    })

    n = int(rng.integers(MIN_RATINGS, MAX_RATINGS + 1))
    tastes = rng.choice(pool_names, size=int(rng.integers(1, 3)), replace=False)
    liked_pool = np.unique(np.concatenate([taste_pools[t] for t in tastes]))

    n_liked = min(int(round(n * SHARE_FROM_TASTE)), len(liked_pool))
    liked = rng.choice(liked_pool, size=n_liked, replace=False)
    rest_pool = np.setdiff1d(all_ids, liked)
    others = rng.choice(rest_pool, size=n - n_liked, replace=False)

    for pid in liked:
        ratings.append((uid, pid, int(rng.choice([3, 4, 5], p=[0.15, 0.40, 0.45]))))
    for pid in others:
        ratings.append((uid, pid, int(rng.choice([1, 2, 3, 4, 5], p=[0.25, 0.30, 0.25, 0.15, 0.05]))))

ratings_df = pd.DataFrame(ratings, columns=["user_id", "painting_id", "rating"])
ratings_df["date"] = [
    (today - pd.Timedelta(days=int(d))).strftime("%Y-%m-%d")
    for d in rng.integers(0, 365, size=len(ratings_df))
]
ratings_df = ratings_df.sample(frac=1, random_state=SEED).reset_index(drop=True)

users_df = pd.DataFrame(users)
users_df.to_csv(DATASET_DIR / "users.csv", index=False)
ratings_df.to_csv(DATASET_DIR / "ratings.csv", index=False)

print(f"users.csv  : {len(users_df)} usuários")
print(f"ratings.csv: {len(ratings_df)} avaliações")
print(ratings_df["rating"].value_counts().sort_index().to_string())