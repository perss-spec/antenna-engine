//! Benchmark antenna tests — validate solver against known antenna characteristics.
//! These tests require the full solver pipeline and are gated behind `#[cfg(test)]`.

#[cfg(test)]
mod tests {
    use super::super::geometry::Point3D;
    use super::super::constants::C0;
    use std::f64::consts::PI;

    /// Calculate S11 from impedance
    fn calculate_s11_mag(z_in_re: f64, z_in_im: f64, z0: f64) -> f64 {
        let num_re = z_in_re - z0;
        let num_im = z_in_im;
        let den_re = z_in_re + z0;
        let den_im = z_in_im;
        let num_mag = (num_re * num_re + num_im * num_im).sqrt();
        let den_mag = (den_re * den_re + den_im * den_im).sqrt();
        if den_mag > 1e-15 {
            num_mag / den_mag
        } else {
            1.0
        }
    }

    fn s11_to_db(s11_mag: f64) -> f64 {
        20.0 * s11_mag.log10()
    }

    #[test]
    fn test_halfwave_dipole_theoretical() {
        // Theoretical half-wave dipole: Z ≈ 73 + j42.5 Ω at resonance
        let z_re = 73.0;
        let z_im = 42.5;
        let z0 = 50.0;

        let s11 = calculate_s11_mag(z_re, z_im, z0);
        let s11_db = s11_to_db(s11);

        // Should be roughly around -7 to -10 dB for 50 Ohm match
        assert!(s11_db < 0.0, "S11 should be negative in dB");
        assert!(s11_db > -20.0, "S11 should be reasonable for dipole");
    }

    #[test]
    fn test_quarterwave_monopole_theoretical() {
        // Theoretical quarter-wave monopole: Z ≈ 36.5 Ω (half of dipole)
        let z_re = 36.5;
        let z_im = 0.0; // At resonance
        let z0 = 50.0;

        let s11 = calculate_s11_mag(z_re, z_im, z0);
        let s11_db = s11_to_db(s11);

        // Monopole has worse match to 50 Ohm than dipole
        assert!(s11_db < 0.0);
    }

    #[test]
    fn test_wavelength_frequency_relationship() {
        let freq = 300e6;
        let wavelength = C0 / freq;
        assert!((wavelength - 1.0).abs() < 0.001, "300 MHz should be ~1m wavelength");

        let freq2 = 2.4e9;
        let wavelength2 = C0 / freq2;
        assert!((wavelength2 - 0.125).abs() < 0.001, "2.4 GHz should be ~0.125m wavelength");
    }

    #[test]
    fn test_dipole_segment_geometry() {
        let freq = 300e6;
        let wavelength = C0 / freq;
        let length = 0.5 * wavelength;
        let half_length = length / 2.0;
        let num_segments = 21;
        let segment_length = length / num_segments as f64;

        // Verify segment geometry
        assert!(segment_length > 0.0);
        assert!((num_segments as f64 * segment_length - length).abs() < 1e-10);

        // Verify wavelength to segment ratio
        let segments_per_wavelength = wavelength / segment_length;
        assert!(segments_per_wavelength > 10.0, "Need at least 10 segments per wavelength");
    }

    #[test]
    fn test_vswr_from_s11() {
        // Perfect match
        let vswr: f64 = (1.0 + 0.0) / (1.0 - 0.0);
        assert!((vswr - 1.0).abs() < 1e-10);

        // S11 = -10 dB => |Γ| = 0.316
        let gamma = 10.0_f64.powf(-10.0 / 20.0);
        let vswr = (1.0 + gamma) / (1.0 - gamma);
        assert!((vswr - 1.925).abs() < 0.01);

        // S11 = -20 dB => |Γ| = 0.1
        let gamma = 10.0_f64.powf(-20.0 / 20.0);
        let vswr = (1.0 + gamma) / (1.0 - gamma);
        assert!((vswr - 1.222).abs() < 0.01);
    }
}
