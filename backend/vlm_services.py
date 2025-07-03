import os
import requests
import base64
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import asdict
from .models import Settings, ModelInfo
from .frame_history import FrameHistoryManager, FrameData, TemporalContext
from fastapi import Body

logger = logging.getLogger(__name__)

class VLMServices:
    """Simplified service class for handling VLM API calls with basic temporal context"""
    
    def __init__(self, context_window: int = 10, summary_window: int = 10):
        # API Keys - PLACEHOLDERS - Replace with actual keys
        self.api_keys = {
            "openai": os.getenv("OPENAI_API_KEY", "your-openai-api-key-here"),
            "anthropic": os.getenv("ANTHROPIC_API_KEY", "your-anthropic-api-key-here"),
            "google": os.getenv("GOOGLE_API_KEY", "your-google-api-key-here"),
        }
        
        # Available models configuration
        self.available_models = {
            "gpt-4o": {
                "name": "GPT-4o",
                "provider": "openai",
                "description": "OpenAI's latest multimodal model",
                "max_tokens": 4096,
                "supports_images": True,
                "supports_text": True
            },
            "gpt-4o-mini": {
                "name": "GPT-4o Mini",
                "provider": "openai",
                "description": "Faster, more efficient GPT-4o variant",
                "max_tokens": 4096,
                "supports_images": True,
                "supports_text": True
            },
            "claude-3-5-sonnet": {
                "name": "Claude 3.5 Sonnet",
                "provider": "anthropic",
                "description": "Anthropic's latest Claude model",
                "max_tokens": 4096,
                "supports_images": True,
                "supports_text": True
            },
            "claude-3-haiku": {
                "name": "Claude 3 Haiku",
                "provider": "anthropic",
                "description": "Fast and efficient Claude model",
                "max_tokens": 4096,
                "supports_images": True,
                "supports_text": True
            },
            "gemini-1.5-flash": {
                "name": "Gemini 1.5 Flash",
                "provider": "google",
                "description": "Google's fast multimodal model",
                "max_tokens": 2048,
                "supports_images": True,
                "supports_text": True
            },
            "gemini-2.0-flash": {
                "name": "Gemini 2.0 Flash",
                "provider": "google",
                "description": "Google's latest multimodal model",
                "max_tokens": 2048,
                "supports_images": True,
                "supports_text": True
            }
        }
        
        self.default_model = "gemini-2.0-flash"
        
        # Configurable context windows
        self.context_window = context_window
        self.summary_window = summary_window
        
        # Initialize frame history manager
        self.frame_history = FrameHistoryManager(context_window=context_window, summary_window=summary_window)
        
        # Session management
        self.active_sessions: Dict[str, FrameHistoryManager] = {}
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available VLM models"""
        return [
            {
                "id": model_id,
                **model_info
            }
            for model_id, model_info in self.available_models.items()
        ]
    
    def get_default_model(self) -> str:
        """Get the default model"""
        return self.default_model
    
    def _validate_api_key(self, provider: str) -> bool:
        """Validate if API key is set for provider"""
        api_key = self.api_keys.get(provider)
        if not api_key or api_key.startswith("your-"):
            logger.warning(f"API key not set for {provider}")
            return False
        return True
    
    def start_session(self, session_id: Optional[str] = None) -> str:
        """Start a new analysis session"""
        if session_id is None:
            session_id = str(uuid.uuid4())
        
        # Create new frame history manager for this session
        self.active_sessions[session_id] = FrameHistoryManager(context_window=self.context_window, summary_window=self.summary_window)
        self.active_sessions[session_id].start_session(session_id)
        
        logger.info(f"Started new VLM session: {session_id} with context window: {self.context_window}")
        return session_id
    
    def get_session_history(self, session_id: str) -> Optional[FrameHistoryManager]:
        """Get frame history for a specific session"""
        return self.active_sessions.get(session_id)
    

    
    async def query_model_with_history(
        self, 
        model: str, 
        image_b64: str, 
        prompt: str = "What is in this image?",
        settings: Optional[Settings] = None,
        session_id: Optional[str] = None,
        use_temporal_context: bool = True
    ) -> Dict[str, Any]:
        """
        Query a VLM model with simplified temporal context from frame history
        
        Args:
            model: Model identifier
            image_b64: Base64 encoded image
            prompt: Text prompt
            settings: Optional VLM settings
            session_id: Session identifier for frame history
            use_temporal_context: Whether to include temporal context
            
        Returns:
            Dictionary with response and temporal context information
        """
        start_time = time.time()
        
        # Get or create session
        if session_id:
            frame_history = self.get_session_history(session_id)
            if not frame_history:
                session_id = self.start_session(session_id)
                frame_history = self.get_session_history(session_id)
        else:
            session_id = self.start_session()
            frame_history = self.get_session_history(session_id)
        
        # Enhance prompt with temporal context
        enhanced_prompt = prompt
        temporal_context = None
        
        if use_temporal_context and frame_history:
            enhanced_prompt = frame_history.enhance_prompt_with_context(prompt)
            temporal_context = frame_history.get_temporal_context()
        
        # Query the VLM model
        try:
            response = await self.query_model(model, image_b64, enhanced_prompt, settings)
            processing_time = time.time() - start_time
            
            # Create frame data
            frame_data = FrameData(
                timestamp=datetime.now(),
                frame_id=str(uuid.uuid4()),
                image_b64=image_b64,
                prompt=prompt,
                model=model,
                response=response,
                detected_objects=None,
                processing_time=processing_time
            )
            
            # Add to frame history
            if frame_history:
                frame_history.add_frame(frame_data)
                logger.info(f"Added frame to session {session_id}. Total frames: {len(frame_history.frame_history)}")
            else:
                logger.warning(f"No frame history available for session {session_id}")
            
            # Always add to default frame history as well
            if self.frame_history:
                self.frame_history.add_frame(frame_data)
                logger.info(f"Added frame to default history. Total frames: {len(self.frame_history.frame_history)}")
            else:
                logger.warning("No default frame history available")
            
            # Prepare result
            result = {
                "response": response,
                "model": model,
                "processing_time": processing_time,
                "session_id": session_id,
                "frame_id": frame_data.frame_id,
                "prompt": prompt,  # Include the original user prompt
                "temporal_context": self._serialize_temporal_context(temporal_context) if temporal_context else None,
                "detected_objects": []
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error in query_model_with_history: {e}")
            raise e
    
    async def query_model(
        self, 
        model: str, 
        image_b64: str, 
        prompt: str = "What is in this image?",
        settings: Optional[Settings] = None
    ) -> str:
        """
        Query a VLM model with an image and prompt
        
        Args:
            model: Model identifier
            image_b64: Base64 encoded image
            prompt: Text prompt
            settings: Optional VLM settings
            
        Returns:
            Model response as string
        """
        if model not in self.available_models:
            raise ValueError(f"Model {model} not supported")
        
        model_info = self.available_models[model]
        provider = model_info["provider"]
        
        # Validate API key
        if not self._validate_api_key(provider):
            raise ValueError(f"API key not configured for {provider}")
        
        # Use default settings if none provided
        if settings is None:
            settings = Settings()
        
        # Route to appropriate provider
        if provider == "openai":
            return await self._query_openai(model, image_b64, prompt, settings)
        elif provider == "anthropic":
            return await self._query_anthropic(model, image_b64, prompt, settings)
        elif provider == "google":
            return await self._query_google(model, image_b64, prompt, settings)
        else:
            raise ValueError(f"Provider {provider} not implemented")
    
    async def _query_openai(self, model: str, image_b64: str, prompt: str, settings: Settings) -> str:
        """Query OpenAI VLM models"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_keys['openai']}"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature
        }
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return result['choices'][0]['message']['content']
            
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenAI API error: {e}")
            raise Exception(f"OpenAI API error: {e}")
    
    async def _query_anthropic(self, model: str, image_b64: str, prompt: str, settings: Settings) -> str:
        """Query Anthropic VLM models"""
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_keys['anthropic'],
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": model,
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64
                            }
                        }
                    ]
                }
            ]
        }
        
        try:
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return result['content'][0]['text']
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Anthropic API error: {e}")
            raise Exception(f"Anthropic API error: {e}")
    
    async def _query_google(self, model: str, image_b64: str, prompt: str, settings: Settings) -> str:
        """Query Google VLM models"""
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_b64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": settings.max_tokens,
                "temperature": settings.temperature
            }
        }
        
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_keys['google']}",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return result['candidates'][0]['content']['parts'][0]['text']
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Google API error: {e}")
            raise Exception(f"Google API error: {e}")
    
    def get_model_info(self, model: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model"""
        if model in self.available_models:
            return {
                "id": model,
                **self.available_models[model]
            }
        return None
    
    def get_session_stats(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a specific session"""
        frame_history = self.get_session_history(session_id)
        if frame_history:
            return frame_history.get_session_stats()
        return None
    
    def clear_session(self, session_id: str) -> bool:
        """Clear a specific session's history"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id].clear_history()
            return True
        return False
    
    def _serialize_temporal_context(self, temporal_context) -> Dict[str, Any]:
        """Convert temporal context to JSON-serializable format"""
        if not temporal_context:
            return {}
        
        context_dict = asdict(temporal_context)
        
        # Convert datetime objects to ISO format strings
        if 'last_update' in context_dict and context_dict['last_update']:
            context_dict['last_update'] = context_dict['last_update'].isoformat()
        
        return context_dict
    
    def update_context_window(self, new_window: int) -> None:
        """Update context window for all active sessions"""
        if new_window != self.context_window:
            self.context_window = new_window
            
            # Update all active sessions
            for session_id, frame_history in self.active_sessions.items():
                frame_history.update_context_window(new_window)
            
            logger.info(f"Updated context window to {new_window} for all active sessions")
    
    def update_summary_window(self, new_window: int) -> None:
        """Update summary window for all active sessions"""
        if new_window != self.summary_window:
            self.summary_window = new_window
            
            # Update all active sessions
            for session_id, frame_history in self.active_sessions.items():
                frame_history.update_summary_window(new_window)
            
            logger.info(f"Updated summary window to {new_window} for all active sessions")
    
    def update_windows(self, context_window: int, summary_window: int) -> None:
        """Update both context and summary windows for all active sessions"""
        self.update_context_window(context_window)
        self.update_summary_window(summary_window)
    
    def get_context_window(self) -> int:
        """Get current context window size"""
        return self.context_window
    
    def get_summary_window(self) -> int:
        """Get current summary window size"""
        return self.summary_window
    
    async def get_general_summary(self, session_id: Optional[str] = None, model: Optional[str] = None, summary_prompt: Optional[str] = None) -> str:
        """
        Get general summary from frame history
        
        Args:
            session_id: Optional session ID. If None, uses default session
            model: Optional specific model to use for summary generation
            summary_prompt: Optional custom summary prompt to use
            
        Returns:
            General summary of recent frames
        """
        logger.info(f"Getting general summary. Session ID: {session_id}, Model: {model}")
        logger.info(f"Default frame history frames: {len(self.frame_history.frame_history) if self.frame_history else 0}")
        
        if not session_id:
            # Use default session
            frame_history = self.frame_history
            logger.info("Using default frame history")
        else:
            frame_history = self.get_session_history(session_id)
            logger.info(f"Using session frame history: {frame_history is not None}")
            
        if not frame_history:
            logger.warning("No frame history available for summary")
            return "No session data available for summary. Please start a session and process some frames first."
            
        logger.info(f"Frame history has {len(frame_history.frame_history)} frames")
        return await frame_history.get_general_summary(force_update=True, model=model, summary_prompt=summary_prompt)
    
    async def generate_scene_summary(self, frame_responses: List[str], model: Optional[str] = None, summary_prompt: Optional[str] = None) -> str:
        """
        Generate intelligent scene summary using LLM analysis
        """
        logger.info(f"Generating scene summary with model: {model}")
        try:
            if summary_prompt:
                prompt = summary_prompt + "\n\n" + "\n".join(frame_responses)
            else:
                prompt = self._create_simple_summary_prompt(frame_responses)

            # Use specified model if it supports text-only summary
            if model and model in self.available_models and self.available_models[model].get("supports_text", False):
                try:
                    summary = await self._query_text_only(
                        model=model,
                        prompt=prompt,
                        settings=Settings(max_tokens=300, temperature=0.3)
                    )
                    logger.info(f"Successfully generated summary using model {model}")
                    return summary.strip()
                except Exception as e:
                    logger.warning(f"Failed to use specified model {model} for summary: {e}")
                    # Fall through to fallback

            # Fallback: try all available models that support text-only summary
            fallback_models = [mid for mid, minfo in self.available_models.items() if minfo.get("supports_text", False)]
            for fallback_model in fallback_models:
                try:
                    summary = await self._query_text_only(
                        model=fallback_model,
                        prompt=prompt,
                        settings=Settings(max_tokens=300, temperature=0.3)
                    )
                    return summary.strip()
                except Exception as e:
                    logger.warning(f"Failed to use model {fallback_model} for summary: {e}")
                    continue

            # If all models fail, use fallback
            logger.warning("All models failed to generate a summary. Using fallback.")
            return self._generate_fallback_summary(frame_responses)
        except Exception as e:
            logger.error(f"Error generating LLM scene summary: {e}")
            return self._generate_fallback_summary(frame_responses)
    
    def _create_simple_summary_prompt(self, frame_responses: List[str]) -> str:
        """Create a simple prompt for LLM analysis"""
        prompt = f"""Based on the following video frame analyses, provide a concise summary of what happened in the video:

FRAME ANALYSES:
"""
        
        for response in frame_responses:
            prompt += f"{response}\n"
        
        prompt += """
TASK: Provide a 3-5 sentence summary that describes what happened in the video. Focus on the actions, movements, and events that occurred. Be specific about what you can see happening.

What story does this video tell? What actually happened?
"""
        
        return prompt
    
    def _generate_fallback_summary(self, frame_responses: List[str]) -> str:
        """Generate fallback summary when LLM is unavailable"""
        if not frame_responses:
            return "No recent frames available for summary."
        
        # Combine frame responses into a coherent summary
        summary = " ".join(frame_responses) + "."
        summary = summary[:-1]
        return summary
    
    async def _query_text_only(self, model: str, prompt: str, settings: Settings) -> str:
        """
        Query LLM with text-only prompt (no image)
        
        Args:
            model: Model identifier
            prompt: Text prompt
            settings: VLM settings
            
        Returns:
            Model response as string
        """
        if model not in self.available_models:
            raise ValueError(f"Model {model} not supported")
        
        model_info = self.available_models[model]
        provider = model_info["provider"]
        
        # Validate API key
        if not self._validate_api_key(provider):
            raise ValueError(f"API key not configured for {provider}")
        
        # Route to appropriate provider for text-only query
        if provider == "openai":
            return await self._query_openai_text_only(model, prompt, settings)
        elif provider == "anthropic":
            return await self._query_anthropic_text_only(model, prompt, settings)
        elif provider == "google":
            return await self._query_google_text_only(model, prompt, settings)
        else:
            raise ValueError(f"Provider {provider} not implemented for text-only queries")
    
    async def _query_openai_text_only(self, model: str, prompt: str, settings: Settings) -> str:
        """Query OpenAI with text-only prompt"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_keys['openai']}"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature
        }
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return result['choices'][0]['message']['content']
            
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenAI API error: {e}")
            raise Exception(f"OpenAI API error: {e}")
    
    async def _query_anthropic_text_only(self, model: str, prompt: str, settings: Settings) -> str:
        """Query Anthropic with text-only prompt"""
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_keys['anthropic'],
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": model,
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        try:
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return result['content'][0]['text']
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Anthropic API error: {e}")
            raise Exception(f"Anthropic API error: {e}")
    
    async def _query_google_text_only(self, model: str, prompt: str, settings: Settings) -> str:
        """Query Google with text-only prompt"""
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": settings.max_tokens,
                "temperature": settings.temperature
            }
        }
        
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_keys['google']}",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            return result['candidates'][0]['content']['parts'][0]['text']
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Google API error: {e}")
            raise Exception(f"Google API error: {e}") 