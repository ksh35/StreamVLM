import { WebSocketMessage } from '../types';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor(
    private url: string = 'ws://localhost:8000/ws',
    private onConnect?: () => void,
    private onDisconnect?: () => void,
    private onError?: (error: string) => void
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.onConnect?.();
          resolve();
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.onDisconnect?.();
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.onError?.('WebSocket connection error');
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  private handleMessage(message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      console.log('Unhandled message type:', message.type, message);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.onError?.('Failed to reconnect after maximum attempts');
    }
  }

  // Convenience methods for common operations
  startSession(sessionId?: string): void {
    console.log('Starting session');
    this.send({
      type: 'start_session',
      session_id: sessionId,
    });
  }

  queryVLM(params: {
    model: string;
    image_b64: string;
    prompt: string;
    session_id?: string;
    use_temporal_context?: boolean;
    settings?: any;
    timestamp?: string;
  }): void {
    this.send({
      type: 'vlm_query',
      ...params,
    });
  }

  getSessionStats(sessionId?: string): void {
    this.send({
      type: 'get_session_stats',
      session_id: sessionId,
    });
  }

  updateContextWindow(contextWindow: number): void {
    this.send({
      type: 'update_context_window',
      context_window: contextWindow,
    });
  }

  getSummary(model?: string, summaryPrompt?: string): void {
    this.send({
      type: 'get_summary',
      model: model,
      summary_prompt: summaryPrompt,
    });
  }

  ping(): void {
    this.send({ type: 'ping' });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
} 