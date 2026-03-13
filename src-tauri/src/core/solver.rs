use serde::{Deserialize, Serialize};
use crate::core::types::{FieldResult, Result, AntennaError};
use crate::core::element::AntennaElement;
use crate::core::geometry::{Mesh, Point3D, Segment};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency: f64,
    pub resolution: usize,
    pub reference_impedance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequencySweepParams {
    pub start_frequency: f64,
    pub stop_frequency: f64,
    pub num_points: usize,
    pub reference_impedance: f64,
    pub resolution: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SParameterResult {
    pub frequency: f64,
    pub s11_re: f64,
    pub s11_im: f64,
    pub vswr: f64,
    pub input_impedance_re: f64,
    pub input_impedance_im: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub s_params: Vec<SParameterResult>,
    pub field: FieldResult,
    pub num_unknowns: usize,
    pub solver_type: String,
    pub computation_time: f64,
    pub convergence_info: ConvergenceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergenceInfo {
    pub iterations: usize,
    pub residual: f64,
    pub converged: bool,
    pub condition_number: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationProgress {
    pub stage: String,
    pub progress: f64,
    pub message: String,
    pub eta_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSimulationParams {
    pub parameter_ranges: std::collections::HashMap<String, (f64, f64)>,
    pub num_samples: usize,
    pub frequency_sweep: FrequencySweepParams,
    pub sampling_method: SamplingMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SamplingMethod {
    Random,
    LatinHypercube,
    Grid,
    Sobol,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetEntry {
    pub parameters: std::collections::HashMap<String, f64>,
    pub results: SimulationResult,
    pub metadata: DatasetMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetMetadata {
    pub antenna_type: String,
    pub timestamp: String,
    pub solver_version: String,
    pub convergence_quality: f64,
}

/// Method of Moments solver
pub struct MomSolver {
    element: AntennaElement,
    params: SimulationParams,
    mesh: Mesh,
}

impl MomSolver {
    pub fn new(element: &AntennaElement, params: &SimulationParams) -> Result<Self> {
        let mesh = Self::generate_mesh(element, params.resolution)?;
        Ok(Self {
            element: element.clone(),
            params: params.clone(),
            mesh,
        })
    }

    fn generate_mesh(element: &AntennaElement, num_segments: usize) -> Result<Mesh> {
        let n = if num_segments == 0 { 21 } else { num_segments };
        match element {
            AntennaElement::Dipole(p) => {
                let half = p.length / 2.0;
                let step = p.length / n as f64;
                let mut vertices = Vec::with_capacity(n + 1);
                for i in 0..=n {
                    vertices.push(Point3D::new(0.0, 0.0, -half + step * i as f64));
                }
                let segments: Vec<Segment> = (0..n).map(|i| Segment { start: i, end: i + 1 }).collect();
                Ok(Mesh { vertices, triangles: vec![], segments })
            }
            AntennaElement::Monopole(p) => {
                let step = p.height / n as f64;
                let mut vertices = Vec::with_capacity(n + 1);
                for i in 0..=n {
                    vertices.push(Point3D::new(0.0, 0.0, step * i as f64));
                }
                let segments: Vec<Segment> = (0..n).map(|i| Segment { start: i, end: i + 1 }).collect();
                Ok(Mesh { vertices, triangles: vec![], segments })
            }
            _ => {
                // Stub mesh for patch/QFH
                let vertices = vec![Point3D::new(0.0, 0.0, 0.0), Point3D::new(0.0, 0.0, 0.01)];
                let segments = vec![Segment { start: 0, end: 1 }];
                Ok(Mesh { vertices, triangles: vec![], segments })
            }
        }
    }

    pub fn run_simulation(&mut self, params: &SimulationParams) -> Result<SimulationResult> {
        let n = self.mesh.segments.len();
        let field = FieldResult {
            points: vec![],
            e_field: vec![],
            h_field: vec![],
            power_density: vec![],
        };
        Ok(SimulationResult {
            s_params: vec![SParameterResult {
                frequency: params.frequency,
                s11_re: 0.0,
                s11_im: 0.0,
                vswr: 1.0,
                input_impedance_re: 50.0,
                input_impedance_im: 0.0,
            }],
            field,
            num_unknowns: n,
            solver_type: "MoM-stub".to_string(),
            computation_time: 0.0,
            convergence_info: ConvergenceInfo {
                iterations: 1,
                residual: 0.0,
                converged: true,
                condition_number: 1.0,
            },
        })
    }
}