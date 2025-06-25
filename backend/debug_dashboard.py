"""
🚀 SUPERHUMAN DEBUG DASHBOARD
Real-time debugging and monitoring dashboard for ClauseIQ.

FEATURES:
- Live API request/response monitoring
- Real-time error tracking
- Performance metrics visualization
- User journey debugging
- Chat flow analysis
- RAG pipeline insights
"""
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict, deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import logging
import traceback

logger = logging.getLogger("debug_dashboard")

class DebugDashboard:
    """Real-time debugging dashboard."""
    
    def __init__(self):
        self.connections: List[WebSocket] = []
        self.metrics = {
            "requests": deque(maxlen=1000),
            "errors": deque(maxlen=500),
            "performance": deque(maxlen=200),
            "chat_sessions": {},
            "user_journeys": defaultdict(list),
            "api_calls": deque(maxlen=1000),
            "rag_analytics": deque(maxlen=100)
        }
        
        # Real-time counters
        self.live_stats = {
            "active_users": set(),
            "active_sessions": set(),
            "requests_per_minute": 0,
            "avg_response_time": 0,
            "error_rate": 0,
            "last_update": time.time()
        }
    
    async def connect(self, websocket: WebSocket):
        """Connect a new WebSocket client."""
        await websocket.accept()
        self.connections.append(websocket)
        logger.info(f"Debug dashboard client connected. Total: {len(self.connections)}")
        
        # Send initial state
        await self.broadcast_metrics()
    
    def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket client."""
        if websocket in self.connections:
            self.connections.remove(websocket)
        logger.info(f"Debug dashboard client disconnected. Total: {len(self.connections)}")
    
    async def log_api_request(self, request: Request, response_time: float, status_code: int, error: Optional[str] = None):
        """Log an API request for real-time monitoring."""
        timestamp = datetime.utcnow()
        
        # Extract useful info
        request_data = {
            "timestamp": timestamp.isoformat(),
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "headers": dict(request.headers),
            "response_time": response_time,
            "status_code": status_code,
            "error": error,
            "user_agent": request.headers.get("user-agent", ""),
            "correlation_id": getattr(request.state, 'correlation_id', None)
        }
        
        # Store metrics
        self.metrics["requests"].append(request_data)
        self.metrics["api_calls"].append(request_data)
        
        # Track user activity
        auth_header = request.headers.get("authorization", "")
        if auth_header:
            self.live_stats["active_users"].add(auth_header[:20])  # Partial hash for privacy
        
        # Log errors separately
        if error or status_code >= 400:
            error_data = {
                **request_data,
                "traceback": error,
                "severity": "high" if status_code >= 500 else "medium"
            }
            self.metrics["errors"].append(error_data)
        
        # Update live stats
        self._update_live_stats()
        
        # Broadcast to connected clients
        await self.broadcast_event("api_request", request_data)
    
    async def log_chat_activity(self, session_id: str, message: str, response: str, user_id: str, document_id: str):
        """Log chat activity for debugging chat flows."""
        chat_event = {
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session_id,
            "user_id": user_id,
            "document_id": document_id,
            "message": message[:200],  # Truncate for privacy
            "response": response[:200],
            "message_length": len(message),
            "response_length": len(response)
        }
        
        # Track session
        if session_id not in self.metrics["chat_sessions"]:
            self.metrics["chat_sessions"][session_id] = {
                "created_at": datetime.utcnow().isoformat(),
                "messages": [],
                "user_id": user_id,
                "document_id": document_id
            }
        
        self.metrics["chat_sessions"][session_id]["messages"].append(chat_event)
        self.live_stats["active_sessions"].add(session_id)
        
        await self.broadcast_event("chat_activity", chat_event)
    
    async def log_rag_pipeline(self, pipeline_data: Dict[str, Any]):
        """
        🚀 COMPREHENSIVE RAG PIPELINE LOGGING
        Log detailed RAG pipeline activity with step-by-step insights for optimization.
        Integrates beautifully with React/Next.js frontend debugging dashboard.
        """
        # Enhance pipeline data with analytics
        enhanced_data = {
            **pipeline_data,
            "efficiency_score": self._calculate_pipeline_efficiency(pipeline_data),
            "performance_grade": self._grade_pipeline_performance(pipeline_data),
            "optimization_hints": self._generate_optimization_hints(pipeline_data)
        }
        
        # Store in RAG analytics for trend analysis
        self.metrics["rag_analytics"].append(enhanced_data)
        
        # Update live RAG stats
        self._update_rag_live_stats(enhanced_data)
        
        # Broadcast to connected React frontend clients
        await self.broadcast_event("rag_pipeline", enhanced_data)
        
        logger.info(f"🔍 RAG Pipeline logged: {pipeline_data['success']} | "
                   f"{pipeline_data['total_time_ms']}ms | "
                   f"Grade: {enhanced_data['performance_grade']}")
    
    def _calculate_pipeline_efficiency(self, pipeline_data: Dict[str, Any]) -> float:
        """Calculate RAG pipeline efficiency score (0-100)."""
        if not pipeline_data.get("success", False):
            return 0.0
        
        total_time = pipeline_data.get("total_time_ms", 1000)
        
        # Find retrieval step
        retrieval_step = next((step for step in pipeline_data.get("steps", []) 
                              if step["step"] == "vector_retrieval"), None)
        
        if not retrieval_step:
            return 50.0  # Default if no retrieval data
        
        chunks_found = retrieval_step.get("details", {}).get("chunks_found", 0)
        
        # Efficiency = (chunks found / time taken) * 100, capped at 100
        if total_time > 0:
            efficiency = min((chunks_found / (total_time / 1000)) * 10, 100)
        else:
            efficiency = 100 if chunks_found > 0 else 0
        
        return round(efficiency, 2)
    
    def _grade_pipeline_performance(self, pipeline_data: Dict[str, Any]) -> str:
        """Grade RAG pipeline performance (A-F)."""
        if not pipeline_data.get("success", False):
            return "F"
        
        total_time = pipeline_data.get("total_time_ms", 1000)
        
        if total_time < 500:
            return "A"
        elif total_time < 1000:
            return "B"
        elif total_time < 2000:
            return "C"
        elif total_time < 5000:
            return "D"
        else:
            return "F"
    
    def _generate_optimization_hints(self, pipeline_data: Dict[str, Any]) -> List[str]:
        """Generate optimization hints for RAG pipeline."""
        hints = []
        
        if not pipeline_data.get("success", False):
            hints.append("Pipeline failed - check error logs")
            return hints
        
        total_time = pipeline_data.get("total_time_ms", 0)
        steps = pipeline_data.get("steps", [])
        
        # Analyze each step for optimization opportunities
        for step in steps:
            step_name = step.get("step", "")
            step_time = step.get("time_ms", 0)
            
            if step_name == "vector_retrieval" and step_time > 800:
                hints.append("Vector retrieval is slow - consider index optimization")
            
            if step_name == "llm_generation" and step_time > 3000:
                hints.append("LLM generation is slow - consider model optimization")
            
            if step_name == "vector_retrieval":
                chunks = step.get("details", {}).get("chunks_found", 0)
                if chunks == 0:
                    hints.append("No chunks found - check document processing")
                elif chunks > 10:
                    hints.append("Too many chunks retrieved - consider better filtering")
        
        if total_time > 3000:
            hints.append("Overall response time is high - consider caching")
        
        if not hints:
            hints.append("Pipeline performing well!")
        
        return hints
    
    def _update_rag_live_stats(self, pipeline_data: Dict[str, Any]):
        """Update live RAG statistics."""
        if not hasattr(self.live_stats, 'rag_stats'):
            self.live_stats['rag_stats'] = {
                "total_queries": 0,
                "successful_queries": 0,
                "avg_response_time": 0,
                "avg_efficiency": 0,
                "success_rate": 0
            }
        
        rag_stats = self.live_stats['rag_stats']
        rag_stats["total_queries"] += 1
        
        if pipeline_data.get("success", False):
            rag_stats["successful_queries"] += 1
        
        # Update averages (simple moving average)
        current_time = pipeline_data.get("total_time_ms", 0)
        current_efficiency = pipeline_data.get("efficiency_score", 0)
        
        rag_stats["avg_response_time"] = round(
            (rag_stats["avg_response_time"] + current_time) / 2, 2
        )
        rag_stats["avg_efficiency"] = round(
            (rag_stats["avg_efficiency"] + current_efficiency) / 2, 2
        )
        rag_stats["success_rate"] = round(
            (rag_stats["successful_queries"] / rag_stats["total_queries"]) * 100, 2
        )
    
    async def log_user_journey(self, user_id: str, action: str, page: str, data: Dict[str, Any] = None):
        """Track user journey for UX debugging."""
        journey_event = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "action": action,
            "page": page,
            "data": data or {}
        }
        
        self.metrics["user_journeys"][user_id].append(journey_event)
        await self.broadcast_event("user_journey", journey_event)
    
    def _update_live_stats(self):
        """Update live statistics."""
        now = time.time()
        
        # Calculate requests per minute
        minute_ago = now - 60
        recent_requests = [r for r in self.metrics["requests"] 
                          if datetime.fromisoformat(r["timestamp"]).timestamp() > minute_ago]
        self.live_stats["requests_per_minute"] = len(recent_requests)
        
        # Calculate average response time
        if recent_requests:
            avg_time = sum(r["response_time"] for r in recent_requests) / len(recent_requests)
            self.live_stats["avg_response_time"] = round(avg_time, 3)
        
        # Calculate error rate
        error_count = sum(1 for r in recent_requests if r.get("error") or r["status_code"] >= 400)
        self.live_stats["error_rate"] = round((error_count / max(len(recent_requests), 1)) * 100, 2)
        
        self.live_stats["last_update"] = now
    
    async def broadcast_event(self, event_type: str, data: Any):
        """Broadcast event to all connected clients."""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all connected clients
        disconnected = []
        for websocket in self.connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        
        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws)
    
    async def broadcast_metrics(self):
        """Broadcast current metrics summary."""
        metrics_summary = {
            "live_stats": self.live_stats,
            "recent_requests": list(self.metrics["requests"])[-10:],
            "recent_errors": list(self.metrics["errors"])[-5:],
            "active_sessions": len(self.live_stats["active_sessions"]),
            "total_users": len(self.live_stats["active_users"]),
            "rag_efficiency": self._calculate_rag_efficiency()
        }
        
        await self.broadcast_event("metrics_update", metrics_summary)
    
    def _calculate_rag_efficiency(self) -> float:
        """Calculate overall RAG pipeline efficiency score."""
        if not self.metrics["rag_analytics"]:
            return 0.0
        
        # Get recent RAG pipelines for efficiency calculation
        recent_rag = list(self.metrics["rag_analytics"])[-20:]
        if not recent_rag:
            return 0.0
        
        # Use the efficiency_score from pipeline data if available
        if recent_rag and "efficiency_score" in recent_rag[0]:
            avg_efficiency = sum(r.get("efficiency_score", 0) for r in recent_rag) / len(recent_rag)
        else:
            # Fallback calculation for backward compatibility
            avg_efficiency = sum(r.get("efficiency_score", 0) for r in recent_rag) / len(recent_rag)
        
        return round(avg_efficiency, 2)
    
    def get_rag_pipeline_metrics(self) -> Dict[str, Any]:
        """Get RAG pipeline metrics for API consumption."""
        recent_pipelines = list(self.metrics["rag_analytics"])[-50:]
        
        if not recent_pipelines:
            return {
                "total_queries": 0,
                "successful_queries": 0,
                "avg_response_time": 0,
                "avg_efficiency": 0,
                "success_rate": 0,
                "recent_pipelines": [],
                "performance_distribution": {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
            }
        
        # Calculate metrics
        total_queries = len(recent_pipelines)
        successful_queries = sum(1 for p in recent_pipelines if p.get("success", False))
        avg_response_time = sum(p.get("total_time_ms", 0) for p in recent_pipelines) / total_queries
        avg_efficiency = sum(p.get("efficiency_score", 0) for p in recent_pipelines) / total_queries
        success_rate = (successful_queries / total_queries) * 100 if total_queries > 0 else 0
        
        # Performance grade distribution
        performance_distribution = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        for pipeline in recent_pipelines:
            grade = pipeline.get("performance_grade", "F")
            performance_distribution[grade] = performance_distribution.get(grade, 0) + 1
        
        return {
            "total_queries": total_queries,
            "successful_queries": successful_queries,
            "avg_response_time": round(avg_response_time, 2),
            "avg_efficiency": round(avg_efficiency, 2),
            "success_rate": round(success_rate, 2),
            "recent_pipelines": recent_pipelines[-10:],  # Last 10 for display
            "performance_distribution": performance_distribution,
            "live_stats": getattr(self.live_stats, 'rag_stats', {})
        }
    
    def get_dashboard_html(self) -> str:
        """Generate dashboard HTML."""
        return '''
<!DOCTYPE html>
<html>
<head>
    <title>🚀 ClauseIQ Debug Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; background: #0a0a0a; color: #fff; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: #1a1a1a; border-radius: 8px; padding: 20px; border-left: 4px solid #00ff88; }
        .metric-value { font-size: 2em; font-weight: bold; color: #00ff88; }
        .metric-label { color: #888; margin-top: 5px; }
        .events { margin-top: 30px; }
        .event { background: #1a1a1a; margin: 10px 0; padding: 15px; border-radius: 5px; border-left: 3px solid #0088ff; }
        .event-time { color: #888; font-size: 0.9em; }
        .error { border-left-color: #ff4444 !important; }
        .chat { border-left-color: #ffaa00 !important; }
        .status { position: fixed; top: 20px; right: 20px; padding: 10px; background: #00ff88; color: #000; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="status" id="status">🔴 Connecting...</div>
    <div class="container">
        <div class="header">
            <h1>🚀 ClauseIQ Debug Dashboard</h1>
            <p>Real-time API monitoring and debugging</p>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value" id="requests-per-minute">0</div>
                <div class="metric-label">Requests/min</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="avg-response-time">0ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="error-rate">0%</div>
                <div class="metric-label">Error Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" id="active-users">0</div>
                <div class="metric-label">Active Users</div>
            </div>
        </div>
        
        <div class="events">
            <h2>🔥 Live Events</h2>
            <div id="events-container"></div>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:8000/debug/ws');
        const status = document.getElementById('status');
        const eventsContainer = document.getElementById('events-container');
        
        ws.onopen = () => {
            status.textContent = '🟢 Connected';
            status.style.background = '#00ff88';
        };
        
        ws.onclose = () => {
            status.textContent = '🔴 Disconnected';
            status.style.background = '#ff4444';
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'metrics_update') {
                updateMetrics(data.data);
            } else {
                addEvent(data);
            }
        };
        
        function updateMetrics(metrics) {
            document.getElementById('requests-per-minute').textContent = metrics.live_stats.requests_per_minute;
            document.getElementById('avg-response-time').textContent = metrics.live_stats.avg_response_time + 'ms';
            document.getElementById('error-rate').textContent = metrics.live_stats.error_rate + '%';
            document.getElementById('active-users').textContent = metrics.total_users;
        }
        
        function addEvent(event) {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            
            if (event.type === 'api_request' && event.data.error) {
                eventDiv.classList.add('error');
            } else if (event.type === 'chat_activity') {
                eventDiv.classList.add('chat');
            }
            
            eventDiv.innerHTML = `
                <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
                <strong>${event.type}</strong>: ${formatEventData(event)}
            `;
            
            eventsContainer.insertBefore(eventDiv, eventsContainer.firstChild);
            
            // Keep only last 50 events
            while (eventsContainer.children.length > 50) {
                eventsContainer.removeChild(eventsContainer.lastChild);
            }
        }
        
        function formatEventData(event) {
            switch (event.type) {
                case 'api_request':
                    return `${event.data.method} ${event.data.path} - ${event.data.status_code} (${event.data.response_time}ms)`;
                case 'chat_activity':
                    return `Session ${event.data.session_id.substring(0, 8)} - Message sent`;
                case 'rag_pipeline':
                    return `Query processed - ${event.data.chunks_found} chunks found (${event.data.response_time}ms)`;
                default:
                    return JSON.stringify(event.data).substring(0, 100);
            }
        }
        
        // Auto-refresh metrics every 5 seconds
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({type: 'request_metrics'}));
            }
        }, 5000);
    </script>
</body>
</html>
        '''

# Global dashboard instance
debug_dashboard = DebugDashboard()
