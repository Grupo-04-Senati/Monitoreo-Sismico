from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_alert_rules():
    return {"items": [], "total": 0}
