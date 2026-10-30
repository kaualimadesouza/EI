from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from topa_api.application.list_stores import ListStoresUseCase
from topa_api.presentation.fastapi.dependencies import get_list_stores_use_case

router = APIRouter(tags=["stores"])


class StoreResponse(BaseModel):
    slug: str
    name: str


@router.get("/stores")
def list_stores(
    use_case: Annotated[ListStoresUseCase, Depends(get_list_stores_use_case)],
) -> list[StoreResponse]:
    """Lists all registered stores for selection in the browser."""
    stores = use_case.execute()
    return [StoreResponse(slug=store.slug, name=store.name) for store in stores]
