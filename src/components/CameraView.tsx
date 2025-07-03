import React from 'react';
import { useAppStore } from '../store';
import { Camera, Play, Square } from 'lucide-react';
import { RefObject } from 'react';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  error: string | null;
  availableDevices: MediaDeviceInfo[];
  selectedDeviceId: string | undefined;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  switchDevice: (deviceId: string) => Promise<void>;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  isStreaming,
  error,
  availableDevices,
  selectedDeviceId,
  startCamera,
  stopCamera,
  switchDevice,
}) => {
  const { cameraSettings } = useAppStore();

  const handleStartCamera = async () => {
    await startCamera(selectedDeviceId);
  };

  const handleStopCamera = () => {
    stopCamera();
  };

  const handleDeviceChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value;
    if (deviceId) {
      await switchDevice(deviceId);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Camera View
        </h2>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              onClick={handleStopCamera}
              className="btn-secondary flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleStartCamera}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Camera Device Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Camera Device
          </label>
          <select
            value={selectedDeviceId || ''}
            onChange={handleDeviceChange}
            className="input-field"
            disabled={isStreaming}
          >
            {availableDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}...`}
              </option>
            ))}
          </select>
        </div>

        {/* Video Display */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-auto"
            autoPlay
            playsInline
            muted
          />
          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
              <div className="text-center">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Camera not active</p>
                <p className="text-sm opacity-75">Click Start to begin streaming</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />

        {/* Camera Status */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-500' : 'bg-gray-400'}`} />
            {isStreaming ? 'Streaming' : 'Stopped'}
          </div>
          <div>
            {cameraSettings.width} × {cameraSettings.height} @ {cameraSettings.frameRate}fps
          </div>
        </div>
      </div>
    </div>
  );
}; 