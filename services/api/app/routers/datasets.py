from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_datasets():
    return {"items": [], "total": 0}


@router.get("/{dataset_id}/quality")
async def dataset_quality(dataset_id: str):
    return {"dataset_id": dataset_id, "quality_report": None}
