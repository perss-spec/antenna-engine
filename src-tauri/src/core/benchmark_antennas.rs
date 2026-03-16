use super::*;
use crate::core::solver::{Solver, SolverOptions};
use crate::core::green::FreeSpaceGreenFunction;
use crate::core::mesh::{Mesh, Segment};
use crate::core::materials::Material;
use crate::core::excitation::Excitation;
use nalgebra::{Complex, Vector3};
use approx::assert_relative_eq;
use std::f64::consts::PI;

const C0: f64 = 299792458.0; // Speed of light in vacuum (m/s)

/// Create a center-fed dipole antenna mesh
fn create_dipole_mesh(length: f64, num_segments: usize, radius: f64) -> Mesh {
    let mut segments = Vec::new();
    let segment_length = length / num_segments as f64;
    let half_length = length / 2.0;
    
    for i in 0..num_segments {
        let z_start = -half_length + i as f64 * segment_length;
        let z_end = z_start + segment_length;
        
        segments.push(Segment {
            id: i,
            start: Vector3::new(0.0, 0.0, z_start),
            end: Vector3::new(0.0, 0.0, z_end),
            radius,
            material_id: 0,
        });
    }
    
    Mesh { segments }
}

/// Create a quarter-wave monopole over ground
fn create_monopole_mesh(length: f64, num_segments: usize, radius: f64) -> Mesh {
    let mut segments = Vec::new();
    let segment_length = length / num_segments as f64;
    
    for i in 0..num_segments {
        let z_start = i as f64 * segment_length;
        let z_end = z_start + segment_length;
        
        segments.push(Segment {
            id: i,
            start: Vector3::new(0.0, 0.0, z_start),
            end: Vector3::new(0.0, 0.0, z_end),
            radius,
            material_id: 0,
        });
    }
    
    Mesh { segments }
}

/// Calculate S11 from impedance
fn calculate_s11(z_in: Complex<f64>, z0: f64) -> Complex<f64> {
    (z_in - z0) / (z_in + z0)
}

/// Convert S11 to dB
fn s11_to_db(s11: Complex<f64>) -> f64 {
    20.0 * s11.norm().log10()
}

#[test]
fn test_halfwave_dipole_300mhz() {
    let freq = 300e6; // 300 MHz
    let wavelength = C0 / freq;
    let length = 0.5 * wavelength; // Half-wave
    let radius = 0.001 * wavelength; // λ/1000 radius
    
    let mesh = create_dipole_mesh(length, 21, radius);
    let materials = vec![Material::PerfectConductor];
    
    // Center-fed excitation
    let excitation = Excitation::DeltaGap {
        segment_index: 10, // Center segment for 21 segments
        voltage: Complex::new(1.0, 0.0),
    };
    
    let options = SolverOptions {
        frequency: freq,
        ground_plane: false,
        max_iterations: 1000,
        tolerance: 1e-6,
    };
    
    let green = FreeSpaceGreenFunction::new();
    let mut solver = Solver::new(mesh, materials, vec![excitation], green, options);
    
    solver.solve().expect("Solver should converge");
    
    // Extract input impedance
    let z_in = solver.get_input_impedance(0).expect("Should have input impedance");
    
    // Theoretical half-wave dipole: Z ≈ 73 + j42.5 Ω
    assert_relative_eq!(z_in.re, 73.0, epsilon = 5.0, 
        "Half-wave dipole resistance should be ≈73Ω");
    assert_relative_eq!(z_in.im, 42.5, epsilon = 10.0,
        "Half-wave dipole reactance should be ≈42.5Ω");
    
    // Check S11
    let s11 = calculate_s11(z_in, 50.0);
    let s11_db = s11_to_db(s11);
    assert!(s11_db < -10.0, "S11 should be < -10 dB at resonance, got {} dB", s11_db);
    
    // Check gain (requires pattern calculation)
    let gain_dbi = 2.15; // Theoretical
    // TODO: Implement gain calculation
}

#[test]
fn test_quarterwave_monopole_300mhz() {
    let freq = 300e6;
    let wavelength = C0 / freq;
    let length = 0.25 * wavelength; // Quarter-wave
    let radius = 0.001 * wavelength;
    
    let mesh = create_monopole_mesh(length, 11, radius);
    let materials = vec![Material::PerfectConductor];
    
    // Base-fed excitation
    let excitation = Excitation::DeltaGap {
        segment_index: 0,
        voltage: Complex::new(1.0, 0.0),
    };
    
    let options = SolverOptions {
        frequency: freq,
        ground_plane: true, // Monopole over ground
        max_iterations: 1000,
        tolerance: 1e-6,
    };
    
    let green = FreeSpaceGreenFunction::new();
    let mut solver = Solver::new(mesh, materials, vec![excitation], green, options);
    
    solver.solve().expect("Solver should converge");
    
    let z_in = solver.get_input_impedance(0).expect("Should have input impedance");
    
    // Theoretical quarter-wave monopole: Z ≈ 36.5 Ω (half of dipole)
    assert_relative_eq!(z_in.re, 36.5, epsilon = 3.0,
        "Quarter-wave monopole resistance should be ≈36.5Ω");
    assert!(z_in.im.abs() < 5.0, 
        "Quarter-wave monopole should be nearly resonant");
}

#[test]
#[ignore] // Slow test
fn test_frequency_sweep() {
    let center_freq = 300e6;
    let wavelength = C0 / center_freq;
    let length = 0.48 * wavelength; // Slightly shorter for resonance
    let radius = 0.001 * wavelength;
    
    let mesh = create_dipole_mesh(length, 21, radius);
    let materials = vec![Material::PerfectConductor];
    
    let excitation = Excitation::DeltaGap {
        segment_index: 10,
        voltage: Complex::new(1.0, 0.0),
    };
    
    let freq_points = 11;
    let freq_start = 250e6;
    let freq_end = 350e6;
    let freq_step = (freq_end - freq_start) / (freq_points - 1) as f64;
    
    let mut min_s11_db = f64::INFINITY;
    let mut resonant_freq = 0.0;
    let mut bandwidth_low = 0.0;
    let mut bandwidth_high = 0.0;
    
    for i in 0..freq_points {
        let freq = freq_start + i as f64 * freq_step;
        
        let options = SolverOptions {
            frequency: freq,
            ground_plane: false,
            max_iterations: 1000,
            tolerance: 1e-6,
        };
        
        let green = FreeSpaceGreenFunction::new();
        let mut solver = Solver::new(mesh.clone(), materials.clone(), vec![excitation.clone()], green, options);
        
        solver.solve().expect("Solver should converge");
        
        let z_in = solver.get_input_impedance(0).expect("Should have input impedance");
        let s11 = calculate_s11(z_in, 50.0);
        let s11_db = s11_to_db(s11);
        
        if s11_db < min_s11_db {
            min_s11_db = s11_db;
            resonant_freq = freq;
        }
        
        // Track -10 dB bandwidth
        if s11_db < -10.0 {
            if bandwidth_low == 0.0 {
                bandwidth_low = freq;
            }
            bandwidth_high = freq;
        }
    }
    
    // Verify resonance near 300 MHz
    assert!((resonant_freq - 300e6).abs() < 10e6, 
        "Resonance should be within 10 MHz of 300 MHz, got {} MHz", resonant_freq / 1e6);
    
    // Verify minimum S11
    assert!(min_s11_db < -15.0, 
        "Minimum S11 should be < -15 dB, got {} dB", min_s11_db);
    
    // Verify bandwidth
    let bandwidth = bandwidth_high - bandwidth_low;
    assert!(bandwidth > 20e6, 
        "Bandwidth at -10 dB should be > 20 MHz, got {} MHz", bandwidth / 1e6);
}

#[test]
fn test_mesh_convergence() {
    let freq = 300e6;
    let wavelength = C0 / freq;
    let length = 0.5 * wavelength;
    let radius = 0.001 * wavelength;
    
    let segment_counts = vec![11, 21, 41, 81];
    let mut impedances = Vec::new();
    
    for &num_segments in &segment_counts {
        let mesh = create_dipole_mesh(length, num_segments, radius);
        let materials = vec![Material::PerfectConductor];
        
        // Center excitation index
        let excitation_index = num_segments / 2;
        let excitation = Excitation::DeltaGap {
            segment_index: excitation_index,
            voltage: Complex::new(1.0, 0.0),
        };
        
        let options = SolverOptions {
            frequency: freq,
            ground_plane: false,
            max_iterations: 1000,
            tolerance: 1e-6,
        };
        
        let green = FreeSpaceGreenFunction::new();
        let mut solver = Solver::new(mesh, materials, vec![excitation], green, options);
        
        solver.solve().expect("Solver should converge");
        
        let z_in = solver.get_input_impedance(0).expect("Should have input impedance");
        impedances.push(z_in);
    }
    
    // Check convergence: difference between 41 and 81 segments < 2%
    let z_41 = impedances[2];
    let z_81 = impedances[3];
    let relative_change = ((z_81 - z_41).norm() / z_41.norm()) * 100.0;
    
    assert!(relative_change < 2.0, 
        "Impedance should converge within 2% between 41 and 81 segments, got {}%", relative_change);
    
    // Check monotonic convergence (each refinement reduces change)
    for i in 1..impedances.len()-1 {
        let change_prev = (impedances[i] - impedances[i-1]).norm();
        let change_next = (impedances[i+1] - impedances[i]).norm();
        assert!(change_next < change_prev,
            "Convergence should be monotonic: change should decrease with refinement");
    }
}

#[test]
fn test_matrix_properties() {
    let freq = 300e6;
    let wavelength = C0 / freq;
    let length = 0.5 * wavelength;
    let radius = 0.001 * wavelength;
    
    let mesh = create_dipole_mesh(length, 11, radius);
    let materials = vec![Material::PerfectConductor];
    
    let excitation = Excitation::DeltaGap {
        segment_index: 5,
        voltage: Complex::new(1.0, 0.0),
    };
    
    let options = SolverOptions {
        frequency: freq,
        ground_plane: false,
        max_iterations: 1000,
        tolerance: 1e-6,
    };
    
    let green = FreeSpaceGreenFunction::new();
    let solver = Solver::new(mesh, materials, vec![excitation], green, options);
    
    // Build Z-matrix
    let z_matrix = solver.build_impedance_matrix();
    
    // Test reciprocity: Z_mn = Z_nm
    let n = z_matrix.nrows();
    for i in 0..n {
        for j in i+1..n {
            let z_ij = z_matrix[(i, j)];
            let z_ji = z_matrix[(j, i)];
            assert_relative_eq!(z_ij.re, z_ji.re, epsilon = 1e-10,
                "Z-matrix must be symmetric (reciprocity): Z[{},{}] != Z[{},{}]", i, j, j, i);
            assert_relative_eq!(z_ij.im, z_ji.im, epsilon = 1e-10,
                "Z-matrix must be symmetric (reciprocity): Z[{},{}] != Z[{},{}]", i, j, j, i);
        }
    }
    
    // Test condition number
    let svd = z_matrix.svd(true, true);
    let singular_values = svd.singular_values;
    let max_sv = singular_values.max();
    let min_sv = singular_values.min();
    let condition_number = max_sv / min_sv;
    
    assert!(condition_number < 1e6,
        "Condition number should be < 1e6 for well-conditioned system, got {:.2e}", condition_number);
}

#[test]
#[ignore] // Requires NEC2 import functionality
fn test_import_solve_pipeline() {
    use crate::core::import::nec2::parse_nec_file;
    
    // Create a simple NEC2 dipole file content
    let nec_content = r#"
CE Half-wave dipole at 300 MHz
GW 1 21 0 0 -0.25 0 0 0.25 0.001
GE 0
EX 0 1 11 0 1.0 0.0
FR 0 1 0 0 300.0 0.0
EN
"#;
    
    // Parse NEC2 file
    let (mesh, excitations, frequency) = parse_nec_file(nec_content)
        .expect("Should parse NEC2 file");
    
    let materials = vec![Material::PerfectConductor];
    
    let options = SolverOptions {
        frequency,
        ground_plane: false,
        max_iterations: 1000,
        tolerance: 1e-6,
    };
    
    let green = FreeSpaceGreenFunction::new();
    let mut solver = Solver::new(mesh, materials, excitations, green, options);
    
    solver.solve().expect("Solver should converge");
    
    let z_in = solver.get_input_impedance(0).expect("Should have input impedance");
    
    // Verify reasonable impedance for half-wave dipole
    assert!(z_in.re > 50.0 && z_in.re < 100.0,
        "Dipole resistance should be between 50-100Ω, got {}Ω", z_in.re);
    assert!(z_in.im.abs() < 50.0,
        "Dipole reactance should be < 50Ω, got {}Ω", z_in.im);
}