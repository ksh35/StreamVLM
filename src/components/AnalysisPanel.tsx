import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { WebSocketService } from '../services/websocket';
import { Brain, Clock, Activity, History } from 'lucide-react';

// Default summary prompt (should match backend)
const DEFAULT_SUMMARY_PROMPT = `Based on the following video frame analyses, provide a concise summary of what happened in the video:\n\nFRAME ANALYSES:\n\n...\n\nTASK: Provide a 3-5 sentence summary that describes what happened in the video. Focus on the actions, movements, and events that occurred. Be specific about what you can see happening.\n\nWhat story does this video tell? What actually happened?`;

export const AnalysisPanel: React.FC = () => {
  const { 
    sessionStats,
    currentResponse,
    detectedObjects,
    generalSummary,
    settings,
    frameHistory,
    setGeneralSummary
  } = useAppStore();

  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [summaryPrompt, setSummaryPrompt] = useState<string>(DEFAULT_SUMMARY_PROMPT);
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);

  useEffect(() => {
    // Create WebSocket service for summary requests
    const ws = new WebSocketService();
    
    // Set up message handlers
    ws.onMessage('summary_response', (data) => {
      if (data.summary && (
        data.summary.includes("No video frames") || 
        data.summary.includes("No recent frames") || 
        data.summary.includes("No session data")
      )) {
        setGeneralSummary(''); // Clear error messages
      } else {
        setGeneralSummary(data.summary);
      }
      setIsLoadingSummary(false);
    });
    
    ws.onMessage('summary_error', (data) => {
      console.error('Summary error:', data.error);
      setGeneralSummary(''); // Clear any error messages
      setIsLoadingSummary(false);
    });
    
    setWsService(ws);
    
    // Connect to WebSocket
    ws.connect().then(() => {
      console.log('WebSocket connected successfully');
    }).catch((error) => {
      console.error('WebSocket connection failed:', error);
    });

    return () => {
      ws.disconnect();
    };
  }, [setGeneralSummary]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleGetSummary = async () => {
    if (!wsService) {
      console.error('WebSocket service not available');
      return;
    }
    
    if (!wsService.isConnected()) {
      console.error('WebSocket is not connected');
      return;
    }
    
    setIsLoadingSummary(true);
    try {
      wsService.getSummary(settings.summaryModel, summaryPrompt);
    } catch (error) {
      console.error('Error getting summary:', error);
      setIsLoadingSummary(false);
    }
  };

  const renderFrameData = (frame: any, index: number) => (
    <div key={index} className="bg-white border border-gray-200 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">Frame {frame.frame_id}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{formatTime(frame.timestamp)}</span>
        </div>
      </div>
      <div className="text-sm text-gray-800 mb-2">{frame.response}</div>
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span>Model: {frame.model}</span>
        <span>Time: {frame.processing_time?.toFixed(2)}s</span>
        <span className="text-blue-600 font-medium">Prompt: "{frame.prompt}"</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
        <Brain className="w-6 h-6" />
        Analysis Results
      </h2>

      {/* General Summary Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-700">Video Summary</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setGeneralSummary('');
                handleGetSummary();
              }}
              disabled={isLoadingSummary}
              className="px-4 py-2 bg-primary-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 font-medium"
            >
              {isLoadingSummary
                ? 'Analyzing Video...'
                : generalSummary
                  ? 'Refresh Summary'
                  : 'Generate Summary'}
            </button>
            <button
              className="text-xs text-gray-400 underline hover:text-blue-500 px-1 py-0.5"
              style={{ fontSize: '0.8rem' }}
              onClick={() => setShowPromptInput((v) => !v)}
              tabIndex={-1}
            >
              {showPromptInput ? 'Hide summary prompt' : 'Edit summary prompt'}
            </button>
          </div>
        </div>
        {showPromptInput && (
          <div className="mb-2">
            <textarea
              className="w-full text-xs border border-gray-200 rounded p-2 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-300"
              style={{ minHeight: 40, maxHeight: 80, resize: 'vertical' }}
              value={summaryPrompt}
              onChange={e => setSummaryPrompt(e.target.value)}
              placeholder="Summary prompt for the LLM..."
            />
            <div className="text-xs text-gray-400 mt-1">This prompt controls how the video summary is generated. Default is recommended.</div>
          </div>
        )}
        
        {generalSummary && !generalSummary.includes("No video frames") && !generalSummary.includes("No recent frames") && !generalSummary.includes("No session data") ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-gray-800 leading-relaxed mb-2">{generalSummary}</p>
                <div className="text-sm text-gray-600">
                  Based on analysis of last {settings.summaryWindow} frames
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-gray-600 mb-2">
                <strong>No video summary yet</strong>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Click "Generate Summary" to analyze what happened in the last {settings.summaryWindow} frames of video
              </p>
              <div className="text-xs text-gray-400 mb-3">
                This will use AI to describe the actions, movements, and events in your video
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Response */}
      {currentResponse && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Current Analysis</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-800">{currentResponse}</p>
          </div>
        </div>
      )}

      {/* Session Stats */}
      {sessionStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Session Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800">{sessionStats.total_frames}</div>
              <div className="text-sm text-gray-600">Total Frames</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800">{sessionStats.frames_per_minute?.toFixed(1)}</div>
              <div className="text-sm text-gray-600">Frames/Min</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800">{sessionStats.models_used?.length || 0}</div>
              <div className="text-sm text-gray-600">Models Used</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800">{sessionStats.avg_processing_time?.toFixed(2)}s</div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
          </div>
        </div>
      )}

      {/* Frame History */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <History className="w-4 h-4" />
          Recent Frames ({frameHistory.length})
        </h3>
        
        {frameHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No frames processed yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {frameHistory.slice().reverse().map(renderFrameData)}
          </div>
        )}
      </div>
    </div>
  );
}; 