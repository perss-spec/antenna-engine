use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Duration;

/// FDTD-specific simulation parameters (separate from MoM params)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FdtdParams {
    pub antenna_type: String,
    pub frequency: f64,
    pub dimensions: Value,
    pub substrate: Option<Value>,
    pub mesh_size: Option<f64>,
}

/// FDTD-specific simulation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FdtdResult {
    pub antenna_type: String,
    pub frequency: f64,
    pub z_in: f64,
    pub s11: Vec<f64>,
    pub gain: f64,
    pub efficiency: f64,
    pub pattern: Value,
    pub convergence: Value,
    pub frequency_points: Option<Vec<f64>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdInput {
    geometry: FdtdGeometry,
    simulation: FdtdSimConfig,
    frequency: FdtdFrequency,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdGeometry {
    antenna_type: String,
    dimensions: Value,
    substrate: Option<FdtdSubstrate>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdSubstrate {
    epsilon_r: f64,
    thickness: f64,
    loss_tangent: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdSimConfig {
    grid_resolution: f64,
    boundary_conditions: String,
    time_steps: Option<u32>,
    convergence_threshold: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdFrequency {
    center: f64,
    bandwidth: f64,
    points: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdOutput {
    z_in: Vec<FdtdComplex>,
    s11: Vec<FdtdComplex>,
    pattern: FdtdPattern,
    convergence_info: FdtdConvergence,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdComplex {
    real: f64,
    imag: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdPattern {
    theta: Vec<f64>,
    phi: Vec<f64>,
    e_theta: Vec<FdtdComplex>,
    e_phi: Vec<FdtdComplex>,
    gain: Vec<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FdtdConvergence {
    converged: bool,
    iterations: u32,
    final_error: f64,
    computation_time: f64,
}

pub struct FdtdBridge {
    python_executable: String,
    script_path: String,
    timeout_duration: Duration,
}

impl FdtdBridge {
    pub fn new() -> Self {
        Self {
            python_executable: "python".to_string(),
            script_path: "python/antenna_ml/fdtd/cli.py".to_string(),
            timeout_duration: Duration::from_secs(300),
        }
    }

    pub fn with_python_path(mut self, python_path: String) -> Self {
        self.python_executable = python_path;
        self
    }

    pub fn with_timeout(mut self, timeout_secs: u64) -> Self {
        self.timeout_duration = Duration::from_secs(timeout_secs);
        self
    }

    fn convert_params_to_fdtd_input(
        &self,
        params: &FdtdParams,
    ) -> Result<FdtdInput, String> {
        let geometry = FdtdGeometry {
            antenna_type: params.antenna_type.clone(),
            dimensions: params.dimensions.clone(),
            substrate: params.substrate.as_ref().map(|s| FdtdSubstrate {
                epsilon_r: s
                    .get("epsilon_r")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(1.0),
                thickness: s
                    .get("thickness")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(1.0),
                loss_tangent: s.get("loss_tangent").and_then(|v| v.as_f64()),
            }),
        };

        let simulation = FdtdSimConfig {
            grid_resolution: params.mesh_size.unwrap_or(0.1),
            boundary_conditions: "PML".to_string(),
            time_steps: Some(1000),
            convergence_threshold: Some(1e-6),
        };

        let frequency = FdtdFrequency {
            center: params.frequency,
            bandwidth: params.frequency * 0.2,
            points: 101,
        };

        Ok(FdtdInput {
            geometry,
            simulation,
            frequency,
        })
    }

    fn convert_fdtd_output_to_result(
        &self,
        output: FdtdOutput,
        params: &FdtdParams,
    ) -> Result<FdtdResult, String> {
        let z_in_mag = output
            .z_in
            .first()
            .map(|z| (z.real * z.real + z.imag * z.imag).sqrt())
            .unwrap_or(50.0);

        let s11_db = output
            .s11
            .iter()
            .map(|s| 20.0 * (s.real * s.real + s.imag * s.imag).sqrt().log10())
            .collect();

        let max_gain = output
            .pattern
            .gain
            .iter()
            .fold(f64::NEG_INFINITY, |a, &b| a.max(b));

        let freq_start = params.frequency * 0.9;
        let freq_end = params.frequency * 1.1;
        let n = output.s11.len();
        let freq_points: Vec<f64> = if n > 1 {
            (0..n)
                .map(|i| freq_start + (freq_end - freq_start) * i as f64 / (n - 1) as f64)
                .collect()
        } else {
            vec![params.frequency]
        };

        Ok(FdtdResult {
            antenna_type: params.antenna_type.clone(),
            frequency: params.frequency,
            z_in: z_in_mag,
            s11: s11_db,
            gain: max_gain,
            efficiency: output.pattern.gain.iter().sum::<f64>()
                / output.pattern.gain.len().max(1) as f64,
            pattern: json!({
                "theta": output.pattern.theta,
                "phi": output.pattern.phi,
                "gain": output.pattern.gain
            }),
            convergence: json!({
                "converged": output.convergence_info.converged,
                "iterations": output.convergence_info.iterations,
                "error": output.convergence_info.final_error,
                "time": output.convergence_info.computation_time
            }),
            frequency_points: Some(freq_points),
        })
    }

    /// Run FDTD simulation synchronously via subprocess
    pub fn run_simulation_sync(
        &self,
        params: &FdtdParams,
    ) -> Result<FdtdResult, String> {
        let fdtd_input = self.convert_params_to_fdtd_input(params)?;
        let input_json = serde_json::to_string(&fdtd_input)
            .map_err(|e| format!("Failed to serialize input: {}", e))?;

        let mut child = Command::new(&self.python_executable)
            .arg(&self.script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Python process: {}", e))?;

        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(input_json.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin
                .flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
        }
        // Drop stdin to signal EOF
        drop(child.stdin.take());

        let output = child
            .wait_with_output()
            .map_err(|e| format!("Failed to wait for process: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FDTD simulation failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let fdtd_output: FdtdOutput = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse FDTD output: {}", e))?;

        self.convert_fdtd_output_to_result(fdtd_output, params)
    }
}

#[cfg(feature = "tauri-app")]
#[tauri::command]
pub async fn run_fdtd_simulation(params: Value) -> Result<Value, String> {
    let fdtd_params: FdtdParams = serde_json::from_value(params)
        .map_err(|e| format!("Invalid simulation parameters: {}", e))?;

    let bridge = FdtdBridge::new();
    let result = bridge.run_simulation_sync(&fdtd_params)?;

    serde_json::to_value(result).map_err(|e| format!("Failed to serialize result: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fdtd_bridge_conversion() {
        let params = FdtdParams {
            antenna_type: "dipole".to_string(),
            frequency: 2.4e9,
            dimensions: json!({"length": 0.06, "radius": 0.001}),
            substrate: None,
            mesh_size: Some(0.001),
        };

        let bridge = FdtdBridge::new();
        let fdtd_input = bridge.convert_params_to_fdtd_input(&params).unwrap();

        assert_eq!(fdtd_input.geometry.antenna_type, "dipole");
        assert_eq!(fdtd_input.frequency.center, 2.4e9);
        assert_eq!(fdtd_input.simulation.grid_resolution, 0.001);
    }
}
