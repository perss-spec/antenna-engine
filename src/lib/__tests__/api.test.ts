import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need a fresh ProminAPI instance per test, so we import the class indirectly
// by re-importing the module. But since `api` is a singleton, we test via it.

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock import.meta.env and window.location for API_BASE resolution
// The module reads these at import time, so we need the mock before import
const { api, ProminAPI } = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');

// Helper to create a mock Response
function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  };
}

describe('ProminAPI', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    api.resetCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- health() ---
  describe('health()', () => {
    it('returns correct shape when server responds', async () => {
      const healthData = { status: 'ok', version: '1.0.0', cores: 4 };
      mockFetch.mockResolvedValueOnce(mockResponse(healthData));

      const result = await api.health();

      expect(result).toEqual(healthData);
      expect(result.status).toBe('ok');
      expect(result.version).toBe('1.0.0');
      expect(result.cores).toBe(4);
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(api.health()).rejects.toThrow('Failed to fetch');
    });
  });

  // --- isServerAvailable() ---
  describe('isServerAvailable()', () => {
    it('returns true when health succeeds', async () => {
      const healthData = { status: 'ok', version: '1.0.0', cores: 4 };
      mockFetch.mockResolvedValueOnce(mockResponse(healthData));

      const available = await api.isServerAvailable();

      expect(available).toBe(true);
    });

    it('returns false when health fails and caches the result', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const available = await api.isServerAvailable();
      expect(available).toBe(false);

      // Second call should use cache — no additional fetch
      const available2 = await api.isServerAvailable();
      expect(available2).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // --- solve() ---
  describe('solve()', () => {
    it('sends correct POST request and returns data', async () => {
      const solveReq = {
        antenna_type: 'dipole',
        frequency: 2.4e9,
        parameters: { length: 0.0625 },
      };
      const solveResp = {
        impedance_real: 73,
        impedance_imag: 42.5,
        s11_db: -10.5,
        vswr: 1.87,
      };
      mockFetch.mockResolvedValueOnce(mockResponse(solveResp));

      const result = await api.solve(solveReq);

      expect(result).toEqual(solveResp);

      // Verify fetch was called with POST and correct body
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/solve');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(solveReq);
    });
  });

  // --- sweep() ---
  describe('sweep()', () => {
    it('sends correct POST and returns sweep data', async () => {
      const sweepReq = {
        antenna_type: 'dipole',
        freq_start: 2e9,
        freq_stop: 3e9,
        freq_points: 11,
        parameters: { length: 0.0625 },
      };
      const sweepResp = {
        frequencies: [2e9, 2.5e9, 3e9],
        s11_db: [-5, -15, -8],
        s11_real: [0.5, 0.1, 0.3],
        s11_imag: [0.1, 0.05, 0.2],
        impedance_real: [50, 73, 60],
        impedance_imag: [20, 0, -10],
        resonant_frequency: 2.5e9,
        min_s11: -15,
        bandwidth: 0.5e9,
      };
      mockFetch.mockResolvedValueOnce(mockResponse(sweepResp));

      const result = await api.sweep(sweepReq);

      expect(result).toEqual(sweepResp);
      expect(result.frequencies).toHaveLength(3);
      expect(result.resonant_frequency).toBe(2.5e9);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/sweep');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(sweepReq);
    });
  });

  // --- submitMomJob() ---
  describe('submitMomJob()', () => {
    it('returns job_id', async () => {
      const jobResp = { job_id: 'abc-123' };
      mockFetch.mockResolvedValueOnce(mockResponse(jobResp));

      const result = await api.submitMomJob({
        antenna_type: 'dipole',
        frequency: 2.4e9,
        segments: 50,
        parameters: { length: 0.0625 },
      });

      expect(result.job_id).toBe('abc-123');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/jobs/mom');
      expect(options.method).toBe('POST');
    });
  });

  // --- getJobStatus() ---
  describe('getJobStatus()', () => {
    it('returns job status', async () => {
      const statusResp = {
        id: 'abc-123',
        status: 'completed' as const,
        progress: 100,
        result: { impedance_real: 73 },
      };
      mockFetch.mockResolvedValueOnce(mockResponse(statusResp));

      const result = await api.getJobStatus('abc-123');

      expect(result.id).toBe('abc-123');
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/jobs/abc-123');
    });
  });

  // --- Timeout / AbortError ---
  describe('timeout handling', () => {
    it('throws "Server timeout" on AbortError', async () => {
      mockFetch.mockImplementationOnce(() => {
        const err = new DOMException('The operation was aborted', 'AbortError');
        return Promise.reject(err);
      });

      await expect(api.health()).rejects.toThrow('Server timeout');
    });
  });

  // --- resetCache() ---
  describe('resetCache()', () => {
    it('clears cached availability so next call re-checks', async () => {
      // First: server unavailable
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const avail1 = await api.isServerAvailable();
      expect(avail1).toBe(false);

      // Reset cache
      api.resetCache();

      // Now server is available
      const healthData = { status: 'ok', version: '1.0.0', cores: 4 };
      mockFetch.mockResolvedValueOnce(mockResponse(healthData));
      const avail2 = await api.isServerAvailable();
      expect(avail2).toBe(true);

      // fetch was called twice total (once per isServerAvailable call)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
