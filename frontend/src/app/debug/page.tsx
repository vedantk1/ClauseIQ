"use client";
import { useAuth } from "@/context/AuthContext";
import { useApiCall } from "@/lib/apiUtils";
import { useEffect, useState } from "react";

// 🚀 SUPERHUMAN DEBUG INTERFACES - Comprehensive typing for debug data
interface DocumentsResponse {
  documents?: Array<{
    id: string;
    filename: string;
    upload_date: string;
  }>;
  error?: string;
}

interface DebugMetrics {
  live_stats: {
    active_sessions: Set<string>;
    active_users: Set<string>;
    requests_per_minute: number;
    avg_response_time: number;
    error_rate: number;
    last_update: number;
    rag_stats?: {
      total_queries: number;
      successful_queries: number;
      avg_response_time: number;
      avg_efficiency: number;
      success_rate: number;
    };
  };
  recent_requests: Array<{
    timestamp: string;
    method: string;
    path: string;
    response_time: number;
    status_code: number;
    error?: string;
  }>;
  recent_errors: Array<{
    timestamp: string;
    error: string;
    severity: string;
    path: string;
  }>;
  active_sessions: number;
  total_users: number;
  rag_efficiency: number;
  chat_sessions: number;
}

interface RAGPipelineData {
  total_queries: number;
  successful_queries: number;
  avg_response_time: number;
  avg_efficiency: number;
  success_rate: number;
  recent_pipelines: Array<{
    timestamp: string;
    document_id: string;
    query: string;
    success: boolean;
    total_time_ms: number;
    efficiency_score: number;
    performance_grade: string;
    steps: Array<{
      step: string;
      success: boolean;
      time_ms: number;
      details: Record<string, unknown>;
    }>;
    optimization_hints: string[];
  }>;
  performance_distribution: Record<string, number>;
}

interface PerformanceData {
  requests_per_minute: number;
  avg_response_time: number;
  error_rate: number;
  recent_requests: Array<{
    timestamp: string;
    method: string;
    path: string;
    response_time: number;
    status_code: number;
  }>;
}

export default function SuperhumanDebugDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const apiCall = useApiCall();
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentsResponse | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // 🚀 REAL-TIME DEBUG STATE
  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics | null>(null);
  const [ragData, setRAGData] = useState<RAGPipelineData | null>(null);
  const [performanceData, setPerformanceData] =
    useState<PerformanceData | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "auth" | "metrics" | "rag" | "performance"
  >("metrics");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 🚀 REAL-TIME DATA FETCHING - Beautiful integration with your APIs
  useEffect(() => {
    if (!isRealTimeEnabled || !isMounted) return;

    const fetchDebugData = async () => {
      try {
        // Fetch all debug data in parallel for maximum efficiency
        const [healthRes, errorsRes, ragRes] = await Promise.all([
          fetch("http://localhost:8000/api/v1/ai-debug/health-check"),
          fetch("http://localhost:8000/api/v1/ai-debug/recent-errors"),
          fetch("http://localhost:8000/api/v1/ai-debug/rag-status"),
        ]);

        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setDebugMetrics({
            live_stats: {
              active_sessions: new Set<string>(),
              active_users: new Set<string>(),
              requests_per_minute: 0,
              avg_response_time:
                healthData.system_diagnostics?.process_health
                  ?.memory_usage_mb || 0,
              error_rate: 0,
              last_update: Date.now(),
            },
            recent_requests: [],
            recent_errors: [],
            active_sessions: 0,
            total_users: 0,
            rag_efficiency: 100,
            chat_sessions: 0,
          });
        }

        if (ragRes.ok) {
          const ragResponseData = await ragRes.json();
          setRAGData(ragResponseData);
        }

        if (errorsRes.ok) {
          const errorsResponseData = await errorsRes.json();
          setPerformanceData({
            requests_per_minute: 0,
            avg_response_time: 0,
            error_rate: errorsResponseData.error_count || 0,
            recent_requests: [],
          });
        }
      } catch (error) {
        addDebugInfo(`❌ Debug data fetch error: ${error}`);
      }
    };

    // Initial fetch
    fetchDebugData();

    // Real-time updates every 10 seconds (reduced frequency to prevent rate limiting)
    const interval = setInterval(fetchDebugData, 10000);
    return () => clearInterval(interval);
  }, [isRealTimeEnabled, isMounted]);

  const addDebugInfo = (message: string) => {
    if (typeof window !== "undefined") {
      console.log(message);
      setDebugInfo((prev) => [
        ...prev,
        `${new Date().toLocaleTimeString()}: ${message}`,
      ]);
    }
  };

  useEffect(() => {
    if (isMounted) {
      addDebugInfo(
        `Auth state - isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}, user: ${
          user?.email || "null"
        }`
      );
    }
  }, [isLoading, isAuthenticated, user, isMounted]);

  if (!isMounted) {
    return (
      <div className="p-8 bg-gray-900 text-white min-h-screen">
        Loading debug dashboard...
      </div>
    );
  }

  // 🚀 BEAUTIFUL COMPONENT RENDERS
  const renderMetricsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-green-400">
        <div className="text-2xl font-bold text-green-400">
          {debugMetrics?.live_stats.requests_per_minute || 0}
        </div>
        <div className="text-gray-400">Requests/min</div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-blue-400">
        <div className="text-2xl font-bold text-blue-400">
          {debugMetrics?.live_stats.avg_response_time || 0}ms
        </div>
        <div className="text-gray-400">Avg Response Time</div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-yellow-400">
        <div className="text-2xl font-bold text-yellow-400">
          {debugMetrics?.live_stats.error_rate || 0}%
        </div>
        <div className="text-gray-400">Error Rate</div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-purple-400">
        <div className="text-2xl font-bold text-purple-400">
          {debugMetrics?.total_users || 0}
        </div>
        <div className="text-gray-400">Active Users</div>
      </div>
    </div>
  );

  const renderRAGTab = () => (
    <div className="space-y-6">
      {/* RAG Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-emerald-400">
          <div className="text-xl font-bold text-emerald-400">
            {ragData?.success_rate?.toFixed(1) || 0}%
          </div>
          <div className="text-gray-400 text-sm">Success Rate</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-cyan-400">
          <div className="text-xl font-bold text-cyan-400">
            {ragData?.avg_efficiency?.toFixed(1) || 0}
          </div>
          <div className="text-gray-400 text-sm">Avg Efficiency</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-orange-400">
          <div className="text-xl font-bold text-orange-400">
            {ragData?.avg_response_time?.toFixed(0) || 0}ms
          </div>
          <div className="text-gray-400 text-sm">Avg Response</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-pink-400">
          <div className="text-xl font-bold text-pink-400">
            {ragData?.total_queries || 0}
          </div>
          <div className="text-gray-400 text-sm">Total Queries</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-indigo-400">
          <div className="text-xl font-bold text-indigo-400">
            {ragData?.successful_queries || 0}
          </div>
          <div className="text-gray-400 text-sm">Successful</div>
        </div>
      </div>

      {/* Recent RAG Pipelines */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">
          🔍 Recent RAG Pipelines
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {ragData?.recent_pipelines?.map((pipeline, idx) => (
            <div
              key={idx}
              className="bg-gray-700 p-4 rounded border-l-4 border-gray-500"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-sm text-gray-300 truncate">
                    Query: {pipeline.query.substring(0, 80)}...
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(pipeline.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      pipeline.success
                        ? "bg-green-900 text-green-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    {pipeline.success ? "✅" : "❌"}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      pipeline.performance_grade === "A"
                        ? "bg-green-900 text-green-300"
                        : pipeline.performance_grade === "B"
                        ? "bg-blue-900 text-blue-300"
                        : pipeline.performance_grade === "C"
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    Grade {pipeline.performance_grade}
                  </span>
                  <span className="text-xs text-gray-400">
                    {pipeline.total_time_ms}ms
                  </span>
                </div>
              </div>

              {pipeline.optimization_hints?.length > 0 && (
                <div className="mt-2 text-xs text-orange-300">
                  💡 {pipeline.optimization_hints[0]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">
            Requests/Min
          </h3>
          <div className="text-3xl font-bold text-green-400">
            {performanceData?.requests_per_minute || 0}
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">
            Avg Response
          </h3>
          <div className="text-3xl font-bold text-blue-400">
            {performanceData?.avg_response_time || 0}ms
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">Error Rate</h3>
          <div className="text-3xl font-bold text-red-400">
            {performanceData?.error_rate || 0}%
          </div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">
          🚀 Recent API Requests
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {performanceData?.recent_requests?.map((req, idx) => (
            <div
              key={idx}
              className="bg-gray-700 p-3 rounded flex justify-between items-center"
            >
              <div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    req.method === "GET"
                      ? "bg-green-900 text-green-300"
                      : req.method === "POST"
                      ? "bg-blue-900 text-blue-300"
                      : req.method === "PUT"
                      ? "bg-yellow-900 text-yellow-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {req.method}
                </span>
                <span className="ml-2 text-gray-300">{req.path}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    req.status_code < 400
                      ? "bg-green-900 text-green-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {req.status_code}
                </span>
                <span className="text-xs text-gray-400">
                  {req.response_time}ms
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(req.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const testDirectLogin = async () => {
    addDebugInfo("Testing direct login...");
    try {
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "debug@test.com",
          password: "testpass123",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          addDebugInfo("✅ Direct login successful, tokens stored");
          window.location.reload(); // Reload to trigger auth context
        }
      } else {
        addDebugInfo("❌ Direct login failed");
      }
    } catch (error) {
      addDebugInfo(`❌ Login error: ${error}`);
    }
  };

  const testDocuments = async () => {
    addDebugInfo("Testing documents API...");
    try {
      const response = await apiCall("/documents/");
      addDebugInfo(`Documents API response status: ${response.status}`);

      if (response.ok) {
        const data = (await response.json()) as DocumentsResponse;
        setDocuments(data);
        addDebugInfo(`✅ Documents loaded: ${JSON.stringify(data)}`);
      } else {
        const errorText = await response.text();
        addDebugInfo(`❌ Documents API failed: ${errorText}`);
      }
    } catch (error) {
      addDebugInfo(`❌ Documents API error: ${error}`);
    }
  };

  const clearTokens = () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      addDebugInfo("🧹 Cleared localStorage");
      window.location.reload();
    }
  };

  // Helper function to safely access localStorage
  const getStorageItem = (key: string): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 🚀 SUPERHUMAN DEBUG DASHBOARD HEADER */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">
                🚀 ClauseIQ Debug Dashboard
              </h1>
              <p className="text-gray-400 mt-1">
                Real-time system monitoring and debugging
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  isRealTimeEnabled ? "bg-green-400" : "bg-red-400"
                }`}
              ></div>
              <span className="text-sm text-gray-400">
                {isRealTimeEnabled ? "Live Updates" : "Offline"}
              </span>
              <button
                onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
                className={`px-3 py-1 rounded text-sm font-semibold ${
                  isRealTimeEnabled
                    ? "bg-red-900 text-red-300 hover:bg-red-800"
                    : "bg-green-900 text-green-300 hover:bg-green-800"
                }`}
              >
                {isRealTimeEnabled ? "Pause" : "Resume"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 NAVIGATION TABS */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {(["metrics", "rag", "performance", "auth"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? "border-blue-400 text-blue-400"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
                }`}
              >
                {tab === "rag" ? "RAG Pipeline" : tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 🚀 DASHBOARD CONTENT */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "metrics" && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              📊 System Metrics
            </h2>
            {renderMetricsTab()}

            {/* Recent Errors */}
            {debugMetrics?.recent_errors &&
              debugMetrics.recent_errors.length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    ❌ Recent Errors
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {debugMetrics.recent_errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="bg-red-900/20 border border-red-800 p-3 rounded"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-red-300 font-medium">
                              {error.path}
                            </div>
                            <div className="text-red-400 text-sm mt-1">
                              {error.error}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(error.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {activeTab === "rag" && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              🔍 RAG Pipeline Analytics
            </h2>
            {renderRAGTab()}
          </div>
        )}

        {activeTab === "performance" && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              ⚡ Performance Monitoring
            </h2>
            {renderPerformanceTab()}
          </div>
        )}

        {activeTab === "auth" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">
              🔐 Authentication Debug
            </h2>

            {/* Auth Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400">Loading State</div>
                <div
                  className={`text-lg font-semibold ${
                    isLoading ? "text-yellow-400" : "text-green-400"
                  }`}
                >
                  {isLoading ? "Loading..." : "Ready"}
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400">Authentication</div>
                <div
                  className={`text-lg font-semibold ${
                    isAuthenticated ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isAuthenticated ? "Authenticated" : "Not Authenticated"}
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400">User Email</div>
                <div className="text-lg font-semibold text-white">
                  {user?.email || "None"}
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-400">Access Token</div>
                <div
                  className={`text-lg font-semibold ${
                    getStorageItem("access_token")
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {getStorageItem("access_token") ? "Present" : "Missing"}
                </div>
              </div>
            </div>

            {/* Auth Actions */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4">
                🛠️ Debug Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={testDirectLogin}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  🔑 Test Login
                </button>
                <button
                  onClick={testDocuments}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  📄 Test Documents API
                </button>
                <button
                  onClick={clearTokens}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                >
                  🧹 Clear Tokens
                </button>
              </div>
            </div>

            {/* Documents Data */}
            {documents && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">
                  📄 Documents Response
                </h3>
                <pre className="bg-gray-900 p-4 rounded text-sm text-gray-300 overflow-auto max-h-64">
                  {JSON.stringify(documents, null, 2)}
                </pre>
              </div>
            )}

            {/* Debug Log */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4">
                📝 Debug Log
              </h3>
              <div className="bg-gray-900 p-4 rounded max-h-96 overflow-y-auto">
                {debugInfo.map((info, index) => (
                  <div
                    key={index}
                    className="text-sm text-gray-300 py-1 border-b border-gray-800 last:border-b-0"
                  >
                    {info}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
