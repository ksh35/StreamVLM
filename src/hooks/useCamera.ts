import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraSettings } from '../types';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  error: string | null;
  availableDevices: MediaDeviceInfo[];
  selectedDeviceId: string | undefined;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => string | null;
  switchDevice: (deviceId: string) => Promise<void>;
}

export const useCamera = (settings: CameraSettings): UseCameraReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();

  // Get available camera devices
  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      
      // Select first device by default
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting available devices:', err);
      setError('Failed to get camera devices');
    }
  }, [selectedDeviceId]);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setError(null);
      
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: settings.frameRate },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setSelectedDeviceId(deviceId);
      }
    } catch (err) {
      console.error('Error starting camera:', err);
      setError('Failed to start camera. Please check permissions.');
      setIsStreaming(false);
    }
  }, [settings.width, settings.height, settings.frameRate]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
  }, []);

  // Capture current frame as base64
  const captureFrame = useCallback((): string | null => {
    
    if (!videoRef.current || !canvasRef.current || !isStreaming) {

      return null;
    }

    const video = videoRef.current;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Failed to get canvas context');
        return null;
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    } catch (err) {
      console.error('Error capturing frame:', err);
      return null;
    }
  }, [isStreaming]);

  // Switch to different camera device
  const switchDevice = useCallback(async (deviceId: string) => {
    await startCamera(deviceId);
  }, [startCamera]);

  // Initialize camera devices on mount
  useEffect(() => {
    getAvailableDevices();
  }, [getAvailableDevices]);

  // Request camera permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        getAvailableDevices();
      } catch (err) {
        console.error('Camera permission denied:', err);
        setError('Camera permission is required');
      }
    };

    requestPermissions();
  }, [getAvailableDevices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isStreaming,
    error,
    availableDevices,
    selectedDeviceId,
    startCamera,
    stopCamera,
    captureFrame,
    switchDevice,
  };
}; 