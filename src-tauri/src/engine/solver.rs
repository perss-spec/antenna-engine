use ndarray::{Array1, Array2};
use num_complex::Complex64;
use crate::engine::mom::{
    compute_impedance_matrix, compute_excitation_vector, solve_currents,
};
use crate::models::{AntennaElement, SimulationParams};

#[derive(Debug, Clone)]
pub struct SolverResult {
    pub frequency: f64,
    pub impedance_matrix: Array2<Complex64>,
    pub excitation_vector: Array1<Complex64>,
    pub current_distribution: Array1<Complex64>,
    pub input_impedance: Complex64,
    pub vswr: f64,
    pub reflection_coefficient: Complex64,
}

pub fn solve_antenna(
    elements: &[AntennaElement],
    params: &SimulationParams,
    frequency: f64,
) -> Result<SolverResult, String> {
    // Validate inputs
    if elements.is_empty() {
        return Err("No antenna elements provided".to_string());
    }
    
    if frequency <= 0.0 {
        return Err("Frequency must be positive".to_string());
    }
    
    // Compute matrices
    let impedance_matrix = compute_impedance_matrix(elements, frequency, params.segments_per_wavelength);
    let excitation_vector = compute_excitation_vector(elements, frequency, params.segments_per_wavelength);
    
    // Solve for currents
    let current_distribution = solve_currents(&impedance_matrix, &excitation_vector)
        .map_err(|e| format!("Failed to solve linear system: {}", e))?;
    
    // Calculate derived quantities
    let input_impedance = calculate_input_impedance(&impedance_matrix, &current_distribution, &excitation_vector);
    let reflection_coefficient = calculate_reflection_coefficient(input_impedance, params.reference_impedance);
    let vswr = calculate_vswr(reflection_coefficient);
    
    Ok(SolverResult {
        frequency,
        impedance_matrix,
        excitation_vector,
        current_distribution,
        input_impedance,
        vswr,
        reflection_coefficient,
    })
}

fn calculate_input_impedance(
    z_matrix: &Array2<Complex64>,
    currents: &Array1<Complex64>,
    excitation: &Array1<Complex64>,
) -> Complex64 {
    // Z_in = V_in / I_in
    // For a single feed point at segment 0
    if currents.len() > 0 && excitation[0].norm() > 1e-10 {
        excitation[0] / currents[0]
    } else {
        Complex64::new(50.0, 0.0) // Default to 50 ohms
    }
}

fn calculate_reflection_coefficient(z_in: Complex64, z_ref: f64) -> Complex64 {
    (z_in - z_ref) / (z_in + z_ref)
}

fn calculate_vswr(gamma: Complex64) -> f64 {
    let mag = gamma.norm();
    (1.0 + mag) / (1.0 - mag).max(1e-10)
}