from fastapi import APIRouter

router = APIRouter()


@router.get("/experiments")
async def list_experiments():
    return {"items": [], "total": 0}


@router.get("/experiments/{experiment_id}")
async def get_experiment(experiment_id: str):
    return {"id": experiment_id}


@router.post("/models/{model_id}/approve")
async def approve_model(model_id: str):
    return {"model_id": model_id, "status": "approved"}
