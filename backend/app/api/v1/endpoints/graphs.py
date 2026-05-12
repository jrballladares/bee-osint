from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.graph import (
    GraphCreate,
    GraphDataRead,
    GraphRead,
    NodeCreate,
    NodeRead,
    NodeUpdate,
    RelationshipCreate,
    RelationshipRead,
)
from app.services.graph_service import GraphService

router = APIRouter()


@router.get("/", response_model=list[GraphRead])
def get_graphs(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    return service.get_graphs()


@router.post("/", response_model=GraphRead)
def create_graph(
    *,
    db: Session = Depends(get_db),
    graph_in: GraphCreate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    return service.create_graph(name=graph_in.name)


@router.delete("/{id}", response_model=bool)
def delete_graph(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    return service.delete_graph(graph_id=id)


@router.post("/{id}/import-record/{record_id}", response_model=list[NodeRead])
def import_record(
    *,
    db: Session = Depends(get_db),
    id: int,
    record_id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    try:
        return service.import_record_to_graph(
            graph_id=id,
            record_id=record_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{id}/investigate/{node_id}", response_model=bool)
def investigate_node(
    *,
    db: Session = Depends(get_db),
    id: int,
    node_id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    try:
        return service.investigate_person_node(
            graph_id=id,
            node_id=node_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TypeError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        ) from e


@router.get("/{graph_id}/documents/{node_id}/download")
def download_document(
    *,
    db: Session = Depends(get_db),
    graph_id: int,
    node_id: int,
    _current_user: User = Depends(get_current_user),
):
    service = GraphService(db)
    try:
        path, filename, media_type = service.get_document_download(
            graph_id=graph_id,
            node_id=node_id,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except TypeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return FileResponse(
        path=str(path),
        filename=filename,
        media_type=media_type,
    )


@router.post("/nodes", response_model=NodeRead)
def create_node(
    *,
    db: Session = Depends(get_db),
    node_in: NodeCreate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    return service.create_node(node_in.model_dump())


@router.put("/nodes/{id}", response_model=NodeRead)
def update_node(
    *,
    db: Session = Depends(get_db),
    id: int,
    node_in: NodeUpdate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    node = service.update_node(
        id,
        node_in.model_dump(exclude_unset=True),
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("/relationships", response_model=RelationshipRead)
def create_relationship(
    *,
    db: Session = Depends(get_db),
    rel_in: RelationshipCreate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    try:
        return service.create_relationship(rel_in.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/{id}/data", response_model=GraphDataRead)
def read_graph_data(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    return {
        "nodes": service.get_nodes(graph_id=id),
        "relationships": service.get_relationships(graph_id=id),
    }


@router.delete("/nodes/{id}", response_model=bool)
def delete_node(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    success = service.delete_node(id)
    if not success:
        raise HTTPException(status_code=404, detail="Node not found")
    return success


@router.delete("/relationships/{id}", response_model=bool)
def delete_relationship(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = GraphService(db)
    success = service.delete_relationship(id)
    if not success:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return success
