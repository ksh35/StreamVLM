#!/usr/bin/env python3
"""
Run script for LiveVLM FastAPI server
"""

import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    # Get configuration from environment variables
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    print(f"Starting LiveVLM server on {host}:{port}")
    print("Available endpoints:")
    print("  - GET  /                    - Health check")
    print("  - GET  /health              - Detailed health check")
    print("  - GET  /docs                - API documentation")
    print("  - GET  /api/models          - Available VLM models")
    print("  - GET  /api/settings        - Default settings")
    print("  - POST /api/vlm/query       - Single VLM query")
    print("  - WS   /ws                  - WebSocket for real-time queries")
    
    # Start the server
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    ) 