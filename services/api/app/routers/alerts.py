from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_alerts():
    return {"items": [], "total": 0}


@router.post("/{alert_id}/approve")
async def approve_alert(alert_id: str):
    return {"alert_id": alert_id, "status": "approved"}
