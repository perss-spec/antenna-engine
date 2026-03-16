import pytest
import numpy as np
from promin.fdtd import FDTDRunner
from promin.mom import MoMRunner
from promin.geometry import Dipole, EmptyBox
from promin.ports import Port
from promin.materials import Air, PML
from promin.mesh import UniformGrid
from promin.sources import PlaneWave, VoltageSource
import logging

logger = logging.getLogger(__name__)

class TestFDTDBenchmark:
    
    def setup_method(self):
        """Setup common test parameters"""
        self.frequency = 300e6  # 300 MHz
        self.wavelength = 3e8 / self.frequency
        self.tolerance = 0.1  # 10% tolerance
        
    def test_fdtd_dipole_impedance(self):
        """Test FDTD dipole impedance at 300 MHz"""
        # Create half-wave dipole
        dipole_length = self.wavelength / 2
        dipole = Dipole(
            center=[0, 0, 0],
            length=dipole_length,
            radius=self.wavelength / 1000,
            orientation='z'
        )
        
        # Create port at dipole center
        port = Port(
            position=[0, 0, 0],
            direction='z',
            impedance=50.0
        )
        
        # Setup FDTD simulation
        grid = UniformGrid(
            bounds=[-self.wavelength, self.wavelength,
                   -self.wavelength, self.wavelength, 
                   -self.wavelength, self.wavelength],
            cell_size=self.wavelength / 20
        )
        
        source = VoltageSource(
            port=port,
            frequency=self.frequency,
            amplitude=1.0
        )
        
        runner = FDTDRunner(
            geometry=[dipole],
            ports=[port],
            sources=[source],
            grid=grid,
            pml_thickness=8,
            time_steps=1000
        )
        
        # Run simulation
        results = runner.run()
        
        # Extract impedance from time-domain V/I
        voltage_td = results.get_port_voltage(port)
        current_td = results.get_port_current(port)
        
        # Convert to frequency domain
        voltage_fd = np.fft.fft(voltage_td)
        current_fd = np.fft.fft(current_td)
        freqs = np.fft.fftfreq(len(voltage_td), runner.dt)
        
        # Find frequency bin closest to target
        freq_idx = np.argmin(np.abs(freqs - self.frequency))
        
        # Calculate input impedance
        z_in = voltage_fd[freq_idx] / current_fd[freq_idx]
        z_in_real = np.real(z_in)
        
        logger.info(f"FDTD dipole impedance: {z_in_real:.1f} Ω")
        
        # Verify against theoretical value (73 Ω ± 10%)
        expected_z = 73.0
        assert abs(z_in_real - expected_z) <= expected_z * self.tolerance, \
            f"Impedance {z_in_real:.1f} Ω outside tolerance of {expected_z} ± {expected_z*self.tolerance:.1f} Ω"
    
    def test_fdtd_vs_mom_s11_comparison(self):
        """Compare S11 between FDTD and MoM solvers"""
        # Create dipole geometry
        dipole = Dipole(
            center=[0, 0, 0],
            length=self.wavelength / 2,
            radius=self.wavelength / 1000,
            orientation='z'
        )
        
        port = Port(
            position=[0, 0, 0],
            direction='z',
            impedance=50.0
        )
        
        # Frequency sweep
        frequencies = np.linspace(250e6, 350e6, 21)
        
        # FDTD simulation
        fdtd_grid = UniformGrid(
            bounds=[-self.wavelength, self.wavelength,
                   -self.wavelength, self.wavelength,
                   -self.wavelength, self.wavelength],
            cell_size=self.wavelength / 15
        )
        
        fdtd_runner = FDTDRunner(
            geometry=[dipole],
            ports=[port],
            grid=fdtd_grid,
            pml_thickness=8
        )
        
        fdtd_results = fdtd_runner.run_frequency_sweep(frequencies)
        fdtd_s11 = [20 * np.log10(abs(s)) for s in fdtd_results.get_s_parameters()[0, 0, :]]
        
        # MoM simulation
        mom_runner = MoMRunner(
            geometry=[dipole],
            ports=[port]
        )
        
        mom_results = mom_runner.run_frequency_sweep(frequencies)
        mom_s11 = [20 * np.log10(abs(s)) for s in mom_results.get_s_parameters()[0, 0, :]]
        
        # Compare S11 values
        max_deviation = max(abs(f - m) for f, m in zip(fdtd_s11, mom_s11))
        logger.info(f"Max S11 deviation: {max_deviation:.2f} dB")
        
        assert max_deviation < 3.0, f"S11 deviation {max_deviation:.2f} dB exceeds 3 dB limit"
        
        # Check resonant frequency agreement
        fdtd_min_idx = np.argmin(fdtd_s11)
        mom_min_idx = np.argmin(mom_s11)
        
        fdtd_resonant = frequencies[fdtd_min_idx]
        mom_resonant = frequencies[mom_min_idx]
        
        freq_error = abs(fdtd_resonant - mom_resonant) / mom_resonant
        logger.info(f"Resonant frequency error: {freq_error*100:.1f}%")
        
        assert freq_error < 0.02, f"Resonant frequency error {freq_error*100:.1f}% exceeds 2%"
    
    def test_pml_absorption(self):
        """Test PML boundary absorption performance"""
        # Create empty box with PML boundaries
        box_size = 2 * self.wavelength
        
        geometry = EmptyBox(
            bounds=[-box_size/2, box_size/2,
                   -box_size/2, box_size/2,
                   -box_size/2, box_size/2]
        )
        
        grid = UniformGrid(
            bounds=[-box_size/2, box_size/2,
                   -box_size/2, box_size/2,
                   -box_size/2, box_size/2],
            cell_size=self.wavelength / 20
        )
        
        # Create plane wave source
        source = PlaneWave(
            frequency=self.frequency,
            direction=[1, 0, 0],  # propagating in +x direction
            polarization=[0, 1, 0],  # y-polarized
            amplitude=1.0,
            position=[-box_size/4, 0, 0]
        )
        
        runner = FDTDRunner(
            geometry=[geometry],
            sources=[source],
            grid=grid,
            pml_thickness=8,
            time_steps=2000
        )
        
        results = runner.run()
        
        # Measure incident and reflected power
        # Place monitors at source plane and before PML
        incident_monitor = results.get_field_monitor(position=[-box_size/4, 0, 0])
        reflected_monitor = results.get_field_monitor(position=[box_size/4 - grid.cell_size*10, 0, 0])
        
        # Calculate power from Poynting vector
        incident_power = np.mean(incident_monitor.poynting_power())
        reflected_power = np.mean(reflected_monitor.poynting_power())
        
        # Calculate reflection in dB
        reflection_db = 10 * np.log10(abs(reflected_power) / incident_power)
        
        logger.info(f"PML reflection: {reflection_db:.1f} dB")
        
        assert reflection_db < -40.0, f"PML reflection {reflection_db:.1f} dB exceeds -40 dB requirement"
    
    @pytest.mark.parametrize("resolution", [10, 15, 20])
    def test_grid_convergence(self, resolution):
        """Test grid convergence for different resolutions"""
        # Create simple dipole
        dipole = Dipole(
            center=[0, 0, 0],
            length=self.wavelength / 2,
            radius=self.wavelength / 1000,
            orientation='z'
        )
        
        port = Port(
            position=[0, 0, 0],
            direction='z',
            impedance=50.0
        )
        
        # Grid with specified resolution
        cell_size = self.wavelength / resolution
        grid = UniformGrid(
            bounds=[-self.wavelength, self.wavelength,
                   -self.wavelength, self.wavelength,
                   -self.wavelength, self.wavelength],
            cell_size=cell_size
        )
        
        source = VoltageSource(
            port=port,
            frequency=self.frequency,
            amplitude=1.0
        )
        
        runner = FDTDRunner(
            geometry=[dipole],
            ports=[port],
            sources=[source],
            grid=grid,
            pml_thickness=8,
            time_steps=1000
        )
        
        results = runner.run()
        
        # Extract impedance
        voltage_td = results.get_port_voltage(port)
        current_td = results.get_port_current(port)
        
        voltage_fd = np.fft.fft(voltage_td)
        current_fd = np.fft.fft(current_td)
        freqs = np.fft.fftfreq(len(voltage_td), runner.dt)
        
        freq_idx = np.argmin(np.abs(freqs - self.frequency))
        z_in = voltage_fd[freq_idx] / current_fd[freq_idx]
        z_in_real = np.real(z_in)
        
        # Store result for comparison
        setattr(self, f'z_in_{resolution}', z_in_real)
        
        logger.info(f"Impedance at λ/{resolution}: {z_in_real:.1f} Ω")
        
        # Basic sanity check - impedance should be reasonable
        assert 50 < z_in_real < 100, f"Impedance {z_in_real:.1f} Ω outside reasonable range"
    
    def test_convergence_trend(self):
        """Verify that results converge with increasing resolution"""
        # This test runs after the parametrized tests
        # Check that impedance values are converging
        
        z_coarse = getattr(self, 'z_in_10', None)
        z_medium = getattr(self, 'z_in_15', None) 
        z_fine = getattr(self, 'z_in_20', None)
        
        if all(z is not None for z in [z_coarse, z_medium, z_fine]):
            # Check that fine-medium difference < medium-coarse difference
            diff_coarse_medium = abs(z_medium - z_coarse)
            diff_medium_fine = abs(z_fine - z_medium)
            
            logger.info(f"Convergence: coarse-medium {diff_coarse_medium:.1f} Ω, "
                       f"medium-fine {diff_medium_fine:.1f} Ω")
            
            # Results should be converging (differences getting smaller)
            assert diff_medium_fine <= diff_coarse_medium, \
                "Results not converging with increased resolution"
            
            # Fine and medium results should be close (< 5% difference)
            relative_error = diff_medium_fine / z_fine
            assert relative_error < 0.05, \
                f"Fine/medium results differ by {relative_error*100:.1f}% (>5%)"