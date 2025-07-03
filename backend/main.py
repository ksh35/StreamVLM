from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import base64
import os
from typing import List, Dict, Any, Optional
import logging
from dotenv import load_dotenv

from .vlm_services import VLMServices
from .models import (
    VLMRequest, VLMResponse, Settings, 
    TemporalContextRequest, TemporalContextResponse,
    SessionRequest, SessionResponse, SessionStats
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LiveVLM API",
    description="Real-time Vision Language Model API for live video analysis with temporal context",
    version="1.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize VLM services
vlm_services = VLMServices(context_window=10, summary_window=10)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.session_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if session_id:
            if session_id not in self.session_connections:
                self.session_connections[session_id] = []
            self.session_connections[session_id].append(websocket)
        
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        # Remove from session connections
        for session_id, connections in self.session_connections.items():
            if websocket in connections:
                connections.remove(websocket)
                if not connections:
                    del self.session_connections[session_id]
        
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

    async def broadcast_to_session(self, message: str, session_id: str):
        """Broadcast message to all connections in a specific session"""
        if session_id in self.session_connections:
            disconnected = []
            for connection in self.session_connections[session_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to session {session_id}: {e}")
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for connection in disconnected:
                self.disconnect(connection)

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "LiveVLM API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "vlm_services": vlm_services.get_available_models()}

@app.post("/api/vlm/query", response_model=VLMResponse)
async def query_vlm(request: VLMRequest):
    """
    Process a single image with VLM (without temporal context)
    """
    try:
        response = await vlm_services.query_model(
            model=request.model,
            image_b64=request.image_b64,
            prompt=request.prompt,
            settings=request.settings
        )
        return VLMResponse(
            success=True,
            response=response,
            model=request.model,
            timestamp=request.timestamp
        )
    except Exception as e:
        logger.error(f"Error processing VLM query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vlm/query-with-context", response_model=TemporalContextResponse)
async def query_vlm_with_context(request: TemporalContextRequest):
    """
    Process a single image with VLM using temporal context from frame history
    """
    try:
        result = await vlm_services.query_model_with_history(
            model=request.model,
            image_b64=request.image_b64,
            prompt=request.prompt,
            settings=request.settings,
            session_id=request.session_id,
            use_temporal_context=request.use_temporal_context
        )
        
        return TemporalContextResponse(
            success=True,
            response=result["response"],
            model=result["model"],
            session_id=result["session_id"],
            frame_id=result["frame_id"],
            processing_time=result["processing_time"],
            prompt=result["prompt"],
            temporal_context=result["temporal_context"],
            detected_objects=result["detected_objects"]
        )
    except Exception as e:
        logger.error(f"Error processing VLM query with context: {e}")
        return TemporalContextResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/session", response_model=SessionResponse)
async def manage_session(request: SessionRequest):
    """
    Manage VLM analysis sessions
    """
    try:
        if request.action == "start":
            session_id = vlm_services.start_session(request.session_id)
            return SessionResponse(
                success=True,
                session_id=session_id,
                message="Session started successfully"
            )
        
        elif request.action == "stats":
            if not request.session_id:
                raise HTTPException(status_code=400, detail="Session ID required for stats")
            
            stats = vlm_services.get_session_stats(request.session_id)
            if not stats:
                raise HTTPException(status_code=404, detail="Session not found")
            
            return SessionResponse(
                success=True,
                session_id=request.session_id,
                stats=SessionStats(
                    session_id=request.session_id,
                    total_frames=stats["total_frames"],
                    session_duration=stats["session_duration"],
                    frames_per_minute=stats["frames_per_minute"],
                    models_used=stats["models_used"],
                    avg_processing_time=stats["avg_processing_time"]
                )
            )
        
        elif request.action == "clear":
            if not request.session_id:
                raise HTTPException(status_code=400, detail="Session ID required for clear")
            
            success = vlm_services.clear_session(request.session_id)
            if not success:
                raise HTTPException(status_code=404, detail="Session not found")
            
            return SessionResponse(
                success=True,
                session_id=request.session_id,
                message="Session cleared successfully"
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error managing session: {e}")
        return SessionResponse(
            success=False,
            error=str(e)
        )

@app.get("/api/models")
async def get_available_models():
    """
    Get list of available VLM models
    """
    return {
        "models": vlm_services.get_available_models(),
        "default_model": vlm_services.get_default_model()
    }

@app.get("/api/settings")
async def get_default_settings():
    """
    Get default settings for VLM queries
    """
    return {
        "max_tokens": 300,
        "temperature": 0.7,
        "delay_seconds": 2,
        "supported_formats": ["jpeg", "png", "webp"],
        "context_window": vlm_services.get_context_window()
    }

@app.post("/api/context-window")
async def update_context_window(context_window: int):
    """Update the context window for image queries"""
    vlm_services.update_context_window(context_window)
    return {"success": True, "context_window": context_window}

@app.get("/api/context-window")
async def get_context_window():
    """Get the current context window for image queries"""
    return {"context_window": vlm_services.get_context_window()}

@app.post("/api/summary-window")
async def update_summary_window(summary_window: int):
    """Update the summary window for summaries"""
    vlm_services.update_summary_window(summary_window)
    return {"success": True, "summary_window": summary_window}

@app.get("/api/summary-window")
async def get_summary_window():
    """Get the current summary window for summaries"""
    return {"summary_window": vlm_services.get_summary_window()}

@app.post("/api/windows")
async def update_windows(context_window: int, summary_window: int):
    """Update both context and summary windows"""
    vlm_services.update_windows(context_window, summary_window)
    return {
        "success": True, 
        "context_window": context_window, 
        "summary_window": summary_window
    }

@app.get("/api/summary")
async def get_summary(request: Request):
    model = request.query_params.get("model")
    summary_prompt = request.query_params.get("summary_prompt")
    return {"summary": await vlm_services.get_general_summary(model=model, summary_prompt=summary_prompt)}

@app.post("/api/summary")
async def generate_summary(request: Request):
    data = await request.json()
    model = data.get("model") if isinstance(data, dict) else None
    summary_prompt = data.get("summary_prompt") if isinstance(data, dict) else None
    return {"summary": await vlm_services.get_general_summary(model=model, summary_prompt=summary_prompt)}

@app.post("/api/save-keys")
async def save_api_keys(
    openai_key: str = Body(None),
    anthropic_key: str = Body(None),
    google_key: str = Body(None)
):
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    # Read existing .env
    existing = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    existing[k] = v
    # Update with new keys if provided
    if openai_key is not None:
        existing["OPENAI_API_KEY"] = openai_key
        vlm_services.api_keys["openai"] = openai_key  # Update running instance
    if anthropic_key is not None:
        existing["ANTHROPIC_API_KEY"] = anthropic_key
        vlm_services.api_keys["anthropic"] = anthropic_key  # Update running instance
    if google_key is not None:
        existing["GOOGLE_API_KEY"] = google_key
        vlm_services.api_keys["google"] = google_key  # Update running instance
    # Write back
    with open(env_path, "w") as f:
        for k, v in existing.items():
            f.write(f"{k}={v}\n")
    return {"success": True}

@app.get("/api/keys-status")
async def keys_status():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    status = {"openai": False, "anthropic": False, "google": False}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY=") and line.strip().split("=", 1)[1]:
                    status["openai"] = True
                if line.startswith("ANTHROPIC_API_KEY=") and line.strip().split("=", 1)[1]:
                    status["anthropic"] = True
                if line.startswith("GOOGLE_API_KEY=") and line.strip().split("=", 1)[1]:
                    status["google"] = True
    return status

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time VLM processing with temporal context
    """
    session_id = None
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "vlm_query":
                # Process VLM query with temporal context
                try:
                    # Convert settings dict to Settings object
                    settings_dict = message.get("settings", {})
                    settings = None
                    if settings_dict:
                        settings = Settings(**settings_dict)
                    
                    result = await vlm_services.query_model_with_history(
                        model=message.get("model", "gpt-4o"),
                        image_b64=message.get("image_b64"),
                        prompt=message.get("prompt", "What is in this image?"),
                        settings=settings,  # Now it's a Settings object, not a dict
                        session_id=message.get("session_id"),
                        use_temporal_context=message.get("use_temporal_context", True)
                    )
                    
                    session_id = result["session_id"]
                    
                    # Send response back to client
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "vlm_response",
                            "success": True,
                            "response": result["response"],
                            "model": result["model"],
                            "session_id": result["session_id"],
                            "frame_id": result["frame_id"],
                            "processing_time": result["processing_time"],
                            "prompt": result["prompt"],
                            "temporal_context": result["temporal_context"],
                            "detected_objects": result["detected_objects"],
                            "timestamp": message.get("timestamp")
                        }),
                        websocket
                    )
                    
                    # Broadcast to other connections in the same session
                    if session_id:
                        await manager.broadcast_to_session(
                            json.dumps({
                                "type": "frame_processed",
                                "session_id": session_id,
                                "frame_id": result["frame_id"],
                                "timestamp": message.get("timestamp")
                            }),
                            session_id
                        )
                        
                except Exception as e:
                    logger.error(f"WebSocket VLM error: {e}")
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "vlm_response",
                            "success": False,
                            "error": str(e)
                        }),
                        websocket
                    )
            
            elif message.get("type") == "start_session":
                # Start a new session
                try:
                    session_id = vlm_services.start_session(message.get("session_id"))
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "session_started",
                            "session_id": session_id
                        }),
                        websocket
                    )
                except Exception as e:
                    logger.error(f"Error starting session: {e}")
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "session_error",
                            "error": str(e)
                        }),
                        websocket
                    )
            
            elif message.get("type") == "get_session_stats":
                # Get session statistics
                try:
                    if not session_id:
                        session_id = message.get("session_id")
                    
                    if session_id:
                        stats = vlm_services.get_session_stats(session_id)
                        await manager.send_personal_message(
                            json.dumps({
                                "type": "session_stats",
                                "session_id": session_id,
                                "stats": stats
                            }),
                            websocket
                        )
                    else:
                        await manager.send_personal_message(
                            json.dumps({
                                "type": "session_error",
                                "error": "No active session"
                            }),
                            websocket
                        )
                except Exception as e:
                    logger.error(f"Error getting session stats: {e}")
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "session_error",
                            "error": str(e)
                        }),
                        websocket
                    )
            
            elif message.get("type") == "ping":
                # Respond to ping
                await manager.send_personal_message(
                    json.dumps({"type": "pong"}),
                    websocket
                )
            
            elif message.get("type") == "update_context_window":
                # Update context window
                try:
                    new_window = message.get("context_window", 10)
                    if not isinstance(new_window, int) or new_window < 1 or new_window > 50:
                        await manager.send_personal_message(
                            json.dumps({
                                "type": "context_window_error",
                                "error": "Context window must be an integer between 1 and 50"
                            }),
                            websocket
                        )
                    else:
                        vlm_services.update_context_window(new_window)
                        await manager.send_personal_message(
                            json.dumps({
                                "type": "context_window_updated",
                                "context_window": new_window
                            }),
                            websocket
                        )
                except Exception as e:
                    logger.error(f"Error updating context window: {e}")
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "context_window_error",
                            "error": str(e)
                        }),
                        websocket
                    )
            
            elif message.get("type") == "get_summary":
                # Get enhanced scene summary
                try:
                    model = message.get("model")  # Get model from message
                    summary_prompt = message.get("summary_prompt")
                    summary = await vlm_services.get_general_summary(session_id, model=model, summary_prompt=summary_prompt)
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "summary_response",
                            "summary": summary
                        }),
                        websocket
                    )
                except Exception as e:
                    logger.error(f"Error getting summary: {e}")
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "summary_error",
                            "error": str(e)
                        }),
                        websocket
                    )
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 