from fastapi import FastAPI
from backend.routes.users import router as user_router
from backend.routes.paintings import router as painting_router

app = FastAPI()

app.include_router(user_router)
app.include_router(painting_router)

@app.get("/")
def home():
    return {"message": "API funcionando!"}