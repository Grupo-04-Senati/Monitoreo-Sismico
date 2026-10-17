from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_sources():
    return {"items": [], "total": 0}


@router.post("/{source_id}/sync")
async def sync_source(source_id: str):
    return {"source_id": source_id, "status": "sync_triggered"}
