use rusqlite::{Connection, Result};
use std::path::Path;
use uuid::Uuid;
use chrono::Utc;
use crate::models::{AssetNode, AssetVersion, Edge, Project, AssetType, NodeStatus};

pub struct SynniaDB {
    conn: Connection,
}

impl SynniaDB {
    /// Initialize connection to a SQLite DB at the given path
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON;", [])?;
        
        let db = SynniaDB { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// Create tables if they don't exist
    fn init_schema(&self) -> Result<()> {
        // 1. Assets Table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                current_version_id TEXT,
                x REAL DEFAULT 0.0,
                y REAL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 2. Versions Table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS asset_versions (
                id TEXT PRIMARY KEY,
                asset_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                meta TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 3. Edges Table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS edges (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                recipe TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(source_id) REFERENCES assets(id) ON DELETE CASCADE,
                FOREIGN KEY(target_id) REFERENCES assets(id) ON DELETE CASCADE
            )",
            [],
        )?;

        Ok(())
    }

    // =================================================================
    // CRUD Operations (Basic Implementation)
    // =================================================================

    pub fn create_asset(&self, project_id: &str, type_: AssetType, x: f64, y: f64) -> Result<AssetNode> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        let type_str = serde_json::to_string(&type_).unwrap().replace("\"", ""); // Simple stringify
        let status_str = "Active";

        self.conn.execute(
            "INSERT INTO assets (id, project_id, type, status, x, y, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (
                &id, 
                project_id, 
                &type_str, 
                status_str, 
                x, 
                y, 
                &now, 
                &now
            ),
        )?;

        Ok(AssetNode {
            id,
            project_id: project_id.to_string(),
            type_,
            status: NodeStatus::Active,
            current_version_id: None,
            x,
            y,
            created_at: now.clone(),
            updated_at: now,
        })
    }
    
    pub fn get_all_assets(&self) -> Result<Vec<AssetNode>> {
        let mut stmt = self.conn.prepare("SELECT id, project_id, type, status, current_version_id, x, y, created_at, updated_at FROM assets")?;
        
        let asset_iter = stmt.query_map([], |row| {
            let type_str: String = row.get(2)?;
            // Extremely basic deserialization mapping for demo. 
            // In production, use serde_rusqlite or match string manually.
            let type_ = match type_str.as_str() {
                "Image" => AssetType::Image,
                "Text" => AssetType::Text,
                "Prompt" => AssetType::Prompt,
                "Link" => AssetType::Link,
                "Grid" => AssetType::Grid,
                _ => AssetType::Other,
            };
            
            let status_str: String = row.get(3)?;
            let status = match status_str.as_str() {
                "Outdated" => NodeStatus::Outdated,
                "Processing" => NodeStatus::Processing,
                "Error" => NodeStatus::Error,
                "Archived" => NodeStatus::Archived,
                _ => NodeStatus::Active,
            };

            Ok(AssetNode {
                id: row.get(0)?,
                project_id: row.get(1)?,
                type_,
                status,
                current_version_id: row.get(4)?,
                x: row.get(5)?,
                y: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
        Ok(assets)
    }

    pub fn create_edge(&self, source: &str, target: &str) -> Result<Edge> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        self.conn.execute(
            "INSERT INTO edges (id, source_id, target_id, recipe, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &id, 
                source, 
                target, 
                None::<String>, // Nullable recipe for manual link
                &now
            ),
        )?;

        Ok(Edge {
            id,
            source_id: source.to_string(),
            target_id: target.to_string(),
            recipe: None,
            created_at: now,
        })
    }

    pub fn get_all_edges(&self) -> Result<Vec<Edge>> {
        let mut stmt = self.conn.prepare("SELECT id, source_id, target_id, recipe, created_at FROM edges")?;
        
        let edge_iter = stmt.query_map([], |row| {
            Ok(Edge {
                id: row.get(0)?,
                source_id: row.get(1)?,
                target_id: row.get(2)?,
                recipe: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut edges = Vec::new();
        for edge in edge_iter {
            edges.push(edge?);
        }
        Ok(edges)
    }

    pub fn update_asset_position(&self, id: &str, x: f64, y: f64) -> Result<()> {
        self.conn.execute(
            "UPDATE assets SET x = ?1, y = ?2, updated_at = ?3 WHERE id = ?4",
            (x, y, Utc::now().to_rfc3339(), id),
        )?;
        Ok(())
    }

    pub fn clear_all_data(&self) -> Result<()> {
        self.conn.execute("DELETE FROM edges", [])?;
        self.conn.execute("DELETE FROM asset_versions", [])?;
        self.conn.execute("DELETE FROM assets", [])?;
        Ok(())
    }
}
