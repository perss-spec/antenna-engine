import numpy as np
from typing import Tuple, Optional, Dict, Any
import warnings

class YeeGrid:
    """3D Yee grid for FDTD simulation with staggered E and H fields."""
    
    def __init__(
        self,
        nx: int,
        ny: int,
        nz: int,
        dx: float,
        dy: float,
        dz: float,
        dt: Optional[float] = None,
        courant_factor: float = 0.95
    ):
        """
        Initialize Yee grid.
        
        Args:
            nx, ny, nz: Number of cells in each dimension
            dx, dy, dz: Cell size in each dimension (meters)
            dt: Time step (auto-calculated if None)
            courant_factor: Safety factor for Courant condition (< 1.0)
        """
        self.nx, self.ny, self.nz = nx, ny, nz
        self.dx, self.dy, self.dz = dx, dy, dz
        
        # Physical constants
        self.c0 = 299792458.0  # Speed of light in vacuum (m/s)
        self.eps0 = 8.854187817e-12  # Permittivity of free space (F/m)
        self.mu0 = 4 * np.pi * 1e-7  # Permeability of free space (H/m)
        self.eta0 = np.sqrt(self.mu0 / self.eps0)  # Free space impedance
        
        # Calculate stable time step using Courant condition
        if dt is None:
            self.dt = self._calculate_dt(courant_factor)
        else:
            self.dt = dt
            # Check stability
            dt_max = self._calculate_dt(1.0)
            if self.dt > dt_max:
                warnings.warn(f"Time step {dt} exceeds Courant limit {dt_max}")
        
        # Initialize field arrays
        # E-field components are on edges
        self.Ex = np.zeros((nx, ny+1, nz+1))
        self.Ey = np.zeros((nx+1, ny, nz+1))
        self.Ez = np.zeros((nx+1, ny+1, nz))
        
        # H-field components are on faces
        self.Hx = np.zeros((nx+1, ny, nz))
        self.Hy = np.zeros((nx, ny+1, nz))
        self.Hz = np.zeros((nx, ny, nz+1))
        
        # Material arrays (at cell centers)
        self.epsilon_r = np.ones((nx, ny, nz))
        self.mu_r = np.ones((nx, ny, nz))
        self.sigma = np.zeros((nx, ny, nz))  # Conductivity (S/m)
        
        # Update coefficients (will be computed after materials are set)
        self.cEx = None
        self.cEy = None
        self.cEz = None
        self.cHx = None
        self.cHy = None
        self.cHz = None
        
        # Time step counter
        self.time_step = 0
        
    def _calculate_dt(self, courant_factor: float) -> float:
        """Calculate stable time step using Courant-Friedrichs-Lewy condition."""
        return courant_factor / (self.c0 * np.sqrt(
            1/self.dx**2 + 1/self.dy**2 + 1/self.dz**2
        ))
    
    @classmethod
    def from_geometry(
        cls,
        bounds_min: Tuple[float, float, float],
        bounds_max: Tuple[float, float, float],
        resolution: float,
        pml_thickness: int = 10,
        padding: int = 10
    ) -> 'YeeGrid':
        """
        Create grid from antenna geometry bounds.
        
        Args:
            bounds_min: Minimum coordinates (x, y, z) of geometry
            bounds_max: Maximum coordinates (x, y, z) of geometry
            resolution: Grid resolution (cells per wavelength)
            pml_thickness: PML layer thickness in cells
            padding: Extra padding between geometry and PML
        """
        # Calculate domain size
        domain_size = np.array(bounds_max) - np.array(bounds_min)
        
        # Add padding and PML
        total_padding = 2 * (padding + pml_thickness)
        
        # Calculate cell size (assuming uniform grid)
        dx = dy = dz = min(domain_size) / resolution
        
        # Calculate number of cells
        nx = int(np.ceil(domain_size[0] / dx)) + total_padding
        ny = int(np.ceil(domain_size[1] / dy)) + total_padding
        nz = int(np.ceil(domain_size[2] / dz)) + total_padding
        
        return cls(nx, ny, nz, dx, dy, dz)
    
    def set_material_region(
        self,
        x_range: Tuple[int, int],
        y_range: Tuple[int, int],
        z_range: Tuple[int, int],
        epsilon_r: float = 1.0,
        mu_r: float = 1.0,
        sigma: float = 0.0
    ):
        """Set material properties in a rectangular region."""
        x1, x2 = x_range
        y1, y2 = y_range
        z1, z2 = z_range
        
        self.epsilon_r[x1:x2, y1:y2, z1:z2] = epsilon_r
        self.mu_r[x1:x2, y1:y2, z1:z2] = mu_r
        self.sigma[x1:x2, y1:y2, z1:z2] = sigma
    
    def compute_update_coefficients(self):
        """Compute update coefficients for E and H fields based on materials."""
        # E-field update coefficients
        # For Ex: use average of surrounding materials
        eps_x = np.zeros_like(self.Ex)
        sigma_x = np.zeros_like(self.Ex)
        
        # Average epsilon and sigma for Ex locations
        eps_x[:-1, 1:-1, 1:-1] = 0.25 * (
            self.epsilon_r[:, :-1, :-1] + self.epsilon_r[:, 1:, :-1] +
            self.epsilon_r[:, :-1, 1:] + self.epsilon_r[:, 1:, 1:]
        )
        sigma_x[:-1, 1:-1, 1:-1] = 0.25 * (
            self.sigma[:, :-1, :-1] + self.sigma[:, 1:, :-1] +
            self.sigma[:, :-1, 1:] + self.sigma[:, 1:, 1:]
        )
        
        # Coefficients for Ex update
        self.cExE = (2 * self.eps0 * eps_x - self.dt * sigma_x) / (2 * self.eps0 * eps_x + self.dt * sigma_x)
        self.cExH = (2 * self.dt) / ((2 * self.eps0 * eps_x + self.dt * sigma_x))
        
        # Similar for Ey
        eps_y = np.zeros_like(self.Ey)
        sigma_y = np.zeros_like(self.Ey)
        eps_y[1:-1, :-1, 1:-1] = 0.25 * (
            self.epsilon_r[:-1, :, :-1] + self.epsilon_r[1:, :, :-1] +
            self.epsilon_r[:-1, :, 1:] + self.epsilon_r[1:, :, 1:]
        )
        sigma_y[1:-1, :-1, 1:-1] = 0.25 * (
            self.sigma[:-1, :, :-1] + self.sigma[1:, :, :-1] +
            self.sigma[:-1, :, 1:] + self.sigma[1:, :, 1:]
        )
        
        self.cEyE = (2 * self.eps0 * eps_y - self.dt * sigma_y) / (2 * self.eps0 * eps_y + self.dt * sigma_y)
        self.cEyH = (2 * self.dt) / ((2 * self.eps0 * eps_y + self.dt * sigma_y))
        
        # Similar for Ez
        eps_z = np.zeros_like(self.Ez)
        sigma_z = np.zeros_like(self.Ez)
        eps_z[1:-1, 1:-1, :-1] = 0.25 * (
            self.epsilon_r[:-1, :-1, :] + self.epsilon_r[1:, :-1, :] +
            self.epsilon_r[:-1, 1:, :] + self.epsilon_r[1:, 1:, :]
        )
        sigma_z[1:-1, 1:-1, :-1] = 0.25 * (
            self.sigma[:-1, :-1, :] + self.sigma[1:, :-1, :] +
            self.sigma[:-1, 1:, :] + self.sigma[1:, 1:, :]
        )
        
        self.cEzE = (2 * self.eps0 * eps_z - self.dt * sigma_z) / (2 * self.eps0 * eps_z + self.dt * sigma_z)
        self.cEzH = (2 * self.dt) / ((2 * self.eps0 * eps_z + self.dt * sigma_z))
        
        # H-field update coefficients (no conductivity for magnetic fields)
        # For Hx: use average of surrounding materials
        mu_x = np.zeros_like(self.Hx)
        mu_x[1:-1, :-1, :-1] = 0.25 * (
            self.mu_r[:-1, :, :] + self.mu_r[1:, :, :] +
            self.mu_r[:-1, :, :] + self.mu_r[1:, :, :]
        )
        self.cHx = self.dt / (self.mu0 * mu_x)
        
        # Similar for Hy
        mu_y = np.zeros_like(self.Hy)
        mu_y[:-1, 1:-1, :-1] = 0.25 * (
            self.mu_r[:, :-1, :] + self.mu_r[:, 1:, :] +
            self.mu_r[:, :-1, :] + self.mu_r[:, 1:, :]
        )
        self.cHy = self.dt / (self.mu0 * mu_y)
        
        # Similar for Hz
        mu_z = np.zeros_like(self.Hz)
        mu_z[:-1, :-1, 1:-1] = 0.25 * (
            self.mu_r[:, :, :-1] + self.mu_r[:, :, 1:] +
            self.mu_r[:, :, :-1] + self.mu_r[:, :, 1:]
        )
        self.cHz = self.dt / (self.mu0 * mu_z)
    
    def update_e_fields(self):
        """Update E-field components using curl of H."""
        # Update Ex
        self.Ex[:, 1:-1, 1:-1] = (
            self.cExE[:, 1:-1, 1:-1] * self.Ex[:, 1:-1, 1:-1] +
            self.cExH[:, 1:-1, 1:-1] * (
                (self.Hz[:, 1:, 1:-1] - self.Hz[:, :-1, 1:-1]) / self.dy -
                (self.Hy[:, 1:-1, 1:] - self.Hy[:, 1:-1, :-1]) / self.dz
            )
        )
        
        # Update Ey
        self.Ey[1:-1, :, 1:-1] = (
            self.cEyE[1:-1, :, 1:-1] * self.Ey[1:-1, :, 1:-1] +
            self.cEyH[1:-1, :, 1:-1] * (
                (self.Hx[1:-1, :, 1:] - self.Hx[1:-1, :, :-1]) / self.dz -
                (self.Hz[1:, :, 1:-1] - self.Hz[:-1, :, 1:-1]) / self.dx
            )
        )
        
        # Update Ez
        self.Ez[1:-1, 1:-1, :] = (
            self.cEzE[1:-1, 1:-1, :] * self.Ez[1:-1, 1:-1, :] +
            self.cEzH[1:-1, 1:-1, :] * (
                (self.Hy[1:, 1:-1, :] - self.Hy[:-1, 1:-1, :]) / self.dx -
                (self.Hx[1:-1, 1:, :] - self.Hx[1:-1, :-1, :]) / self.dy
            )
        )
    
    def update_h_fields(self):
        """Update H-field components using curl of E."""
        # Update Hx
        self.Hx[1:-1, 1:-1, 1:-1] = (
            self.Hx[1:-1, 1:-1, 1:-1] - self.cHx[1:-1, 1:-1, 1:-1] * (
                (self.Ez[1:-1, 2:, 1:-1] - self.Ez[1:-1, 1:-1, 1:-1]) / self.dy -
                (self.Ey[1:-1, 1:-1, 2:] - self.Ey[1:-1, 1:-1, 1:-1]) / self.dz
            )
        )
        
        # Update Hy
        self.Hy[1:-1, 1:-1, 1:-1] = (
            self.Hy[1:-1, 1:-1, 1:-1] - self.cHy[1:-1, 1:-1, 1:-1] * (
                (self.Ex[1:-1, 1:-1, 2:] - self.Ex[1:-1, 1:-1, 1:-1]) / self.dz -
                (self.Ez[2:, 1:-1, 1:-1] - self.Ez[1:-1, 1:-1, 1:-1]) / self.dx
            )
        )
        
        # Update Hz
        self.Hz[1:-1, 1:-1, 1:-1] = (
            self.Hz[1:-1, 1:-1, 1:-1] - self.cHz[1:-1, 1:-1, 1:-1] * (
                (self.Ey[2:, 1:-1, 1:-1] - self.Ey[1:-1, 1:-1, 1:-1]) / self.dx -
                (self.Ex[1:-1, 2:, 1:-1] - self.Ex[1:-1, 1:-1, 1:-1]) / self.dy
            )
        )
    
    def get_field_at_point(self, x: int, y: int, z: int) -> Dict[str, np.ndarray]:
        """Get interpolated E and H fields at a grid point."""
        # Interpolate to cell center
        ex = 0.5 * (self.Ex[x, y, z] + self.Ex[x, y+1, z+1])
        ey = 0.5 * (self.Ey[x, y, z] + self.Ey[x+1, y, z+1])
        ez = 0.5 * (self.Ez[x, y, z] + self.Ez[x+1, y+1, z])
        
        hx = 0.5 * (self.Hx[x, y, z] + self.Hx[x+1, y, z])
        hy = 0.5 * (self.Hy[x, y, z] + self.Hy[x, y+1, z])
        hz = 0.5 * (self.Hz[x, y, z] + self.Hz[x, y, z+1])
        
        return {
            'E': np.array([ex, ey, ez]),
            'H': np.array([hx, hy, hz])
        }