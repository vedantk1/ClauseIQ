from fastapi import APIRouter, Depends, Request, Query
from typing import List, Literal
from datetime import datetime, timedelta
from models.analytics import AnalyticsData, AnalyticsActivity, AnalyticsMonthlyStats, AnalyticsRiskBreakdown
from database.service import get_document_service
from middleware.api_standardization import APIResponse, create_success_response, create_error_response
from middleware.versioning import versioned_response
from auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard", response_model=APIResponse[AnalyticsData])
@versioned_response
async def get_analytics_dashboard(
    request: Request,
    time_range: Literal["7d", "30d", "90d", "1y"] = Query(default="30d", description="Time range for analytics"),
    current_user: dict = Depends(get_current_user)
):
    """Get analytics dashboard data with real user document statistics."""
    correlation_id = getattr(request.state, 'correlation_id', None)
    
    try:
        service = get_document_service()
        
        # Get all documents for the user
        documents = await service.get_documents_for_user(current_user["id"])
        
        # Filter documents based on time range
        now = datetime.now()
        if time_range == "7d":
            start_date = now - timedelta(days=7)
        elif time_range == "30d":
            start_date = now - timedelta(days=30)
        elif time_range == "90d":
            start_date = now - timedelta(days=90)
        elif time_range == "1y":
            start_date = now - timedelta(days=365)
        else:
            start_date = now - timedelta(days=30)  # Default to 30 days
        
        # Filter documents within the time range
        filtered_documents = []
        for doc in documents:
            try:
                upload_date = datetime.fromisoformat(doc.get('upload_date', '').replace('Z', '+00:00'))
                if upload_date >= start_date:
                    filtered_documents.append(doc)
            except:
                # Skip documents with invalid dates
                continue
        
        documents = filtered_documents
        
        # Calculate basic statistics
        total_documents = len(documents)
        
        # Count documents from this month
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        documents_this_month = 0
        
        # Initialize counters
        total_risky_clauses = 0
        total_high_risk = 0
        total_medium_risk = 0
        total_low_risk = 0
        recent_activity = []
        
        # Process each document
        for doc in documents:
            try:
                upload_date = datetime.fromisoformat(doc.get('upload_date', '').replace('Z', '+00:00'))
                if upload_date >= month_start:
                    documents_this_month += 1
            except:
                pass
            
            # Count risky clauses
            risk_summary = doc.get('risk_summary', {})
            high = risk_summary.get('high', 0)
            medium = risk_summary.get('medium', 0)
            low = risk_summary.get('low', 0)
            
            total_high_risk += high
            total_medium_risk += medium
            total_low_risk += low
            total_risky_clauses += high + medium  # Only count high and medium as risky
            
            # Add to recent activity (last 10 documents)
            if len(recent_activity) < 10:
                risk_level = "low"
                if high > 0:
                    risk_level = "high"
                elif medium > 0:
                    risk_level = "medium"
                
                recent_activity.append(AnalyticsActivity(
                    id=doc.get('id', ''),
                    document=doc.get('filename', 'Unknown'),
                    action="Analyzed",
                    timestamp=doc.get('upload_date', datetime.now().isoformat()),
                    riskLevel=risk_level
                ))
        
        # Calculate average risk score (1-5 scale)
        total_clauses = total_high_risk + total_medium_risk + total_low_risk
        if total_clauses > 0:
            # Weight: High=5, Medium=3, Low=1
            weighted_score = (total_high_risk * 5 + total_medium_risk * 3 + total_low_risk * 1) / total_clauses
        else:
            weighted_score = 1.0
        
        # Calculate most common contract types
        contract_type_counts = {}
        for doc in documents:
            contract_type = doc.get('contract_type', 'Unknown')
            if contract_type:
                contract_type_counts[contract_type] = contract_type_counts.get(contract_type, 0) + 1
        
        # Sort by count and calculate percentages
        sorted_contract_types = sorted(contract_type_counts.items(), key=lambda x: x[1], reverse=True)
        most_common_contract_types = []
        
        for contract_type, count in sorted_contract_types[:5]:  # Top 5
            percentage = (count / total_documents * 100) if total_documents > 0 else 0
            most_common_contract_types.append({
                "type": contract_type,
                "count": count,
                "percentage": round(percentage, 1)
            })
        
        # Calculate processing time analytics (simulated for now)
        # In a real implementation, you'd track actual processing times
        processing_times = []
        for doc in documents:
            # Simulate processing time based on document complexity
            risk_summary = doc.get('risk_summary', {})
            complexity = risk_summary.get('high', 0) + risk_summary.get('medium', 0)
            # Base time 60s + 10s per risky clause
            processing_time = 60 + (complexity * 10)
            processing_times.append(processing_time)
        
        if processing_times:
            avg_time = sum(processing_times) / len(processing_times)
            fastest_time = min(processing_times)
            slowest_time = max(processing_times)
            total_time = sum(processing_times)
        else:
            avg_time = fastest_time = slowest_time = total_time = 0
        
        # Generate chart data with automatic granularity based on time range
        time_stats = []
        
        # Calculate the actual date range based on time range
        if time_range == "7d":
            start_date = now - timedelta(days=7)
            granularity = "daily"
            data_points = 7
        elif time_range == "30d":
            start_date = now - timedelta(days=30)
            granularity = "weekly"
            data_points = 5  # 30 days = ~5 weeks
        elif time_range == "90d":
            start_date = now - timedelta(days=90)
            granularity = "weekly"
            data_points = 13  # 90 days = ~13 weeks
        elif time_range == "1y":
            start_date = now - timedelta(days=365)
            granularity = "monthly"
            data_points = 12  # 12 months
        else:
            start_date = now - timedelta(days=30)
            granularity = "weekly"
            data_points = 5
        
        if granularity == "daily":
            # Generate daily stats - work backwards from today
            for i in range(data_points):
                day_start = now - timedelta(days=data_points-1-i)
                day_start = day_start.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                
                day_docs = 0
                day_risks = 0
                
                for doc in documents:
                    try:
                        upload_date = datetime.fromisoformat(doc.get('upload_date', '').replace('Z', '+00:00'))
                        if day_start <= upload_date < day_end:
                            day_docs += 1
                            risk_summary = doc.get('risk_summary', {})
                            doc_risks = risk_summary.get('high', 0) + risk_summary.get('medium', 0)
                            day_risks += doc_risks
                    except:
                        continue
                
                day_label = day_start.strftime('%m/%d')
                time_stats.append(AnalyticsMonthlyStats(
                    month=day_label,
                    documents=day_docs,
                    risks=day_risks
                ))
                
        elif granularity == "weekly":
            # Generate weekly stats - work backwards from today
            for i in range(data_points):
                week_start = now - timedelta(weeks=data_points-1-i)
                week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
                week_end = week_start + timedelta(days=7)
                
                week_docs = 0
                week_risks = 0
                
                for doc in documents:
                    try:
                        upload_date = datetime.fromisoformat(doc.get('upload_date', '').replace('Z', '+00:00'))
                        # Only count documents if they fall within the week AND the time range
                        if week_start <= upload_date < week_end:
                            week_docs += 1
                            risk_summary = doc.get('risk_summary', {})
                            doc_risks = risk_summary.get('high', 0) + risk_summary.get('medium', 0)
                            week_risks += doc_risks
                    except:
                        continue
                
                week_label = week_start.strftime('%m/%d')
                time_stats.append(AnalyticsMonthlyStats(
                    month=week_label,
                    documents=week_docs,
                    risks=week_risks
                ))
                
        elif granularity == "monthly":
            # Generate monthly stats - work backwards from today
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            current_year = now.year
            current_month = now.month
            month_data = {}
            
            for i in range(data_points):
                # Calculate month working backwards from current month
                target_month = current_month - (data_points-1-i)
                target_year = current_year
                
                if target_month <= 0:
                    target_month += 12
                    target_year -= 1
                
                month_key = f"{target_year}-{target_month:02d}"
                month_name = months[target_month - 1]
                month_data[month_key] = {
                    "name": month_name,
                    "documents": 0,
                    "risks": 0
                }
            
            for doc in documents:
                try:
                    upload_date = datetime.fromisoformat(doc.get('upload_date', '').replace('Z', '+00:00'))
                    month_key = f"{upload_date.year}-{upload_date.month:02d}"
                    
                    if month_key in month_data:
                        month_data[month_key]["documents"] += 1
                        risk_summary = doc.get('risk_summary', {})
                        doc_risks = risk_summary.get('high', 0) + risk_summary.get('medium', 0)
                        month_data[month_key]["risks"] += doc_risks
                except:
                    continue
            
            for month_key in sorted(month_data.keys()):
                data = month_data[month_key]
                time_stats.append(AnalyticsMonthlyStats(
                    month=data["name"],
                    documents=data["documents"],
                    risks=data["risks"]
                ))
                

        
        monthly_stats = time_stats
        
        # Create analytics response
        analytics_data = AnalyticsData(
            totalDocuments=total_documents,
            documentsThisMonth=documents_this_month,
            riskyClausesCaught=total_risky_clauses,
            mostCommonContractTypes=most_common_contract_types,
            processingTimeAnalytics={
                "averageTime": round(avg_time, 1),
                "fastestTime": round(fastest_time, 1),
                "slowestTime": round(slowest_time, 1),
                "totalProcessingTime": round(total_time, 1)
            },
            recentActivity=recent_activity,
            monthlyStats=monthly_stats,
            riskBreakdown=AnalyticsRiskBreakdown(
                high=total_high_risk,
                medium=total_medium_risk,
                low=total_low_risk
            )
        )
        
        return create_success_response(
            data=analytics_data,
            correlation_id=correlation_id
        )
        
    except Exception as e:
        print(f"Error generating analytics: {str(e)}")
        # Return default/empty data on error
        default_analytics = AnalyticsData(
            totalDocuments=0,
            documentsThisMonth=0,
            riskyClausesCaught=0,
            mostCommonContractTypes=[],
            processingTimeAnalytics={
                "averageTime": 0.0,
                "fastestTime": 0.0,
                "slowestTime": 0.0,
                "totalProcessingTime": 0.0
            },
            recentActivity=[],
            monthlyStats=[],
            riskBreakdown=AnalyticsRiskBreakdown(high=0, medium=0, low=0)
        )
        
        return create_error_response(
            code="ANALYTICS_GENERATION_FAILED",
            message=f"Failed to generate analytics: {str(e)}",
            details={"fallback_data": default_analytics.dict()},
            correlation_id=correlation_id
        )
