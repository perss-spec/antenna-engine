pub mod mom;
pub mod solver;
pub mod far_field;
pub mod visualization;

pub use mom::{compute_impedance_matrix, compute_excitation_vector, solve_currents};
pub use solver::{solve_antenna, SolverResult};
pub use far_field::{compute_far_field, compute_directivity};
pub use visualization::{generate_visualization_data, VisualizationData};