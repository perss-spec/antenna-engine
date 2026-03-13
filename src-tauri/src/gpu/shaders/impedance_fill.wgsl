// GPU shader for MoM impedance matrix computation
// Each thread computes one Z[i,j] element using Green's function

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

@compute @workgroup_size(8, 8)
fn fill_impedance(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.y;
    let j = gid.x;
    
    if (i >= params.num_segments || j >= params.num_segments) {
        return;
    }
    
    let seg_i = segments[i];
    let seg_j = segments[j];
    
    // Calculate impedance matrix element Z[i,j]
    var z_ij: vec2<f32>;
    
    if (i == j) {
        // Self-impedance (simplified)
        let length = seg_i.length;
        let self_z = params.eta0 * sin(2.0 * 3.14159265 * length * params.frequency / 299792458.0) / (4.0 * 3.14159265);
        z_ij = vec2<f32>(self_z, 0.0);
    } else {
        // Mutual impedance using Green's function
        let center_i = (seg_i.start_pos + seg_i.end_pos) * 0.5;
        let center_j = (seg_j.start_pos + seg_j.end_pos) * 0.5;
        
        let r_vec = center_i - center_j;
        let r = length(r_vec);
        
        if (r < 1e-6) {
            z_ij = vec2<f32>(0.0, 0.0);
        } else {
            // Green's function: G = exp(-jkr) / (4πr)
            let kr = params.k0 * r;
            let cos_kr = cos(kr);
            let sin_kr = sin(kr);
            
            // exp(-jkr) = cos(kr) - j*sin(kr)
            let green_re = cos_kr / (4.0 * 3.14159265 * r);
            let green_im = -sin_kr / (4.0 * 3.14159265 * r);
            
            // Z_ij = η₀ * G(r)
            z_ij = vec2<f32>(green_re * params.eta0, green_im * params.eta0);
        }
    }
    
    // Store result in row-major order
    let index = i * params.num_segments + j;
    z_matrix[index] = z_ij;
}