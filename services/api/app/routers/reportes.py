from fastapi import APIRouter

router = APIRouter()


@router.post("/")
async def create_report():
    return {"status": "queued"}


@router.get("/{report_id}")
async def get_report(report_id: str):
    return {"id": report_id, "status": "pending"}
