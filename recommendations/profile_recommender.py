"""Recomendação por PERFIL: mesma lógica do `recommender.ts` do front, agora no back.

Atributos de cada obra: Tema, Estilo, Escola, Artista, Palavra-chave (binários, sem IDF).
  - categorias escolhidas: peso = weight / 2  (Gosto = 0.5, Gosto muito = 1)
  - histórico: soma de nota_peso / total_de_avaliações   (1: -1 | 2: -0.5 | 3: 0 | 4: 0.5 | 5: 1)
  - perfil = categorias * alpha + histórico * (1 - alpha)   (se só um existir, ele vale 100%)
  - score = dot(perfil, obra) / (|perfil| * sqrt(nº de atributos da obra))   -> cosseno, em [0, 1]
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
from scipy import sparse

from recommendations.painting_recommender import get_recommender

PROFILE_ALPHA = 0.5  # igual ao PROFILE_ALPHA do recommender.ts
NOTE_WEIGHT = {1: -1.0, 2: -0.5, 3: 0.0, 4: 0.5, 5: 1.0}
GROUP_TO_TYPE = {"styles": "style", "themes": "theme", "schools": "school", "artists": "artist"}
TYPE_LABEL = {"theme": "Tema", "style": "Estilo", "school": "Escola",
              "keyword": "Palavra-chave", "artist": "Artista"}
TOP_FEATURES = 4  # atributos explicados por recomendação


def _split(text: str) -> list[str]:
    return [t.strip() for t in str(text).split(",") if t.strip()]


class FeatureSpace:
    def __init__(self, df):
        self.index: dict[tuple[str, str], int] = {}
        self.names: list[tuple[str, str]] = []
        self.groups: list[str] = []  # grupo de diversidade de cada obra (estilo ou tema principal)
        rows, cols = [], []
        data = df[["style", "theme", "school", "keywords", "artist"]]
        for i, (style, theme, school, kws, artist) in enumerate(data.itertuples(index=False, name=None)):
            styles, themes = _split(style), _split(theme)
            self.groups.append((styles or themes or [""])[0])
            feats = {("style", v) for v in styles} | {("theme", v) for v in themes}
            feats |= {("school", v) for v in _split(school)}
            feats |= {("keyword", v) for v in _split(kws)}
            if str(artist).strip():
                feats.add(("artist", str(artist).strip()))
            for f in feats:
                j = self.index.get(f)
                if j is None:
                    j = len(self.names)
                    self.index[f] = j
                    self.names.append(f)
                rows.append(i)
                cols.append(j)
        n, m = len(df), len(self.names)
        self.B = sparse.csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, m))
        self.counts = np.asarray(self.B.sum(axis=0)).ravel()
        self.sqrt_nf = np.sqrt(np.asarray(self.B.sum(axis=1)).ravel())


@lru_cache(maxsize=1)
def get_space() -> FeatureSpace:
    return FeatureSpace(get_recommender().painting_df)


@dataclass
class Profile:
    cat: np.ndarray
    hist: np.ndarray
    cat_factor: float
    hist_factor: float
    weights: np.ndarray
    norm: float
    history_idx: list[int] = field(default_factory=list)


def build_profile(ratings: list[tuple[str, int]], categories: dict, alpha: float = PROFILE_ALPHA) -> Profile:
    sp, pos = get_space(), get_recommender().pos
    m = len(sp.names)

    cat = np.zeros(m)
    for group, items in (categories or {}).items():
        ftype = GROUP_TO_TYPE.get(group)
        for item in items or []:
            j = sp.index.get((ftype, item["value"]))
            if j is not None:
                cat[j] = item.get("weight", 1) / 2

    hist = np.zeros(m)
    idx, w = [], []
    for pid, rating in ratings:
        j = pos.get(str(pid))
        if j is not None:
            idx.append(j)
            w.append(NOTE_WEIGHT.get(int(rating), 0.0) / len(ratings))
    if idx:
        hist = np.asarray(sp.B[idx].T @ np.array(w)).ravel()

    has_cat, has_hist = bool(cat.any()), len(ratings) > 0
    cat_factor = alpha if (has_hist and has_cat) else (1.0 if has_cat else 0.0)
    hist_factor = 1 - alpha if (has_hist and has_cat) else (1.0 if has_hist else 0.0)
    weights = cat * cat_factor + hist * hist_factor
    return Profile(cat, hist, cat_factor, hist_factor, weights, float(np.linalg.norm(weights)), idx)


def _explain(sp: FeatureSpace, p: Profile, i: int) -> list[dict]:
    denom = p.norm * sp.sqrt_nf[i]
    out = []
    for j in sp.B[i].indices:
        ftype, value = sp.names[j]
        for origin, val in (("selection", p.cat[j] * p.cat_factor), ("history", p.hist[j] * p.hist_factor)):
            if val > 0:
                out.append({"name": f"{TYPE_LABEL[ftype]}: {value}", "type": ftype,
                            "origin": origin, "contribution": round(float(val / denom), 2)})
    out.sort(key=lambda f: -f["contribution"])
    return out[:TOP_FEATURES]


def recommend(p: Profile, n: int = 10, diversify: bool = False) -> list[dict]:
    if p.norm == 0:
        return []
    sp, rec = get_space(), get_recommender()
    dot = np.asarray(sp.B @ p.weights).ravel()
    score = np.where(sp.sqrt_nf > 0, dot / (p.norm * np.maximum(sp.sqrt_nf, 1e-9)), 0.0)
    score = np.clip(score, 0, 1)
    if p.history_idx:
        score[p.history_idx] = -1  # obras já avaliadas nunca entram
    order = [int(j) for j in np.argsort(-score, kind="stable") if score[j] > 0]

    if diversify:  # evita repetir o mesmo grupo (estilo/tema) nas 2 últimas escolhas
        pool, picked = order, []
        while pool and len(picked) < n:
            last = {sp.groups[k] for k in picked[-2:]}
            pos = next((q for q, k in enumerate(pool) if sp.groups[k] not in last), 0)
            picked.append(pool.pop(pos))
        order = picked
    order = order[:n]

    results = []
    hist = np.array(p.history_idx, dtype=int)
    for i in order:
        similar_id, similar = None, None
        if len(hist):
            overlap = np.asarray((sp.B[hist] @ sp.B[i].T).todense()).ravel()
            sims = overlap / np.sqrt(np.maximum(sp.sqrt_nf[hist] ** 2 * sp.sqrt_nf[i] ** 2, 1e-9))
            best = int(sims.argmax())
            if sims[best] > 0:
                similar_id, similar = str(rec.ids[hist[best]]), round(float(sims[best]), 2)
        results.append({
            "index": i,
            "painting_id": str(rec.ids[i]),
            "score": round(float(score[i]), 2),
            "matched_features": _explain(sp, p, i),
            "most_similar_history_item_id": similar_id,
            "similarity_to_history_item": similar,
        })
    return results


def taste_profile(p: Profile, top: int = 5) -> list[dict]:
    sp = get_space()
    order = [j for j in np.argsort(-p.weights, kind="stable")[:top] if p.weights[j] > 0]
    if not order:
        return []
    top_w = max(float(p.weights[order[0]]), 1.0)
    return [{"name": sp.names[j][1], "type": sp.names[j][0], "weight": round(float(p.weights[j]) / top_w, 3)}
            for j in order]


def catalog(limit: int = 40, artists_limit: int = 50) -> dict[str, list[str]]:
    """Categorias para o onboarding, da mais para a menos frequente."""
    sp = get_space()
    out = {}
    for group, ftype in GROUP_TO_TYPE.items():
        idx = [j for j, (t, _) in enumerate(sp.names) if t == ftype]
        idx.sort(key=lambda j: -sp.counts[j])
        out[group] = [sp.names[j][1] for j in idx[: artists_limit if group == "artists" else limit]]
    return out


def search_artists(q: str, limit: int = 5) -> list[str]:
    sp, q = get_space(), q.strip().lower()
    idx = [j for j, (t, v) in enumerate(sp.names) if t == "artist" and q in v.lower()]
    idx.sort(key=lambda j: -sp.counts[j])
    return [sp.names[j][1] for j in idx[:limit]]