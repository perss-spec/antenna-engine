//! Reference antenna data from Balanis "Antenna Theory" and Pozar "Microwave Engineering"

/// Reference impedance values for standard antennas at resonance
pub struct ReferenceAntenna {
    pub name: &'static str,
    pub z_real: f64,      // Ω
    pub z_imag: f64,      // Ω
    pub z_tolerance: f64,  // ±Ω
    pub directivity_dbi: f64,
    pub source: &'static str,
}

pub const HALF_WAVE_DIPOLE: ReferenceAntenna = ReferenceAntenna {
    name: "Half-wave dipole",
    z_real: 73.0,
    z_imag: 42.5,
    z_tolerance: 5.0,
    directivity_dbi: 2.15,
    source: "Balanis Table 4.3",
};

pub const QUARTER_WAVE_MONOPOLE: ReferenceAntenna = ReferenceAntenna {
    name: "Quarter-wave monopole",
    z_real: 36.5,
    z_imag: 21.25,
    z_tolerance: 3.0,
    directivity_dbi: 5.15,
    source: "Balanis Table 4.4",
};

pub const RECTANGULAR_PATCH_2400: ReferenceAntenna = ReferenceAntenna {
    name: "Rectangular patch (2.4 GHz, FR4)",
    z_real: 150.0,  // Edge impedance
    z_imag: 0.0,
    z_tolerance: 50.0,
    directivity_dbi: 6.0,
    source: "Pozar Ch. 14",
};

pub const FOLDED_DIPOLE: ReferenceAntenna = ReferenceAntenna {
    name: "Folded dipole",
    z_real: 292.0,  // 4 × 73
    z_imag: 0.0,
    z_tolerance: 20.0,
    directivity_dbi: 2.15,
    source: "Balanis Sec. 9.4",
};

pub const SHORT_DIPOLE: ReferenceAntenna = ReferenceAntenna {
    name: "Short dipole (L << λ)",
    z_real: 20.0,
    z_imag: -200.0,
    z_tolerance: 10.0,
    directivity_dbi: 1.76,
    source: "Balanis Sec. 4.2",
};
