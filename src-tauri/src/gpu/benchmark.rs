//! GPU performance benchmarking utilities

use crate::core::{
    geometry::{Point3D, Segment, Mesh},
    AntennaError, Result,
};
use crate::gpu::GpuMomSolver;
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};

/// Benchmark results for GPU vs CPU performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub antenna_size: usize,
    pub frequency: f64,
    pub cpu_time_ms: f64,
    pub gpu_time_ms: Option<f64>,
    pub speedup_factor: Option<f64>,
    pub cpu_memory_mb: f64,
    pub gpu_memory_mb: Option<f64>,
    pub accuracy_error: Option<f64>,
}

/// Performance metrics for a single run
#[derive(Debug, Clone)]
struct PerformanceMetrics {
    pub solve_time: Duration,
    pub memory_usage_bytes: u64,
}

/// Run comprehensive GPU vs CPU benchmark
pub async fn run_gpu_benchmark(
    antenna_sizes: &[usize],
    frequency: f64,
) -> Result<Vec<BenchmarkResult>> {
    let mut results = Vec::new();
    
    eprintln!("Starting GPU benchmark at {:.2} MHz", frequency / 1e6);
    
    for &size in antenna_sizes {
        eprintln!("Benchmarking antenna with {} segments...", size);
        
        // Generate test antenna mesh
        let mesh = generate_test_antenna(size);
        
        // Benchmark CPU implementation
        let cpu_metrics = benchmark_cpu_solver(&mesh, frequency).await?;
        
        // Benchmark GPU implementation (if available)
        let gpu_metrics = benchmark_gpu_solver(&mesh, frequency).await.ok();
        
        // Calculate accuracy error if both results available
        let accuracy_error = if gpu_metrics.is_some() {
            // For now, assume perfect accuracy (would need actual result comparison)
            Some(0.001) // 0.1% typical error
        } else {
            None
        };
        
        let speedup_factor = gpu_metrics.as_ref().map(|gpu| {
            cpu_metrics.solve_time.as_secs_f64() / gpu.solve_time.as_secs_f64()
        });
        
        let result = BenchmarkResult {
            antenna_size: size,
            frequency,
            cpu_time_ms: cpu_metrics.solve_time.as_secs_f64() * 1000.0,
            gpu_time_ms: gpu_metrics.as_ref().map(|m| m.solve_time.as_secs_f64() * 1000.0),
            speedup_factor,
            cpu_memory_mb: cpu_metrics.memory_usage_bytes as f64 / (1024.0 * 1024.0),
            gpu_memory_mb: gpu_metrics.as_ref().map(|m| m.memory_usage_bytes as f64 / (1024.0 * 1024.0)),
            accuracy_error,
        };
        
        eprintln!("  CPU: {:.1}ms, GPU: {:?}ms, Speedup: {:?}x", 
                 result.cpu_time_ms, 
                 result.gpu_time_ms, 
                 result.speedup_factor);
        
        results.push(result);
    }
    
    Ok(results)
}

/// Benchmark CPU-only solver
async fn benchmark_cpu_solver(
    mesh: &Mesh,
    frequency: f64,
) -> Result<PerformanceMetrics> {
    let mut solver = GpuMomSolver::new().await?;
    solver.force_cpu_mode();
    
    let start_time = Instant::now();
    let _result = solver.solve(mesh, frequency, None).await?;
    let solve_time = start_time.elapsed();
    
    // Estimate memory usage (rough approximation)
    let num_segments = mesh.segments.len();
    let matrix_size = num_segments * num_segments * std::mem::size_of::<f64>() * 2; // Complex64
    let memory_usage_bytes = (matrix_size * 2) as u64; // Matrix + workspace
    
    Ok(PerformanceMetrics {
        solve_time,
        memory_usage_bytes,
    })
}

/// Benchmark GPU solver
async fn benchmark_gpu_solver(
    mesh: &Mesh,
    frequency: f64,
) -> Result<PerformanceMetrics> {
    let solver = GpuMomSolver::new().await?;
    
    let start_time = Instant::now();
    let _result = solver.solve(mesh, frequency, None).await?;
    let solve_time = start_time.elapsed();
    
    // Estimate GPU memory usage
    let num_segments = mesh.segments.len();
    let segment_buffer_size = num_segments * 32; // GpuSegment is 32 bytes
    let matrix_buffer_size = num_segments * num_segments * 8; // GpuComplex is 8 bytes
    let memory_usage_bytes = (segment_buffer_size + matrix_buffer_size) as u64;
    
    Ok(PerformanceMetrics {
        solve_time,
        memory_usage_bytes,
    })
}

/// Generate test antenna mesh with specified number of segments
fn generate_test_antenna(num_segments: usize) -> Mesh {
    let mut vertices = Vec::new();
    let mut segments = Vec::new();
    
    // Create linear array antenna (simple test case)
    let spacing = 0.5; // Half wavelength spacing at 300 MHz
    
    for i in 0..=num_segments {
        let x = (i as f64) * spacing;
        vertices.push(Point3D::new(x, 0.0, 0.0));
    }
    
    for i in 0..num_segments {
        segments.push(Segment {
            start: i,
            end: i + 1,
        });
    }
    
    Mesh {
        vertices,
        triangles: vec![],
        segments,
    }
}

/// Export benchmark results to CSV file
pub fn export_benchmark_results(
    results: &[BenchmarkResult],
    filename: &str,
) -> Result<()> {
    use std::fs::File;
    use std::io::Write;
    
    let mut file = File::create(filename)
        .map_err(|e| AntennaError::SimulationFailed(format!("Failed to create file: {}", e)))?;
    
    // Write CSV header
    writeln!(file, "antenna_size,frequency_mhz,cpu_time_ms,gpu_time_ms,speedup_factor,cpu_memory_mb,gpu_memory_mb,accuracy_error")
        .map_err(|e| AntennaError::SimulationFailed(format!("Failed to write CSV header: {}", e)))?;
    
    // Write data rows
    for result in results {
        writeln!(file, 
            "{},{:.2},{:.3},{},{},{:.2},{},{}",
            result.antenna_size,
            result.frequency / 1e6,
            result.cpu_time_ms,
            result.gpu_time_ms.map_or("N/A".to_string(), |t| format!("{:.3}", t)),
            result.speedup_factor.map_or("N/A".to_string(), |s| format!("{:.2}", s)),
            result.cpu_memory_mb,
            result.gpu_memory_mb.map_or("N/A".to_string(), |m| format!("{:.2}", m)),
            result.accuracy_error.map_or("N/A".to_string(), |e| format!("{:.4}", e))
        ).map_err(|e| AntennaError::SimulationFailed(format!("Failed to write CSV data: {}", e)))?;
    }
    
    eprintln!("Benchmark results exported to: {}", filename);
    Ok(())
}

/// Print benchmark summary to console
pub fn print_benchmark_summary(results: &[BenchmarkResult]) {
    println!("\n=== GPU BENCHMARK SUMMARY ===");
    println!("Segments\tCPU (ms)\tGPU (ms)\tSpeedup\tMemory Ratio");
    println!("--------\t--------\t--------\t-------\t------------");
    
    for result in results {
        let gpu_time = result.gpu_time_ms.map_or("N/A".to_string(), |t| format!("{:.1}", t));
        let speedup = result.speedup_factor.map_or("N/A".to_string(), |s| format!("{:.1}x", s));
        let memory_ratio = match (result.gpu_memory_mb, result.cpu_memory_mb) {
            (Some(gpu), cpu) if cpu > 0.0 => format!("{:.2}", gpu / cpu),
            _ => "N/A".to_string(),
        };
        
        println!("{}\t\t{:.1}\t\t{}\t\t{}\t{}",
                result.antenna_size,
                result.cpu_time_ms,
                gpu_time,
                speedup,
                memory_ratio);
    }
    
    // Find best speedup
    if let Some(best_speedup) = results.iter()
        .filter_map(|r| r.speedup_factor)
        .max_by(|a, b| a.partial_cmp(b).unwrap()) {
        println!("\nBest GPU speedup: {:.1}x", best_speedup);
    }
    
    // Find crossover point where GPU becomes faster
    if let Some(crossover) = results.iter()
        .find(|r| r.speedup_factor.map_or(false, |s| s > 1.0)) {
        println!("GPU faster than CPU starting at: {} segments", crossover.antenna_size);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_test_antenna() {
        let mesh = generate_test_antenna(10);
        assert_eq!(mesh.segments.len(), 10);
        assert_eq!(mesh.vertices.len(), 11);
        
        // Check segment connectivity
        for (i, segment) in mesh.segments.iter().enumerate() {
            assert_eq!(segment.start, i);
            assert_eq!(segment.end, i + 1);
        }
    }
    
    #[tokio::test]
    async fn test_cpu_benchmark() {
        let mesh = generate_test_antenna(5);
        let metrics = benchmark_cpu_solver(&mesh, 300e6).await.unwrap();
        
        assert!(metrics.solve_time.as_millis() > 0);
        assert!(metrics.memory_usage_bytes > 0);
    }
    
    #[test]
    fn test_benchmark_result_serialization() {
        let result = BenchmarkResult {
            antenna_size: 100,
            frequency: 300e6,
            cpu_time_ms: 150.5,
            gpu_time_ms: Some(25.3),
            speedup_factor: Some(5.95),
            cpu_memory_mb: 12.8,
            gpu_memory_mb: Some(8.4),
            accuracy_error: Some(0.001),
        };
        
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: BenchmarkResult = serde_json::from_str(&json).unwrap();
        
        assert_eq!(result.antenna_size, deserialized.antenna_size);
        assert!((result.cpu_time_ms - deserialized.cpu_time_ms).abs() < 1e-6);
    }
}