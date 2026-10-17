from fastapi import APIRouter

router = APIRouter()


@router.get("/summary")
async def dashboard_summary():
    return {
        "total_events": 0,
        "recent_events": 0,
        "last_sync": None,
        "active_sources": 0,
        "active_alerts": 0,
    }
