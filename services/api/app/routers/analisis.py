from fastapi import APIRouter

router = APIRouter()


@router.get("/timeseries")
async def timeseries():
    return {"data": []}
