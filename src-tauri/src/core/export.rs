//! Dataset export functionality for simulation results

use crate::core::types::{Result, AntennaError};
use crate::core::batch::{BatchResult, SimulationPoint};
use crate::core::solver::SimulationResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::Path;

/// Export format options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    Csv,
    Json,
    Touchstone,
    Matlab,
}

/// Export configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportConfig {
    pub format: ExportFormat,
    pub include_fields: bool,
    pub include_sparameters: bool,
    pub include_metadata: bool,
    pub precision: usize,
}

impl Default for ExportConfig {
    fn default() -> Self {
        Self {
            format: ExportFormat::Csv,
            include_fields: true,
            include_sparameters: true,
            include_metadata: true,
            precision: 6,
        }
    }
}

/// Dataset exporter
pub struct DatasetExporter;

impl DatasetExporter {
    /// Export batch results to file
    pub fn export_batch_results<P: AsRef<Path>>(
        results: &BatchResult,
        config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        match config.format {
            ExportFormat::Csv => Self::export_csv(results, config, output_path),
            ExportFormat::Json => Self::export_json(results, config, output_path),
            ExportFormat::Touchstone => Self::export_touchstone(results, config, output_path),
            ExportFormat::Matlab => Self::export_matlab(results, config, output_path),
        }
    }

    /// Export single simulation result
    pub fn export_simulation_result<P: AsRef<Path>>(
        result: &SimulationResult,
        config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        // Create a minimal batch result with single point
        let point = SimulationPoint {
            parameters: HashMap::new(),
            result: Some(result.clone()),
            error: None,
        };
        
        let batch_config = crate::core::batch::BatchConfig {
            base_element: crate::core::element::AntennaElement::new_dipole(0.15, 0.001),
            base_params: crate::core::solver::SimulationParams {
                frequency: 1e9,
                resolution: 0.01,
                reference_impedance: 50.0,
            },
            sweeps: vec![],
            parallel: false,
        };
        
        let batch_result = BatchResult {
            config: batch_config,
            points: vec![point],
            total_points: 1,
            successful_points: 1,
            failed_points: 0,
            execution_time_ms: 0,
        };
        
        Self::export_batch_results(&batch_result, config, output_path)
    }

    /// Export to CSV format
    fn export_csv<P: AsRef<Path>>(
        results: &BatchResult,
        _config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let mut file = File::create(output_path)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to create CSV file: {}", e)))?;
        
        // Write CSV header
        writeln!(file, "Frequency_MHz,S11_dB,Z_Real,Z_Imag")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write CSV header: {}", e)))?;
        
        // Write data for each successful simulation point
        for point in &results.points {
            if let Some(ref sim_result) = point.result {
                for s_param in &sim_result.s_parameters {
                    let freq_mhz = s_param.frequency / 1e6;
                    let s11_db = 20.0 * (s_param.s11_re * s_param.s11_re + s_param.s11_im * s_param.s11_im).sqrt().log10();
                    writeln!(file, "{:.6},{:.8},{:.8},{:.8}", 
                            freq_mhz, s11_db, s_param.input_impedance_re, s_param.input_impedance_im)
                        .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write CSV data: {}", e)))?;
                }
            }
        }
        
        Ok(())
    }

    /// Export to JSON format
    fn export_json<P: AsRef<Path>>(
        results: &BatchResult,
        _config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let json_str = serde_json::to_string_pretty(results)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to serialize to JSON: {}", e)))?;
        
        std::fs::write(output_path, json_str)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write JSON file: {}", e)))?;
        
        Ok(())
    }

    /// Export to Touchstone format
    fn export_touchstone<P: AsRef<Path>>(
        results: &BatchResult,
        _config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let mut file = File::create(output_path)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to create Touchstone file: {}", e)))?;
        
        // Write Touchstone header
        writeln!(file, "! PROMIN Antenna Studio")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write Touchstone header: {}", e)))?;
        writeln!(file, "# MHz S RI R 50")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write Touchstone format line: {}", e)))?;
        
        // Write S-parameter data
        for point in &results.points {
            if let Some(ref sim_result) = point.result {
                for s_param in &sim_result.s_parameters {
                    let freq_mhz = s_param.frequency / 1e6;
                    writeln!(file, "{:.6} {:.8} {:.8}", 
                            freq_mhz, s_param.s11_re, s_param.s11_im)
                        .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write Touchstone data: {}", e)))?;
                }
            }
        }
        
        Ok(())
    }

    /// Export to MATLAB format
    fn export_matlab<P: AsRef<Path>>(
        results: &BatchResult,
        _config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let mut file = File::create(output_path)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to create MATLAB file: {}", e)))?;
        
        // Write MATLAB header
        writeln!(file, "% PROMIN Antenna Studio Export")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write MATLAB header: {}", e)))?;
        writeln!(file, "% Generated by PROMIN Antenna Studio")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write MATLAB timestamp: {}", e)))?;
        
        // Collect all frequency points
        let mut frequencies = Vec::new();
        let mut s11_real = Vec::new();
        let mut s11_imag = Vec::new();
        
        for point in &results.points {
            if let Some(ref sim_result) = point.result {
                for s_param in &sim_result.s_parameters {
                    frequencies.push(s_param.frequency / 1e6); // Convert to MHz
                    s11_real.push(s_param.s11_re);
                    s11_imag.push(s_param.s11_im);
                }
            }
        }
        
        // Write frequency vector
        write!(file, "frequency = [")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write frequency array: {}", e)))?;
        for (i, freq) in frequencies.iter().enumerate() {
            if i > 0 {
                write!(file, ", ")
                    .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write frequency separator: {}", e)))?;
            }
            write!(file, "{:.6}", freq)
                .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write frequency value: {}", e)))?;
        }
        writeln!(file, "];")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to close frequency array: {}", e)))?;
        
        // Write S11 real vector
        write!(file, "s11_real = [")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write s11_real array: {}", e)))?;
        for (i, val) in s11_real.iter().enumerate() {
            if i > 0 {
                write!(file, ", ")
                    .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write s11_real separator: {}", e)))?;
            }
            write!(file, "{:.8}", val)
                .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write s11_real value: {}", e)))?;
        }
        writeln!(file, "];")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to close s11_real array: {}", e)))?;
        
        // Write S11 imaginary vector
        write!(file, "s11_imag = [")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write s11_imag array: {}", e)))?;
        for (i, val) in s11_imag.iter().enumerate() {
            if i > 0 {
                write!(file, ", ")
                    .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write s11_imag separator: {}", e)))?;
            }
            write!(file, "{:.8}", val)
                .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write s11_imag value: {}", e)))?;
        }
        writeln!(file, "];")
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to close s11_imag array: {}", e)))?;
        
        Ok(())
    }
}

/// Write Touchstone S1P file
pub fn write_touchstone_s1p(
    path: &str,
    frequencies: &[f64],
    s11_real: &[f64],
    s11_imag: &[f64],
) -> std::result::Result<(), String> {
    let mut file = File::create(path)
        .map_err(|e| format!("Failed to create S1P file: {}", e))?;
    
    // Write Touchstone header
    writeln!(file, "! PROMIN Antenna Studio")
        .map_err(|e| format!("Failed to write header: {}", e))?;
    writeln!(file, "# MHz S RI R 50")
        .map_err(|e| format!("Failed to write format line: {}", e))?;
    
    // Write S-parameter data
    for i in 0..frequencies.len() {
        let freq_mhz = frequencies[i] / 1e6;
        writeln!(file, "{:.6} {:.8} {:.8}", freq_mhz, s11_real[i], s11_imag[i])
            .map_err(|e| format!("Failed to write data line {}: {}", i, e))?;
    }
    
    Ok(())
}

/// Write CSV file with antenna simulation data
pub fn write_csv(
    path: &str,
    frequencies: &[f64],
    s11_db: &[f64],
    z_real: &[f64],
    z_imag: &[f64],
) -> std::result::Result<(), String> {
    let mut file = File::create(path)
        .map_err(|e| format!("Failed to create CSV file: {}", e))?;
    
    // Write CSV header
    writeln!(file, "Frequency_MHz,S11_dB,Z_Real,Z_Imag")
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;
    
    // Write data rows
    for i in 0..frequencies.len() {
        let freq_mhz = frequencies[i] / 1e6;
        writeln!(file, "{:.6},{:.8},{:.8},{:.8}", freq_mhz, s11_db[i], z_real[i], z_imag[i])
            .map_err(|e| format!("Failed to write CSV data line {}: {}", i, e))?;
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    
    #[test]
    fn test_write_s1p() {
        let frequencies = vec![300e6, 400e6, 500e6];
        let s11_real = vec![0.1, 0.2, 0.3];
        let s11_imag = vec![-0.5, -0.4, -0.3];
        
        let path = "/tmp/test_output.s1p";
        let result = write_touchstone_s1p(path, &frequencies, &s11_real, &s11_imag);
        
        assert!(result.is_ok(), "S1P write should succeed");
        assert!(Path::new(path).exists(), "S1P file should exist");
        
        // Clean up
        let _ = std::fs::remove_file(path);
    }
    
    #[test]
    fn test_write_csv() {
        let frequencies = vec![300e6, 400e6, 500e6];
        let s11_db = vec![-10.0, -15.0, -20.0];
        let z_real = vec![50.0, 55.0, 60.0];
        let z_imag = vec![10.0, 5.0, 0.0];
        
        let path = "/tmp/test_output.csv";
        let result = write_csv(path, &frequencies, &s11_db, &z_real, &z_imag);
        
        assert!(result.is_ok(), "CSV write should succeed");
        assert!(Path::new(path).exists(), "CSV file should exist");
        
        // Clean up
        let _ = std::fs::remove_file(path);
    }
}