use ndarray::{Array2, Axis};
use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizationData {
    pub pattern_2d: Vec<Vec<f64>>,
    pub pattern_3d: Vec<Vec<Vec<f64>>>,
    pub azimuth_cut: Vec<f64>,
    pub elevation_cut: Vec<f64>,
    pub theta_angles: Vec<f64>,
    pub phi_angles: Vec<f64>,
}

pub fn generate_visualization_data(
    far_field: &Array2<Complex64>,
    theta_range: (f64, f64),
    phi_range: (f64, f64),
    theta_points: usize,
    phi_points: usize,
) -> VisualizationData {
    let theta_angles: Vec<f64> = (0..theta_points)
        .map(|i| theta_range.0 + (theta_range.1 - theta_range.0) * i as f64 / (theta_points - 1) as f64)
        .collect();
    
    let phi_angles: Vec<f64> = (0..phi_points)
        .map(|i| phi_range.0 + (phi_range.1 - phi_range.0) * i as f64 / (phi_points - 1) as f64)
        .collect();

    // Convert to magnitude in dB
    let pattern_db = far_field.mapv(|c| 20.0 * c.norm().log10());
    
    // Extract 2D pattern (assuming it's already in the correct shape)
    let pattern_2d: Vec<Vec<f64>> = pattern_db
        .axis_iter(Axis(0))
        .map(|row| row.to_vec())
        .collect();
    
    // Generate 3D pattern data
    let mut pattern_3d = vec![vec![vec![0.0; phi_points]; theta_points]; 3];
    
    for (i, &theta) in theta_angles.iter().enumerate() {
        for (j, &phi) in phi_angles.iter().enumerate() {
            let r = pattern_db[[i, j]].max(-40.0) + 40.0; // Normalize to 0-40 range
            let theta_rad = theta * PI / 180.0;
            let phi_rad = phi * PI / 180.0;
            
            pattern_3d[0][i][j] = r * theta_rad.sin() * phi_rad.cos(); // X
            pattern_3d[1][i][j] = r * theta_rad.sin() * phi_rad.sin(); // Y
            pattern_3d[2][i][j] = r * theta_rad.cos(); // Z
        }
    }
    
    // Extract cuts at phi=0 (azimuth) and theta=90 (elevation)
    let azimuth_cut = pattern_db.column(0).to_vec();
    let elevation_cut = pattern_db.row(theta_points / 2).to_vec();
    
    VisualizationData {
        pattern_2d,
        pattern_3d,
        azimuth_cut,
        elevation_cut,
        theta_angles,
        phi_angles,
    }
}