//! Recipe types.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// File system entry (folder or recipe)
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum RecipeEntry {
    #[serde(rename = "folder")]
    Folder {
        name: String,
        path: String,
    },
    #[serde(rename = "recipe")]
    Recipe {
        id: String,
        path: String,
        name: String,
        description: Option<String>,
        author: Option<String>,
        icon: Option<String>,
        cover: Option<String>,
    },
}

/// Directory listing result
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<RecipeEntry>,
}

/// File tree node for Mini-IDE
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}
