from sqlalchemy.orm import Session

from app.models.graph import Graph, Node, Relationship


class GraphRepository:
    def __init__(self, db: Session):
        self.db = db

    # Graph operations
    def create_graph(self, name: str) -> Graph:
        graph = Graph(name=name)
        self.db.add(graph)
        self.db.commit()
        self.db.refresh(graph)
        return graph

    def get_graphs(self) -> list[Graph]:
        return self.db.query(Graph).all()

    def get_graph(self, graph_id: int) -> Graph | None:
        return self.db.query(Graph).filter(Graph.id == graph_id).first()

    def delete_graph(self, graph_id: int) -> bool:
        graph = self.get_graph(graph_id)
        if not graph:
            return False
        self.db.delete(graph)
        self.db.commit()
        return True

    # Node operations
    def create_node(self, node_data: dict) -> Node:
        graph = self.get_graph(node_data["graph_id"])
        if not graph:
            raise ValueError("Graph not found")

        node = Node(**node_data)
        self.db.add(node)
        self.db.commit()
        self.db.refresh(node)
        return node

    def get_nodes(self, graph_id: int) -> list[Node]:
        return self.db.query(Node).filter(Node.graph_id == graph_id).all()

    def get_node_by_record_id(self, record_id: int, graph_id: int | None = None) -> Node | None:
        query = self.db.query(Node).filter(Node.type == "person")
        if graph_id:
            query = query.filter(Node.graph_id == graph_id)

        nodes = query.all()
        for node in nodes:
            if node.data and node.data.get("record_id") == record_id:
                return node
        return None

    def get_node_by_properties(self, graph_id: int, label: str, type: str) -> Node | None:
        return (
            self.db.query(Node)
            .filter(
                Node.graph_id == graph_id,
                Node.label == label,
                Node.type == type,
            )
            .first()
        )

    def get_relationship_by_properties(
        self, graph_id: int, source_id: int, target_id: int, type: str
    ) -> Relationship | None:
        return (
            self.db.query(Relationship)
            .filter(
                Relationship.graph_id == graph_id,
                Relationship.source_id == source_id,
                Relationship.target_id == target_id,
                Relationship.type == type,
            )
            .first()
        )

    def create_relationship(self, rel_data: dict) -> Relationship:
        graph = self.get_graph(rel_data["graph_id"])
        if not graph:
            raise ValueError("Graph not found")

        # Validate that both source and target nodes belong to the same graph.
        source_node = (
            self.db.query(Node)
            .filter(
                Node.id == rel_data["source_id"],
                Node.graph_id == rel_data["graph_id"],
            )
            .first()
        )
        target_node = (
            self.db.query(Node)
            .filter(
                Node.id == rel_data["target_id"],
                Node.graph_id == rel_data["graph_id"],
            )
            .first()
        )

        if not source_node or not target_node:
            raise ValueError("Source or target node not found in the specified graph")

        rel = Relationship(**rel_data)
        self.db.add(rel)
        self.db.commit()
        self.db.refresh(rel)
        return rel

    def get_relationships(self, graph_id: int) -> list[Relationship]:
        return self.db.query(Relationship).filter(Relationship.graph_id == graph_id).all()

    def update_node(self, node_id: int, node_data: dict) -> Node | None:
        node = self.db.query(Node).filter(Node.id == node_id).first()
        if not node:
            return None
        for key, value in node_data.items():
            if key != "graph_id":  # Prevent moving nodes between graphs for now
                setattr(node, key, value)
        self.db.commit()
        self.db.refresh(node)
        return node

    def delete_node(self, node_id: int) -> bool:
        node = self.db.query(Node).filter(Node.id == node_id).first()
        if not node:
            return False
        # Also delete associated relationships
        self.db.query(Relationship).filter(
            ((Relationship.source_id == node_id) | (Relationship.target_id == node_id)),
        ).delete()
        self.db.delete(node)
        self.db.commit()
        return True

    def delete_relationship(self, rel_id: int) -> bool:
        rel = self.db.query(Relationship).filter(Relationship.id == rel_id).first()
        if not rel:
            return False
        self.db.delete(rel)
        self.db.commit()
        return True
