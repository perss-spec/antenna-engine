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
        config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let mut file = File::create(output_path)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to create file: {}", e)))?;
        
        // Write header
        let mut header = Vec::new();
        
        // Parameter columns
        if let Some(first_point) = results.points.first() {
            for param_name in first_point.parameters.keys() {
                header.push(param_name.clone());
            }
        }
        
        // S-parameter columns
        if config.include_sparameters {
            header.extend_from_slice(&[
                "frequency".to_string(),
                "s11_re".to_string(),
                "s11_im".to_string(),
                "vswr".to_string(),
                "input_impedance_re".to_string(),
                "input_impedance_im".to_string(),
            ]);
        }
        
        // Field result columns
        if config.include_fields {
            header.extend_from_slice(&[
                "beamwidth_deg".to_string(),
                "directivity_dbi".to_string(),
                "efficiency".to_string(),
                "max_gain_dbi".to_string(),
                "front_to_back_ratio_db".to_string(),
                "cross_pol_discrimination_db".to_string(),
                "impedance_bandwidth_mhz".to_string(),
            ]);
        }
        
        writeln!(file, "{}"  , header.join(","))
            .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        
        // Write data rows
        for point in &results.points {
            let mut row = Vec::new();
            
            // Parameter values
            if let Some(first_point) = results.points.first() {
                for param_name in first_point.parameters.keys() {
                    let value = point.parameters.get(param_name).unwrap_or(&0.0);
                    row.push(Self::format_number(*value, config.precision));
                }
            }
            
            if let Some(ref result) = point.result {
                // S-parameter values
                if config.include_sparameters {
                    if let Some(sp) = result.s_parameters.first() {
                        row.push(Self::format_number(sp.frequency, config.precision));
                        row.push(Self::format_number(sp.s11_re, config.precision));
                        row.push(Self::format_number(sp.s11_im, config.precision));
                        row.push(Self::format_number(sp.vswr, config.precision));
                        row.push(Self::format_number(sp.input_impedance_re, config.precision));
                        row.push(Self::format_number(sp.input_impedance_im, config.precision));
                    }
                }

                // Field result values
                if config.include_fields {
                    row.push(Self::format_number(result.field_results.beamwidth_deg, config.precision));
                    row.push(Self::format_number(result.field_results.directivity_dbi, config.precision));
                    row.push(Self::format_number(result.field_results.efficiency, config.precision));
                    row.push(Self::format_number(result.field_results.max_gain_dbi, config.precision));
                    row.push(Self::format_number(result.field_results.front_to_back_ratio_db, config.precision));
                    row.push(Self::format_number(result.field_results.cross_pol_discrimination_db, config.precision));
                    row.push(Self::format_number(result.field_results.impedance_bandwidth_mhz, config.precision));
                }
            } else {
                // Fill with empty values for failed simulations
                let num_cols = if config.include_sparameters { 6 } else { 0 } + 
                              if config.include_fields { 7 } else { 0 };
                for _ in 0..num_cols {
                    row.push("NaN".to_string());
                }
            }
            
            writeln!(file, "{}", row.join(","))
                .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        }
        
        Ok(())
    }

    /// Export to JSON format
    fn export_json<P: AsRef<Path>>(
        results: &BatchResult,
        config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let mut export_data = serde_json::Map::new();
        
        if config.include_metadata {
            export_data.insert("metadata".to_string(), serde_json::to_value(&results.config)
                .map_err(|e| AntennaError::SimulationFailed(format!("JSON serialization error: {}", e)))?);
            export_data.insert("total_points".to_string(), serde_json::Value::Number(results.total_points.into()));
            export_data.insert("successful_points".to_string(), serde_json::Value::Number(results.successful_points.into()));
            export_data.insert("failed_points".to_string(), serde_json::Value::Number(results.failed_points.into()));
            export_data.insert("execution_time_ms".to_string(), serde_json::Value::Number(results.execution_time_ms.into()));
        }
        
        export_data.insert("results".to_string(), serde_json::to_value(&results.points)
            .map_err(|e| AntennaError::SimulationFailed(format!("JSON serialization error: {}", e)))?);
        
        let json_string = serde_json::to_string_pretty(&export_data)
            .map_err(|e| AntennaError::SimulationFailed(format!("JSON serialization error: {}", e)))?;
        
        std::fs::write(output_path, json_string)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write file: {}", e)))?;
        
        Ok(())
    }

    /// Export to Touchstone format (.s1p)
    fn export_touchstone<P: AsRef<Path>>(
        results: &BatchResult,
        _config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let mut file = File::create(output_path)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to create file: {}", e)))?;
        
        // Write Touchstone header
        writeln!(file, "# Hz S RI R 50")
            .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        writeln!(file, "! Exported from PROMIN Antenna Studio")
            .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        
        // Write S-parameter data
        for point in &results.points {
            if let Some(ref result) = point.result {
                if let Some(sp) = result.s_parameters.first() {
                    writeln!(file, "{:.6e} {:.6e} {:.6e}",
                        sp.frequency,
                        sp.s11_re,
                        sp.s11_im)
                        .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
                }
            }
        }
        
        Ok(())
    }

    /// Export to MATLAB format
    fn export_matlab<P: AsRef<Path>>(
        results: &BatchResult,
        config: &ExportConfig,
        output_path: P,
    ) -> Result<()> {
        let mut file = File::create(output_path)
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to create file: {}", e)))?;
        
        writeln!(file, "% PROMIN Antenna Studio Export")
            .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        writeln!(file, "% Generated by PROMIN Antenna Studio")
            .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        writeln!(file, "")
            .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        
        // Export parameters as arrays
        if let Some(first_point) = results.points.first() {
            for param_name in first_point.parameters.keys() {
                let values: Vec<f64> = results.points.iter()
                    .map(|p| *p.parameters.get(param_name).unwrap_or(&0.0))
                    .collect();
                
                writeln!(file, "{} = [{}];", param_name, 
                    values.iter().map(|v| Self::format_number(*v, config.precision)).collect::<Vec<_>>().join(" "))
                    .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
            }
        }
        
        // Export S-parameters
        if config.include_sparameters {
            let frequencies: Vec<String> = results.points.iter()
                .filter_map(|p| p.result.as_ref())
                .filter_map(|r| r.s_parameters.first())
                .map(|sp| Self::format_number(sp.frequency, config.precision))
                .collect();

            let s11_re: Vec<String> = results.points.iter()
                .filter_map(|p| p.result.as_ref())
                .filter_map(|r| r.s_parameters.first())
                .map(|sp| Self::format_number(sp.s11_re, config.precision))
                .collect();

            let s11_im: Vec<String> = results.points.iter()
                .filter_map(|p| p.result.as_ref())
                .filter_map(|r| r.s_parameters.first())
                .map(|sp| Self::format_number(sp.s11_im, config.precision))
                .collect();
            
            writeln!(file, "frequency = [{}];", frequencies.join(" "))
                .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
            writeln!(file, "s11_re = [{}];", s11_re.join(" "))
                .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
            writeln!(file, "s11_im = [{}];", s11_im.join(" "))
                .map_err(|e| AntennaError::SimulationFailed(format!("Write error: {}", e)))?;
        }
        
        Ok(())
    }

    /// Format number with specified precision
    fn format_number(value: f64, precision: usize) -> String {
        format!("{:.prec$}", value, prec = precision)
    }
}

impl Default for ExportConfig {
    fn default() -> Self {
        Self {
            format: ExportFormat::Json,
            include_fields: true,
            include_sparameters: true,
            include_metadata: true,
            precision: 6,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_export_config_default() {
        let config = ExportConfig::default();
        assert!(matches!(config.format, ExportFormat::Json));
        assert!(config.include_fields);
        assert!(config.include_sparameters);
        assert!(config.include_metadata);
        assert_eq!(config.precision, 6);
    }

    #[test]
    fn test_format_number() {
        assert_eq!(DatasetExporter::format_number(3.14159, 2), "3.14");
        assert_eq!(DatasetExporter::format_number(1000.0, 0), "1000");
        assert_eq!(DatasetExporter::format_number(0.001234, 4), "0.0012");
    }

    #[test]
    fn test_export_formats() {
        let formats = vec![
            ExportFormat::Csv,
            ExportFormat::Json,
            ExportFormat::Touchstone,
            ExportFormat::Matlab,
        ];
        
        // Just test that all formats can be created
        assert_eq!(formats.len(), 4);
    }

    #[test]
    fn test_dataset_exporter_creation() {
        // DatasetExporter is a unit struct, just test it exists
        let _exporter = DatasetExporter;
        assert!(true);
    }
}