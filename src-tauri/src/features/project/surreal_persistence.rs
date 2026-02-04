use std::collections::HashMap;

use serde_json::json;

use crate::core::AppError;
use crate::domain::{
    Asset, AssetSysMetadata, File, Graph, Node, NodeMeta, NodePresentation, NodeSysMetadata,
    Position, ProjectMeta, SynniaEdge, SynniaNode, SynniaNodeData, SynniaProject, ValueType,
    Viewport,
};
use crate::infrastructure::surreal::repositories::SurrealRepositories;
use crate::infrastructure::surreal::SurrealDb;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMetaRecord {
    project_id: String,
    name: String,
    created_at: String,
    updated_at: String,
    thumbnail: Option<String>,
    description: Option<String>,
    author: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectViewportRecord {
    project_id: String,
    viewport: Viewport,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSettingsRecord {
    project_id: String,
    settings: Option<HashMap<String, serde_json::Value>>,
}

pub async fn init_project_surreal(db: &SurrealDb, project_id: &str, name: &str) -> Result<ProjectMeta, AppError> {
    let now = chrono::Utc::now();
    let now_str = now.to_rfc3339();

    let meta = ProjectMeta {
        id: project_id.to_string(),
        name: name.to_string(),
        created_at: now_str.clone(),
        updated_at: now_str.clone(),
        thumbnail: None,
        description: None,
        author: None,
    };

    let meta_record = ProjectMetaRecord {
        project_id: project_id.to_string(),
        name: meta.name.clone(),
        created_at: meta.created_at.clone(),
        updated_at: meta.updated_at.clone(),
        thumbnail: None,
        description: None,
        author: None,
    };

    let _: Option<ProjectMetaRecord> = db
        .create(("project_meta", project_id))
        .content(meta_record)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let viewport_record = ProjectViewportRecord {
        project_id: project_id.to_string(),
        viewport: Viewport { x: 0.0, y: 0.0, zoom: 1.0 },
    };
    let _: Option<ProjectViewportRecord> = db
        .create(("project_viewport", project_id))
        .content(viewport_record)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(meta)
}

pub async fn load_project_surreal(db: &SurrealDb, project_id: &str) -> Result<SynniaProject, AppError> {
    let repos = SurrealRepositories::new(db.clone());

    let meta = load_project_meta(db, project_id).await?;
    let viewport = load_project_viewport(db, project_id).await?;
    let settings = load_project_settings(db, project_id).await?;

    let nodes = repos.node.list_by_project(project_id).await?;
    let edges = repos.edge.list_by_project(project_id).await?;
    let files = repos.file.list_by_project(project_id).await?;

    let (legacy_nodes, assets) = project_nodes_to_legacy(&nodes);
    let legacy_edges = edges.into_iter().map(edge_to_legacy).collect();
    let files_map = files_to_map(files);

    Ok(SynniaProject {
        version: "3.0.0".to_string(),
        meta,
        viewport,
        graph: Graph { nodes: legacy_nodes, edges: legacy_edges },
        assets,
        files: Some(files_map),
        settings,
    })
}

pub async fn save_project_surreal(
    db: &SurrealDb,
    project_id: &str,
    project: &SynniaProject,
) -> Result<(), AppError> {
    let repos = SurrealRepositories::new(db.clone());
    let nodes = legacy_to_project_nodes(&project.graph.nodes, &project.assets);
    let edges = project.graph.edges.iter().map(edge_from_legacy).collect::<Vec<_>>();
    let files = project
        .files
        .as_ref()
        .map(|map| map.values().cloned().collect::<Vec<_>>())
        .unwrap_or_default();

    repos.node.delete_by_project(project_id).await?;
    repos.edge.delete_by_project(project_id).await?;
    repos.file.delete_by_project(project_id).await?;

    for node in &nodes {
        repos.node.create(project_id, node).await?;
    }

    for edge in &edges {
        repos.edge.create(project_id, edge).await?;
    }
    for file in &files {
        repos.file.create(project_id, file).await?;
    }

    save_project_meta(db, project_id, &project.meta).await?;
    save_project_viewport(db, project_id, &project.viewport).await?;
    save_project_settings(db, project_id, &project.settings).await?;

    Ok(())
}

async fn load_project_meta(db: &SurrealDb, project_id: &str) -> Result<ProjectMeta, AppError> {
    let mut response = db
        .query("SELECT * FROM project_meta WHERE projectId = $projectId")
        .bind(("projectId", project_id.to_string()))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let record: Option<ProjectMetaRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
    let record = record.ok_or_else(|| AppError::NotFound("Project meta not found".to_string()))?;

    Ok(ProjectMeta {
        id: project_id.to_string(),
        name: record.name,
        created_at: record.created_at,
        updated_at: record.updated_at,
        thumbnail: record.thumbnail,
        description: record.description,
        author: record.author,
    })
}

async fn save_project_meta(db: &SurrealDb, project_id: &str, meta: &ProjectMeta) -> Result<(), AppError> {
    let record = ProjectMetaRecord {
        project_id: project_id.to_string(),
        name: meta.name.clone(),
        created_at: meta.created_at.clone(),
        updated_at: meta.updated_at.clone(),
        thumbnail: meta.thumbnail.clone(),
        description: meta.description.clone(),
        author: meta.author.clone(),
    };

    let _: Option<ProjectMetaRecord> = db
        .update(("project_meta", project_id))
        .content(record)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

async fn load_project_viewport(db: &SurrealDb, project_id: &str) -> Result<Viewport, AppError> {
    let mut response = db
        .query("SELECT * FROM project_viewport WHERE projectId = $projectId")
        .bind(("projectId", project_id.to_string()))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let record: Option<ProjectViewportRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
    Ok(record.map(|r| r.viewport).unwrap_or(Viewport { x: 0.0, y: 0.0, zoom: 1.0 }))
}

async fn save_project_viewport(db: &SurrealDb, project_id: &str, viewport: &Viewport) -> Result<(), AppError> {
    let record = ProjectViewportRecord {
        project_id: project_id.to_string(),
        viewport: viewport.clone(),
    };

    let _: Option<ProjectViewportRecord> = db
        .update(("project_viewport", project_id))
        .content(record)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

async fn load_project_settings(db: &SurrealDb, project_id: &str) -> Result<Option<HashMap<String, serde_json::Value>>, AppError> {
    let mut response = db
        .query("SELECT * FROM project_settings WHERE projectId = $projectId")
        .bind(("projectId", project_id.to_string()))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let record: Option<ProjectSettingsRecord> = response.take(0).map_err(|e| AppError::Database(e.to_string()))?;
    Ok(record.and_then(|r| r.settings))
}

async fn save_project_settings(
    db: &SurrealDb,
    project_id: &str,
    settings: &Option<HashMap<String, serde_json::Value>>,
) -> Result<(), AppError> {
    let record = ProjectSettingsRecord {
        project_id: project_id.to_string(),
        settings: settings.clone(),
    };

    let _: Option<ProjectSettingsRecord> = db
        .update(("project_settings", project_id))
        .content(record)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

fn legacy_to_project_nodes(nodes: &[SynniaNode], assets: &HashMap<String, Asset>) -> Vec<Node> {
    nodes.iter().map(|node| node_from_legacy(node, assets)).collect()
}

fn project_nodes_to_legacy(nodes: &[Node]) -> (Vec<SynniaNode>, HashMap<String, Asset>) {
    let mut legacy_nodes = Vec::with_capacity(nodes.len());
    let mut assets = HashMap::new();

    for node in nodes {
        let (legacy, asset) = node_to_legacy(node);
        legacy_nodes.push(legacy);
        assets.insert(asset.id.clone(), asset);
    }

    (legacy_nodes, assets)
}

fn files_to_map(files: Vec<File>) -> HashMap<String, File> {
    files.into_iter().map(|file| (file.id.clone(), file)).collect()
}

fn node_from_legacy(node: &SynniaNode, assets: &HashMap<String, Asset>) -> Node {
    let asset_id = node.data.asset_id.clone().unwrap_or_else(|| node.id.clone());
    let now = chrono::Utc::now().timestamp_millis();
    let asset = assets.get(&asset_id);

    let sys = if let Some(asset) = asset {
        NodeSysMetadata {
            name: asset.sys.name.clone(),
            created_at: asset.sys.created_at,
            updated_at: asset.sys.updated_at,
            source: asset.sys.source.clone(),
            is_library_asset: asset.sys.is_library_asset,
        }
    } else {
        NodeSysMetadata {
            name: node.data.title.clone(),
            created_at: now,
            updated_at: now,
            source: "user".to_string(),
            is_library_asset: None,
        }
    };

    let value_type = asset.map(|a| a.value_type.as_str().to_string());
    let data = asset.map(|a| a.value.clone()).unwrap_or_else(|| json!({}));
    let schema = asset
        .and_then(|a| a.config.as_ref())
        .and_then(|cfg| cfg.get("schema"))
        .cloned();

    let meta = NodeMeta {
        sys,
        value_meta: asset.and_then(|a| a.value_meta.clone()),
        ui: None,
        ext: Some(json!({ "assetId": asset_id })),
    };

    let style_value = node.style.as_ref().map(|v| {
        let mut map = serde_json::Map::new();
        for (key, value) in v.iter() {
            map.insert(key.clone(), value.clone());
        }
        serde_json::Value::Object(map)
    });

    let presentation = NodePresentation {
        position: crate::domain::node::NodePosition { x: node.position.x, y: node.position.y },
        size: Some(crate::domain::node::NodeSize {
            width: node.width,
            height: node.height,
        }),
        style: style_value,
        layout: Some(crate::domain::node::NodeLayout {
            mode: node.data.layout_mode.clone(),
            docked_to: node.data.docked_to.clone(),
            parent_id: node.parent_id.clone(),
        }),
        expanded: Some(crate::domain::node::NodeExpanded {
            collapsed: node.data.collapsed.unwrap_or(false),
            expanded_width: None,
            expanded_height: None,
            original_position: None,
        }),
        visibility: None,
        ui: node.data.has_product_handle.map(|value| json!({ "hasProductHandle": value })),
    };

    Node {
        id: node.id.clone(),
        type_: node.type_.clone(),
        value_type,
        data,
        schema,
        meta,
        presentation,
        recipe_id: node.data.recipe_id.clone(),
        file_ids: None,
        execution_state: node.data.state.clone(),
        error_message: None,
        state_updated_at: None,
        is_reference: node.data.is_reference,
        original_node_id: None,
    }
}

fn node_to_legacy(node: &Node) -> (SynniaNode, Asset) {
    let asset_id = node
        .meta
        .ext
        .as_ref()
        .and_then(|v| v.get("assetId"))
        .and_then(|v| v.as_str())
        .unwrap_or(node.id.as_str())
        .to_string();

    let value_type = match node.value_type.as_deref() {
        Some("array") => ValueType::Array,
        _ => ValueType::Record,
    };

    let asset = Asset {
        id: asset_id.clone(),
        value_type,
        value: node.data.clone(),
        value_meta: node.meta.value_meta.clone(),
        config: node.schema.clone().map(|schema| json!({ "schema": schema })),
        sys: AssetSysMetadata {
            name: node.meta.sys.name.clone(),
            created_at: node.meta.sys.created_at,
            updated_at: node.meta.sys.updated_at,
            source: node.meta.sys.source.clone(),
            is_library_asset: node.meta.sys.is_library_asset,
        },
    };

    let data = SynniaNodeData {
        title: node.meta.sys.name.clone(),
        asset_id: Some(asset_id),
        is_reference: node.is_reference,
        collapsed: node.presentation.expanded.as_ref().map(|e| e.collapsed),
        layout_mode: node.presentation.layout.as_ref().and_then(|l| l.mode.clone()),
        docked_to: node.presentation.layout.as_ref().and_then(|l| l.docked_to.clone()),
        state: node.execution_state.clone(),
        recipe_id: node.recipe_id.clone(),
        has_product_handle: node
            .presentation
            .ui
            .as_ref()
            .and_then(|ui| ui.get("hasProductHandle"))
            .and_then(|v| v.as_bool()),
    };

    let style_map = node.presentation.style.as_ref().and_then(|value| {
        value.as_object().map(|obj| {
            obj.iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect::<HashMap<String, serde_json::Value>>()
        })
    });

    let legacy = SynniaNode {
        id: node.id.clone(),
        type_: node.type_.clone(),
        position: Position { x: node.presentation.position.x, y: node.presentation.position.y },
        width: node.presentation.size.as_ref().and_then(|s| s.width),
        height: node.presentation.size.as_ref().and_then(|s| s.height),
        parent_id: node.presentation.layout.as_ref().and_then(|l| l.parent_id.clone()),
        extent: None,
        style: style_map,
        data,
    };

    (legacy, asset)
}

fn edge_from_legacy(edge: &SynniaEdge) -> crate::domain::Edge {
    let edge_type = match edge.type_.as_deref() {
        Some("output") => "product",
        _ => "value",
    };

    crate::domain::Edge {
        id: edge.id.clone(),
        type_: edge_type.to_string(),
        source_node_id: edge.source.clone(),
        target_node_id: edge.target.clone(),
        source_handle: edge.source_handle.clone(),
        target_handle: edge.target_handle.clone(),
        mapping_spec: None,
        ui_type: edge.type_.clone(),
    }
}

fn edge_to_legacy(edge: crate::domain::Edge) -> SynniaEdge {
    let edge_type = if edge.type_ == "product" { Some("output".to_string()) } else { None };

    SynniaEdge {
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        source_handle: edge.source_handle,
        target_handle: edge.target_handle,
        type_: edge_type,
        label: None,
        animated: None,
    }
}
