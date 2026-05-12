import mimetypes
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.graph import Graph, Node, Relationship
from app.repositories.graph_repository import GraphRepository
from app.repositories.news_repository import NewsRepository
from app.repositories.record_repository import RecordRepository


class GraphService:
    ADDRESS_LABEL_MAX_LENGTH = 30

    def __init__(self, db: Session):
        self.db = db
        self.repo = GraphRepository(db)
        self.record_repo = RecordRepository(db)
        self.news_repo = NewsRepository(db)

    def create_graph(self, name: str) -> Graph:
        return self.repo.create_graph(name)

    def get_graphs(self) -> list[Graph]:
        return self.repo.get_graphs()

    def delete_graph(self, graph_id: int) -> bool:
        return self.repo.delete_graph(graph_id)

    def create_node(
        self,
        node_data: dict,
    ) -> Node:
        return self.repo.create_node(node_data)

    def get_nodes(self, graph_id: int) -> list[Node]:
        return self.repo.get_nodes(graph_id)

    def update_node(
        self,
        node_id: int,
        node_data: dict,
    ) -> Node | None:
        return self.repo.update_node(node_id, node_data)

    def delete_node(
        self,
        node_id: int,
    ) -> bool:
        return self.repo.delete_node(node_id)

    def create_relationship(
        self,
        rel_data: dict,
    ) -> Relationship:
        return self.repo.create_relationship(rel_data)

    def get_relationships(self, graph_id: int) -> list[Relationship]:
        return self.repo.get_relationships(graph_id)

    def investigate_person_node(
        self,
        graph_id: int,
        node_id: int,
    ) -> bool:
        node = self.db.query(Node).filter(Node.id == node_id, Node.graph_id == graph_id).first()

        if not node:
            raise ValueError("Node not found")

        if node.type != "person":
            raise TypeError("Only person nodes can be investigated for news")

        self.search_and_link_news(
            graph_id=graph_id,
            person_node=node,
            name=node.label,
        )
        return True

    def get_document_download(
        self,
        graph_id: int,
        node_id: int,
    ) -> tuple[Path, str, str]:
        node = (
            self.db.query(Node)
            .filter(
                Node.id == node_id,
                Node.graph_id == graph_id,
            )
            .first()
        )

        if not node:
            raise FileNotFoundError("Document node not found")

        if node.type != "document":
            raise TypeError("Selected node is not a document")

        node_data = node.data or {}
        file_path = (
            node_data.get("file_path") or node_data.get("path") or node_data.get("document_path")
        )

        if not file_path:
            raise FileNotFoundError("Document file path not found in node data")

        path = Path(file_path)
        if not path.exists() or not path.is_file():
            raise FileNotFoundError("Document file does not exist")

        filename = (
            node_data.get("file_name") or node_data.get("filename") or node.label or path.name
        )
        media_type = (
            node_data.get("content_type")
            or mimetypes.guess_type(str(path))[0]
            or "application/octet-stream"
        )

        return path, filename, media_type

    def delete_relationship(
        self,
        rel_id: int,
    ) -> bool:
        return self.repo.delete_relationship(rel_id)

    def import_record_to_graph(
        self,
        graph_id: int,
        record_id: int,
    ) -> list[Node]:
        record = self.record_repo.get_record(record_id)
        if not record:
            raise ValueError("Record not found")

        nodes = []

        person_name = f"{record.first_name} {record.last_name}"

        person_node = self.repo.get_node_by_record_id(record_id, graph_id)
        if not person_node:
            person_node = self.repo.create_node(
                {
                    "graph_id": graph_id,
                    "label": person_name,
                    "type": "person",
                    "data": {"record_id": record_id},
                },
            )
        nodes.append(person_node)

        for phone in record.phones:
            phone_node = self.repo.get_node_by_properties(
                graph_id,
                phone.phone_number,
                "phone",
            )
            if not phone_node:
                phone_node = self.repo.create_node(
                    {
                        "graph_id": graph_id,
                        "label": phone.phone_number,
                        "type": "phone",
                        "data": {"label": phone.label},
                    },
                )
            nodes.append(phone_node)

            if not self.repo.get_relationship_by_properties(
                graph_id,
                person_node.id,
                phone_node.id,
                "has_phone",
            ):
                self.repo.create_relationship(
                    {
                        "graph_id": graph_id,
                        "source_id": person_node.id,
                        "target_id": phone_node.id,
                        "type": "has_phone",
                    },
                )

        if record.email:
            email_node = self.repo.get_node_by_properties(
                graph_id,
                record.email,
                "email",
            )
            if not email_node:
                email_node = self.repo.create_node(
                    {
                        "graph_id": graph_id,
                        "label": record.email,
                        "type": "email",
                        "data": {},
                    },
                )
            nodes.append(email_node)

            if not self.repo.get_relationship_by_properties(
                graph_id,
                person_node.id,
                email_node.id,
                "has_email",
            ):
                self.repo.create_relationship(
                    {
                        "graph_id": graph_id,
                        "source_id": person_node.id,
                        "target_id": email_node.id,
                        "type": "has_email",
                    },
                )

        for addr in record.addresses:
            label = (
                addr.address[: self.ADDRESS_LABEL_MAX_LENGTH] + "..."
                if len(addr.address) > self.ADDRESS_LABEL_MAX_LENGTH
                else addr.address
            )
            addr_node = self.repo.get_node_by_properties(graph_id, label, "address")
            if not addr_node:
                addr_node = self.repo.create_node(
                    {
                        "graph_id": graph_id,
                        "label": label,
                        "type": "address",
                        "data": {"full_address": addr.address, "label": addr.label},
                    },
                )
            nodes.append(addr_node)

            if not self.repo.get_relationship_by_properties(
                graph_id,
                person_node.id,
                addr_node.id,
                "has_address",
            ):
                self.repo.create_relationship(
                    {
                        "graph_id": graph_id,
                        "source_id": person_node.id,
                        "target_id": addr_node.id,
                        "type": "has_address",
                    },
                )

        for sm in record.social_media:
            label = f"{sm.platform}: {sm.username_or_url}"
            sm_node = self.repo.get_node_by_properties(graph_id, label, "social_media")
            if not sm_node:
                sm_node = self.repo.create_node(
                    {
                        "graph_id": graph_id,
                        "label": label,
                        "type": "social_media",
                        "data": {
                            "platform": sm.platform,
                            "username_or_url": sm.username_or_url,
                        },
                    },
                )
            nodes.append(sm_node)

            if not self.repo.get_relationship_by_properties(
                graph_id,
                person_node.id,
                sm_node.id,
                "has_social",
            ):
                self.repo.create_relationship(
                    {
                        "graph_id": graph_id,
                        "source_id": person_node.id,
                        "target_id": sm_node.id,
                        "type": "has_social",
                    },
                )

        for doc in record.documents:
            doc_node = self.repo.get_node_by_properties(
                graph_id,
                doc.file_name,
                "document",
            )
            if not doc_node:
                doc_node = self.repo.create_node(
                    {
                        "graph_id": graph_id,
                        "label": doc.file_name,
                        "type": "document",
                        "data": {
                            "file_path": doc.file_path,
                            "file_type": doc.file_type,
                        },
                    },
                )
            nodes.append(doc_node)

            if not self.repo.get_relationship_by_properties(
                graph_id,
                person_node.id,
                doc_node.id,
                "has_document",
            ):
                self.repo.create_relationship(
                    {
                        "graph_id": graph_id,
                        "source_id": person_node.id,
                        "target_id": doc_node.id,
                        "type": "has_document",
                    },
                )

        self.search_and_link_news(
            graph_id,
            person_node,
            person_name,
        )

        return nodes

    def search_and_link_news(
        self,
        graph_id: int,
        person_node: Node,
        name: str,
    ):
        news_items, _ = self.news_repo.get_paginated_news(
            page=1,
            page_size=10,
            query_text=name,
        )

        for news, _source_name in news_items:
            existing_news_node = (
                self.db.query(Node)
                .filter(
                    Node.graph_id == graph_id,
                    Node.type == "news",
                    Node.label == news.title,
                )
                .first()
            )

            if not existing_news_node:
                existing_news_node = self.repo.create_node(
                    {
                        "graph_id": graph_id,
                        "label": news.title,
                        "type": "news",
                        "data": {"news_id": news.id, "link": news.link},
                    },
                )

            existing_rel = (
                self.db.query(Relationship)
                .filter(
                    Relationship.graph_id == graph_id,
                    Relationship.source_id == existing_news_node.id,
                    Relationship.target_id == person_node.id,
                    Relationship.type == "mentions",
                )
                .first()
            )

            if not existing_rel:
                self.repo.create_relationship(
                    {
                        "graph_id": graph_id,
                        "source_id": existing_news_node.id,
                        "target_id": person_node.id,
                        "type": "mentions",
                    },
                )
