struct Segment {
    start_pos: vec3<f32>,
    end_pos: vec3<f32>,
    length: f32,
    padding: f32,
}

struct Params {
    frequency: f32,
    k0: f32,
    eta0: f32,
    num_segments: u32,
}

@group(0) @binding(0) var<storage, read> segments: array<Segment>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read_write> z_matrix: array<vec2<f32>>;

const PI: f32 = 3.14159265359;
const EPS: f32 = 1e-10;

@compute @workgroup_size(8, 8)
fn fill_impedance(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.y;
    let j = gid.x;
    
    if (i >= params.num_segments || j >= params.num_segments) {
        return;
    }
    
    let seg_i = segments[i];
    let seg_j = segments[j];
    
    // Compute segment centers
    let center_i = (seg_i.start_pos + seg_i.end_pos) * 0.5;
    let center_j = (seg_j.start_pos + seg_j.end_pos) * 0.5;
    
    let r_vec = center_i - center_j;
    let r = length(r_vec);
    
    var z_element: vec2<f32>;
    
    if (i == j) {
        // Self-impedance (thin wire approximation)
        let a = seg_j.length / 100.0; // Wire radius approximation
        let ln_term = log(2.0 * seg_j.length / a);
        // Z_self = eta0 / (2π) * ln(2L/a) * j
        z_element = vec2<f32>(0.0, params.eta0 / (2.0 * PI) * ln_term);
    } else if (r < EPS) {
        z_element = vec2<f32>(0.0, 0.0);
    } else {
        // Mutual impedance using Green's function
        let kr = params.k0 * r;
        
        // Green's function: G = -jk0 * exp(-jkr) / (4πr)
        // exp(-jkr) = cos(kr) - j*sin(kr)
        let cos_kr = cos(kr);
        let sin_kr = sin(kr);
        
        let exp_neg_jkr = vec2<f32>(cos_kr, -sin_kr);
        let green_factor = -params.k0 / (4.0 * PI * r);
        
        // G = green_factor * j * exp(-jkr)
        // j * (a + jb) = -b + ja
        let green = vec2<f32>(
            green_factor * (-exp_neg_jkr.y),  // Real part
            green_factor * exp_neg_jkr.x      // Imaginary part
        );
        
        // Z_mutual = eta0 * length_j * G
        z_element = vec2<f32>(
            params.eta0 * seg_j.length * green.x,
            params.eta0 * seg_j.length * green.y
        );
    }
    
    let matrix_idx = i * params.num_segments + j;
    z_matrix[matrix_idx] = z_element;
}