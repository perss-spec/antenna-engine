use ndarray::{Array1, Array2, Axis, Zip};
use num_complex::Complex64;
use rayon::prelude::*;
use std::f64::EPSILON;

use crate::core::error::{CoreError, Result};

/// Information about GMRES convergence
#[derive(Debug, Clone)]
pub struct ConvergenceInfo {
    pub iterations: usize,
    pub residual_norm: f64,
    pub converged: bool,
}

/// LU decomposition with partial pivoting for complex matrices
struct LUDecomposition {
    lu: Array2<Complex64>,
    pivots: Vec<usize>,
}

impl LUDecomposition {
    /// Perform LU decomposition with partial pivoting
    fn new(mut a: Array2<Complex64>) -> Result<Self> {
        let n = a.nrows();
        if n != a.ncols() {
            return Err(CoreError::Validation("Matrix must be square".to_string()));
        }

        let mut pivots = vec![0; n];

        for k in 0..n {
            // Find pivot
            let mut max_val = 0.0;
            let mut max_row = k;
            for i in k..n {
                let val = a[[i, k]].norm();
                if val > max_val {
                    max_val = val;
                    max_row = i;
                }
            }

            if max_val < EPSILON {
                return Err(CoreError::Validation("Matrix is singular".to_string()));
            }

            pivots[k] = max_row;

            // Swap rows
            if max_row != k {
                for j in 0..n {
                    let tmp = a[[k, j]];
                    a[[k, j]] = a[[max_row, j]];
                    a[[max_row, j]] = tmp;
                }
            }

            // Compute multipliers and eliminate
            for i in (k + 1)..n {
                a[[i, k]] /= a[[k, k]];
                for j in (k + 1)..n {
                    a[[i, j]] -= a[[i, k]] * a[[k, j]];
                }
            }
        }

        Ok(LUDecomposition { lu: a, pivots })
    }

    /// Solve Ax = b using forward and backward substitution
    fn solve(&self, b: &Array1<Complex64>) -> Result<Array1<Complex64>> {
        let n = self.lu.nrows();
        if b.len() != n {
            return Err(CoreError::Validation("Vector size mismatch".to_string()));
        }

        // Apply permutation
        let mut x = b.clone();
        for k in 0..n {
            if self.pivots[k] != k {
                let tmp = x[k];
                x[k] = x[self.pivots[k]];
                x[self.pivots[k]] = tmp;
            }
        }

        // Forward substitution (solve Ly = Pb)
        for i in 1..n {
            for j in 0..i {
                x[i] -= self.lu[[i, j]] * x[j];
            }
        }

        // Backward substitution (solve Ux = y)
        for i in (0..n).rev() {
            for j in (i + 1)..n {
                x[i] -= self.lu[[i, j]] * x[j];
            }
            x[i] /= self.lu[[i, i]];
        }

        Ok(x)
    }
}

/// Solve linear system using LU decomposition
pub fn lu_solve(a: &Array2<Complex64>, b: &Array1<Complex64>) -> Result<Array1<Complex64>> {
    let lu = LUDecomposition::new(a.clone())?;
    lu.solve(b)
}

/// Matrix-vector multiplication with parallelization for large matrices
fn matvec(a: &Array2<Complex64>, x: &Array1<Complex64>) -> Array1<Complex64> {
    let n = a.nrows();
    let mut y = Array1::zeros(n);
    
    if n > 1000 {
        // Parallel version for large matrices
        let y_vec: Vec<Complex64> = (0..n)
            .into_par_iter()
            .map(|i| {
                a.row(i).dot(x)
            })
            .collect();
        y.assign(&Array1::from_vec(y_vec));
    } else {
        // Sequential version for small matrices
        Zip::from(&mut y)
            .and(a.rows())
            .for_each(|y_i, row| {
                *y_i = row.dot(x);
            });
    }
    
    y
}

/// GMRES solver for complex linear systems
pub fn gmres(
    a: &Array2<Complex64>,
    b: &Array1<Complex64>,
    tol: f64,
    max_iter: usize,
    restart: usize,
) -> Result<(Array1<Complex64>, ConvergenceInfo)> {
    let n = a.nrows();
    if n != a.ncols() || b.len() != n {
        return Err(CoreError::Validation("Matrix/vector dimension mismatch".to_string()));
    }

    let b_norm = b.mapv(|x| x.norm_sqr()).sum().sqrt();
    if b_norm < EPSILON {
        return Ok((Array1::zeros(n), ConvergenceInfo {
            iterations: 0,
            residual_norm: 0.0,
            converged: true,
        }));
    }

    // Initial guess
    let mut x = Array1::zeros(n);
    let mut total_iters = 0;

    // Diagonal preconditioner
    let precond: Vec<Complex64> = (0..n)
        .map(|i| {
            let diag = a[[i, i]];
            if diag.norm() > EPSILON {
                Complex64::new(1.0, 0.0) / diag
            } else {
                Complex64::new(1.0, 0.0)
            }
        })
        .collect();

    for _restart_count in 0..(max_iter / restart) {
        // Compute initial residual
        let r = &*b - &matvec(a, &x);
        let r_norm = r.mapv(|x| x.norm_sqr()).sum().sqrt();
        
        if r_norm / b_norm < tol {
            return Ok((x, ConvergenceInfo {
                iterations: total_iters,
                residual_norm: r_norm / b_norm,
                converged: true,
            }));
        }

        // Apply preconditioner
        let mut r_prec = r.clone();
        for i in 0..n {
            r_prec[i] *= precond[i];
        }

        let beta = r_prec.mapv(|x| x.norm_sqr()).sum().sqrt();
        let mut v = vec![Array1::zeros(n); restart + 1];
        v[0] = r_prec / beta;

        // Hessenberg matrix
        let mut h = Array2::zeros((restart + 1, restart));
        let mut s = Array1::zeros(restart + 1);
        s[0] = Complex64::new(beta, 0.0);

        // Givens rotation components
        let mut c = vec![0.0; restart];
        let mut sn = vec![Complex64::new(0.0, 0.0); restart];

        let mut j = 0;
        while j < restart && total_iters < max_iter {
            total_iters += 1;

            // Arnoldi iteration with Modified Gram-Schmidt
            let mut w = matvec(a, &v[j]);
            
            // Apply preconditioner
            for i in 0..n {
                w[i] *= precond[i];
            }

            for i in 0..=j {
                h[[i, j]] = v[i].dot(&w);
                w = w - h[[i, j]] * &v[i];
            }

            h[[j + 1, j]] = Complex64::new(w.mapv(|x| x.norm_sqr()).sum().sqrt(), 0.0);

            if h[[j + 1, j]].norm() < EPSILON {
                j += 1;
                break;
            }

            v[j + 1] = w / h[[j + 1, j]];

            // Apply previous Givens rotations
            for i in 0..j {
                let temp = c[i] * h[[i, j]] + sn[i] * h[[i + 1, j]];
                h[[i + 1, j]] = -sn[i].conj() * h[[i, j]] + c[i] * h[[i + 1, j]];
                h[[i, j]] = temp;
            }

            // Compute new Givens rotation
            let h_jj = h[[j, j]];
            let h_j1j = h[[j + 1, j]];
            let rho = (h_jj.norm_sqr() + h_j1j.norm_sqr()).sqrt();
            
            c[j] = h_jj.norm() / rho;
            sn[j] = h_jj / h_jj.norm() * h_j1j.conj() / rho;

            h[[j, j]] = Complex64::new(rho, 0.0);
            h[[j + 1, j]] = Complex64::new(0.0, 0.0);

            // Update RHS
            s[j + 1] = -sn[j].conj() * s[j];
            s[j] = c[j] * s[j];

            let residual = s[j + 1].norm() / b_norm;
            if residual < tol {
                j += 1;
                break;
            }

            j += 1;
        }

        // Solve upper triangular system
        let mut y = Array1::zeros(j);
        for i in (0..j).rev() {
            y[i] = s[i];
            for k in (i + 1)..j {
                y[i] -= h[[i, k]] * y[k];
            }
            y[i] /= h[[i, i]];
        }

        // Update solution
        for i in 0..j {
            x = x + y[i] * &v[i];
        }

        // Check convergence
        let r = &*b - &matvec(a, &x);
        let r_norm = r.mapv(|x| x.norm_sqr()).sum().sqrt();
        
        if r_norm / b_norm < tol {
            return Ok((x, ConvergenceInfo {
                iterations: total_iters,
                residual_norm: r_norm / b_norm,
                converged: true,
            }));
        }
    }

    // Final residual check
    let r = &*b - &matvec(a, &x);
    let r_norm = r.mapv(|x| x.norm_sqr()).sum().sqrt();

    Ok((x, ConvergenceInfo {
        iterations: total_iters,
        residual_norm: r_norm / b_norm,
        converged: r_norm / b_norm < tol,
    }))
}

/// Estimate condition number using power iteration
pub fn estimate_condition_number(a: &Array2<Complex64>) -> f64 {
    let n = a.nrows();
    if n != a.ncols() || n == 0 {
        return f64::INFINITY;
    }

    // Power iteration for largest singular value
    let mut v = Array1::from_elem(n, Complex64::new(1.0 / (n as f64).sqrt(), 0.0));
    let mut lambda_max = 0.0;
    
    for _ in 0..30 {
        let av = matvec(a, &v);
        let v_new_norm = av.mapv(|x| x.norm_sqr()).sum().sqrt();
        
        if v_new_norm < EPSILON {
            break;
        }
        
        v = av / v_new_norm;
        let av = matvec(a, &v);
        lambda_max = v.dot(&av).norm();
    }

    // Inverse power iteration for smallest singular value
    let mut v = Array1::from_elem(n, Complex64::new(1.0 / (n as f64).sqrt(), 0.0));
    let mut lambda_min = lambda_max;
    
    // Try to solve (A^H A - sigma I)x = v for smallest eigenvalue
    let sigma = lambda_max * EPSILON.sqrt();
    let mut a_shifted = a.dot(&a.t().mapv(|x| x.conj()));
    for i in 0..n {
        a_shifted[[i, i]] -= Complex64::new(sigma, 0.0);
    }

    for _ in 0..20 {
        match lu_solve(&a_shifted, &v) {
            Ok(v_new) => {
                let v_new_norm = v_new.mapv(|x| x.norm_sqr()).sum().sqrt();
                if v_new_norm < EPSILON {
                    break;
                }
                v = v_new / v_new_norm;
                let av = matvec(a, &v);
                lambda_min = v.dot(&av).norm();
            }
            Err(_) => break,
        }
    }

    if lambda_min < EPSILON {
        f64::INFINITY
    } else {
        lambda_max / lambda_min
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn test_lu_solve_3x3() {
        // Test system: [1+i, 2, 0; 3, 4-i, 5; 1, 0, 2+i] * [x; y; z] = [3+i; 12-i; 3+2i]
        // Solution should be [1; 0+i; 1]
        let a = Array2::from_shape_vec(
            (3, 3),
            vec![
                Complex64::new(1.0, 1.0), Complex64::new(2.0, 0.0), Complex64::new(0.0, 0.0),
                Complex64::new(3.0, 0.0), Complex64::new(4.0, -1.0), Complex64::new(5.0, 0.0),
                Complex64::new(1.0, 0.0), Complex64::new(0.0, 0.0), Complex64::new(2.0, 1.0),
            ],
        ).unwrap();
        
        let b = Array1::from_vec(vec![
            Complex64::new(3.0, 1.0),
            Complex64::new(12.0, -1.0),
            Complex64::new(3.0, 2.0),
        ]);

        let x = lu_solve(&a, &b).unwrap();
        
        assert_abs_diff_eq!(x[0].re, 1.0, epsilon = 1e-10);
        assert_abs_diff_eq!(x[0].im, 0.0, epsilon = 1e-10);
        assert_abs_diff_eq!(x[1].re, 0.0, epsilon = 1e-10);
        assert_abs_diff_eq!(x[1].im, 1.0, epsilon = 1e-10);
        assert_abs_diff_eq!(x[2].re, 1.0, epsilon = 1e-10);
        assert_abs_diff_eq!(x[2].im, 0.0, epsilon = 1e-10);
    }

    #[test]
    fn test_gmres_convergence() {
        // Well-conditioned diagonal-dominant matrix
        let n = 10;
        let mut a = Array2::zeros((n, n));
        for i in 0..n {
            a[[i, i]] = Complex64::new(10.0, 0.0);
            if i > 0 {
                a[[i, i - 1]] = Complex64::new(-1.0, 0.5);
            }
            if i < n - 1 {
                a[[i, i + 1]] = Complex64::new(-1.0, -0.5);
            }
        }

        let b = Array1::from_elem(n, Complex64::new(1.0, 0.0));
        
        let (x, info) = gmres(&a, &b, 1e-8, 100, 30).unwrap();
        
        assert!(info.converged);
        assert!(info.residual_norm < 1e-8);
        
        // Verify solution
        let r = &b - &matvec(&a, &x);
        let r_norm = r.mapv(|x| x.norm_sqr()).sum().sqrt();
        assert!(r_norm < 1e-7);
    }

    #[test]
    fn test_lu_gmres_agreement() {
        // Small system where both methods should work
        let n = 5;
        let mut a = Array2::zeros((n, n));
        for i in 0..n {
            a[[i, i]] = Complex64::new(2.0, 0.1);
            if i > 0 {
                a[[i, i - 1]] = Complex64::new(-0.5, 0.0);
            }
            if i < n - 1 {
                a[[i, i + 1]] = Complex64::new(-0.5, 0.0);
            }
        }

        let b = Array1::from_elem(n, Complex64::new(1.0, -0.5));
        
        let x_lu = lu_solve(&a, &b).unwrap();
        let (x_gmres, _) = gmres(&a, &b, 1e-10, 100, 30).unwrap();
        
        for i in 0..n {
            assert_abs_diff_eq!(x_lu[i].re, x_gmres[i].re, epsilon = 1e-8);
            assert_abs_diff_eq!(x_lu[i].im, x_gmres[i].im, epsilon = 1e-8);
        }
    }

    #[test]
    fn test_condition_number() {
        // Well-conditioned identity matrix
        let a = Array2::eye(5);
        let cond = estimate_condition_number(&a.mapv(|x| Complex64::new(x, 0.0)));
        assert_abs_diff_eq!(cond, 1.0, epsilon = 0.1);

        // Poorly conditioned matrix
        let mut a = Array2::zeros((3, 3));
        a[[0, 0]] = Complex64::new(1.0, 0.0);
        a[[1, 1]] = Complex64::new(0.1, 0.0);
        a[[2, 2]] = Complex64::new(0.01, 0.0);
        let cond = estimate_condition_number(&a);
        assert!(cond > 50.0);
    }
}