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
    antenna_params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    if frequency <= 0.0 {
        return Err("Frequency must be positive".into());
    }
    let segments = if segments == 0 { 21 } else { segments };
    let wavelength = C0 / frequency;

    match antenna_type.to_lowercase().as_str() {
        "dipole" => {
            let length = antenna_params["length_m"].as_f64().unwrap_or(wavelength / 2.0);
            let radius = antenna_params["radius_m"].as_f64().unwrap_or(0.001);
            simulate_dipole(frequency, wavelength, segments, length, radius)
        }
        "monopole" => {
            let height = antenna_params["height_m"].as_f64().unwrap_or(wavelength / 4.0);
            let radius = antenna_params["radius_m"].as_f64().unwrap_or(0.001);
            simulate_monopole(frequency, wavelength, segments, height, radius)
        }
        "patch" => {
            let width = antenna_params["width_m"].as_f64();
            let length = antenna_params["length_m"].as_f64();
            let er = antenna_params["substrate_er"].as_f64().unwrap_or(4.4);
            let h = antenna_params["substrate_height_m"].as_f64().unwrap_or(0.0016);
            simulate_patch(frequency, wavelength, width, length, er, h)
        }
        "qfh" => {
            let diameter = antenna_params["diameter_m"].as_f64().unwrap_or(wavelength * 0.16);
            let height = antenna_params["height_m"].as_f64().unwrap_or(wavelength * 0.26);
            let wire_radius = antenna_params["radius_m"].as_f64().unwrap_or(0.001);
            simulate_qfh(frequency, wavelength, segments, diameter, height, wire_radius)
        }
        "yagi" => {
            let driven_length = antenna_params["length_m"].as_f64().unwrap_or(wavelength / 2.0);
            let spacing = antenna_params["spacing_m"].as_f64().unwrap_or(wavelength * 0.25);
            let radius = antenna_params["radius_m"].as_f64().unwrap_or(0.003);
            simulate_yagi(frequency, wavelength, segments, driven_length, spacing, radius)
        }
        other => Err(format!("Unknown antenna type: {}", other)),
    }
}

#[tauri::command]
pub fn simulate_sweep(
    antenna_type: String,
    freq_start: f64,
    freq_stop: f64,
    freq_points: usize,
    antenna_params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    if freq_start <= 0.0 || freq_stop <= freq_start {
        return Err("Invalid frequency range".into());
    }
    let n = if freq_points < 2 { 101 } else { freq_points };

    let mut frequencies = Vec::with_capacity(n);
    let mut s11_db = Vec::with_capacity(n);
    let mut s11_real = Vec::with_capacity(n);
    let mut s11_imag = Vec::with_capacity(n);
    let mut impedance_real = Vec::with_capacity(n);
    let mut impedance_imag = Vec::with_capacity(n);

    let mut min_s11 = f64::INFINITY;
    let mut resonant_freq = freq_start;
    let mut bw_start: Option<f64> = None;
    let mut bw_stop: Option<f64> = None;

    for i in 0..n {
        let f = freq_start + (freq_stop - freq_start) * i as f64 / (n - 1) as f64;
        frequencies.push(f);

        let result = simulate_antenna(antenna_type.clone(), f, 21, antenna_params.clone())?;
        let res = result["results"].clone();

        let s11_re_val = res["s11"]["re"].as_f64().unwrap_or(0.0);
        let s11_im_val = res["s11"]["im"].as_f64().unwrap_or(0.0);
        let s11_db_val = res["s11"]["db"].as_f64().unwrap_or(0.0);
        let z_re = res["input_impedance"]["re"].as_f64().unwrap_or(50.0);
        let z_im = res["input_impedance"]["im"].as_f64().unwrap_or(0.0);

        s11_db.push(s11_db_val);
        s11_real.push(s11_re_val);
        s11_imag.push(s11_im_val);
        impedance_real.push(z_re);
        impedance_imag.push(z_im);

        if s11_db_val < min_s11 {
            min_s11 = s11_db_val;
            resonant_freq = f;
        }

        if s11_db_val <= -10.0 {
            if bw_start.is_none() { bw_start = Some(f); }
            bw_stop = Some(f);
        }
    }

    let bandwidth = match (bw_start, bw_stop) {
        (Some(start), Some(stop)) => stop - start,
        _ => 0.0,
    };

    Ok(json!({
        "frequencies": frequencies,
        "s11Db": s11_db,
        "s11Real": s11_real,
        "s11Imag": s11_imag,
        "impedanceReal": impedance_real,
        "impedanceImag": impedance_imag,
        "resonantFreq": resonant_freq,
        "minS11": min_s11,
        "bandwidth": bandwidth,
    }))
}

#[tauri::command]
pub fn compute_radiation_pattern(
    antenna_type: String,
    frequency: f64,
    theta_points: usize,
    phi_points: usize,
) -> Result<serde_json::Value, String> {
    if frequency <= 0.0 {
        return Err("Frequency must be positive".into());
    }
    let n_theta = if theta_points < 2 { 37 } else { theta_points };
    let n_phi = if phi_points < 2 { 73 } else { phi_points };
    let wl = C0 / frequency;

    let mut pattern = Vec::with_capacity(n_theta);
    let mut max_gain = f64::NEG_INFINITY;

    for it in 0..n_theta {
        let theta = std::f64::consts::PI * it as f64 / (n_theta - 1) as f64;
        let mut row = Vec::with_capacity(n_phi);
        for ip in 0..n_phi {
            let phi = 2.0 * std::f64::consts::PI * ip as f64 / (n_phi - 1) as f64;
            let gain = match antenna_type.to_lowercase().as_str() {
                "dipole" => {
                    let st = theta.sin();
                    if st.abs() < 1e-6 { -40.0 }
                    else {
                        let f_theta = ((std::f64::consts::FRAC_PI_2 * theta.cos()).cos()) / st;
                        2.15 + 20.0 * f_theta.abs().max(1e-10).log10()
                    }
                }
                "monopole" => {
                    let st = theta.sin();
                    if st.abs() < 1e-6 || theta > std::f64::consts::FRAC_PI_2 { -40.0 }
                    else {
                        let f_theta = ((std::f64::consts::FRAC_PI_2 * theta.cos()).cos()) / st;
                        5.15 + 20.0 * f_theta.abs().max(1e-10).log10()
                    }
                }
                "patch" => {
                    let g = theta.cos().powi(2);
                    6.0 + 10.0 * g.max(1e-10).log10()
                }
                "qfh" => {
                    // Shaped cardioid with RHCP: (1+cos(theta))^2/4 with axial ratio
                    let cos_t = theta.cos();
                    let g_co = ((1.0 + cos_t) / 2.0).powi(2); // co-pol RHCP
                    let g_cross = ((1.0 - cos_t) / 2.0).powi(2) * 0.05; // cross-pol suppressed
                    let g_total = g_co + g_cross;
                    3.0 + 10.0 * g_total.max(1e-10).log10()
                }
                "yagi" => {
                    // Endfire array factor for 3 elements with proper phasing
                    let cos_t = theta.cos();
                    let d = 0.25 * wl;
                    let k = 2.0 * std::f64::consts::PI / wl;
                    let psi = k * d * cos_t;
                    // 3-element AF: reflector + driven + director with phase shifts
                    let af_re = 1.0 + (psi - 0.2).cos() + (2.0 * psi + 0.15).cos();
                    let af_im = (psi - 0.2).sin() + (2.0 * psi + 0.15).sin();
                    let af_mag = (af_re * af_re + af_im * af_im).sqrt() / 3.0;
                    // Element factor (dipole)
                    let st = theta.sin();
                    let ef = if st.abs() < 1e-6 { 0.0 }
                             else { ((std::f64::consts::FRAC_PI_2 * cos_t).cos()) / st };
                    let g_total = (af_mag * ef).powi(2);
                    // phi dependence: E-plane vs H-plane
                    let phi_factor = phi.cos().powi(2) + 0.3 * phi.sin().powi(2);
                    7.1 + 10.0 * (g_total * phi_factor).max(1e-10).log10()
                }
                _ => -40.0,
            };
            if gain > max_gain { max_gain = gain; }
            row.push(gain);
        }
        pattern.push(row);
    }

    Ok(json!({
        "pattern": pattern,
        "maxGain": max_gain,
        "thetaPoints": n_theta,
        "phiPoints": n_phi,
        "antennaType": antenna_type,
        "frequency": frequency,
    }))
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
// Analytical simulation models — parametrized by physical dimensions
// ---------------------------------------------------------------------------

fn simulate_dipole(freq: f64, wl: f64, segments: usize, length: f64, _radius: f64) -> Result<serde_json::Value, String> {
    let k = 2.0 * std::f64::consts::PI / wl;
    let _ = k;

    // Resonant frequency from FIXED physical length
    let f_res = C0 / (2.0 * length);
    let ratio = freq / f_res;

    // Impedance: varies with detuning from resonance
    let z_re = 73.0 + 40.0 * (ratio - 1.0).powi(2);
    let z_im = 42.5 * (ratio - 1.0) * ratio;

    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).max(1e-30).log10();

    let mesh = generate_wire_mesh(length, segments);

    Ok(json!({
        "antenna_type": "dipole",
        "frequency": freq,
        "wavelength": wl,
        "physical_length": length,
        "resonant_frequency": f_res,
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

fn simulate_monopole(freq: f64, wl: f64, segments: usize, height: f64, _radius: f64) -> Result<serde_json::Value, String> {
    // Resonant frequency from FIXED physical height
    let f_res = C0 / (4.0 * height);
    let ratio = freq / f_res;

    let z_re = 36.5 + 20.0 * (ratio - 1.0).powi(2);
    let z_im = 21.25 * (ratio - 1.0) * ratio;

    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).max(1e-30).log10();

    let mesh = generate_wire_mesh(height, segments / 2 + 1);

    Ok(json!({
        "antenna_type": "monopole",
        "frequency": freq,
        "wavelength": wl,
        "physical_height": height,
        "resonant_frequency": f_res,
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

fn simulate_patch(freq: f64, wl: f64, width_opt: Option<f64>, length_opt: Option<f64>, er: f64, h: f64) -> Result<serde_json::Value, String> {
    // Use provided dimensions or compute defaults
    let w = width_opt.unwrap_or_else(|| C0 / (2.0 * freq) * (2.0 / (er + 1.0)).sqrt());
    let er_eff = (er + 1.0) / 2.0 + (er - 1.0) / 2.0 * (1.0 + 12.0 * h / w).powf(-0.5);
    let patch_length = length_opt.unwrap_or_else(|| C0 / (2.0 * freq * er_eff.sqrt()));

    // Resonant frequency from FIXED physical length
    let f_res = C0 / (2.0 * patch_length * er_eff.sqrt());

    // Q-factor from cavity model
    let q = C0 / (4.0 * freq * h * er_eff.sqrt());
    let ratio = freq / f_res;
    let detuning = ratio - 1.0 / ratio; // freq/f_res - f_res/freq

    // Impedance: cavity model with Q
    let z_re = 200.0 / (1.0 + q.powi(2) * detuning.powi(2));
    let z_im = z_re * q * detuning;

    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).max(1e-30).log10();

    Ok(json!({
        "antenna_type": "patch",
        "frequency": freq,
        "wavelength": wl,
        "patch_width": w,
        "patch_length": patch_length,
        "substrate_er": er,
        "substrate_height": h,
        "er_effective": er_eff,
        "resonant_frequency": f_res,
        "q_factor": q,
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

fn simulate_qfh(freq: f64, wl: f64, segments: usize, diameter: f64, height: f64, _wire_radius: f64) -> Result<serde_json::Value, String> {
    // QFH resonance from physical height (quarter-turn helix)
    let f_res = C0 / (4.0 * height);
    let ratio = freq / f_res;

    let z_re = 50.0 + 15.0 * (ratio - 1.0).powi(2);
    let z_im = 25.0 * (ratio - 1.0) * ratio;

    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).max(1e-30).log10();

    Ok(json!({
        "antenna_type": "qfh",
        "frequency": freq,
        "wavelength": wl,
        "diameter": diameter,
        "height": height,
        "resonant_frequency": f_res,
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

fn simulate_yagi(freq: f64, wl: f64, segments: usize, driven_length: f64, spacing: f64, _radius: f64) -> Result<serde_json::Value, String> {
    let reflector = driven_length * 1.05;
    let director = driven_length * 0.91;

    // Resonant frequency from FIXED driven element length
    let f_res = C0 / (2.0 * driven_length);
    let ratio = freq / f_res;

    // Yagi driven element has lower impedance due to mutual coupling
    let z_re = 25.0 + 15.0 * (ratio - 1.0).powi(2);
    let z_im = 10.0 * (ratio - 1.0) * ratio;

    let (s11_re, s11_im, vswr) = compute_s11(z_re, z_im, 50.0);
    let s11_db = 10.0 * (s11_re * s11_re + s11_im * s11_im).max(1e-30).log10();

    Ok(json!({
        "antenna_type": "yagi",
        "frequency": freq,
        "wavelength": wl,
        "elements": {
            "driven": driven_length,
            "reflector": reflector,
            "director": director,
            "spacing": spacing
        },
        "resonant_frequency": f_res,
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
