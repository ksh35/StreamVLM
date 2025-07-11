import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from collections import deque
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class FrameData:
    """Data structure for storing frame information and VLM response"""
    timestamp: datetime
    frame_id: str
    image_b64: str
    prompt: str
    model: str
    response: str
    detected_objects: Optional[List[str]] = None
    processing_time: Optional[float] = None

@dataclass
class TemporalContext:
    """Temporal context using raw LLM outputs from recent frames"""
    recent_responses: List[str]  # Raw LLM outputs from recent frames
    last_update: datetime

class FrameHistoryManager:
    """Simplified frame history manager focusing on summaries"""
    
    def __init__(self, max_frames: int = 50, max_age_minutes: int = 10, context_window: int = 10, summary_window: int = 10):
        self.max_frames = max_frames
        self.max_age_minutes = max_age_minutes
        self.context_window = context_window
        self.summary_window = summary_window
        self.frame_history: deque = deque(maxlen=max_frames)
        self.session_id: Optional[str] = None
        self.last_context_update: Optional[datetime] = None
        self.cached_context: Optional[TemporalContext] = None
        self.last_summary_update: Optional[datetime] = None
        self.cached_summary: Optional[str] = None
        
    def start_session(self, session_id: str):
        """Start a new analysis session"""
        self.session_id = session_id
        self.frame_history.clear()
        self.last_context_update = None
        self.cached_context = None
        self.last_summary_update = None
        self.cached_summary = None
        logger.info(f"Started new session: {session_id}")
    
    def add_frame(self, frame_data: FrameData) -> None:
        """Add a new frame to the history"""
        # Clean old frames
        self._clean_old_frames()
        
        # Add new frame
        self.frame_history.append(frame_data)
        
        # Invalidate cached context
        self.cached_context = None
        
        logger.debug(f"Added frame {frame_data.frame_id} to history. Total frames: {len(self.frame_history)}")
    
    def _clean_old_frames(self) -> None:
        """Remove frames older than max_age_minutes"""
        cutoff_time = datetime.now() - timedelta(minutes=self.max_age_minutes)
        while self.frame_history and self.frame_history[0].timestamp < cutoff_time:
            self.frame_history.popleft()
    
    def get_recent_frames(self, count: int = 5) -> List[FrameData]:
        """Get the most recent frames"""
        return list(self.frame_history)[-count:]
    
    def get_temporal_context(self, force_update: bool = False) -> TemporalContext:
        """Get temporal context using raw LLM outputs from recent frames"""
        if (self.cached_context and not force_update and 
            self.last_context_update and 
            datetime.now() - self.last_context_update < timedelta(seconds=5)):
            return self.cached_context
        
        if not self.frame_history:
            return self._create_empty_context()
        
        # Get recent frames using configurable context window
        recent_frames = self.get_recent_frames(min(self.context_window, len(self.frame_history)))
        
        # Extract raw LLM responses from recent frames
        recent_responses = [frame.response for frame in recent_frames]
        
        # Create and cache context
        context = TemporalContext(
            recent_responses=recent_responses,
            last_update=datetime.now()
        )
        
        self.cached_context = context
        self.last_context_update = datetime.now()
        
        return context
    
    def _generate_activity_summary(self, frames: List[FrameData]) -> str:
        """Generate a simple summary of recent activity"""
        if not frames:
            return "No recent activity"
        
        # Extract key information from recent responses
        recent_responses = [f.response for f in frames[-3:]]  # Last 3 frames
        
        # Simple summary based on common themes
        all_text = " ".join(recent_responses).lower()
        
        if "person" in all_text or "people" in all_text:
            return "People present in scene"
        elif "object" in all_text or "item" in all_text:
            return "Objects visible in scene"
        elif "empty" in all_text or "clear" in all_text:
            return "Relatively empty scene"
        else:
            return "General scene activity"
    
    def _create_empty_context(self) -> TemporalContext:
        """Create empty temporal context"""
        return TemporalContext(
            recent_responses=[],
            last_update=datetime.now()
        )
    
    def enhance_prompt_with_context(self, base_prompt: str, include_history: bool = True) -> str:
        """Enhance a base prompt with temporal context using raw LLM outputs"""
        if not include_history or not self.frame_history:
            return base_prompt
        
        context = self.get_temporal_context()
        
        enhanced_prompt = f"{base_prompt}\n\n"
        enhanced_prompt += "Temporal Context (Recent Frame Analyses):\n"
        
        if context.recent_responses:
            for i, response in enumerate(context.recent_responses[-5:], 1):  # Last 5 responses
                enhanced_prompt += f"Frame {i}: {response}\n"
        
        enhanced_prompt += "\nPlease consider these recent previous frame analyses when analyzing the current frame."
        
        return enhanced_prompt
    
    def get_session_stats(self) -> Dict[str, Any]:
        """Get statistics about the current session"""
        if not self.frame_history:
            return {"total_frames": 0, "session_duration": 0}
        
        first_frame = self.frame_history[0]
        last_frame = self.frame_history[-1]
        
        session_duration = (last_frame.timestamp - first_frame.timestamp).total_seconds()
        
        return {
            "total_frames": len(self.frame_history),
            "session_duration": session_duration,
            "frames_per_minute": len(self.frame_history) / (session_duration / 60) if session_duration > 0 else 0,
            "models_used": list(set(f.model for f in self.frame_history)),
            "avg_processing_time": sum(f.processing_time or 0 for f in self.frame_history) / len(self.frame_history) if self.frame_history else 0
        }
    
    def export_history(self) -> List[Dict[str, Any]]:
        """Export frame history as JSON-serializable data"""
        return [asdict(frame) for frame in self.frame_history]
    
    def clear_history(self) -> None:
        """Clear all frame history"""
        self.frame_history.clear()
        self.cached_context = None
        self.last_context_update = None
        self.last_summary_update = None
        self.cached_summary = None
        logger.info("Frame history cleared")
    
    async def get_general_summary(
        self, 
        force_update: bool = False, 
        model: Optional[str] = None, 
        summary_prompt: Optional[str] = None,
        user_api_keys: Optional[Dict[str, str]] = None
    ) -> str:
        """Generate a summary of what happened in recent frames using LLM"""
        if not self.frame_history:
            return "No video frames have been processed yet. Start the camera and begin analysis to generate a summary."
        # Get the most recent frames based on summary window
        recent_frames = self.get_recent_frames(min(self.summary_window, len(self.frame_history)))
        if not recent_frames:
            return "No recent frames available for summary. Try processing more video frames first."
        frame_responses = [f.response for f in recent_frames]
        # Call the LLM-powered summary
        return await self._generate_llm_summary(frame_responses, model, summary_prompt, user_api_keys)
    
    async def _generate_llm_summary(
        self, 
        frame_responses: List[str], 
        model: Optional[str] = None, 
        summary_prompt: Optional[str] = None,
        user_api_keys: Optional[Dict[str, str]] = None
    ) -> str:
        """Generate a summary of recent frames using LLM"""
        try:
            # Import VLM service for LLM analysis
            from .vlm_services import VLMServices
            
            # Create VLM service instance with default windows
            vlm_service = VLMServices(context_window=10, summary_window=10)
            
            # Generate LLM-powered summary
            summary = await vlm_service.generate_scene_summary(
                frame_responses, 
                model=model, 
                summary_prompt=summary_prompt,
                user_api_keys=user_api_keys
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"Error generating LLM summary: {e}")
            # Fallback to template-based summary
            return self._generate_template_summary(frame_responses)
    
    def _generate_template_summary(self, frame_responses: List[str]) -> str:
        """Generate a template-based summary as fallback"""
        if not frame_responses:
            return "No recent frames available for summary. Try processing more video frames first."
        
        # Combine frame responses into a coherent summary
        summary = ". ".join(frame_responses) + "."
        
        return summary
    
    def update_context_window(self, new_window: int) -> None:
        """Update the context window size and invalidate caches"""
        if new_window != self.context_window:
            self.context_window = new_window
            self.cached_context = None
            self.cached_summary = None
            self.last_context_update = None
            self.last_summary_update = None
            logger.info(f"Context window updated to {new_window} frames")
    
    def update_summary_window(self, new_window: int) -> None:
        """Update the summary window size and invalidate summary cache"""
        if new_window != self.summary_window:
            self.summary_window = new_window
            self.cached_summary = None
            self.last_summary_update = None
            logger.info(f"Summary window updated to {new_window} frames")
    
    def update_windows(self, context_window: int, summary_window: int) -> None:
        """Update both context and summary windows"""
        self.update_context_window(context_window)
        self.update_summary_window(summary_window) 