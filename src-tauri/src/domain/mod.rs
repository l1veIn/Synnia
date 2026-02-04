//! Domain models module.
//!
//! Contains core data structures used throughout the application.
//! These types are serializable and have TypeScript bindings via ts-rs.

pub mod project;
pub mod asset;
pub mod graph;
pub mod recipe;
pub mod node;
pub mod edge;
pub mod file;
pub mod execution;

// Re-export commonly used types
pub use project::{SynniaProject, ProjectMeta};
pub use asset::{Asset, ValueType, AssetSysMetadata, AssetMeta, RecordAssetConfig, ArrayAssetConfig};
pub use graph::{Graph, SynniaNode, SynniaEdge, Viewport, Position, SynniaNodeData};
pub use recipe::AgentDefinition;
pub use node::{Node, NodeMeta, NodePresentation, NodeSysMetadata};
pub use edge::Edge;
pub use file::File;
pub use execution::ExecutionRun;
