from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime

class Settings(BaseModel):
    """VLM query settings"""
    max_tokens: int = Field(default=300, ge=1, le=4000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    delay_seconds: float = Field(default=2.0, ge=0.1, le=60.0)
    
class VLMRequest(BaseModel):
    """Request model for VLM queries"""
    model: str = Field(..., description="VLM model to use")
    image_b64: str = Field(..., description="Base64 encoded image")
    prompt: str = Field(default="What is in this image?", description="Query prompt")
    settings: Optional[Settings] = Field(default=None, description="VLM settings")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now, description="Request timestamp")

class VLMResponse(BaseModel):
    """Response model for VLM queries"""
    success: bool = Field(..., description="Whether the query was successful")
    response: Optional[str] = Field(default=None, description="VLM response text")
    model: Optional[str] = Field(default=None, description="Model used for the query")
    timestamp: Optional[datetime] = Field(default=None, description="Response timestamp")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class ModelInfo(BaseModel):
    """Information about available VLM models"""
    id: str = Field(..., description="Model identifier")
    name: str = Field(..., description="Display name")
    provider: str = Field(..., description="API provider")
    description: str = Field(..., description="Model description")
    max_tokens: int = Field(..., description="Maximum tokens supported")
    supports_images: bool = Field(default=True, description="Whether model supports images")

class TemporalContextRequest(BaseModel):
    """Request model for temporal context queries"""
    model: str = Field(..., description="VLM model to use")
    image_b64: str = Field(..., description="Base64 encoded image")
    prompt: str = Field(default="What is in this image?", description="Query prompt")
    settings: Optional[Settings] = Field(default=None, description="VLM settings")
    session_id: Optional[str] = Field(default=None, description="Session identifier")
    use_temporal_context: bool = Field(default=True, description="Whether to use temporal context")

class TemporalContextResponse(BaseModel):
    """Response model for temporal context queries"""
    success: bool = Field(..., description="Whether the query was successful")
    response: Optional[str] = Field(default=None, description="VLM response text")
    model: Optional[str] = Field(default=None, description="Model used for the query")
    session_id: Optional[str] = Field(default=None, description="Session identifier")
    frame_id: Optional[str] = Field(default=None, description="Frame identifier")
    processing_time: Optional[float] = Field(default=None, description="Processing time in seconds")
    prompt: Optional[str] = Field(default=None, description="Original user prompt")
    temporal_context: Optional[Dict[str, Any]] = Field(default=None, description="Temporal context information")
    detected_objects: Optional[List[str]] = Field(default=None, description="Detected objects")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class SessionStats(BaseModel):
    """Session statistics"""
    session_id: str = Field(..., description="Session identifier")
    total_frames: int = Field(..., description="Total number of frames processed")
    session_duration: float = Field(..., description="Session duration in seconds")
    frames_per_minute: float = Field(..., description="Average frames per minute")
    models_used: List[str] = Field(..., description="Models used in session")
    avg_processing_time: float = Field(..., description="Average processing time per frame")

class SessionRequest(BaseModel):
    """Request model for session operations"""
    session_id: Optional[str] = Field(default=None, description="Session identifier")
    action: str = Field(..., description="Action to perform (start, clear, stats)")

class SessionResponse(BaseModel):
    """Response model for session operations"""
    success: bool = Field(..., description="Whether the operation was successful")
    session_id: Optional[str] = Field(default=None, description="Session identifier")
    message: Optional[str] = Field(default=None, description="Operation message")
    stats: Optional[SessionStats] = Field(default=None, description="Session statistics")
    error: Optional[str] = Field(default=None, description="Error message if failed") 