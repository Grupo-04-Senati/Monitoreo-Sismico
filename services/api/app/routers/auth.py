from fastapi import APIRouter

router = APIRouter()


@router.get("/login")
def login_placeholder():
    return {"message": "Endpoint de login - implementar en Fase 2"}
