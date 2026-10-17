from fastapi import APIRouter

router = APIRouter()


@router.get("/events/geojson")
async def events_geojson():
    return {"type": "FeatureCollection", "features": []}
