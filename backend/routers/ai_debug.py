"""
🤖 AI ASSISTANT DEBUG ENDPOINTS
Quick diagnostic endpoints that help the AI assistant troubleshoot issues.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import json
import os
import glob
from utils.ai_debug_helper import get_system_diagnostics, ai_debug, DebugLevel
from config.logging import get_foundational_logger

logger = get_foundational_logger(__name__)
router = APIRouter(prefix="/ai-debug", tags=["AI Assistant Debug"])

@router.get("/health-check")
async def ai_health_check():
    """
    🤖 COMPREHENSIVE HEALTH CHECK FOR AI TROUBLESHOOTING
    
    When you ask me 'is the system healthy?', I curl this endpoint.
    """
    try:
        diagnostics = get_system_diagnostics()
        
        # Determine overall health status
        memory_ok = diagnostics["system_health"]["memory_usage_percent"] < 90
        disk_ok = diagnostics["system_health"]["disk_usage_percent"] < 90
        cpu_ok = diagnostics["system_health"]["cpu_percent"] < 80
        
        overall_health = "healthy" if all([memory_ok, disk_ok, cpu_ok]) else "degraded"
        
        return {
            "status": overall_health,
            "timestamp": datetime.utcnow().isoformat(),
            "system_diagnostics": diagnostics,
            "health_indicators": {
                "memory_healthy": memory_ok,
                "disk_healthy": disk_ok,
                "cpu_healthy": cpu_ok
            },
            "quick_summary": f"System {overall_health} - CPU: {diagnostics['system_health']['cpu_percent']}%, Memory: {diagnostics['system_health']['memory_usage_percent']}%, Disk: {diagnostics['system_health']['disk_usage_percent']}%"
        }
        
    except Exception as e:
        ai_debug.log_system_event(
            event_type="HEALTH_CHECK_FAILED",
            level=DebugLevel.ERROR,
            message="Health check endpoint failed",
            error=e
        )
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@router.get("/recent-errors")
async def get_recent_errors(hours: int = 1):
    """
    🤖 GET RECENT ERRORS FOR AI ANALYSIS
    
    When you ask me 'what errors happened recently?', I curl this.
    """
    try:
        error_log_path = "logs/error.log"
        if not os.path.exists(error_log_path):
            return {"errors": [], "message": "No error log found"}
        
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        recent_errors = []
        
        with open(error_log_path, 'r') as f:
            lines = f.readlines()
            
        # Parse recent errors (simplified parsing)
        for line in lines[-100:]:  # Last 100 lines
            if "ERROR" in line or "CRITICAL" in line:
                recent_errors.append({
                    "log_line": line.strip(),
                    "timestamp": datetime.utcnow().isoformat()  # Simplified
                })
        
        return {
            "recent_errors": recent_errors[-20:],  # Last 20 errors
            "error_count": len(recent_errors),
            "time_window_hours": hours,
            "summary": f"Found {len(recent_errors)} errors in the last {hours} hour(s)"
        }
        
    except Exception as e:
        ai_debug.log_system_event(
            event_type="ERROR_RETRIEVAL_FAILED",
            level=DebugLevel.ERROR,
            message="Failed to retrieve recent errors",
            error=e
        )
        raise HTTPException(status_code=500, detail=f"Error retrieval failed: {str(e)}")

@router.get("/rag-status")
async def get_rag_status():
    """
    🤖 RAG PIPELINE STATUS FOR AI TROUBLESHOOTING
    
    When you ask me 'is RAG working?', I curl this endpoint.
    """
    try:
        # Try to get recent RAG activity from logs
        ai_log_path = "logs/app.log"
        rag_activity = []
        
        if os.path.exists(ai_log_path):
            with open(ai_log_path, 'r') as f:
                lines = f.readlines()
            
            # Look for recent RAG activity
            for line in lines[-200:]:  # Last 200 lines
                if "RAG" in line or "rag" in line:
                    rag_activity.append(line.strip())
        
        # Check if RAG service is importable
        rag_service_ok = True
        rag_error = None
        try:
            from services.rag_service import RAGService
            rag_service = RAGService()
        except Exception as e:
            rag_service_ok = False
            rag_error = str(e)
        
        return {
            "rag_service_importable": rag_service_ok,
            "rag_service_error": rag_error,
            "recent_rag_activity": rag_activity[-10:],  # Last 10 RAG-related log entries
            "activity_count": len(rag_activity),
            "summary": f"RAG service {'✅ OK' if rag_service_ok else '❌ ERROR'} - {len(rag_activity)} recent activities"
        }
        
    except Exception as e:
        ai_debug.log_system_event(
            event_type="RAG_STATUS_CHECK_FAILED",
            level=DebugLevel.ERROR,
            message="RAG status check failed",
            error=e
        )
        raise HTTPException(status_code=500, detail=f"RAG status check failed: {str(e)}")

@router.get("/database-status")
async def get_database_status():
    """
    🤖 DATABASE STATUS FOR AI TROUBLESHOOTING
    
    When you ask me 'is the database working?', I curl this.
    """
    try:
        from database.factory import get_database_factory
        
        db_factory = get_database_factory()
        
        # Test database health
        db_healthy = await db_factory.health_check()
        connection_info = db_factory.get_connection_info()
        
        # Try a simple operation
        test_operation_ok = True
        test_error = None
        try:
            # This is a safe read-only test
            db = await db_factory.get_database()
            collections = await db.list_collection_names()
        except Exception as e:
            test_operation_ok = False
            test_error = str(e)
        
        return {
            "database_healthy": db_healthy,
            "connection_info": connection_info,
            "test_operation_success": test_operation_ok,
            "test_error": test_error,
            "collections_accessible": test_operation_ok,
            "summary": f"Database {'✅ HEALTHY' if db_healthy and test_operation_ok else '❌ ISSUES DETECTED'}"
        }
        
    except Exception as e:
        ai_debug.log_system_event(
            event_type="DB_STATUS_CHECK_FAILED",
            level=DebugLevel.ERROR,
            message="Database status check failed",
            error=e
        )
        return {
            "database_healthy": False,
            "error": str(e),
            "summary": "❌ DATABASE STATUS CHECK FAILED"
        }

@router.get("/log-summary")
async def get_log_summary():
    """
    🤖 LOG SUMMARY FOR AI ANALYSIS
    
    When you ask me 'what's in the logs?', I curl this for a quick overview.
    """
    try:
        log_dir = "logs"
        summary = {
            "timestamp": datetime.utcnow().isoformat(),
            "log_files": {},
            "total_errors": 0,
            "total_warnings": 0,
            "recent_activity": []
        }
        
        if not os.path.exists(log_dir):
            return {"error": "Log directory not found", "summary": "No logs available"}
        
        # Check each log file
        for log_file in glob.glob(f"{log_dir}/*.log"):
            filename = os.path.basename(log_file)
            file_stats = os.stat(log_file)
            
            with open(log_file, 'r') as f:
                lines = f.readlines()
            
            # Count error levels
            errors = len([line for line in lines if "ERROR" in line])
            warnings = len([line for line in lines if "WARNING" in line])
            
            summary["log_files"][filename] = {
                "size_mb": round(file_stats.st_size / (1024**2), 2),
                "line_count": len(lines),
                "error_count": errors,
                "warning_count": warnings,
                "last_modified": datetime.fromtimestamp(file_stats.st_mtime).isoformat()
            }
            
            summary["total_errors"] += errors
            summary["total_warnings"] += warnings
            
            # Get recent lines
            if len(lines) > 0:
                summary["recent_activity"].extend(lines[-5:])  # Last 5 lines from each file
        
        return {
            "log_summary": summary,
            "quick_analysis": f"📊 {summary['total_errors']} errors, {summary['total_warnings']} warnings across {len(summary['log_files'])} log files"
        }
        
    except Exception as e:
        ai_debug.log_system_event(
            event_type="LOG_SUMMARY_FAILED",
            level=DebugLevel.ERROR,
            message="Log summary generation failed",
            error=e
        )
        raise HTTPException(status_code=500, detail=f"Log summary failed: {str(e)}")

@router.post("/test-components")
async def test_system_components():
    """
    🤖 TEST ALL MAJOR COMPONENTS FOR AI TROUBLESHOOTING
    
    When you ask me 'test everything', I curl this endpoint.
    """
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "component_tests": {},
        "overall_status": "unknown"
    }
    
    # Test 1: Database
    try:
        from database.factory import get_database_factory
        db_factory = get_database_factory()
        db_healthy = await db_factory.health_check()
        results["component_tests"]["database"] = {
            "status": "✅ PASS" if db_healthy else "❌ FAIL",
            "healthy": db_healthy
        }
    except Exception as e:
        results["component_tests"]["database"] = {
            "status": "❌ ERROR",
            "error": str(e)
        }
    
    # Test 2: RAG Service
    try:
        from services.rag_service import RAGService
        rag_service = RAGService()
        rag_available = await rag_service.is_available()
        results["component_tests"]["rag_service"] = {
            "status": "✅ PASS" if rag_available else "❌ FAIL",
            "available": rag_available
        }
    except Exception as e:
        results["component_tests"]["rag_service"] = {
            "status": "❌ ERROR",
            "error": str(e)
        }
    
    # Test 3: Chat Service
    try:
        from services.chat_service import get_chat_service
        chat_service = get_chat_service()
        chat_available = await chat_service.is_available()
        results["component_tests"]["chat_service"] = {
            "status": "✅ PASS" if chat_available else "❌ FAIL",
            "available": chat_available
        }
    except Exception as e:
        results["component_tests"]["chat_service"] = {
            "status": "❌ ERROR",
            "error": str(e)
        }
    
    # Determine overall status
    all_tests = results["component_tests"]
    passed_tests = [test for test in all_tests.values() if test["status"] == "✅ PASS"]
    
    if len(passed_tests) == len(all_tests):
        results["overall_status"] = "✅ ALL SYSTEMS HEALTHY"
    elif len(passed_tests) > 0:
        results["overall_status"] = f"⚠️ PARTIAL: {len(passed_tests)}/{len(all_tests)} components healthy"
    else:
        results["overall_status"] = "❌ CRITICAL: All components failing"
    
    return results
