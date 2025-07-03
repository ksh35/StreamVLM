import { create } from 'zustand';
import { 
  AppSettings, 
  FrameData, 
  VLMModel, 
  SessionStats, 
  TemporalContext,
  CameraSettings 
} from '../types';

interface AppState {
  // Settings
  settings: AppSettings;
  cameraSettings: CameraSettings;
  
  // Data
  availableModels: VLMModel[];
  currentSession: string | null;
  frameHistory: FrameData[];
  sessionStats: SessionStats | null;
  temporalContext: TemporalContext | null;
  
  // Current frame data
  currentResponse: string | null;
  detectedObjects: string[];
  generalSummary: string | null;
  
  // UI State
  isConnected: boolean;
  isProcessing: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateCameraSettings: (settings: Partial<CameraSettings>) => void;
  setAvailableModels: (models: VLMModel[]) => void;
  setCurrentSession: (sessionId: string | null) => void;
  addFrame: (frame: FrameData) => void;
  clearFrameHistory: () => void;
  setSessionStats: (stats: SessionStats | null) => void;
  setTemporalContext: (context: TemporalContext | null) => void;
  setCurrentResponse: (response: string | null) => void;
  setDetectedObjects: (objects: string[]) => void;
  setGeneralSummary: (summary: string | null) => void;
  setConnectionStatus: (connected: boolean) => void;
  setProcessingStatus: (processing: boolean) => void;
  setStreamingStatus: (streaming: boolean) => void;
  setError: (error: string | null) => void;
}

const defaultSettings: AppSettings = {
  selectedModel: 'gemini-1.5-flash',
  summaryModel: 'gemini-2.0-flash',
  prompt: 'What do you see in this image?',
  maxTokens: 300,
  temperature: 0.7,
  delaySeconds: 2,
  useTemporalContext: true,
  autoStart: false,
  contextWindow: 10,  // Default context window for image queries
  summaryWindow: 10,  // Default summary window for summaries
};

const defaultCameraSettings: CameraSettings = {
  width: 640,
  height: 480,
  frameRate: 30,
};

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  settings: defaultSettings,
  cameraSettings: defaultCameraSettings,
  availableModels: [],
  currentSession: null,
  frameHistory: [],
  sessionStats: null,
  temporalContext: null,
  currentResponse: null,
  detectedObjects: [],
  generalSummary: null,
  isConnected: false,
  isProcessing: false,
  isStreaming: false,
  error: null,
  
  // Actions
  updateSettings: (newSettings) => 
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    })),
    
  updateCameraSettings: (newSettings) =>
    set((state) => ({
      cameraSettings: { ...state.cameraSettings, ...newSettings }
    })),
    
  setAvailableModels: (models) => set({ availableModels: models }),
  
  setCurrentSession: (sessionId) => set({ currentSession: sessionId }),
  
  addFrame: (frame) => 
    set((state) => ({
      frameHistory: [...state.frameHistory, frame].slice(-50) // Keep last 50 frames
    })),
    
  clearFrameHistory: () => set({ frameHistory: [] }),
  
  setSessionStats: (stats) => set({ sessionStats: stats }),
  
  setTemporalContext: (context) => set({ temporalContext: context }),
  
  setCurrentResponse: (response) => set({ currentResponse: response }),
  
  setDetectedObjects: (objects) => set({ detectedObjects: objects }),
  
  setGeneralSummary: (summary) => set({ generalSummary: summary }),
  
  setConnectionStatus: (connected) => set({ isConnected: connected }),
  
  setProcessingStatus: (processing) => set({ isProcessing: processing }),
  
  setStreamingStatus: (streaming) => set({ isStreaming: streaming }),
  
  setError: (error) => set({ error }),
})); 