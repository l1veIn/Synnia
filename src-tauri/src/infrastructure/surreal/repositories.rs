use surrealdb::sql::Thing;

use crate::core::AppError;
use crate::domain::{Edge, ExecutionRun, File, Node};
use super::SurrealDb;

#[derive(Clone)]
pub struct SurrealRepositories {
    pub node: NodeRepository,
    pub edge: EdgeRepository,
    pub file: FileRepository,
    pub execution: ExecutionRepository,
}

impl SurrealRepositories {
    pub fn new(db: SurrealDb) -> Self {
        Self {
            node: NodeRepository::new(db.clone()),
            edge: EdgeRepository::new(db.clone()),
            file: FileRepository::new(db.clone()),
            execution: ExecutionRepository::new(db),
        }
    }
}

#[derive(Clone, Debug)]
pub struct NodeRepository {
    db: SurrealDb,
}

impl NodeRepository {
    pub fn new(db: SurrealDb) -> Self {
        Self { db }
    }

    pub async fn create(&self, project_id: &str, node: &Node) -> Result<(), AppError> {
        let record = NodeRecord::from_domain(project_id, node);
        let _: Option<NodeRecord> = self
            .db
            .create(("node", node.id.as_str()))
            .content(record)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn update(&self, project_id: &str, node: &Node) -> Result<(), AppError> {
        let record = NodeRecord::from_domain(project_id, node);
        let _: Option<NodeRecord> = self
            .db
            .update(("node", node.id.as_str()))
            .content(record)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn get(&self, project_id: &str, id: &str) -> Result<Option<Node>, AppError> {
        let mut response = self
            .db
            .query("SELECT * FROM node WHERE projectId = $projectId AND id = $id")
            .bind(("projectId", project_id.to_string()))
            .bind(("id", Thing::from(("node", id))))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result: Option<NodeRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(result.map(|r| r.into_domain()))
    }

    pub async fn list_by_project(&self, project_id: &str) -> Result<Vec<Node>, AppError> {
        let mut response = self
            .db
            .query("SELECT * FROM node WHERE projectId = $projectId")
            .bind(("projectId", project_id.to_string()))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result: Vec<NodeRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(result.into_iter().map(|r| r.into_domain()).collect())
    }

    pub async fn delete(&self, project_id: &str, id: &str) -> Result<(), AppError> {
        self.db
            .query("DELETE node WHERE projectId = $projectId AND id = $id")
            .bind(("projectId", project_id.to_string()))
            .bind(("id", Thing::from(("node", id))))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn delete_by_project(&self, project_id: &str) -> Result<(), AppError> {
        self.db
            .query("DELETE node WHERE projectId = $projectId")
            .bind(("projectId", project_id.to_string()))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct EdgeRepository {
    db: SurrealDb,
}

impl EdgeRepository {
    pub fn new(db: SurrealDb) -> Self {
        Self { db }
    }

    pub async fn create(&self, project_id: &str, edge: &Edge) -> Result<(), AppError> {
        let record = EdgeRecord::from_domain(project_id, edge);
        let _: Option<EdgeRecord> = self
            .db
            .create(("edge", edge.id.as_str()))
            .content(record)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn list_by_project(&self, project_id: &str) -> Result<Vec<Edge>, AppError> {
        let mut response = self
            .db
            .query("SELECT * FROM edge WHERE projectId = $projectId")
            .bind(("projectId", project_id.to_string()))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result: Vec<EdgeRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(result.into_iter().map(|r| r.into_domain()).collect())
    }

    pub async fn delete(&self, project_id: &str, id: &str) -> Result<(), AppError> {
        self.db
            .query("DELETE edge WHERE projectId = $projectId AND id = $id")
            .bind(("projectId", project_id.to_string()))
            .bind(("id", Thing::from(("edge", id))))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn delete_by_project(&self, project_id: &str) -> Result<(), AppError> {
        self.db
            .query("DELETE edge WHERE projectId = $projectId")
            .bind(("projectId", project_id.to_string()))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct FileRepository {
    db: SurrealDb,
}

impl FileRepository {
    pub fn new(db: SurrealDb) -> Self {
        Self { db }
    }

    pub async fn create(&self, project_id: &str, file: &File) -> Result<(), AppError> {
        let record = FileRecord::from_domain(project_id, file);
        let _: Option<FileRecord> = self
            .db
            .create(("file", file.id.as_str()))
            .content(record)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn get(&self, project_id: &str, id: &str) -> Result<Option<File>, AppError> {
        let mut response = self
            .db
            .query("SELECT * FROM file WHERE projectId = $projectId AND id = $id")
            .bind(("projectId", project_id.to_string()))
            .bind(("id", Thing::from(("file", id))))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result: Option<FileRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(result.map(|r| r.into_domain()))
    }

    pub async fn list_by_project(&self, project_id: &str) -> Result<Vec<File>, AppError> {
        let mut response = self
            .db
            .query("SELECT * FROM file WHERE projectId = $projectId")
            .bind(("projectId", project_id.to_string()))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result: Vec<FileRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(result.into_iter().map(|r| r.into_domain()).collect())
    }

    pub async fn delete(&self, project_id: &str, id: &str) -> Result<(), AppError> {
        self.db
            .query("DELETE file WHERE projectId = $projectId AND id = $id")
            .bind(("projectId", project_id.to_string()))
            .bind(("id", Thing::from(("file", id))))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn delete_by_project(&self, project_id: &str) -> Result<(), AppError> {
        self.db
            .query("DELETE file WHERE projectId = $projectId")
            .bind(("projectId", project_id.to_string()))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct ExecutionRepository {
    db: SurrealDb,
}

impl ExecutionRepository {
    pub fn new(db: SurrealDb) -> Self {
        Self { db }
    }

    pub async fn create(&self, project_id: &str, run: &ExecutionRun) -> Result<(), AppError> {
        let record = ExecutionRecord::from_domain(project_id, run);
        let _: Option<ExecutionRecord> = self
            .db
            .create(("execution_run", run.run_id.as_str()))
            .content(record)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn update(&self, project_id: &str, run: &ExecutionRun) -> Result<(), AppError> {
        let record = ExecutionRecord::from_domain(project_id, run);
        let _: Option<ExecutionRecord> = self
            .db
            .update(("execution_run", run.run_id.as_str()))
            .content(record)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn list_by_node(&self, project_id: &str, node_id: &str) -> Result<Vec<ExecutionRun>, AppError> {
        let mut response = self
            .db
            .query("SELECT * FROM execution_run WHERE projectId = $projectId AND (inputNodeId = $nodeId OR outputNodeId = $nodeId) ORDER BY startedAt DESC")
            .bind(("projectId", project_id.to_string()))
            .bind(("nodeId", node_id.to_string()))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result: Vec<ExecutionRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(result.into_iter().map(|r| r.into_domain()).collect())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeRecord {
    id: Thing,
    project_id: String,
    #[serde(flatten)]
    node: Node,
}

impl NodeRecord {
    fn from_domain(project_id: &str, node: &Node) -> Self {
        Self {
            id: Thing::from(("node", node.id.as_str())),
            project_id: project_id.to_string(),
            node: node.clone(),
        }
    }

    fn into_domain(self) -> Node {
        let mut node = self.node;
        node.id = self.id.id.to_string();
        node
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct EdgeRecord {
    id: Thing,
    project_id: String,
    #[serde(flatten)]
    edge: Edge,
}

impl EdgeRecord {
    fn from_domain(project_id: &str, edge: &Edge) -> Self {
        Self {
            id: Thing::from(("edge", edge.id.as_str())),
            project_id: project_id.to_string(),
            edge: edge.clone(),
        }
    }

    fn into_domain(self) -> Edge {
        let mut edge = self.edge;
        edge.id = self.id.id.to_string();
        edge
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileRecord {
    id: Thing,
    project_id: String,
    #[serde(flatten)]
    file: File,
}

impl FileRecord {
    fn from_domain(project_id: &str, file: &File) -> Self {
        Self {
            id: Thing::from(("file", file.id.as_str())),
            project_id: project_id.to_string(),
            file: file.clone(),
        }
    }

    fn into_domain(self) -> File {
        let mut file = self.file;
        file.id = self.id.id.to_string();
        file
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecutionRecord {
    id: Thing,
    project_id: String,
    #[serde(flatten)]
    run: ExecutionRun,
}

impl ExecutionRecord {
    fn from_domain(project_id: &str, run: &ExecutionRun) -> Self {
        Self {
            id: Thing::from(("execution_run", run.run_id.as_str())),
            project_id: project_id.to_string(),
            run: run.clone(),
        }
    }

    fn into_domain(self) -> ExecutionRun {
        let mut run = self.run;
        run.run_id = self.id.id.to_string();
        run
    }
}
