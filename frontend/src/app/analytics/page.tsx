"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Skeleton from "@/components/Skeleton";
import { AnalysisTrendChart } from "@/components/AnalysisTrendChart";
import {
  FileText,
  Clock,
  BarChart3,
  Activity,
  Filter,
  ArrowUp,
  Minus,
  Target,
  Shield,
  Zap,
  ChevronDown,
} from "lucide-react";
import config from "@/config/config";

interface AnalyticsData {
  totalDocuments: number;
  documentsThisMonth: number;
  riskyClausesCaught: number;
  mostCommonContractTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  processingTimeAnalytics: {
    averageTime: number;
    fastestTime: number;
    slowestTime: number;
    totalProcessingTime: number;
  };
  recentActivity: Array<{
    id: string;
    document: string;
    action: string;
    timestamp: string;
    riskLevel: "low" | "medium" | "high";
  }>;
  monthlyStats: Array<{
    month: string;
    documents: number;
    risks: number;
  }>;
  riskBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

type TimeRange = "7d" | "30d" | "90d" | "1y";

export default function AnalyticsDashboard() {
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [isTimeRangeDropdownOpen, setTimeRangeDropdownOpen] = useState(false);
  const timeRangeDropdownRef = useRef<HTMLDivElement>(null);

  // Chart toggle states
  const [showDocuments, setShowDocuments] = useState(true);
  const [showRisks, setShowRisks] = useState(true);

  // Risk filter states
  const [isRiskFilterOpen, setRiskFilterOpen] = useState(false);
  const [riskFilter, setRiskFilter] = useState({
    high: true,
    medium: true,
    low: true,
  });
  const [riskSort, setRiskSort] = useState<
    "count-desc" | "count-asc" | "level"
  >("count-desc");
  const riskFilterRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        timeRangeDropdownRef.current &&
        !timeRangeDropdownRef.current.contains(event.target as Node)
      ) {
        setTimeRangeDropdownOpen(false);
      }
      if (
        riskFilterRef.current &&
        !riskFilterRef.current.contains(event.target as Node)
      ) {
        setRiskFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Fetch real analytics data from API
    const fetchAnalytics = async () => {
      setLoading(true);

      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          throw new Error("No access token found");
        }

        const response = await fetch(
          `${config.apiUrl}/api/v1/analytics/dashboard?time_period=${timePeriod}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const apiResponse = await response.json();

        // Check if the response follows the standardized API format
        if (apiResponse.success && apiResponse.data) {
          const data: AnalyticsData = apiResponse.data;
          setAnalyticsData(data);
        } else if (apiResponse.error) {
          throw new Error(
            apiResponse.error.message || "Failed to fetch analytics data"
          );
        } else {
          // Fallback for legacy format
          const data: AnalyticsData = apiResponse;
          setAnalyticsData(data);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);

        // Fallback to basic mock data on error
        const fallbackData: AnalyticsData = {
          totalDocuments: 0,
          documentsThisMonth: 0,
          riskyClausesCaught: 0,
          mostCommonContractTypes: [],
          processingTimeAnalytics: {
            averageTime: 0,
            fastestTime: 0,
            slowestTime: 0,
            totalProcessingTime: 0,
          },
          recentActivity: [],
          monthlyStats: [],
          riskBreakdown: {
            high: 0,
            medium: 0,
            low: 0,
          },
        };
        setAnalyticsData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timePeriod]);

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "high":
        return "text-status-error";
      case "medium":
        return "text-status-warning";
      case "low":
        return "text-status-success";
      default:
        return "text-text-secondary";
    }
  };

  const getRiskLevelBg = (level: string) => {
    switch (level) {
      case "high":
        return "bg-status-error/10";
      case "medium":
        return "bg-status-warning/10";
      case "low":
        return "bg-status-success/10";
      default:
        return "bg-surface-secondary";
    }
  };

  // Auth loading check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-purple"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="space-y-2">
            <Skeleton variant="rect" className="h-8 w-48" />
            <Skeleton variant="rect" className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton variant="rect" className="h-10 w-24" />
            <Skeleton variant="rect" className="h-10 w-32" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton variant="rect" className="h-4 w-24" />
                  <Skeleton variant="rect" className="h-8 w-8 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton variant="rect" className="h-8 w-16" />
                  <Skeleton variant="rect" className="h-3 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <Skeleton variant="rect" className="h-6 w-32 mb-4" />
            <Skeleton variant="rect" className="h-64 w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton variant="rect" className="h-6 w-32 mb-4" />
            <Skeleton variant="rect" className="h-64 w-full" />
          </Card>
        </div>

        {/* Activity Skeleton */}
        <Card className="p-6">
          <Skeleton variant="rect" className="h-6 w-32 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton variant="rect" className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="rect" className="h-4 w-48" />
                  <Skeleton variant="rect" className="h-3 w-32" />
                </div>
                <Skeleton variant="rect" className="h-3 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-secondary flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No Analytics Data
            </h3>
            <p className="text-text-secondary text-sm mb-6">
              Upload and analyze documents to see your analytics dashboard.
            </p>
            <Button onClick={() => router.push("/")}>Upload Document</Button>
          </Card>
        </div>
      </div>
    );
  }

  // Process risk data with filters and sorting
  const riskData = [
    {
      level: "high",
      count: analyticsData.riskBreakdown.high,
      color: "bg-status-error",
      dotColor: "bg-status-error",
      label: "High Risk",
    },
    {
      level: "medium",
      count: analyticsData.riskBreakdown.medium,
      color: "bg-status-warning",
      dotColor: "bg-status-warning",
      label: "Medium Risk",
    },
    {
      level: "low",
      count: analyticsData.riskBreakdown.low,
      color: "bg-status-success",
      dotColor: "bg-status-success",
      label: "Low Risk",
    },
  ]
    .filter((item) => riskFilter[item.level as keyof typeof riskFilter])
    .sort((a, b) => {
      switch (riskSort) {
        case "count-desc":
          return b.count - a.count;
        case "count-asc":
          return a.count - b.count;
        case "level":
          const levelOrder = { high: 3, medium: 2, low: 1 };
          return (
            levelOrder[b.level as keyof typeof levelOrder] -
            levelOrder[a.level as keyof typeof levelOrder]
          );
        default:
          return 0;
      }
    });

  const totalFilteredRisks = riskData.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-space-grotesk">
            Analytics Dashboard
          </h1>
          <p className="text-text-secondary mt-1">
            Track your legal document analysis performance and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Dropdown */}
          <div className="relative" ref={timeRangeDropdownRef}>
            <button
              onClick={() => setTimeRangeDropdownOpen(!isTimeRangeDropdownOpen)}
              className="px-3 py-2 bg-bg-elevated border border-border-muted rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors hover:bg-bg-elevated/80 flex items-center gap-2 min-w-[140px] justify-between"
            >
              <span>
                {timeRange === "7d" && "Last 7 days"}
                {timeRange === "30d" && "Last 30 days"}
                {timeRange === "90d" && "Last 90 days"}
                {timeRange === "1y" && "Last year"}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-text-tertiary transition-transform ${
                  isTimeRangeDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isTimeRangeDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-full bg-bg-elevated border border-border-muted rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    setTimeRange("7d");
                    setTimeRangeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors first:rounded-t-lg ${
                    timeRange === "7d"
                      ? "bg-accent-purple/10 text-accent-purple"
                      : ""
                  }`}
                >
                  Last 7 days
                </button>
                <button
                  onClick={() => {
                    setTimeRange("30d");
                    setTimeRangeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors ${
                    timeRange === "30d"
                      ? "bg-accent-purple/10 text-accent-purple"
                      : ""
                  }`}
                >
                  Last 30 days
                </button>
                <button
                  onClick={() => {
                    setTimeRange("90d");
                    setTimeRangeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors ${
                    timeRange === "90d"
                      ? "bg-accent-purple/10 text-accent-purple"
                      : ""
                  }`}
                >
                  Last 90 days
                </button>
                <button
                  onClick={() => {
                    setTimeRange("1y");
                    setTimeRangeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-text-primary hover:bg-bg-surface transition-colors last:rounded-b-lg ${
                    timeRange === "1y"
                      ? "bg-accent-purple/10 text-accent-purple"
                      : ""
                  }`}
                >
                  Last year
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-secondary text-sm font-medium">
              Documents Analyzed
            </span>
            <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent-purple" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-text-primary">
              {analyticsData.totalDocuments}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <ArrowUp className="w-3 h-3 text-status-success" />
              <span className="text-status-success font-medium">
                +{analyticsData.documentsThisMonth}
              </span>
              <span className="text-text-tertiary">this month</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-secondary text-sm font-medium">
              Risky Clauses Caught
            </span>
            <div className="w-10 h-10 rounded-lg bg-status-error/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-status-error" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-text-primary">
              {analyticsData.riskyClausesCaught}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Target className="w-3 h-3 text-status-warning" />
              <span className="text-text-tertiary">across all documents</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-secondary text-sm font-medium">
              Most Common Contract Types
            </span>
            <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent-purple" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-text-primary">
              {analyticsData.mostCommonContractTypes.length > 0 
                ? analyticsData.mostCommonContractTypes[0].type 
                : "None"}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-text-tertiary">
                {analyticsData.mostCommonContractTypes.length > 0 
                  ? `${analyticsData.mostCommonContractTypes[0].count} documents (${analyticsData.mostCommonContractTypes[0].percentage}%)`
                  : "No contracts analyzed"}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-secondary text-sm font-medium">
              Processing Time Analytics
            </span>
            <div className="w-10 h-10 rounded-lg bg-status-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-status-warning" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-text-primary">
              {analyticsData.processingTimeAnalytics.averageTime.toFixed(1)}s
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Minus className="w-3 h-3 text-text-tertiary" />
              <span className="text-text-tertiary">average processing time</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Document Analysis Trend */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-primary">
              Analysis Trend
            </h3>
            <div className="flex items-center gap-2">
              {/* Time Period Toggles */}
              <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-1 border border-border-muted">
                <button
                  onClick={() => setTimePeriod("daily")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer ${
                    timePeriod === "daily"
                      ? "bg-accent-purple text-white shadow-md transform scale-105"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-primary/50"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setTimePeriod("weekly")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer ${
                    timePeriod === "weekly"
                      ? "bg-accent-purple text-white shadow-md transform scale-105"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-primary/50"
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTimePeriod("monthly")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer ${
                    timePeriod === "monthly"
                      ? "bg-accent-purple text-white shadow-md transform scale-105"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-primary/50"
                  }`}
                >
                  Monthly
                </button>
              </div>
              
              {/* Chart Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDocuments(!showDocuments)}
                  className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    showDocuments
                      ? "bg-accent-purple/20 text-accent-purple"
                      : "text-text-secondary hover:text-accent-purple"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${
                    showDocuments ? "bg-accent-purple" : "bg-text-tertiary"
                  }`}></div>
                  <span>Documents</span>
                </button>
                <button
                  onClick={() => setShowRisks(!showRisks)}
                  className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    showRisks
                      ? "bg-status-error/20 text-status-error"
                      : "text-text-secondary hover:text-status-error"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${
                    showRisks ? "bg-status-error" : "bg-text-tertiary"
                  }`}></div>
                  <span>Risks</span>
                </button>
              </div>
            </div>
          </div>
          {/* Interactive Chart */}
          <AnalysisTrendChart
            monthlyStats={analyticsData.monthlyStats}
            showDocuments={showDocuments}
            showRisks={showRisks}
          />
        </Card>

        {/* Risk Distribution */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-primary">
              Risk Distribution
            </h3>
            <div className="relative" ref={riskFilterRef}>
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setRiskFilterOpen(!isRiskFilterOpen)}
              >
                <Filter className="w-4 h-4" />
              </Button>
              {isRiskFilterOpen && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-bg-elevated border border-border-muted rounded-lg shadow-lg z-10">
                  <div className="p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-text-primary mb-2 block">
                          Show Risk Levels
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={riskFilter.high}
                              onChange={(e) =>
                                setRiskFilter((prev) => ({
                                  ...prev,
                                  high: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 text-accent-purple bg-bg-surface border-border-muted rounded focus:ring-accent-purple/20"
                            />
                            <div className="w-3 h-3 rounded-full bg-status-error"></div>
                            <span className="text-sm text-text-primary">
                              High Risk
                            </span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={riskFilter.medium}
                              onChange={(e) =>
                                setRiskFilter((prev) => ({
                                  ...prev,
                                  medium: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 text-accent-purple bg-bg-surface border-border-muted rounded focus:ring-accent-purple/20"
                            />
                            <div className="w-3 h-3 rounded-full bg-status-warning"></div>
                            <span className="text-sm text-text-primary">
                              Medium Risk
                            </span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={riskFilter.low}
                              onChange={(e) =>
                                setRiskFilter((prev) => ({
                                  ...prev,
                                  low: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 text-accent-purple bg-bg-surface border-border-muted rounded focus:ring-accent-purple/20"
                            />
                            <div className="w-3 h-3 rounded-full bg-status-success"></div>
                            <span className="text-sm text-text-primary">
                              Low Risk
                            </span>
                          </label>
                        </div>
                      </div>

                      <hr className="border-border-muted" />

                      <div>
                        <label className="text-sm font-medium text-text-primary mb-2 block">
                          Sort By
                        </label>
                        <select
                          value={riskSort}
                          onChange={(e) =>
                            setRiskSort(e.target.value as typeof riskSort)
                          }
                          className="w-full px-3 py-2 bg-bg-surface border border-border-muted rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple text-sm"
                        >
                          <option value="count-desc">
                            Count (High to Low)
                          </option>
                          <option value="count-asc">Count (Low to High)</option>
                          <option value="level">Risk Level</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {/* Risk Bars */}
            {riskData.length > 0 ? (
              <div className="space-y-3">
                {riskData.map((risk) => (
                  <div key={risk.level} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${risk.dotColor}`}
                        ></div>
                        <span className="text-sm font-medium text-text-primary">
                          {risk.label}
                        </span>
                      </div>
                      <span className="text-sm text-text-secondary">
                        {risk.count}
                      </span>
                    </div>
                    <div className="w-full bg-surface-secondary rounded-full h-2">
                      <div
                        className={`${risk.color} h-2 rounded-full transition-all`}
                        style={{
                          width:
                            totalFilteredRisks > 0
                              ? `${(risk.count / totalFilteredRisks) * 100}%`
                              : "0%",
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-secondary flex items-center justify-center">
                  <Filter className="w-6 h-6 text-text-tertiary" />
                </div>
                <p className="text-text-secondary text-sm">
                  No risk data matches your current filter settings
                </p>
                <Button
                  variant="tertiary"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    setRiskFilter({ high: true, medium: true, low: true })
                  }
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">
            Recent Activity
          </h3>
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => router.push("/documents")}
          >
            View All
          </Button>
        </div>
        <div className="space-y-4">
          {analyticsData.recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface-secondary/50 transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${getRiskLevelBg(
                  activity.riskLevel
                )}`}
              >
                <FileText
                  className={`w-5 h-5 ${getRiskLevelColor(activity.riskLevel)}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate">
                    {activity.document}
                  </span>
                  <span className="text-text-secondary">•</span>
                  <span className="text-text-secondary text-sm">
                    {activity.action}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getRiskLevelBg(
                      activity.riskLevel
                    )} ${getRiskLevelColor(activity.riskLevel)} font-medium`}
                  >
                    {activity.riskLevel} risk
                  </span>
                  <span className="text-text-tertiary text-xs">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              </div>
              <Button variant="tertiary" size="sm">
                View
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
