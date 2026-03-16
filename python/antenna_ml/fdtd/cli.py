#!/usr/bin/env python3
"""
CLI interface for FDTD antenna simulation.
Reads JSON input from stdin, runs FDTD simulation, outputs JSON results to stdout.
"""

import json
import sys
import numpy as np
from typing import Dict, List, Tuple, Any
import logging

from .fdtd_solver import FDTDSolver
from .antenna_builder import AntennaBuilder
from .boundary_conditions import PMLBoundary

# Configure logging to stderr so it doesn't interfere with JSON output
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)

class FDTDCLIRunner:
    """Command-line interface for FDTD antenna simulation."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def parse_input(self) -> Dict[str, Any]:
        """Parse JSON input from stdin."""
        try:
            input_data = json.load(sys.stdin)
            return input_data
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON input: {e}")
            raise ValueError(f"Invalid JSON input: {e}")
    
    def create_antenna(self, geometry: Dict[str, Any]) -> Any:
        """Create antenna geometry from input parameters."""
        antenna_type = geometry.get('antenna_type', 'dipole')
        dimensions = geometry.get('dimensions', {})
        substrate = geometry.get('substrate')
        
        builder = AntennaBuilder()
        
        if antenna_type == 'dipole':
            length = dimensions.get('length', 0.06)
            radius = dimensions.get('radius', 0.001)
            antenna = builder.create_dipole(length, radius)
            
        elif antenna_type == 'patch':
            width = dimensions.get('width', 0.03)
            height = dimensions.get('height', 0.02)
            
            if substrate:
                epsilon_r = substrate.get('epsilon_r', 4.4)
                thickness = substrate.get('thickness', 0.0016)
                loss_tangent = substrate.get('loss_tangent', 0.02)
                antenna = builder.create_patch(width, height, epsilon_r, thickness, loss_tangent)
            else:
                antenna = builder.create_patch(width, height)
                
        elif antenna_type == 'loop':
            radius = dimensions.get('radius', 0.02)
            wire_radius = dimensions.get('wire_radius', 0.001)
            antenna = builder.create_loop(radius, wire_radius)
            
        else:
            raise ValueError(f"Unsupported antenna type: {antenna_type}")
        
        return antenna
    
    def setup_simulation(self, antenna: Any, sim_params: Dict[str, Any], freq_params: Dict[str, Any]) -> FDTDSolver:
        """Set up FDTD simulation parameters."""
        grid_resolution = sim_params.get('grid_resolution', 0.001)
        boundary_type = sim_params.get('boundary_conditions', 'PML')
        time_steps = sim_params.get('time_steps', 1000)
        convergence_threshold = sim_params.get('convergence_threshold', 1e-6)
        
        # Calculate domain size based on antenna and wavelength
        center_freq = freq_params.get('center', 2.4e9)
        wavelength = 3e8 / center_freq
        domain_size = [wavelength * 2, wavelength * 2, wavelength * 2]
        
        # Create FDTD solver
        solver = FDTDSolver(
            domain_size=domain_size,
            grid_resolution=grid_resolution,
            time_steps=time_steps
        )
        
        # Add antenna to solver
        solver.add_antenna(antenna)
        
        # Set boundary conditions
        if boundary_type.upper() == 'PML':
            pml_thickness = int(10 / grid_resolution)  # 10 cells thick
            boundary = PMLBoundary(thickness=pml_thickness)
            solver.set_boundary_conditions(boundary)
        
        # Set convergence criteria
        solver.set_convergence_threshold(convergence_threshold)
        
        return solver
    
    def run_simulation(self, solver: FDTDSolver, freq_params: Dict[str, Any]) -> Dict[str, Any]:
        """Run FDTD simulation and collect results."""
        center_freq = freq_params.get('center', 2.4e9)
        bandwidth = freq_params.get('bandwidth', center_freq * 0.2)
        freq_points = freq_params.get('points', 101)
        
        # Create frequency array
        freq_min = center_freq - bandwidth / 2
        freq_max = center_freq + bandwidth / 2
        frequencies = np.linspace(freq_min, freq_max, freq_points)
        
        # Run simulation
        self.logger.info("Starting FDTD simulation...")
        results = solver.solve(frequencies)
        
        # Extract results
        z_in = results.get('impedance', [])
        s11 = results.get('s_parameters', {}).get('S11', [])
        
        # Calculate radiation pattern
        theta_range = np.linspace(0, np.pi, 91)  # 0 to 180 degrees
        phi_range = np.linspace(0, 2*np.pi, 181)  # 0 to 360 degrees
        
        pattern_data = solver.calculate_radiation_pattern(
            theta_range, phi_range, center_freq
        )
        
        # Format complex numbers for JSON serialization
        def format_complex(z_array):
            return [{"real": float(z.real), "imag": float(z.imag)} for z in z_array]
        
        # Prepare output
        output = {
            "z_in": format_complex(z_in),
            "s11": format_complex(s11),
            "pattern": {
                "theta": theta_range.tolist(),
                "phi": phi_range.tolist(),
                "e_theta": format_complex(pattern_data.get('E_theta', [])),
                "e_phi": format_complex(pattern_data.get('E_phi', [])),
                "gain": pattern_data.get('gain', []).tolist()
            },
            "convergence_info": {
                "converged": results.get('converged', True),
                "iterations": int(results.get('iterations', 0)),
                "final_error": float(results.get('final_error', 0.0)),
                "computation_time": float(results.get('computation_time', 0.0))
            }
        }
        
        return output
    
    def run(self):
        """Main CLI execution function."""
        try:
            # Parse input
            input_data = self.parse_input()
            
            # Extract sections
            geometry = input_data.get('geometry', {})
            simulation = input_data.get('simulation', {})
            frequency = input_data.get('frequency', {})
            
            # Create antenna
            antenna = self.create_antenna(geometry)
            
            # Setup simulation
            solver = self.setup_simulation(antenna, simulation, frequency)
            
            # Run simulation
            results = self.run_simulation(solver, frequency)
            
            # Output results as JSON
            json.dump(results, sys.stdout, indent=2)
            
        except Exception as e:
            self.logger.error(f"Simulation failed: {e}")
            error_output = {
                "error": str(e),
                "z_in": [],
                "s11": [],
                "pattern": {
                    "theta": [],
                    "phi": [],
                    "e_theta": [],
                    "e_phi": [],
                    "gain": []
                },
                "convergence_info": {
                    "converged": False,
                    "iterations": 0,
                    "final_error": float('inf'),
                    "computation_time": 0.0
                }
            }
            json.dump(error_output, sys.stdout, indent=2)
            sys.exit(1)

def main():
    """Entry point for CLI."""
    runner = FDTDCLIRunner()
    runner.run()

if __name__ == "__main__":
    main()