use std::fs;
use std::path::Path;
use std::io::Write;
use crate::models::SynniaProject;
use crate::error::AppError;

pub fn save_project(project_root: &Path, project: &SynniaProject) -> Result<(), AppError> {
    // 1. Validate path
    if !project_root.exists() {
        return Err(AppError::Io(format!("Project path does not exist: {:?}", project_root)));
    }

    let file_path = project_root.join("synnia.json");
    
    // 2. Serialize to JSON (pretty print for git friendliness)
    let json_content = serde_json::to_string_pretty(project)?;

    // 3. Atomic Write strategy: Write to .tmp first, then rename
    let tmp_path = project_root.join("synnia.json.tmp");
    let mut file = fs::File::create(&tmp_path)?;
    file.write_all(json_content.as_bytes())?;
    file.sync_all()?; // Ensure flush to disk

    // 4. Rename (Atomic replace)
    fs::rename(&tmp_path, &file_path)?;

    Ok(())
}

pub fn load_project(project_root: &Path) -> Result<SynniaProject, AppError> {
    let file_path = project_root.join("synnia.json");

    if !file_path.exists() {
        return Err(AppError::NotFound("synnia.json not found in project directory".to_string()));
    }

    let content = fs::read_to_string(&file_path)?;
    let project: SynniaProject = serde_json::from_str(&content)?;

    Ok(project)
}

pub fn init_project(project_root: &Path, name: &str) -> Result<SynniaProject, AppError> {
    // Check if synnia.json already exists
    let file_path = project_root.join("synnia.json");
    if file_path.exists() {
        // If it exists, we treat initialization as "loading"
        // This prevents accidental overwrites
        return load_project(project_root);
    }

    let now = chrono::Utc::now().to_rfc3339();
    
    let project = SynniaProject {
        version: "2.0.0".to_string(),
        meta: crate::models::ProjectMeta {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            created_at: now.clone(),
            updated_at: now,
            thumbnail: None,
            description: None,
            author: None,
        },
        viewport: crate::models::Viewport { x: 0.0, y: 0.0, zoom: 1.0 },
        graph: crate::models::Graph { nodes: vec![], edges: vec![] },
        settings: None,
    };

    save_project(project_root, &project)?;
    Ok(project)
}
