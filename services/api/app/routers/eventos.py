from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/")
async def list_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return {"items": [], "total": 0, "limit": limit, "offset": offset}


@router.get("/{event_id}")
async def get_event(event_id: str):
    return {"id": event_id, "message": "Detalle de evento - implementar en Fase 3"}
