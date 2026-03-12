// GPU compute shader for MoM impedance matrix filling
// Each thread computes one Z[i,j] element using Green's function

struct Segment {
    start_pos: vec3<f32>,
    end_pos: vec3<f32>,
    length: f32,
    padding: f32,
}

struct Complex {
    real: f32,
    imag: f32,
}

@group(0) @binding(0) var<storage, read> segments: array<Segment>;
@group(0) @binding(1) var<storage, read_write> z_matrix: array<Complex>;

// Physical constants (f32 precision)
const PI: f32 = 3.14159265359;
const C0: f32 = 299792458.0;           // Speed of light
const MU0: f32 = 1.25663706e-6;        // Permeability of free space
const EPS0: f32 = 8.854187817e-12;     // Permittivity of free space
const ETA0: f32 = 376.73031366857;     // Impedance of free space
const FREQUENCY: f32 = 300e6;          // Fixed frequency for now (TODO: make uniform)

// Complex number operations
fn complex_mul(a: Complex, b: Complex) -> Complex {
    return Complex(
        a.real * b.real - a.imag * b.imag,
        a.real * b.imag + a.imag * b.real
    );
}

fn complex_exp(z: Complex) -> Complex {
    let exp_real = exp(z.real);
    return Complex(
        exp_real * cos(z.imag),
        exp_real * sin(z.imag)
    );
}

fn complex_norm(z: Complex) -> f32 {
    return sqrt(z.real * z.real + z.imag * z.imag);
}

// Compute Green's function for two points
fn greens_function(r1: vec3<f32>, r2: vec3<f32>, k: f32) -> Complex {
    let r = distance(r1, r2);
    if (r < 1e-6) {
        // Avoid singularity
        return Complex(0.0, 0.0);
    }
    
    let kr = k * r;
    let phase = Complex(0.0, -kr);
    let exp_term = complex_exp(phase);
    let green_factor = 1.0 / (4.0 * PI * r);
    
    return Complex(
        exp_term.real * green_factor,
        exp_term.imag * green_factor
    );
}

// Compute mutual impedance between segments i and j
fn compute_mutual_impedance(i: u32, j: u32, k: f32, eta: f32) -> Complex {
    let seg_i = segments[i];
    let seg_j = segments[j];
    
    // Segment centers
    let center_i = (seg_i.start_pos + seg_i.end_pos) * 0.5;
    let center_j = (seg_j.start_pos + seg_j.end_pos) * 0.5;
    
    let length_i = seg_i.length;
    let length_j = seg_j.length;
    
    if (i == j) {
        // Self-impedance (simplified thin-wire approximation)
        let self_resistance = eta * k * length_i / (4.0 * PI);
        return Complex(self_resistance, 0.0);
    } else {
        // Mutual impedance using Green's function
        let green = greens_function(center_i, center_j, k);
        let impedance_factor = eta * k * k * length_i * length_j;
        
        return Complex(
            impedance_factor * green.real,
            impedance_factor * green.imag
        );
    }
}

@compute @workgroup_size(8, 8)
fn fill_impedance(@builtin(global_invocation_id) gid: vec3<u32>) {
    let num_segments = arrayLength(&segments);
    let i = gid.x;
    let j = gid.y;
    
    // Check bounds
    if (i >= num_segments || j >= num_segments) {
        return;
    }
    
    // Compute wave number
    let k = 2.0 * PI * FREQUENCY / C0;
    let eta = ETA0;
    
    // Compute impedance matrix element
    let z_ij = compute_mutual_impedance(i, j, k, eta);
    
    // Store in row-major order
    let matrix_index = i * num_segments + j;
    z_matrix[matrix_index] = z_ij;
}