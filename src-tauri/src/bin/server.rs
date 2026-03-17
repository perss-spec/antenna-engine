use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use antenna_engine_lib::core::geometry::Point3D;
use antenna_engine_lib::core::solver::{MomSolver, PortDef, SolverSimParams, WireDef};

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

struct AppState {
    jobs: RwLock<HashMap<String, JobStatus>>,
}

#[derive(Clone, Serialize, Deserialize)]
struct JobStatus {
    id: String,
    status: String,
    progress: f64,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SolveRequest {
    antenna_type: String,
    frequency: f64,
    #[serde(default)]
    parameters: HashMap<String, f64>,
}

#[derive(Serialize)]
struct SolveResponse {
    impedance_real: f64,
    impedance_imag: f64,
    s11_db: f64,
    vswr: f64,
}

#[derive(Deserialize)]
struct SweepRequest {
    antenna_type: String,
    freq_start: f64,
    freq_stop: f64,
    freq_points: usize,
    #[serde(default)]
    parameters: HashMap<String, f64>,
}

#[derive(Serialize)]
struct SweepResponse {
    frequencies: Vec<f64>,
    s11_db: Vec<f64>,
    s11_real: Vec<f64>,
    s11_imag: Vec<f64>,
    impedance_real: Vec<f64>,
    impedance_imag: Vec<f64>,
    resonant_frequency: f64,
    min_s11: f64,
    bandwidth: f64,
}

#[derive(Deserialize)]
struct PatternRequest {
    antenna_type: String,
    frequency: f64,
    #[serde(default = "default_theta")]
    theta_points: usize,
    #[serde(default = "default_phi")]
    phi_points: usize,
}

fn default_theta() -> usize { 37 }
fn default_phi() -> usize { 73 }

#[derive(Serialize)]
struct PatternResponse {
    pattern: Vec<Vec<f64>>,
    max_gain: f64,
    theta_points: usize,
    phi_points: usize,
}

#[derive(Deserialize)]
struct MomRequest {
    antenna_type: String,
    frequency: f64,
    #[serde(default = "default_segments")]
    segments: usize,
    #[serde(default)]
    parameters: HashMap<String, f64>,
}

fn default_segments() -> usize { 21 }

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "cores": rayon::current_num_threads(),
    }))
}

async fn solve_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SolveRequest>,
) -> impl IntoResponse {
    let (tx, rx) = tokio::sync::oneshot::channel();
    rayon::spawn(move || {
        let _ = tx.send(compute_solve(&req));
    });
    match rx.await {
        Ok(Ok(resp)) => (StatusCode::OK, Json(serde_json::to_value(resp).unwrap())).into_response(),
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "computation cancelled"})),
        )
            .into_response(),
    }
}

async fn sweep_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SweepRequest>,
) -> impl IntoResponse {
    let (tx, rx) = tokio::sync::oneshot::channel();
    rayon::spawn(move || {
        let _ = tx.send(compute_sweep(&req));
    });
    match rx.await {
        Ok(Ok(resp)) => (StatusCode::OK, Json(serde_json::to_value(resp).unwrap())).into_response(),
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "computation cancelled"})),
        )
            .into_response(),
    }
}

async fn pattern_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<PatternRequest>,
) -> impl IntoResponse {
    let (tx, rx) = tokio::sync::oneshot::channel();
    rayon::spawn(move || {
        let _ = tx.send(compute_pattern(&req));
    });
    match rx.await {
        Ok(Ok(resp)) => (StatusCode::OK, Json(serde_json::to_value(resp).unwrap())).into_response(),
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "computation cancelled"})),
        )
            .into_response(),
    }
}

async fn submit_mom_job(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MomRequest>,
) -> impl IntoResponse {
    let job_id = Uuid::new_v4().to_string();
    let job = JobStatus {
        id: job_id.clone(),
        status: "queued".to_string(),
        progress: 0.0,
        result: None,
        error: None,
    };

    state.jobs.write().await.insert(job_id.clone(), job);

    let state_clone = state.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        if let Some(job) = state_clone.jobs.write().await.get_mut(&job_id_clone) {
            job.status = "running".to_string();
        }

        let (tx, rx) = tokio::sync::oneshot::channel();
        rayon::spawn(move || {
            let _ = tx.send(compute_mom(&req));
        });

        match rx.await {
            Ok(Ok(result)) => {
                if let Some(job) = state_clone.jobs.write().await.get_mut(&job_id_clone) {
                    job.status = "completed".to_string();
                    job.progress = 100.0;
                    job.result = Some(result);
                }
            }
            Ok(Err(e)) => {
                if let Some(job) = state_clone.jobs.write().await.get_mut(&job_id_clone) {
                    job.status = "failed".to_string();
                    job.error = Some(e);
                }
            }
            Err(_) => {
                if let Some(job) = state_clone.jobs.write().await.get_mut(&job_id_clone) {
                    job.status = "failed".to_string();
                    job.error = Some("computation cancelled".to_string());
                }
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(serde_json::json!({"job_id": job_id})),
    )
}

async fn get_job_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> impl IntoResponse {
    let jobs = state.jobs.read().await;
    match jobs.get(&job_id) {
        Some(job) => (StatusCode::OK, Json(serde_json::to_value(job).unwrap())).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "job not found"})),
        )
            .into_response(),
    }
}

// ---------------------------------------------------------------------------
// Analytical compute helpers (mirrors bridge.rs without tauri dependency)
// ---------------------------------------------------------------------------

const C0: f64 = 299_792_458.0;

fn reflection_coefficient(z_re: f64, z_im: f64, z0: f64) -> (f64, f64, f64) {
    let den_re = z_re + z0;
    let den_im = z_im;
    let den_mag2 = den_re * den_re + den_im * den_im;
    if den_mag2 < 1e-30 {
        return (1.0, 0.0, 0.0);
    }
    let num_re = z_re - z0;
    let num_im = z_im;
    let s11_re = (num_re * den_re + num_im * den_im) / den_mag2;
    let s11_im = (num_im * den_re - num_re * den_im) / den_mag2;
    let s11_mag2 = s11_re * s11_re + s11_im * s11_im;
    let s11_db = 10.0 * s11_mag2.max(1e-30).log10();
    (s11_re, s11_im, s11_db)
}

fn vswr_from_gamma(s11_re: f64, s11_im: f64) -> f64 {
    let mag = (s11_re * s11_re + s11_im * s11_im).sqrt().min(0.9999);
    (1.0 + mag) / (1.0 - mag)
}

fn analytical_impedance(
    antenna_type: &str,
    frequency: f64,
    params: &HashMap<String, f64>,
) -> (f64, f64) {
    let lambda = C0 / frequency;

    match antenna_type {
        "dipole" | "half_wave_dipole" => {
            let length = params.get("length_m").copied().unwrap_or(lambda / 2.0);
            let f_res = C0 / (2.0 * length);
            let ratio = frequency / f_res;
            let z_re = 73.0 + 40.0 * (ratio - 1.0).powi(2);
            let z_im = 42.5 * (ratio - 1.0) * ratio;
            (z_re.max(1.0), z_im)
        }
        "monopole" | "quarter_wave_monopole" => {
            let height = params.get("height_m").or(params.get("length_m")).copied().unwrap_or(lambda / 4.0);
            let f_res = C0 / (4.0 * height);
            let ratio = frequency / f_res;
            let z_re = 36.5 + 20.0 * (ratio - 1.0).powi(2);
            let z_im = 21.25 * (ratio - 1.0) * ratio;
            (z_re.max(1.0), z_im)
        }
        "patch" | "rectangular_patch" => {
            let er = params.get("substrate_er").or(params.get("epsilon_r")).copied().unwrap_or(4.4);
            let h = params.get("substrate_height_m").or(params.get("substrate_h_m")).copied().unwrap_or(0.0016);
            let w = params.get("width_m").copied().unwrap_or_else(|| {
                C0 / (2.0 * frequency) * (2.0 / (er + 1.0)).sqrt()
            });
            let er_eff = (er + 1.0) / 2.0 + (er - 1.0) / 2.0 * (1.0 + 12.0 * h / w).powf(-0.5);
            let patch_l = params.get("length_m").copied().unwrap_or_else(|| {
                C0 / (2.0 * frequency * er_eff.sqrt())
            });
            let f_res = C0 / (2.0 * patch_l * er_eff.sqrt());
            let q = C0 / (4.0 * frequency * h * er_eff.sqrt());
            let detuning = frequency / f_res - f_res / frequency;
            let z_re = 200.0 / (1.0 + q.powi(2) * detuning.powi(2));
            let z_im = z_re * q * detuning;
            (z_re.max(5.0).min(500.0), z_im)
        }
        "qfh" => {
            let height = params.get("height_m").copied().unwrap_or(lambda * 0.26);
            let f_res = C0 / (4.0 * height);
            let ratio = frequency / f_res;
            let z_re = 50.0 + 15.0 * (ratio - 1.0).powi(2);
            let z_im = 25.0 * (ratio - 1.0) * ratio;
            (z_re.max(1.0), z_im)
        }
        "yagi" => {
            let driven_length = params.get("length_m").copied().unwrap_or(lambda / 2.0);
            let f_res = C0 / (2.0 * driven_length);
            let ratio = frequency / f_res;
            let z_re = 25.0 + 15.0 * (ratio - 1.0).powi(2);
            let z_im = 10.0 * (ratio - 1.0) * ratio;
            (z_re.max(1.0), z_im)
        }
        _ => (50.0, 10.0 * (frequency / 1e9 - 1.0)),
    }
}

fn compute_solve(req: &SolveRequest) -> Result<SolveResponse, String> {
    if req.frequency <= 0.0 {
        return Err("Frequency must be positive".into());
    }
    let (z_re, z_im) = analytical_impedance(&req.antenna_type, req.frequency, &req.parameters);
    let (s11_re, s11_im, s11_db) = reflection_coefficient(z_re, z_im, 50.0);
    let vswr = vswr_from_gamma(s11_re, s11_im);
    Ok(SolveResponse {
        impedance_real: z_re,
        impedance_imag: z_im,
        s11_db,
        vswr,
    })
}

fn compute_sweep(req: &SweepRequest) -> Result<SweepResponse, String> {
    if req.freq_start <= 0.0 || req.freq_stop <= req.freq_start {
        return Err("Invalid frequency range".into());
    }
    let n = req.freq_points.max(2).min(10001);

    let mut frequencies = Vec::with_capacity(n);
    let mut s11_db_vec = Vec::with_capacity(n);
    let mut s11_re_vec = Vec::with_capacity(n);
    let mut s11_im_vec = Vec::with_capacity(n);
    let mut z_re_vec = Vec::with_capacity(n);
    let mut z_im_vec = Vec::with_capacity(n);

    let mut min_s11 = 0.0f64;
    let mut res_freq = req.freq_start;

    for i in 0..n {
        let f = req.freq_start + (req.freq_stop - req.freq_start) * (i as f64) / ((n - 1) as f64);
        frequencies.push(f);

        let (z_re, z_im) = analytical_impedance(&req.antenna_type, f, &req.parameters);
        let (s_re, s_im, s_db) = reflection_coefficient(z_re, z_im, 50.0);

        s11_db_vec.push(s_db);
        s11_re_vec.push(s_re);
        s11_im_vec.push(s_im);
        z_re_vec.push(z_re);
        z_im_vec.push(z_im);

        if s_db < min_s11 {
            min_s11 = s_db;
            res_freq = f;
        }
    }

    // -10 dB bandwidth
    let mut bw_start = req.freq_start;
    let mut bw_stop = req.freq_start;
    for i in 0..n {
        if s11_db_vec[i] < -10.0 {
            bw_start = frequencies[i];
            break;
        }
    }
    for i in (0..n).rev() {
        if s11_db_vec[i] < -10.0 {
            bw_stop = frequencies[i];
            break;
        }
    }
    let bandwidth = if bw_stop > bw_start { bw_stop - bw_start } else { 0.0 };

    Ok(SweepResponse {
        frequencies,
        s11_db: s11_db_vec,
        s11_real: s11_re_vec,
        s11_imag: s11_im_vec,
        impedance_real: z_re_vec,
        impedance_imag: z_im_vec,
        resonant_frequency: res_freq,
        min_s11,
        bandwidth,
    })
}

fn compute_pattern(req: &PatternRequest) -> Result<PatternResponse, String> {
    if req.frequency <= 0.0 {
        return Err("Frequency must be positive".into());
    }
    let wl = C0 / req.frequency;
    let n_theta = req.theta_points.max(2).min(361);
    let n_phi = req.phi_points.max(2).min(361);

    let mut pattern = Vec::with_capacity(n_theta);
    let mut max_gain: f64 = -999.0;

    for it in 0..n_theta {
        let theta = std::f64::consts::PI * (it as f64) / ((n_theta - 1) as f64);
        let mut row = Vec::with_capacity(n_phi);
        for ip in 0..n_phi {
            let phi = 2.0 * std::f64::consts::PI * (ip as f64) / ((n_phi - 1) as f64);
            let gain = match req.antenna_type.as_str() {
                "dipole" | "half_wave_dipole" => {
                    let st = theta.sin();
                    if st.abs() < 1e-6 {
                        -40.0
                    } else {
                        let f_theta =
                            ((std::f64::consts::FRAC_PI_2 * theta.cos()).cos()) / st;
                        2.15 + 20.0 * f_theta.abs().max(1e-10).log10()
                    }
                }
                "monopole" | "quarter_wave_monopole" => {
                    let st = theta.sin();
                    if st.abs() < 1e-6 || theta > std::f64::consts::FRAC_PI_2 {
                        -40.0
                    } else {
                        let f_theta =
                            ((std::f64::consts::FRAC_PI_2 * theta.cos()).cos()) / st;
                        5.15 + 20.0 * f_theta.abs().max(1e-10).log10()
                    }
                }
                "patch" | "rectangular_patch" => {
                    let g = theta.cos().powi(2);
                    6.0 + 10.0 * g.max(1e-10).log10()
                }
                "qfh" => {
                    let cos_t = theta.cos();
                    let g_co = ((1.0 + cos_t) / 2.0).powi(2);
                    let g_cross = ((1.0 - cos_t) / 2.0).powi(2) * 0.05;
                    let g_total = g_co + g_cross;
                    3.0 + 10.0 * g_total.max(1e-10).log10()
                }
                "yagi" => {
                    let cos_t = theta.cos();
                    let d = 0.25 * wl;
                    let k = 2.0 * std::f64::consts::PI / wl;
                    let psi = k * d * cos_t;
                    let af_re = 1.0 + (psi - 0.2).cos() + (2.0 * psi + 0.15).cos();
                    let af_im = (psi - 0.2).sin() + (2.0 * psi + 0.15).sin();
                    let af_mag = (af_re * af_re + af_im * af_im).sqrt() / 3.0;
                    let st = theta.sin();
                    let ef = if st.abs() < 1e-6 {
                        0.0
                    } else {
                        ((std::f64::consts::FRAC_PI_2 * cos_t).cos()) / st
                    };
                    let g_total = (af_mag * ef).powi(2);
                    let phi_factor = phi.cos().powi(2) + 0.3 * phi.sin().powi(2);
                    7.1 + 10.0 * (g_total * phi_factor).max(1e-10).log10()
                }
                _ => -40.0,
            };
            if gain > max_gain {
                max_gain = gain;
            }
            row.push(gain);
        }
        pattern.push(row);
    }

    Ok(PatternResponse {
        pattern,
        max_gain,
        theta_points: n_theta,
        phi_points: n_phi,
    })
}

fn compute_mom(req: &MomRequest) -> Result<serde_json::Value, String> {
    let lambda = C0 / req.frequency;

    // Build wire geometry based on antenna type
    let (wires, port_location) = match req.antenna_type.as_str() {
        "dipole" | "half_wave_dipole" => {
            let length = req.parameters.get("length_m").copied().unwrap_or(lambda / 2.0);
            let radius = req.parameters.get("radius_m").copied().unwrap_or(0.001);
            let wires = vec![WireDef {
                start: Point3D::new(0.0, 0.0, -length / 2.0),
                end: Point3D::new(0.0, 0.0, length / 2.0),
                radius,
                id: "driven".to_string(),
            }];
            (wires, Point3D::new(0.0, 0.0, 0.0))
        }
        "monopole" | "quarter_wave_monopole" => {
            let height = req.parameters.get("height_m").or(req.parameters.get("length_m")).copied().unwrap_or(lambda / 4.0);
            let radius = req.parameters.get("radius_m").copied().unwrap_or(0.001);
            let wires = vec![WireDef {
                start: Point3D::new(0.0, 0.0, 0.0),
                end: Point3D::new(0.0, 0.0, height),
                radius,
                id: "monopole".to_string(),
            }];
            (wires, Point3D::new(0.0, 0.0, 0.0))
        }
        "yagi" => {
            let driven_length = req.parameters.get("length_m").copied().unwrap_or(lambda / 2.0);
            let spacing = req.parameters.get("spacing_m").copied().unwrap_or(lambda * 0.25);
            let radius = req.parameters.get("radius_m").copied().unwrap_or(0.003);
            let reflector = driven_length * 1.05;
            let director = driven_length * 0.91;
            let wires = vec![
                WireDef {
                    start: Point3D::new(-spacing, 0.0, -reflector / 2.0),
                    end: Point3D::new(-spacing, 0.0, reflector / 2.0),
                    radius,
                    id: "reflector".to_string(),
                },
                WireDef {
                    start: Point3D::new(0.0, 0.0, -driven_length / 2.0),
                    end: Point3D::new(0.0, 0.0, driven_length / 2.0),
                    radius,
                    id: "driven".to_string(),
                },
                WireDef {
                    start: Point3D::new(spacing, 0.0, -director / 2.0),
                    end: Point3D::new(spacing, 0.0, director / 2.0),
                    radius,
                    id: "director".to_string(),
                },
            ];
            (wires, Point3D::new(0.0, 0.0, 0.0))
        }
        _ => {
            // Fallback: single wire dipole
            let length = req.parameters.get("length_m").copied().unwrap_or(lambda / 2.0);
            let wires = vec![WireDef {
                start: Point3D::new(0.0, 0.0, -length / 2.0),
                end: Point3D::new(0.0, 0.0, length / 2.0),
                radius: 0.001,
                id: "wire".to_string(),
            }];
            (wires, Point3D::new(0.0, 0.0, 0.0))
        }
    };

    let mut solver = MomSolver::new();
    solver.set_wires(wires);
    solver.set_ports(vec![PortDef {
        location: port_location,
    }]);
    solver.set_params(SolverSimParams {
        frequency_start: req.frequency,
        frequency_stop: req.frequency,
        frequency_steps: 1,
        reference_impedance: 50.0,
    });

    match solver.run_simulation() {
        Ok(results) => {
            if let Some(r) = results.first() {
                Ok(serde_json::json!({
                    "method": "mom",
                    "segments": req.segments,
                    "impedance_real": r.impedance_re,
                    "impedance_imag": r.impedance_im,
                    "s11_db": r.s_parameters.s11_magnitude_db,
                    "s11_phase_deg": r.s_parameters.s11_phase_deg,
                    "vswr": r.vswr,
                    "radiation_pattern": {
                        "max_gain_dbi": r.radiation_pattern.max_gain_dbi,
                        "theta_deg": r.radiation_pattern.theta_deg,
                        "phi_deg": r.radiation_pattern.phi_deg,
                    }
                }))
            } else {
                Err("MoM solver returned no results".into())
            }
        }
        Err(e) => {
            // Fallback to analytical
            let solve_req = SolveRequest {
                antenna_type: req.antenna_type.clone(),
                frequency: req.frequency,
                parameters: req.parameters.clone(),
            };
            let analytical = compute_solve(&solve_req)?;
            Ok(serde_json::json!({
                "method": "mom_fallback_analytical",
                "segments": req.segments,
                "impedance_real": analytical.impedance_real,
                "impedance_imag": analytical.impedance_imag,
                "s11_db": analytical.s11_db,
                "vswr": analytical.vswr,
                "mom_error": e,
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "promin_server=info,tower_http=info".into()),
        )
        .init();

    let state = Arc::new(AppState {
        jobs: RwLock::new(HashMap::new()),
    });

    let cors = CorsLayer::very_permissive();

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/solve", post(solve_handler))
        .route("/api/sweep", post(sweep_handler))
        .route("/api/pattern", post(pattern_handler))
        .route("/api/jobs/mom", post(submit_mom_job))
        .route("/api/jobs/{id}", get(get_job_status))
        .layer(cors)
        .with_state(state);

    let addr = std::env::var("PROMIN_ADDR").unwrap_or_else(|_| "0.0.0.0:3001".to_string());
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    tracing::info!("PROMIN Solver API listening on {}", addr);
    tracing::info!("Rayon thread pool: {} threads", rayon::current_num_threads());

    axum::serve(listener, app).await.unwrap();
}
