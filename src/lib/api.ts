// PROMIN Antenna Studio — Server API Client
import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const N8N_BASE = import.meta.env.VITE_N8N_URL || '/webhook';

// Types
export interface SolveRequest {
  antenna_type: string;
  frequency: number;
  parameters: Record<string, number>;
}

export interface SolveResponse {
  impedance_real: number;
  impedance_imag: number;
  s11_db: number;
  vswr: number;
}

export interface SweepRequest {
  antenna_type: string;
  freq_start: number;
  freq_stop: number;
  freq_points: number;
  parameters: Record<string, number>;
}

export interface SweepResponse {
  frequencies: number[];
  s11_db: number[];
  s11_real: number[];
  s11_imag: number[];
  impedance_real: number[];
  impedance_imag: number[];
  resonant_frequency: number;
  min_s11: number;
  bandwidth: number;
}

export interface PatternRequest {
  antenna_type: string;
  frequency: number;
  theta_points: number;
  phi_points: number;
}

export interface PatternResponse {
  pattern: number[][];
  max_gain: number;
  theta_points: number;
  phi_points: number;
}

export interface MomJobResponse {
  job_id: string;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
}

export interface OptimizeRequest {
  antenna_type: string;
  target_frequency: number;
  target_s11: number;
  target_bandwidth_pct: number;
  constraints: Record<string, number>;
}

export interface OptimizeResponse {
  best_parameters: Record<string, number>;
  simulation_result: SolveResponse;
  ai_analysis: string;
  iterations: number;
  history: Array<{
    parameters: Record<string, number>;
    result: SolveResponse;
  }>;
}

export interface AIAnalysis {
  assessment: string;
  matching_recommendations: string;
  optimization_suggestions: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  cores: number;
}

// API client class
class ProminAPI {
  private baseUrl: string;
  private n8nUrl: string;
  private _serverAvailable: boolean | null = null;

  constructor(baseUrl = API_BASE, n8nUrl = N8N_BASE) {
    this.baseUrl = baseUrl;
    this.n8nUrl = n8nUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  }

  private async n8nRequest<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.n8nUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`n8n error: ${res.status}`);
    }
    return res.json();
  }

  // Health check — also caches server availability
  async health(): Promise<HealthResponse> {
    const result = await this.request<HealthResponse>('/health');
    this._serverAvailable = true;
    return result;
  }

  // Check if server is available (with cache)
  async isServerAvailable(): Promise<boolean> {
    if (this._serverAvailable !== null) return this._serverAvailable;
    try {
      await this.health();
      return true;
    } catch {
      this._serverAvailable = false;
      return false;
    }
  }

  // === Direct Solver API ===

  async solve(req: SolveRequest): Promise<SolveResponse> {
    return this.request('/solve', { method: 'POST', body: JSON.stringify(req) });
  }

  async sweep(req: SweepRequest): Promise<SweepResponse> {
    return this.request('/sweep', { method: 'POST', body: JSON.stringify(req) });
  }

  async pattern(req: PatternRequest): Promise<PatternResponse> {
    return this.request('/pattern', { method: 'POST', body: JSON.stringify(req) });
  }

  // === Async Job API ===

  async submitMomJob(req: {
    antenna_type: string;
    frequency: number;
    segments: number;
    parameters: Record<string, number>;
  }): Promise<MomJobResponse> {
    return this.request('/jobs/mom', { method: 'POST', body: JSON.stringify(req) });
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    return this.request(`/jobs/${jobId}`);
  }

  // Poll job until complete
  async waitForJob(
    jobId: string,
    onProgress?: (progress: number) => void,
    intervalMs = 1000,
  ): Promise<JobStatus> {
    while (true) {
      const status = await this.getJobStatus(jobId);
      onProgress?.(status.progress);
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  // === n8n AI Pipeline ===

  async computeWithAI(
    req: SolveRequest & { type: 'solve' | 'sweep' | 'pattern' | 'mom' },
  ): Promise<{ result: unknown; ai_analysis: AIAnalysis }> {
    return this.n8nRequest('/ae/compute', req);
  }

  async optimize(req: OptimizeRequest): Promise<OptimizeResponse> {
    return this.n8nRequest('/ae/optimize', req);
  }

  async runRegression(): Promise<{
    total: number;
    passed: number;
    failed: number;
    report: string;
  }> {
    return this.n8nRequest('/ae/regression', {});
  }
}

// Singleton
export const api = new ProminAPI();

// Hook for React
export function useServerAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    api.isServerAvailable().then(setAvailable);
  }, []);

  return available;
}
