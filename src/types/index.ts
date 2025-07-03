export interface VLMResponse {
  success: boolean;
  response?: string;
  model?: string;
  timestamp?: string;
  error?: string;
}

export interface TemporalContextResponse {
  success: boolean;
  response?: string;
  model?: string;
  session_id?: string;
  frame_id?: string;
  processing_time?: number;
  temporal_context?: TemporalContext;
  detected_objects?: string[];
  error?: string;
}

export interface TemporalContext {
  recent_responses: string[];
  last_update: string;
}

export interface VLMRequest {
  model: string;
  image_b64: string;
  prompt: string;
  settings?: VLMSettings;
  session_id?: string;
  use_temporal_context?: boolean;
}

export interface VLMSettings {
  max_tokens: number;
  temperature: number;
  delay_seconds: number;
}

export interface VLMModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  max_tokens: number;
  supports_images: boolean;
  supports_text: boolean;
}

export interface SessionStats {
  session_id: string;
  total_frames: number;
  session_duration: number;
  frames_per_minute: number;
  models_used: string[];
  avg_processing_time: number;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface FrameData {
  timestamp: string;
  frame_id: string;
  response: string;
  model: string;
  processing_time: number;
  prompt: string;
  detected_objects?: string[];
  temporal_context?: TemporalContext;
}

export interface CameraSettings {
  deviceId?: string;
  width: number;
  height: number;
  frameRate: number;
}

export interface AppSettings {
  selectedModel: string;
  summaryModel: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  delaySeconds: number;
  useTemporalContext: boolean;
  autoStart: boolean;
  contextWindow: number;
  summaryWindow: number;
} 