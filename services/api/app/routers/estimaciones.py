from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_estimates():
    return {"items": [], "total": 0, "disclaimer": "Estimaciones experimentales. No equivalen a alertas oficiales."}
