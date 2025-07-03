import { 
  VLMRequest, 
  VLMResponse, 
  TemporalContextResponse, 
  VLMModel,
  SessionStats
} from '../types';

const API_BASE = '/api';

export class ApiService {
  static async getModels(): Promise<VLMModel[]> {
    try {
      const response = await fetch(`${API_BASE}/models`);
      if (!response.ok) throw new Error('Failed to fetch models');
      
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }

  static async getSettings(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE}/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  }

  static async queryVLM(request: VLMRequest): Promise<VLMResponse> {
    try {
      console.log('Querying VLM');
      const response = await fetch(`${API_BASE}/vlm/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) throw new Error('Failed to query VLM');
      
      return await response.json();
    } catch (error) {
      console.error('Error querying VLM:', error);
      throw error;
    }
  }

  static async queryVLMWithContext(request: VLMRequest): Promise<TemporalContextResponse> {
    try {
      const response = await fetch(`${API_BASE}/vlm/query-with-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) throw new Error('Failed to query VLM with context');
      
      return await response.json();
    } catch (error) {
      console.error('Error querying VLM with context:', error);
      throw error;
    }
  }

  static async startSession(sessionId?: string): Promise<{ session_id: string }> {
    try {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          session_id: sessionId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to start session');
      
      return await response.json();
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  }

  static async getSessionStats(sessionId: string): Promise<SessionStats> {
    try {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stats',
          session_id: sessionId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get session stats');
      
      const data = await response.json();
      return data.stats;
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error;
    }
  }

  static async clearSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear',
          session_id: sessionId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to clear session');
    } catch (error) {
      console.error('Error clearing session:', error);
      throw error;
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('/health');
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  static async getContextWindow(): Promise<number> {
    try {
      const response = await fetch(`${API_BASE}/settings/context-window`);
      if (!response.ok) throw new Error('Failed to fetch context window');
      
      const data = await response.json();
      return data.context_window;
    } catch (error) {
      console.error('Error fetching context window:', error);
      return 10; // Default fallback
    }
  }

  static async updateContextWindow(contextWindow: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/context-window`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context_window: contextWindow }),
      });
      
      if (!response.ok) throw new Error('Failed to update context window');
    } catch (error) {
      console.error('Error updating context window:', error);
      throw error;
    }
  }

  static async updateSummaryWindow(summaryWindow: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/summary-window`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summary_window: summaryWindow }),
      });
      
      if (!response.ok) throw new Error('Failed to update summary window');
    } catch (error) {
      console.error('Error updating summary window:', error);
      throw error;
    }
  }

  static async updateWindows(contextWindow: number, summaryWindow: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/windows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          context_window: contextWindow,
          summary_window: summaryWindow 
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update windows');
    } catch (error) {
      console.error('Error updating windows:', error);
      throw error;
    }
  }
} 