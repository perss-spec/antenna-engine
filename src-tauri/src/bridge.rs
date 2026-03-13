use serde_json::json;

/// Speed of light (m/s)
const C0: f64 = 299_792_458.0;

#[tauri::command]
pub fn get_antenna_templates() -> Vec<serde_json::Value> {
    vec![
        json!({
            "id": "dipole",
            "name": "Half-Wave Dipole",
            "type": "Dipole",
            "default_frequency": 145.0e6,
            "default_params": {
                "length": C0 / 145.0e6 / 2.0,
                "radius": 0.001,
            },
            "description": "Classic half-wave dipole antenna",
            "frequency_range": [1.0e6, 6.0e9],
            "typical_applications": ["HF/VHF/UHF communications", "Reference antenna"]
        }),
        json!({
            "id": "monopole",
            "name": "Quarter-Wave Monopole",
            "type": "Monopole",
            "default_frequency": 433.0e6,
            "default_params": {
                "height": C0 / 433.0e6 / 4.0,
                "radius": 0.001,
                "ground_plane_radius": 0.2,
            },
            "description": "Quarter-wave monopole over ground plane",
            "frequency_range": [1.0e6, 6.0e9],
            "typical_applications": ["Vehicle antennas", "Base stations"]
        }),
        json!({
            "id": "patch",
            "name": "Rectangular Patch",
            "type": "Patch",
            "default_frequency": 2.4e9,
            "default_params": {
                "width": 0.038,
                "length": 0.029,
                "substrate_height": 0.0016,
                "substrate_er": 4.4,
            },
            "description": "Rectangular microstrip patch antenna",
            "frequency_range": [100.0e6, 30.0e9],
            "typical_applications": ["WiFi", "GPS", "Satellite communications"]
        }),
        json!({
            "id": "qfh",
            "name": "Quadrifilar Helix (QFH)",
            "type": "Qfh",
            "default_frequency": 137.5e6,
            "default_params": {
                "frequency": 137.5e6,
                "turns": 0.5,
                "diameter": 0.22,
                "height": 0.35,
                "wire_radius": 0.001,
            },
            "description": "Quadrifilar helix for circular polarization",
            "frequency_range": [50.0e6, 3.0e9],
            "typical_applications": ["Weather satellite reception (NOAA/Meteor)", "GPS"]
        }),
        json!({
            "id": "yagi",
            "name": "3-Element Yagi-Uda",
            "type": "Yagi",
            "default_frequency": 145.0e6,
            "default_params": {
                "num_elements": 3,
                "driven_length": C0 / 145.0e6 / 2.0,
                "reflector_length": C0 / 145.0e6 / 2.0 * 1.05,
                "director_length": C0 / 145.0e6 / 2.0 * 0.91,
                "spacing": 0.25 * C0 / 145.0e6,
                "radius": 0.003,
            },
            "description": "Directional Yagi-Uda antenna",
            "frequency_range": [30.0e6, 3.0e9],
            "typical_applications": ["Amateur radio", "TV reception", "Point-to-point links"]
        }),
    ]
}

#[tauri::command]
pub fn simulate_antenna(
    antenna_type: String,
    frequency: f64,
    segments: usize,
) -> Result<serde_json::Value, String> {
    if frequency <= 0.0 {
        return Err("Frequency must be positive".into());
    }
    let segments = if segments == 0 { 21 } else { segments };
    let wavelength = C0 / frequency;

    match antenna_type.to_lowercase().as_str() {
        "dipole" => simulate_dipole(frequency, wavelength, segments),
        "monopole" => simulate_monopole(frequency, wavelength, segments),
        "patch" => simulate_patch(frequency, wavelength),
        "qfh" => simulate_qfh(frequency, wavelength, segments),
        "yagi" => simulate_yagi(frequency, wavelength, segments),
        other => Err(format!("Unknown antenna type: {}", other)),
    }
}

#[tauri::command]
pub fn get_simulation_status() -> serde_json::Value {
    json!({
        "stage": "idle",
        "progress": 0.0,
        "message": "No simulation running",
        "eta_seconds": null
    })
}

// ---------------------------------------------------------------------------
// Analytical simulation models
// ---------------------------------------------------------------------------

fn simulate_dipole(freq: f64, wl: f64, segments: usize) -> Result<serde_json::Value, String> {
    let length = wl / 2.0;
    let k = 2.0 * std::f64::consts::PI / wl;

    // Input impedance of half-wave dipole ~73+j42 at resonance
    let z_re = 73.0;
    let z_im = 42.5 * (freq / (C0 / (2.0 * length)) - 1.0);
    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).log10();

    let mesh = generate_wire_mesh(length, segments);

    Ok(json!({
        "antenna_type": "dipole",
        "frequency": freq,
        "wavelength": wl,
        "num_segments": segments,
        "mesh": mesh,
        "results": {
            "input_impedance": { "re": z_re, "im": z_im },
            "s11": { "re": s11_re, "im": s11_im, "db": s11_db },
            "vswr": vswr,
            "gain_dbi": 2.15,
            "directivity_dbi": 2.15,
            "efficiency": 0.98,
            "beamwidth_e": 78.0,
            "beamwidth_h": 360.0,
            "bandwidth_pct": 8.0,
            "polarization": "linear"
        }
    }))
}

fn simulate_monopole(freq: f64, wl: f64, segments: usize) -> Result<serde_json::Value, String> {
    let height = wl / 4.0;

    let z_re = 36.5;
    let z_im = 21.25 * (freq / (C0 / (4.0 * height)) - 1.0);
    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).log10();

    let mesh = generate_wire_mesh(height, segments / 2 + 1);

    Ok(json!({
        "antenna_type": "monopole",
        "frequency": freq,
        "wavelength": wl,
        "num_segments": segments,
        "mesh": mesh,
        "results": {
            "input_impedance": { "re": z_re, "im": z_im },
            "s11": { "re": s11_re, "im": s11_im, "db": s11_db },
            "vswr": vswr,
            "gain_dbi": 5.15,
            "directivity_dbi": 5.15,
            "efficiency": 0.95,
            "beamwidth_e": 45.0,
            "beamwidth_h": 360.0,
            "bandwidth_pct": 10.0,
            "polarization": "linear"
        }
    }))
}

fn simulate_patch(freq: f64, wl: f64) -> Result<serde_json::Value, String> {
    // Cavity model approximation for rectangular patch on FR-4
    let er = 4.4_f64;
    let h = 0.0016;
    let w = C0 / (2.0 * freq) * (2.0 / (er + 1.0)).sqrt();
    let er_eff = (er + 1.0) / 2.0 + (er - 1.0) / 2.0 * (1.0 + 12.0 * h / w).powf(-0.5);
    let l_eff = C0 / (2.0 * freq * er_eff.sqrt());

    let z_re = 200.0; // edge-fed patch, typical
    let z_im = 0.0;
    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).log10();

    Ok(json!({
        "antenna_type": "patch",
        "frequency": freq,
        "wavelength": wl,
        "patch_width": w,
        "patch_length": l_eff,
        "substrate_er": er,
        "substrate_height": h,
        "er_effective": er_eff,
        "results": {
            "input_impedance": { "re": z_re, "im": z_im },
            "s11": { "re": s11_re, "im": s11_im, "db": s11_db },
            "vswr": vswr,
            "gain_dbi": 6.0,
            "directivity_dbi": 7.0,
            "efficiency": 0.85,
            "beamwidth_e": 65.0,
            "beamwidth_h": 80.0,
            "bandwidth_pct": 2.5,
            "polarization": "linear"
        }
    }))
}

fn simulate_qfh(freq: f64, wl: f64, segments: usize) -> Result<serde_json::Value, String> {
    let diameter = wl * 0.16;
    let height = wl * 0.26;

    let z_re = 50.0;
    let z_im = 5.0 * (freq / (C0 / (4.0 * height)) - 1.0);
    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).log10();

    Ok(json!({
        "antenna_type": "qfh",
        "frequency": freq,
        "wavelength": wl,
        "diameter": diameter,
        "height": height,
        "num_segments": segments,
        "results": {
            "input_impedance": { "re": z_re, "im": z_im },
            "s11": { "re": s11_re, "im": s11_im, "db": s11_db },
            "vswr": vswr,
            "gain_dbi": 3.0,
            "directivity_dbi": 4.0,
            "efficiency": 0.75,
            "beamwidth_e": 140.0,
            "beamwidth_h": 360.0,
            "bandwidth_pct": 15.0,
            "polarization": "circular"
        }
    }))
}

fn simulate_yagi(freq: f64, wl: f64, segments: usize) -> Result<serde_json::Value, String> {
    let driven = wl / 2.0;
    let reflector = driven * 1.05;
    let director = driven * 0.91;
    let spacing = wl * 0.25;

    let z_re = 25.0;
    let z_im = 10.0 * (freq / (C0 / driven) - 1.0);
    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).log10();

    Ok(json!({
        "antenna_type": "yagi",
        "frequency": freq,
        "wavelength": wl,
        "elements": {
            "driven": driven,
            "reflector": reflector,
            "director": director,
            "spacing": spacing
        },
        "num_segments": segments,
        "results": {
            "input_impedance": { "re": z_re, "im": z_im },
            "s11": { "re": s11_re, "im": s11_im, "db": s11_db },
            "vswr": vswr,
            "gain_dbi": 7.1,
            "directivity_dbi": 7.4,
            "efficiency": 0.95,
            "beamwidth_e": 55.0,
            "beamwidth_h": 70.0,
            "bandwidth_pct": 5.0,
            "polarization": "linear",
            "front_to_back_db": 12.0
        }
    }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn compute_s11(z_re: f64, z_im: f64, z0: f64) -> (f64, f64, f64) {
    // Γ = (Z - Z0) / (Z + Z0)
    let denom_re = z_re + z0;
    let denom_im = z_im;
    let denom_mag_sq = denom_re * denom_re + denom_im * denom_im;

    let num_re = z_re - z0;
    let num_im = z_im;

    let gamma_re = (num_re * denom_re + num_im * denom_im) / denom_mag_sq;
    let gamma_im = (num_im * denom_re - num_re * denom_im) / denom_mag_sq;

    let gamma_mag = (gamma_re * gamma_re + gamma_im * gamma_im).sqrt();
    let vswr = if gamma_mag < 0.999 {
        (1.0 + gamma_mag) / (1.0 - gamma_mag)
    } else {
        999.0
    };

    (gamma_re, gamma_im, vswr)
}

fn generate_wire_mesh(length: f64, num_segments: usize) -> serde_json::Value {
    let half = length / 2.0;
    let step = length / num_segments as f64;

    let mut points = Vec::with_capacity(num_segments + 1);
    for i in 0..=num_segments {
        let z = -half + step * i as f64;
        points.push(json!({ "x": 0.0, "y": 0.0, "z": z }));
    }

    let mut wire_segments = Vec::with_capacity(num_segments);
    for i in 0..num_segments {
        wire_segments.push(json!({
            "start": points[i],
            "end": points[i + 1],
            "index": i
        }));
    }

    json!({
        "points": points,
        "segments": wire_segments,
        "feed_segment": num_segments / 2,
        "total_length": length
    })
}

#[tauri::command]
pub fn export_touchstone_s1p(
    frequencies: Vec<f64>,
    s11_re: Vec<f64>,
    s11_im: Vec<f64>,
    reference_impedance: f64,
) -> Result<String, String> {
    if frequencies.len() != s11_re.len() || frequencies.len() != s11_im.len() {
        return Err("Frequency, S11 real and imaginary vectors must have the same length".into());
    }
    let mut output = String::new();
    output.push_str("! PROMIN Antenna Studio Export\n");
    output.push_str("! Touchstone S1P Format\n");
    output.push_str(&format!("# HZ S RI R {:.1}\n", reference_impedance));
    for i in 0..frequencies.len() {
        output.push_str(&format!("{:.6e} {:.8e} {:.8e}\n", frequencies[i], s11_re[i], s11_im[i]));
    }
    Ok(output)
}
