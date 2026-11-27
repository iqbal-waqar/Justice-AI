from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.interactors.client_interactor import client_interactor
from backend.interactors.firm_interactor import FirmContext, current_firm
from backend.schemas import ClientIn, ClientOut, ClientUpdate, MatterIn, MatterOut, MatterUpdate

router = APIRouter()


@router.get("/clients", response_model=List[ClientOut])
def list_clients(search: Optional[str] = None, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.list_clients(ctx, db, search)


@router.post("/clients", response_model=ClientOut)
def create_client(body: ClientIn, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.create_client(ctx, body.model_dump(), db)


@router.get("/clients/{client_id}", response_model=ClientOut)
def get_client(client_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.client_detail(ctx, client_id, db)


@router.put("/clients/{client_id}", response_model=ClientOut)
def update_client(client_id: int, body: ClientUpdate, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.update_client(ctx, client_id, body.model_dump(exclude_unset=True), db)


@router.delete("/clients/{client_id}")
def delete_client(client_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.delete_client(ctx, client_id, db)


@router.get("/matters", response_model=List[MatterOut])
def list_matters(ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.list_matters(ctx, db)


@router.post("/matters", response_model=MatterOut)
def create_matter(body: MatterIn, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.create_matter(ctx, body.model_dump(exclude_none=True), db)


@router.put("/matters/{matter_id}", response_model=MatterOut)
def update_matter(matter_id: int, body: MatterUpdate, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.update_matter(ctx, matter_id, body.model_dump(exclude_unset=True), db)


@router.delete("/matters/{matter_id}")
def delete_matter(matter_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return client_interactor.delete_matter(ctx, matter_id, db)
