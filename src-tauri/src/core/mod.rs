pub mod geometry;
pub mod materials;
pub mod simulation;
pub mod analysis;
pub mod import;

// Re-export commonly used types
pub use geometry::{Vertex, Triangle, Mesh};
pub use materials::{Material, MaterialProperties};
pub use simulation::{SimulationParameters, SimulationResult};
pub use analysis::{AnalysisType, AnalysisResult};
pub use import::{ImportFormat, ImportedModel, ImportMetadata, import_file, detect_format};