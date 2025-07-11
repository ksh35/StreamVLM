import React from 'react';
import { useAppStore } from '../store';
import { VLMModel } from '../types';
import { Settings, Brain, Zap, Clock, MessageSquare } from 'lucide-react';
import { ApiService } from '../services/api';

export const SettingsPanel: React.FC = () => {
  const { settings, availableModels, updateSettings } = useAppStore();

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ selectedModel: event.target.value });
  };

  const handleSummaryModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ summaryModel: event.target.value });
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateSettings({ prompt: event.target.value });
  };

  const handleMaxTokensChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ maxTokens: parseInt(event.target.value) });
  };

  const handleTemperatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ temperature: parseFloat(event.target.value) });
  };

  const handleDelayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ delaySeconds: parseFloat(event.target.value) });
  };

  const handleTemporalContextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ useTemporalContext: event.target.checked });
  };

  const handleAutoStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ autoStart: event.target.checked });
  };

  const handleContextWindowChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newContextWindow = parseInt(event.target.value);
    updateSettings({ contextWindow: newContextWindow });
    
    // Sync with backend
    try {
      await ApiService.updateContextWindow(newContextWindow);
    } catch (error) {
      console.error('Failed to update context window on backend:', error);
    }
  };

  const handleSummaryWindowChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSummaryWindow = parseInt(event.target.value);
    updateSettings({ summaryWindow: newSummaryWindow });
    
    // Sync with backend
    try {
      await ApiService.updateSummaryWindow(newSummaryWindow);
    } catch (error) {
      console.error('Failed to update summary window on backend:', error);
    }
  };

  // Filter models for summary (scene summary) selection
  const summaryCapableModels = availableModels.filter((model: VLMModel) => model.supports_text);

  // Add a function to show configured providers
  const getConfiguredProviders = () => {
    const savedKeys = sessionStorage.getItem('vlmstream_api_keys');
    if (savedKeys) {
      const keys = JSON.parse(savedKeys);
      return Object.keys(keys).filter(key => keys[key] && keys[key].length > 0);
    }
    return [];
  };

  // Add this to show API key status
  const configuredProviders = getConfiguredProviders();

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5" />
        <h2 className="text-xl font-semibold">VLM Settings</h2>
      </div>

      <div className="space-y-4">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            VLM Model
          </label>
          <select
            value={settings.selectedModel}
            onChange={handleModelChange}
            className="input-field"
          >
            {availableModels.map((model: VLMModel) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </option>
            ))}
          </select>
          {availableModels.find((m: VLMModel) => m.id === settings.selectedModel) && (
            <p className="text-xs text-gray-500 mt-1">
              {availableModels.find((m: VLMModel) => m.id === settings.selectedModel)?.description}
            </p>
          )}
        </div>

        {/* Summary Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Summary Model
          </label>
          <select
            value={settings.summaryModel}
            onChange={handleSummaryModelChange}
            className="input-field"
          >
            {summaryCapableModels.map((model: VLMModel) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </option>
            ))}
          </select>
          {summaryCapableModels.find((m: VLMModel) => m.id === settings.summaryModel) && (
            <p className="text-xs text-gray-500 mt-1">
              {summaryCapableModels.find((m: VLMModel) => m.id === settings.summaryModel)?.description}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Model used for generating video summaries from frame analysis
          </p>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Prompt
          </label>
          <textarea
            value={settings.prompt}
            onChange={handlePromptChange}
            className="input-field resize-none"
            rows={3}
            placeholder="What do you see in this image?"
          />
        </div>

        {/* Model Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Tokens
            </label>
            <input
              type="number"
              min="1"
              max="4000"
              value={settings.maxTokens}
              onChange={handleMaxTokensChange}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={handleTemperatureChange}
              className="input-field"
            />
          </div>
        </div>

        {/* Processing Settings */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Query Delay (seconds)
          </label>
          <input
            type="number"
            min="0.1"
            max="60"
            step="0.1"
            value={settings.delaySeconds}
            onChange={handleDelayChange}
            className="input-field"
          />
        </div>

        {/* Feature Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Zap className="w-4 h-4" />
              Use Temporal Context
            </label>
            <input
              type="checkbox"
              checked={settings.useTemporalContext}
              onChange={handleTemporalContextChange}
              className="form-checkbox text-primary-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Settings className="w-4 h-4" />
              Auto-start Analysis
            </label>
            <input
              type="checkbox"
              checked={settings.autoStart}
              onChange={handleAutoStartChange}
              className="form-checkbox text-primary-500"
            />
          </div>
        </div>

        {/* Temporal Context */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Use Temporal Context
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={settings.useTemporalContext}
              onChange={handleTemporalContextChange}
              className="form-checkbox text-primary-500"
            />
            <span className="ml-2 text-sm text-gray-600">
              Include context from previous frames
            </span>
          </div>
        </div>

        {/* Context Window */}
        {settings.useTemporalContext && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Image Query Context Window (frames)
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={settings.contextWindow}
              onChange={handleContextWindowChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span className="font-medium">{settings.contextWindow} frames</span>
              <span>20</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Number of recent frames to analyze for temporal context in image queries
            </p>
          </div>
        )}

        {/* Summary Window */}
        {settings.useTemporalContext && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Summary Window (frames)
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={settings.summaryWindow}
              onChange={handleSummaryWindowChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span className="font-medium">{settings.summaryWindow} frames</span>
              <span>20</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Number of recent frames to analyze for summary generation
            </p>
          </div>
        )}

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Temporal Context</h3>
          <p className="text-xs text-blue-700">
            When enabled, the VLM will consider previous frames to provide more coherent analysis.
          </p>
        </div>

        {/* Configured API Keys */}
        {configuredProviders.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-sm font-medium text-green-800 mb-1">Configured API Keys</h3>
            <p className="text-xs text-green-700">
              {configuredProviders.join(', ')} API keys configured
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 