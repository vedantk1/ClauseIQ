"""
Analytics-related models.
"""
from pydantic import BaseModel
from typing import List


class AnalyticsActivity(BaseModel):
    id: str
    document: str
    action: str
    timestamp: str
    riskLevel: str


class AnalyticsMonthlyStats(BaseModel):
    month: str
    documents: int
    risks: int


class AnalyticsRiskBreakdown(BaseModel):
    high: int
    medium: int
    low: int


class ContractTypeCount(BaseModel):
    type: str
    count: int
    percentage: float


class RiskScoreAnalytics(BaseModel):
    averageScore: float
    highestScore: float
    lowestScore: float
    totalScore: float


class AnalyticsData(BaseModel):
    totalDocuments: int
    documentsThisMonth: int
    riskyClausesCaught: int
    mostCommonContractTypes: List[ContractTypeCount]
    riskScoreAnalytics: RiskScoreAnalytics
    recentActivity: List[AnalyticsActivity]
    monthlyStats: List[AnalyticsMonthlyStats]
    riskBreakdown: AnalyticsRiskBreakdown
