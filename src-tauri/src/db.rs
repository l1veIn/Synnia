use rusqlite::{Connection, Result};
use std::path::Path;
use uuid::Uuid;
use chrono::Utc;
use crate::models::{AssetNode, AssetVersion, Edge, Project, AssetType, NodeStatus, AssetNodeWithData, AgentDefinition};

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
        db.init_default_agents()?; // Ensure defaults exist
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
                label TEXT,
                current_version_id TEXT,
                x REAL DEFAULT 0.0,
                y REAL DEFAULT 0.0,
                width REAL,
                height REAL,
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

        // 4. Settings Table (Key-Value Store)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // 5. Agents Table (New!)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                system_prompt TEXT NOT NULL,
                input_schema TEXT NOT NULL,
                output_config TEXT,
                is_system INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )",
            [],
        )?;

        Ok(())
    }

    // Initialize built-in agents
    fn init_default_agents(&self) -> Result<()> {
        let count: i64 = self.conn.query_row("SELECT count(*) FROM agents WHERE is_system = 1", [], |r| r.get(0))?;
        
        if count == 0 {
            // 1. Naming Expert
            self.create_agent(
                "naming-expert",
                "Brand Naming Expert",
                "Generates creative brand names based on product type and tone.",
                "You are a world-class brand naming expert. Given a product type and tone, generate 5 creative names with brief rationales. Output purely JSON array of strings if possible, or just the list.",
                r#"{
                    "type": "object",
                    "properties": {
                        "product_type": { "type": "string", "title": "Product Type" },
                        "tone": { "type": "string", "enum": ["Modern", "Classic", "Playful"], "title": "Tone" }
                    },
                    "required": ["product_type"]
                }"#, 
                true
            )?;
            
            // 2. Visual Prompt Artist
            self.create_agent(
                "visual-artist",
                "Visual Prompt Artist",
                "Expands brief ideas into detailed Stable Diffusion/Midjourney prompts.",
                "You are a visual artist. Convert the user's brief idea into a detailed, high-quality image generation prompt suitable for Stable Diffusion. Focus on lighting, composition, and style keywords.",
                r#"{
                    "type": "object",
                    "properties": {
                        "idea": { "type": "string", "title": "Core Idea" },
                        "style": { "type": "string", "title": "Art Style", "default": "Cyberpunk" }
                    },
                    "required": ["idea"]
                }"#, 
                true
            )?;
        }
        Ok(())
    }

    // =================================================================
    // Agent Operations
    // =================================================================

    pub fn create_agent(&self, id_override: &str, name: &str, desc: &str, prompt: &str, schema: &str, is_system: bool) -> Result<()> {
        let id = if id_override.is_empty() { Uuid::new_v4().to_string() } else { id_override.to_string() };
        let now = Utc::now().to_rfc3339();
        
        self.conn.execute(
            "INSERT OR REPLACE INTO agents (id, name, description, system_prompt, input_schema, is_system, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (
                &id, 
                name, 
                desc, 
                prompt, 
                schema,
                is_system as i32, 
                &now
            ),
        )?;
        Ok(())
    }

    pub fn get_all_agents(&self) -> Result<Vec<AgentDefinition>> {
        let mut stmt = self.conn.prepare("SELECT id, name, description, system_prompt, input_schema, output_config, is_system FROM agents")?;
        
        let iter = stmt.query_map([], |row| {
            Ok(AgentDefinition {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                system_prompt: row.get(3)?,
                input_schema: row.get(4)?,
                output_config: row.get(5)?,
                is_system: row.get(6)?,
            })
        })?;

        let mut agents = Vec::new();
        for agent in iter {
            agents.push(agent?);
        }
        Ok(agents)
    }

    // =================================================================
    // Settings Operations
    // =================================================================
    
    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            (key, value),
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query([key])?;

        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    // =================================================================
    // CRUD Operations (Basic Implementation)
    // =================================================================

    // Not used often now, but keep for compatibility
    pub fn create_asset(&self, project_id: &str, type_: AssetType, x: f64, y: f64) -> Result<AssetNode> {
        self.create_asset_with_payload(project_id, type_, x, y, "")
    }
    
    pub fn get_all_assets(&self) -> Result<Vec<AssetNode>> {
        let mut stmt = self.conn.prepare("SELECT id, project_id, type, status, current_version_id, x, y, created_at, updated_at, label, width, height FROM assets")?;
        
        let asset_iter = stmt.query_map([], |row| {
            let type_str: String = row.get(2)?;
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
                label: row.get(9).ok(),
                width: row.get(10).ok(),
                height: row.get(11).ok(),
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

    pub fn delete_edge(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM edges WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn restore_edge(&self, id: &str, source: &str, target: &str) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR REPLACE INTO edges (id, source_id, target_id, created_at) VALUES (?1, ?2, ?3, ?4)",
            (id, source, target, &now),
        )?;
        Ok(())
    }

    pub fn update_asset_position(&self, id: &str, x: f64, y: f64) -> Result<()> {
        self.conn.execute(
            "UPDATE assets SET x = ?1, y = ?2, updated_at = ?3 WHERE id = ?4",
            (x, y, Utc::now().to_rfc3339(), id),
        )?;
        Ok(())
    }

    pub fn update_asset_size(&self, id: &str, width: f64, height: f64) -> Result<()> {
        self.conn.execute(
            "UPDATE assets SET width = ?1, height = ?2, updated_at = ?3 WHERE id = ?4",
            (width, height, Utc::now().to_rfc3339(), id),
        )?;
        Ok(())
    }

    pub fn update_asset_label(&self, id: &str, label: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE assets SET label = ?1, updated_at = ?2 WHERE id = ?3",
            (label, Utc::now().to_rfc3339(), id),
        )?;
        Ok(())
    }

    pub fn update_asset_payload(&self, asset_id: &str, new_payload: &str) -> Result<()> {
        let version_id: Option<String> = self.conn.query_row(
            "SELECT current_version_id FROM assets WHERE id = ?1",
            [asset_id],
            |row| row.get(0)
        ).ok();

        if let Some(vid) = version_id {
            self.conn.execute(
                "UPDATE asset_versions SET payload = ?1 WHERE id = ?2",
                (new_payload, &vid),
            )?;
            
            self.conn.execute(
                "UPDATE assets SET updated_at = ?1 WHERE id = ?2",
                (Utc::now().to_rfc3339(), asset_id),
            )?;
        }
        Ok(())
    }

    pub fn create_asset_with_payload(&self, project_id: &str, type_: AssetType, x: f64, y: f64, payload: &str) -> Result<AssetNode> {
        let id = Uuid::new_v4().to_string();
        let version_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        
        let type_str = serde_json::to_string(&type_).unwrap().replace("\"", ""); 
        let status_str = "Active";
        
        let label = format!("{} {}", type_str, id.chars().take(4).collect::<String>());

        // 1. Create Asset
        self.conn.execute(
            "INSERT INTO assets (id, project_id, type, status, current_version_id, x, y, created_at, updated_at, label) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (
                &id, 
                project_id, 
                &type_str, 
                status_str, 
                &version_id,
                x, 
                y, 
                &now, 
                &now,
                &label
            ),
        )?;

        // 2. Create Version
        self.conn.execute(
            "INSERT INTO asset_versions (id, asset_id, payload, created_at) VALUES (?1, ?2, ?3, ?4)",
            (&version_id, &id, payload, &now),
        )?;

        Ok(AssetNode {
            id,
            project_id: project_id.to_string(),
            type_,
            status: NodeStatus::Active,
            current_version_id: Some(version_id),
            x,
            y,
            created_at: now.clone(),
            updated_at: now,
            label: Some(label),
            width: None,
            height: None
        })
    }

    pub fn restore_asset(
        &self, 
        id: &str, 
        project_id: &str, 
        type_: AssetType, 
        x: f64, 
        y: f64, 
        width: Option<f64>, 
        height: Option<f64>,
        payload: &str
    ) -> Result<()> {
        let version_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let type_str = serde_json::to_string(&type_).unwrap().replace("\"", ""); 
        let status_str = "Active";
        let label = format!("{} {}", type_str, id.chars().take(4).collect::<String>());

        self.conn.execute(
            "INSERT OR REPLACE INTO assets (id, project_id, type, status, current_version_id, x, y, width, height, created_at, updated_at, label) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            (
                id, 
                project_id, 
                &type_str, 
                status_str, 
                &version_id,
                x, 
                y, 
                width,
                height,
                &now, 
                &now,
                &label
            ),
        )?;

        self.conn.execute(
            "INSERT OR REPLACE INTO asset_versions (id, asset_id, payload, created_at) VALUES (?1, ?2, ?3, ?4)",
            (&version_id, id, payload, &now),
        )?;

        Ok(())
    }

    pub fn get_latest_version(&self, asset_id: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT payload FROM asset_versions WHERE asset_id = ?1 ORDER BY created_at DESC LIMIT 1")?;
        let mut rows = stmt.query([asset_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_nodes_with_data(&self) -> Result<Vec<AssetNodeWithData>> {
        let mut stmt = self.conn.prepare(
            "SELECT a.id, a.type, a.status, a.x, a.y, a.label, a.width, a.height, v.payload 
             FROM assets a 
             LEFT JOIN asset_versions v ON a.current_version_id = v.id"
        )?;
        
        let node_iter = stmt.query_map([], |row| {
            let type_str: String = row.get(1)?;
            let type_ = match type_str.as_str() {
                "Image" => AssetType::Image,
                "Text" => AssetType::Text,
                "Prompt" => AssetType::Prompt,
                "Link" => AssetType::Link,
                "Grid" => AssetType::Grid,
                _ => AssetType::Other,
            };
            
            let status_str: String = row.get(2)?;
            let status = match status_str.as_str() {
                "Outdated" => NodeStatus::Outdated,
                "Processing" => NodeStatus::Processing,
                "Error" => NodeStatus::Error,
                "Archived" => NodeStatus::Archived,
                _ => NodeStatus::Active,
            };

            Ok(AssetNodeWithData {
                id: row.get(0)?,
                type_,
                status,
                x: row.get(3)?,
                y: row.get(4)?,
                label: row.get(5).ok(),
                width: row.get(6).ok(),
                height: row.get(7).ok(),
                payload: row.get(8).ok(),
            })
        })?;

        let mut nodes = Vec::new();
        for node in node_iter {
            nodes.push(node?);
        }
        Ok(nodes)
    }

    pub fn clear_all_data(&self) -> Result<()> {
        // Disable foreign keys temporarily to avoid ordering issues during drop
        self.conn.execute("PRAGMA foreign_keys = OFF;", [])?;
        
        self.conn.execute("DROP TABLE IF EXISTS edges", [])?;
        self.conn.execute("DROP TABLE IF EXISTS asset_versions", [])?;
        self.conn.execute("DROP TABLE IF EXISTS assets", [])?;
        self.conn.execute("DROP TABLE IF EXISTS settings", [])?;
        self.conn.execute("DROP TABLE IF EXISTS agents", [])?;
        
        self.conn.execute("PRAGMA foreign_keys = ON;", [])?;
        
        // Re-init schema immediately
        self.init_schema()?;
        self.init_default_agents()?; // Restore system agents
        
        Ok(())
    }

    pub fn delete_asset(&self, id: &str) -> Result<()> {
        // Foreign keys will handle cascade delete of versions and edges
        self.conn.execute("DELETE FROM assets WHERE id = ?1", [id])?;
        Ok(())
    }
}
