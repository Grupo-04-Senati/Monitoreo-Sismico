from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_audit_logs():
    return {"items": [], "total": 0}
