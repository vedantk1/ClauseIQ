"""
🤖 AI DEBUG HELPER
Structured logging and diagnostics designed for AI assistant troubleshooting.
When things break, the AI can easily parse these logs and provide targeted help.
"""
import json
import logging
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum
import psutil
import os

logger = logging.getLogger("ai_debug")

class DebugLevel(Enum):
    """Debug severity levels for AI assistant triage."""
    CRITICAL = "CRITICAL"  # System down, immediate attention needed
    ERROR = "ERROR"        # Feature broken, user impact
    WARNING = "WARNING"    # Degraded performance, investigate soon
    INFO = "INFO"          # Normal operation, good to know
    DEBUG = "DEBUG"        # Detailed troubleshooting info

class AIDebugLogger:
    """
    Structured logging designed for AI assistant consumption.
    When you ask me to debug an issue, I can parse these logs easily.
    """
    
    def __init__(self):
        self.logger = logging.getLogger("ai_debug")
    
    def log_system_event(self, 
                        event_type: str,
                        level: DebugLevel,
                        message: str,
                        context: Optional[Dict[str, Any]] = None,
                        error: Optional[Exception] = None,
                        user_id: Optional[str] = None,
                        request_id: Optional[str] = None) -> None:
        """
        🤖 AI-FRIENDLY STRUCTURED LOGGING
        
        When you have issues, I can search for these structured logs:
        - grep "ERROR.*RAG_PIPELINE" logs/ai_debug.log
        - grep "user_id.*abc123" logs/ai_debug.log
        - grep "CRITICAL" logs/ai_debug.log
        """
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "level": level.value,
            "message": message,
            "context": context or {},
            "user_id": user_id,
            "request_id": request_id,
            "traceback": None
        }
        
        if error:
            log_entry["error"] = {
                "type": error.__class__.__name__,
                "message": str(error),
                "traceback": traceback.format_exc()
            }
        
        # Log in both structured JSON and human-readable format
        json_log = json.dumps(log_entry, default=str)
        human_log = f"[{level.value}] {event_type}: {message}"
        
        if level == DebugLevel.CRITICAL:
            self.logger.critical(f"🚨 {human_log}")
            self.logger.critical(f"JSON: {json_log}")
        elif level == DebugLevel.ERROR:
            self.logger.error(f"❌ {human_log}")
            self.logger.error(f"JSON: {json_log}")
        elif level == DebugLevel.WARNING:
            self.logger.warning(f"⚠️ {human_log}")
            self.logger.warning(f"JSON: {json_log}")
        elif level == DebugLevel.INFO:
            self.logger.info(f"ℹ️ {human_log}")
            self.logger.info(f"JSON: {json_log}")
        else:  # DEBUG
            self.logger.debug(f"🔍 {human_log}")
            self.logger.debug(f"JSON: {json_log}")
    
    def log_rag_pipeline_step(self,
                             step_name: str,
                             success: bool,
                             duration_ms: float,
                             details: Dict[str, Any],
                             user_id: str,
                             document_id: str,
                             query: str) -> None:
        """Log RAG pipeline steps for AI debugging."""
        
        level = DebugLevel.INFO if success else DebugLevel.ERROR
        
        context = {
            "step_name": step_name,
            "success": success,
            "duration_ms": duration_ms,
            "document_id": document_id,
            "query": query[:100],  # Truncate for privacy
            "details": details
        }
        
        message = f"RAG step '{step_name}' {'✅ succeeded' if success else '❌ failed'} in {duration_ms}ms"
        
        self.log_system_event(
            event_type="RAG_PIPELINE_STEP",
            level=level,
            message=message,
            context=context,
            user_id=user_id
        )
    
    def log_api_error(self,
                     endpoint: str,
                     method: str,
                     error: Exception,
                     user_id: Optional[str] = None,
                     request_data: Optional[Dict] = None) -> None:
        """Log API errors for AI troubleshooting."""
        
        context = {
            "endpoint": endpoint,
            "method": method,
            "request_data": request_data
        }
        
        self.log_system_event(
            event_type="API_ERROR",
            level=DebugLevel.ERROR,
            message=f"API {method} {endpoint} failed: {str(error)}",
            context=context,
            error=error,
            user_id=user_id
        )
    
    def log_database_operation(self,
                              operation: str,
                              collection: str,
                              success: bool,
                              duration_ms: float,
                              error: Optional[Exception] = None,
                              document_count: Optional[int] = None) -> None:
        """Log database operations for AI troubleshooting."""
        
        level = DebugLevel.INFO if success else DebugLevel.ERROR
        
        context = {
            "operation": operation,
            "collection": collection,
            "success": success,
            "duration_ms": duration_ms,
            "document_count": document_count
        }
        
        message = f"DB {operation} on {collection} {'✅ succeeded' if success else '❌ failed'} in {duration_ms}ms"
        
        self.log_system_event(
            event_type="DATABASE_OPERATION",
            level=level,
            message=message,
            context=context,
            error=error
        )

def get_system_diagnostics() -> Dict[str, Any]:
    """
    🤖 SYSTEM DIAGNOSTICS FOR AI TROUBLESHOOTING
    
    When you ask me "what's wrong with the system?", I can call this
    to get a comprehensive health snapshot.
    """
    
    try:
        # Memory info
        memory = psutil.virtual_memory()
        
        # Disk info
        disk = psutil.disk_usage('/')
        
        # Process info
        process = psutil.Process()
        
        diagnostics = {
            "timestamp": datetime.utcnow().isoformat(),
            "system_health": {
                "memory_usage_percent": memory.percent,
                "memory_available_gb": round(memory.available / (1024**3), 2),
                "disk_usage_percent": disk.percent,
                "disk_free_gb": round(disk.free / (1024**3), 2),
                "cpu_percent": psutil.cpu_percent(),
                "load_average": os.getloadavg() if hasattr(os, 'getloadavg') else None
            },
            "process_health": {
                "memory_usage_mb": round(process.memory_info().rss / (1024**2), 2),
                "cpu_percent": process.cpu_percent(),
                "num_threads": process.num_threads(),
                "open_files": len(process.open_files()),
                "connections": len(process.connections())
            },
            "python_info": {
                "version": f"{psutil.sys.version_info.major}.{psutil.sys.version_info.minor}.{psutil.sys.version_info.micro}",
                "platform": psutil.sys.platform
            }
        }
        
        return diagnostics
        
    except Exception as e:
        return {
            "error": f"Failed to get diagnostics: {str(e)}",
            "timestamp": datetime.utcnow().isoformat()
        }

def log_startup_diagnostics():
    """Log system state at startup for AI reference."""
    ai_debug = AIDebugLogger()
    
    diagnostics = get_system_diagnostics()
    
    ai_debug.log_system_event(
        event_type="SYSTEM_STARTUP",
        level=DebugLevel.INFO,
        message="ClauseIQ backend starting up - system diagnostics captured",
        context=diagnostics
    )

# Global AI debug logger instance
ai_debug = AIDebugLogger()
