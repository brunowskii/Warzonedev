// API service for backend communication with production support
import logger from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV 
    ? 'http://localhost:5000' 
    : '');

class ApiService {
  private static async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const startTime = Date.now();
    
    try {
      logger.debug(`API Request: ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        credentials: 'include'
      });
      
      const duration = Date.now() - startTime;
      logger.apiCall(options.method || 'GET', endpoint, duration, response.status);
      
      const data = await response.json();
      
      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
        logger.error(`API Error: ${endpoint}`, { 
          status: response.status, 
          error: data.error,
          duration 
        });
        throw error;
      }
      
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        logger.error(`Network Error: ${endpoint}`, { duration, originalError: error.message });
        throw networkError;
      }
      
      logger.error(`API Request Failed: ${endpoint}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration 
      });
      
      throw error;
    }
  }

  // Tournament endpoints
  static async getTournaments() {
    return this.request('/api/tournaments');
  }

  static async getTournament(id: string) {
    return this.request(`/api/tournaments/${id}`);
  }

  static async createTournament(tournament: any) {
    return this.request('/api/tournaments', {
      method: 'POST',
      body: JSON.stringify(tournament)
    });
  }

  static async updateTournament(id: string, tournament: any) {
    return this.request(`/api/tournaments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tournament)
    });
  }

  // Team endpoints
  static async getTeams(tournamentId: string) {
    return this.request(`/api/tournaments/${tournamentId}/teams`);
  }

  static async createTeam(team: any) {
    return this.request('/api/teams', {
      method: 'POST',
      body: JSON.stringify(team)
    });
  }

  // Match endpoints
  static async getMatches(tournamentId: string) {
    return this.request(`/api/tournaments/${tournamentId}/matches`);
  }

  static async createMatch(match: any) {
    return this.request('/api/matches', {
      method: 'POST',
      body: JSON.stringify(match)
    });
  }

  // Pending submission endpoints
  static async getPendingSubmissions(tournamentId: string) {
    return this.request(`/api/tournaments/${tournamentId}/pending`);
  }

  static async createPendingSubmission(submission: any) {
    return this.request('/api/pending-submissions', {
      method: 'POST',
      body: JSON.stringify(submission)
    });
  }

  static async approveSubmission(id: string, data: any) {
    return this.request(`/api/pending-submissions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async rejectSubmission(id: string) {
    return this.request(`/api/pending-submissions/${id}/reject`, {
      method: 'POST'
    });
  }

  // Score adjustment endpoints
  static async getScoreAdjustments(tournamentId: string) {
    return this.request(`/api/tournaments/${tournamentId}/adjustments`);
  }

  static async createScoreAdjustment(adjustment: any) {
    return this.request('/api/score-adjustments', {
      method: 'POST',
      body: JSON.stringify(adjustment)
    });
  }

  // Manager endpoints
  static async getManagers() {
    return this.request('/api/managers');
  }

  static async createManager(manager: any) {
    return this.request('/api/managers', {
      method: 'POST',
      body: JSON.stringify(manager)
    });
  }

  // Audit log endpoints
  static async getAuditLogs(tournamentId?: string, limit?: number) {
    const params = new URLSearchParams();
    if (tournamentId) params.append('tournamentId', tournamentId);
    if (limit) params.append('limit', limit.toString());
    
    return this.request(`/api/audit-logs?${params.toString()}`);
  }

  static async createAuditLog(log: any) {
    return this.request('/api/audit-logs', {
      method: 'POST',
      body: JSON.stringify(log)
    });
  }

  // Authentication endpoints
  static async login(code: string, type: 'admin' | 'manager' | 'team') {
    logger.userAction('Login attempt', { type });
    
    try {
      const result = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ code, type })
      });
      
      logger.userAction('Login successful', { type, userType: result.userType });
      return result;
    } catch (error) {
      logger.warn('Login failed', { type, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Health check with enhanced error handling
  static async healthCheck() {
    try {
      return await this.request('/api/health');
    } catch (error) {
      logger.warn('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { 
        success: false, 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Connection test utility
  static async testConnection() {
    try {
      const result = await this.healthCheck();
      const connectionData = {
        connected: result.success,
        apiUrl: API_BASE_URL,
        environment: result.environment || 'unknown',
        timestamp: result.timestamp || Date.now()
      };
      
      logger.info('Connection test completed', connectionData);
      return connectionData;
    } catch (error) {
      const connectionData = {
        connected: false,
        apiUrl: API_BASE_URL,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
      
      logger.error('Connection test failed', connectionData);
      return connectionData;
    }
  }
}

export default ApiService;