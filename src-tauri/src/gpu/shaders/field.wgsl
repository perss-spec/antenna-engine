// Field calculation compute shader
struct FieldPoint {
    position: vec3<f32>,
    value: f32,
};

@group(0) @binding(0) var<storage, read> sources: array<FieldPoint>;
@group(0) @binding(1) var<storage, read_write> targets: array<FieldPoint>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= arrayLength(&targets)) {
        return;
    }

    var sum: f32 = 0.0;
    let target_pos = targets[id.x].position;
    
    for (var i: u32 = 0; i < arrayLength(&sources); i = i + 1) {
        let source_pos = sources[i].position;
        let dx = target_pos.x - source_pos.x;
        let dy = target_pos.y - source_pos.y;
        let dz = target_pos.z - source_pos.z;
        let distance = sqrt(dx*dx + dy*dy + dz*dz);
        sum = sum + sources[i].value / (distance + 1e-6);
    }
    
    targets[id.x].value = sum;
}