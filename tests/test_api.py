"""Testes automatizados para validação dos endpoints da API."""
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_home():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "API funcionando!"}


def test_list_users():
    response = client.get("/users/?limit=5")
    assert response.status_code == 200
    users = response.json()
    assert isinstance(users, list)
    assert len(users) <= 5
    if users:
        assert "id" in users[0]
        assert "username" in users[0]


def test_get_evaluation_metrics():
    response = client.get("/evaluation/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert "fbc" in data["models"]
    assert "random" in data["models"]
    assert "popularity" in data["models"]
    assert "fbc_mmr" in data["models"]
    assert "precision@5" in data["models"]["fbc"]["metrics"]


def test_get_qualitative_cases():
    response = client.get("/evaluation/qualitative")
    assert response.status_code == 200
    cases = response.json()
    assert isinstance(cases, list)
    assert len(cases) == 3
    assert any(c["is_error"] for c in cases)


def test_categories():
    response = client.get("/categories/")
    assert response.status_code == 200
    data = response.json()
    assert "styles" in data
    assert "themes" in data
