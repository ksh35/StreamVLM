import { useEffect, useRef } from 'react';
import { CameraView } from './components/CameraView';
import { AnalysisPanel } from './components/AnalysisPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useAppStore } from './store';
import { ApiService } from './services/api';
import { WebSocketService } from './services/websocket';
import { useCamera } from './hooks/useCamera';
import { Brain, Wifi, WifiOff, Play, Square, RotateCcw } from 'lucide-react';
import { ApiKeyModal } from './components/ApiKeyModal';
import React, { useState } from 'react';

function App() {
  const {
    settings,
    cameraSettings,
    currentSession,
    isConnected,
    isProcessing,
    isStreaming,
    error,
    updateSettings,
    setAvailableModels,
    setCurrentSession,
    addFrame,
    clearFrameHistory,
    setSessionStats,
    setTemporalContext,
    setConnectionStatus,
    setProcessingStatus,
    setStreamingStatus,
    setError,
  } = useAppStore();

  const wsRef = useRef<WebSocketService | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Get all camera functions and refs from useCamera
  const {
    videoRef,
    canvasRef,
    isStreaming: cameraIsStreaming,
    error: cameraError,
    availableDevices,
    selectedDeviceId,
    startCamera,
    stopCamera,
    switchDevice,
    captureFrame,
  } = useCamera(cameraSettings);

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Initialize API and WebSocket
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check backend health
        const isHealthy = await ApiService.healthCheck();
        if (!isHealthy) {
          setError('Backend is not available. Please start the FastAPI server.');
          return;
        }

        // Load available models
        const models = await ApiService.getModels();
        setAvailableModels(models);

        // Load context window setting
        const contextWindow = await ApiService.getContextWindow();
        updateSettings({ contextWindow });

        // Initialize WebSocket
        wsRef.current = new WebSocketService(
          'ws://localhost:8000/ws',
          () => setConnectionStatus(true),
          () => setConnectionStatus(false),
          (error) => setError(error)
        );

        // Set up message handlers
        wsRef.current.onMessage('session_started', (data) => {
          setCurrentSession(data.session_id);
        });

        wsRef.current.onMessage('vlm_response', (data) => {
          if (data.success) {
            addFrame({
              timestamp: new Date().toISOString(),
              frame_id: data.frame_id,
              response: data.response,
              model: data.model,
              processing_time: data.processing_time,
              prompt: data.prompt,
              detected_objects: [],
              temporal_context: data.temporal_context,
            });
            setTemporalContext(data.temporal_context);
          } else {
            setError(data.error || 'VLM query failed');
          }
          setProcessingStatus(false);
        });

        wsRef.current.onMessage('session_stats', (data) => {
          setSessionStats(data.stats);
        });

        wsRef.current.onMessage('session_error', (data) => {
          setError(data.error);
        });

        // Connect to WebSocket
        await wsRef.current.connect();
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setError('Failed to initialize application');
      }
    };

    initializeApp();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handle streaming
  useEffect(() => {
    if (isStreaming && isConnected && !isProcessing) {
      console.log('Streaming');
      intervalRef.current = setInterval(() => {
        if (!isProcessing && wsRef.current) {
          console.log('Capturing frame');
          const frameData = captureFrame();
          if (frameData) {
            setProcessingStatus(true);
            console.log('Querying VLM');
            wsRef.current.queryVLM({
              model: settings.selectedModel,
              image_b64: frameData,
              prompt: settings.prompt,
              session_id: currentSession || undefined,
              use_temporal_context: settings.useTemporalContext,
              settings: {
                max_tokens: settings.maxTokens,
                temperature: settings.temperature,
                delay_seconds: settings.delaySeconds,
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }, settings.delaySeconds * 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isStreaming, isConnected, isProcessing, settings, currentSession, captureFrame]);

  const handleStartAnalysis = async () => {
    if (!wsRef.current || !isConnected) {
      setError('WebSocket not connected');
      console.log('WebSocket not connected');
      return;
    }

    try {
      // Start session if not already started
      if (!currentSession) {
        console.log('Starting session');
        wsRef.current.startSession();
      }

      setStreamingStatus(true);
      clearFrameHistory();
    } catch (error) {
      setError('Failed to start analysis');
      console.log('Failed to start analysis');
    }
  };

  const handleStopAnalysis = () => {
    console.log('Stopping analysis');
    setStreamingStatus(false);
    setProcessingStatus(false);
  };

  const handleClearHistory = () => {
    clearFrameHistory();
    setTemporalContext(null);
    setSessionStats(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-primary-600" />
              <h1 className="text-xl font-bold text-gray-900">StreamVLM</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" />
                    <span className="text-red-600">Disconnected</span>
                  </>
                )}
              </div>

              {/* API Key Button */}
              <button
                className="btn-secondary"
                onClick={() => setShowApiKeyModal(true)}
              >
                API Keys
              </button>

              {/* Analysis Controls */}
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    onClick={handleStopAnalysis}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Stop Analysis
                  </button>
                ) : (
                  <button
                    onClick={handleStartAnalysis}
                    className="btn-primary flex items-center gap-2"
                    disabled={!isConnected}
                  >
                    <Play className="w-4 h-4" />
                    Start Analysis
                  </button>
                )}
                
                <button
                  onClick={handleClearHistory}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700">
                <span className="font-medium">Error:</span>
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Camera and Settings */}
          <div className="lg:col-span-1 space-y-6">
            <CameraView 
              videoRef={videoRef}
              canvasRef={canvasRef}
              isStreaming={cameraIsStreaming}
              error={cameraError}
              availableDevices={availableDevices}
              selectedDeviceId={selectedDeviceId}
              startCamera={startCamera}
              stopCamera={stopCamera}
              switchDevice={switchDevice}
            />
            <SettingsPanel />
          </div>

          {/* Right Column - Analysis Results */}
          <div className="lg:col-span-2">
            <AnalysisPanel />
          </div>
        </div>
      </main>

      <ApiKeyModal open={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
    </div>
  );
}

export default App; 