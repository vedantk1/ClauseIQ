"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Skeleton from "@/components/Skeleton";
import {
  FileText,
  Clock,
  BarChart3,
  Activity,
  Download,
  Filter,
  ArrowUp,
  Minus,
  Target,
  Shield,
  Zap,
} from "lucide-react";

interface AnalyticsData {
  totalDocuments: number;
  documentsThisMonth: number;
  riskyClausesCaught: number;
  timeSavedHours: number;
  avgRiskScore: number;
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
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  useEffect(() => {
    // Simulate API call with mock data
    const fetchAnalytics = async () => {
      setLoading(true);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock data
      const mockData: AnalyticsData = {
        totalDocuments: 47,
        documentsThisMonth: 12,
        riskyClausesCaught: 23,
        timeSavedHours: 156,
        avgRiskScore: 2.3,
        recentActivity: [
          {
            id: "1",
            document: "Employment_Contract_v2.pdf",
            action: "Analyzed",
            timestamp: "2025-06-03T10:30:00Z",
            riskLevel: "medium",
          },
          {
            id: "2",
            document: "Service_Agreement.docx",
            action: "Risk flagged",
            timestamp: "2025-06-02T15:45:00Z",
            riskLevel: "high",
          },
          {
            id: "3",
            document: "NDA_Template.pdf",
            action: "Reviewed",
            timestamp: "2025-06-02T09:15:00Z",
            riskLevel: "low",
          },
          {
            id: "4",
            document: "Partnership_Agreement.pdf",
            action: "Analyzed",
            timestamp: "2025-06-01T14:20:00Z",
            riskLevel: "medium",
          },
        ],
        monthlyStats: [
          { month: "Jan", documents: 8, risks: 12 },
          { month: "Feb", documents: 15, risks: 18 },
          { month: "Mar", documents: 12, risks: 14 },
          { month: "Apr", documents: 18, risks: 22 },
          { month: "May", documents: 22, risks: 28 },
          { month: "Jun", documents: 12, risks: 15 },
        ],
        riskBreakdown: {
          high: 8,
          medium: 15,
          low: 24,
        },
      };

      setAnalyticsData(mockData);
      setLoading(false);
    };

    fetchAnalytics();
  }, [timeRange]);

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
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple transition-colors"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
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
              Time Saved
            </span>
            <div className="w-10 h-10 rounded-lg bg-status-success/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-status-success" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-text-primary">
              {analyticsData.timeSavedHours}h
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="w-3 h-3 text-status-success" />
              <span className="text-text-tertiary">estimated review time</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-secondary text-sm font-medium">
              Avg Risk Score
            </span>
            <div className="w-10 h-10 rounded-lg bg-status-warning/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-status-warning" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-text-primary">
              {analyticsData.avgRiskScore.toFixed(1)}/5
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Minus className="w-3 h-3 text-text-tertiary" />
              <span className="text-text-tertiary">medium risk level</span>
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
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-accent-purple"></div>
                <span className="text-text-secondary">Documents</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-status-error"></div>
                <span className="text-text-secondary">Risks</span>
              </div>
            </div>
          </div>
          {/* Chart Placeholder */}
          <div className="h-64 bg-surface-secondary rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-text-tertiary mx-auto mb-2" />
              <p className="text-text-tertiary">
                Chart visualization coming soon
              </p>
            </div>
          </div>
        </Card>

        {/* Risk Distribution */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-primary">
              Risk Distribution
            </h3>
            <Button variant="tertiary" size="sm">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {/* Risk Bars */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-status-error"></div>
                  <span className="text-sm font-medium text-text-primary">
                    High Risk
                  </span>
                </div>
                <span className="text-sm text-text-secondary">
                  {analyticsData.riskBreakdown.high}
                </span>
              </div>
              <div className="w-full bg-surface-secondary rounded-full h-2">
                <div
                  className="bg-status-error h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      (analyticsData.riskBreakdown.high /
                        (analyticsData.riskBreakdown.high +
                          analyticsData.riskBreakdown.medium +
                          analyticsData.riskBreakdown.low)) *
                      100
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-status-warning"></div>
                  <span className="text-sm font-medium text-text-primary">
                    Medium Risk
                  </span>
                </div>
                <span className="text-sm text-text-secondary">
                  {analyticsData.riskBreakdown.medium}
                </span>
              </div>
              <div className="w-full bg-surface-secondary rounded-full h-2">
                <div
                  className="bg-status-warning h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      (analyticsData.riskBreakdown.medium /
                        (analyticsData.riskBreakdown.high +
                          analyticsData.riskBreakdown.medium +
                          analyticsData.riskBreakdown.low)) *
                      100
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-status-success"></div>
                  <span className="text-sm font-medium text-text-primary">
                    Low Risk
                  </span>
                </div>
                <span className="text-sm text-text-secondary">
                  {analyticsData.riskBreakdown.low}
                </span>
              </div>
              <div className="w-full bg-surface-secondary rounded-full h-2">
                <div
                  className="bg-status-success h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      (analyticsData.riskBreakdown.low /
                        (analyticsData.riskBreakdown.high +
                          analyticsData.riskBreakdown.medium +
                          analyticsData.riskBreakdown.low)) *
                      100
                    }%`,
                  }}
                ></div>
              </div>
            </div>
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
            onClick={() => router.push("/history")}
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
