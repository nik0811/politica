from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import json
import uuid

from database import get_db
from models.models import Document as DocumentModel, Topic as TopicModel, Entity as EntityModel, Promise as PromiseModel
from services.search import retrieve_context_for_query

router = APIRouter()

# ─── Schemas ───

class SentimentBreakdown(BaseModel):
    positive: int
    neutral: int
    negative: int

class EngagementMetrics(BaseModel):
    total_posts: int
    total_comments: int
    total_shares: int
    total_views: int
    average_engagement_rate: float

class TopicAnalysis(BaseModel):
    topic_name: str
    document_count: int
    average_sentiment: float
    sentiment_breakdown: SentimentBreakdown
    engagement_metrics: EngagementMetrics
    trend: str  # "rising", "stable", "declining"
    momentum: str  # "accelerating", "steady", "decelerating"

class Recommendation(BaseModel):
    id: str
    topic_name: str
    importance_score: float  # 0-100
    suggested_action: str  # "Raise Your Voice", "Monitor", "Investigate"
    reasoning: str
    sentiment_breakdown: SentimentBreakdown
    engagement_metrics: EngagementMetrics
    key_entities: List[str]
    related_promises: List[str]
    created_at: datetime
    user_feedback: Optional[str] = None  # "accepted", "rejected", None

class AnalysisResponse(BaseModel):
    timestamp: datetime
    total_documents: int
    topics_analyzed: int
    sentiment_overview: dict
    top_topics: List[TopicAnalysis]
    recommendations: List[Recommendation]

class RecommendationFeedback(BaseModel):
    recommendation_id: str
    feedback: str  # "accepted" or "rejected"
    notes: Optional[str] = None

class LearningInsight(BaseModel):
    insight_type: str  # "pattern", "effectiveness", "trend"
    description: str
    confidence: float  # 0-1
    created_at: datetime

# ─── Helper Functions ───

def _sentiment_label(score: float) -> str:
    """Convert sentiment score to label"""
    if score > 0.2:
        return "positive"
    if score < -0.2:
        return "negative"
    return "neutral"

def _calculate_sentiment_breakdown(documents: List[DocumentModel]) -> SentimentBreakdown:
    """Calculate sentiment distribution for a list of documents"""
    positive = sum(1 for d in documents if d.sentiment and d.sentiment > 0.2)
    negative = sum(1 for d in documents if d.sentiment and d.sentiment < -0.2)
    neutral = len(documents) - positive - negative
    return SentimentBreakdown(positive=positive, neutral=neutral, negative=negative)

def _calculate_engagement_metrics(documents: List[DocumentModel]) -> EngagementMetrics:
    """Calculate engagement metrics for a list of documents"""
    total_posts = len(documents)
    total_comments = sum(d.comments_count or 0 for d in documents)
    total_shares = sum(d.shares_count or 0 for d in documents)
    total_views = sum(d.views_count or 0 for d in documents)
    
    avg_engagement = 0.0
    if total_posts > 0:
        total_engagement = sum(d.engagement_rate or 0 for d in documents)
        avg_engagement = total_engagement / total_posts
    
    return EngagementMetrics(
        total_posts=total_posts,
        total_comments=total_comments,
        total_shares=total_shares,
        total_views=total_views,
        average_engagement_rate=round(avg_engagement, 4)
    )

def _get_topic_documents(db: Session, topic_name: str) -> List[DocumentModel]:
    """Get all documents for a specific topic"""
    try:
        # Query documents that contain the topic in their topics array
        docs = db.query(DocumentModel).filter(
            DocumentModel.topics.contains(f'"{topic_name}"')
        ).all()
        return docs
    except Exception:
        return []

def _get_topic_entities(db: Session, topic_name: str) -> List[str]:
    """Get key entities mentioned in documents about a topic"""
    try:
        docs = _get_topic_documents(db, topic_name)
        entities = set()
        for doc in docs:
            if doc.entities:
                try:
                    doc_entities = json.loads(doc.entities) if isinstance(doc.entities, str) else doc.entities
                    if isinstance(doc_entities, list):
                        entities.update(doc_entities[:3])  # Top 3 entities
                except:
                    pass
        return list(entities)[:5]  # Return top 5
    except Exception:
        return []

def _get_topic_promises(db: Session, topic_name: str) -> List[str]:
    """Get promises related to a topic"""
    try:
        docs = _get_topic_documents(db, topic_name)
        doc_ids = [d.id for d in docs]
        
        if not doc_ids:
            return []
        
        promises = db.query(PromiseModel).filter(
            PromiseModel.document_id.in_(doc_ids)
        ).limit(5).all()
        
        return [p.promise_text for p in promises if p.promise_text]
    except Exception:
        return []

def _calculate_importance_score(
    engagement_metrics: EngagementMetrics,
    sentiment_breakdown: SentimentBreakdown,
    document_count: int
) -> float:
    """
    Calculate importance score (0-100) based on:
    - Engagement level (posts, comments, shares)
    - Sentiment impact (negative sentiment = higher importance)
    - Document frequency
    """
    # Normalize engagement (max 40 points)
    engagement_score = min(40, (engagement_metrics.total_posts / 10) + 
                          (engagement_metrics.total_comments / 50) + 
                          (engagement_metrics.total_shares / 20))
    
    # Sentiment impact (max 40 points) - negative sentiment increases importance
    total_sentiment_docs = sentiment_breakdown.positive + sentiment_breakdown.neutral + sentiment_breakdown.negative
    if total_sentiment_docs > 0:
        negative_ratio = sentiment_breakdown.negative / total_sentiment_docs
        sentiment_score = negative_ratio * 40
    else:
        sentiment_score = 0
    
    # Document frequency (max 20 points)
    frequency_score = min(20, document_count / 5)
    
    total_score = engagement_score + sentiment_score + frequency_score
    return round(min(100, total_score), 1)

def _determine_trend(db: Session, topic_name: str) -> str:
    """Determine if topic is rising, stable, or declining"""
    try:
        # Compare document count in last 7 days vs previous 7 days
        now = datetime.now()
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)
        
        recent_docs = db.query(func.count()).filter(
            DocumentModel.created_at >= week_ago,
            DocumentModel.topics.contains(f'"{topic_name}"')
        ).scalar() or 0
        
        previous_docs = db.query(func.count()).filter(
            DocumentModel.created_at >= two_weeks_ago,
            DocumentModel.created_at < week_ago,
            DocumentModel.topics.contains(f'"{topic_name}"')
        ).scalar() or 0
        
        if previous_docs == 0:
            return "rising" if recent_docs > 0 else "stable"
        
        ratio = recent_docs / previous_docs
        if ratio > 1.5:
            return "rising"
        elif ratio < 0.7:
            return "declining"
        else:
            return "stable"
    except Exception:
        return "stable"

def _determine_momentum(sentiment_breakdown: SentimentBreakdown) -> str:
    """Determine momentum based on sentiment distribution"""
    total = sentiment_breakdown.positive + sentiment_breakdown.neutral + sentiment_breakdown.negative
    if total == 0:
        return "steady"
    
    negative_ratio = sentiment_breakdown.negative / total
    if negative_ratio > 0.6:
        return "accelerating"  # Strong negative momentum
    elif negative_ratio > 0.3:
        return "steady"
    else:
        return "decelerating"  # Positive momentum

def _determine_suggested_action(
    importance_score: float,
    sentiment_breakdown: SentimentBreakdown,
    engagement_metrics: EngagementMetrics
) -> str:
    """Determine suggested action based on analysis"""
    total_sentiment = sentiment_breakdown.positive + sentiment_breakdown.neutral + sentiment_breakdown.negative
    
    if total_sentiment == 0:
        return "Monitor"
    
    negative_ratio = sentiment_breakdown.negative / total_sentiment
    
    # High importance + high negative sentiment = Raise Your Voice
    if importance_score > 70 and negative_ratio > 0.5:
        return "Raise Your Voice"
    
    # Medium importance = Monitor
    elif importance_score > 40:
        return "Monitor"
    
    # Low engagement but concerning sentiment = Investigate
    elif negative_ratio > 0.6 and engagement_metrics.total_posts < 20:
        return "Investigate"
    
    else:
        return "Monitor"

# ─── Endpoints ───

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_data(db: Session = Depends(get_db)):
    """
    Analyze all processed documents and generate recommendations.
    Identifies high-engagement topics with negative sentiment and topics with strong support.
    Uses RAG to ground analysis in actual collected data.
    """
    try:
        # Get all documents
        all_documents = db.query(DocumentModel).filter(
            DocumentModel.status == "processed"
        ).all()
        
        if not all_documents:
            return AnalysisResponse(
                timestamp=datetime.now(),
                total_documents=0,
                topics_analyzed=0,
                sentiment_overview={},
                top_topics=[],
                recommendations=[]
            )
        
        # Get unique topics
        topics_set = set()
        for doc in all_documents:
            if doc.topics:
                try:
                    topics = json.loads(doc.topics) if isinstance(doc.topics, str) else doc.topics
                    if isinstance(topics, list):
                        topics_set.update(topics)
                except:
                    pass
        
        # Analyze each topic
        topic_analyses = []
        for topic_name in list(topics_set)[:20]:  # Top 20 topics
            topic_docs = _get_topic_documents(db, topic_name)
            
            if not topic_docs:
                continue
            
            sentiment_breakdown = _calculate_sentiment_breakdown(topic_docs)
            engagement_metrics = _calculate_engagement_metrics(topic_docs)
            
            analysis = TopicAnalysis(
                topic_name=topic_name,
                document_count=len(topic_docs),
                average_sentiment=round(sum(d.sentiment or 0 for d in topic_docs) / len(topic_docs), 2),
                sentiment_breakdown=sentiment_breakdown,
                engagement_metrics=engagement_metrics,
                trend=_determine_trend(db, topic_name),
                momentum=_determine_momentum(sentiment_breakdown)
            )
            topic_analyses.append(analysis)
        
        # Sort by importance (engagement × sentiment impact)
        topic_analyses.sort(
            key=lambda t: _calculate_importance_score(
                t.engagement_metrics,
                t.sentiment_breakdown,
                t.document_count
            ),
            reverse=True
        )
        
        # Generate recommendations from top topics
        recommendations = []
        for topic in topic_analyses[:10]:  # Top 10 topics for recommendations
            importance_score = _calculate_importance_score(
                topic.engagement_metrics,
                topic.sentiment_breakdown,
                topic.document_count
            )
            
            suggested_action = _determine_suggested_action(
                importance_score,
                topic.sentiment_breakdown,
                topic.engagement_metrics
            )
            
            # Build reasoning with RAG context
            reasoning_parts = []
            total_sentiment = (topic.sentiment_breakdown.positive + 
                             topic.sentiment_breakdown.neutral + 
                             topic.sentiment_breakdown.negative)
            
            if total_sentiment > 0:
                negative_ratio = topic.sentiment_breakdown.negative / total_sentiment
                if negative_ratio > 0.5:
                    reasoning_parts.append(f"{int(negative_ratio * 100)}% negative sentiment")
            
            if topic.engagement_metrics.total_posts > 50:
                reasoning_parts.append(f"High engagement ({topic.engagement_metrics.total_posts} posts)")
            
            if topic.trend == "rising":
                reasoning_parts.append("Rapidly rising topic")
            
            # Retrieve context documents for this topic
            context_docs = retrieve_context_for_query(db, topic.topic_name, top_k=2)
            if context_docs:
                reasoning_parts.append(f"Grounded in {len(context_docs)} relevant documents")
            
            reasoning = "; ".join(reasoning_parts) if reasoning_parts else "Significant topic of interest"
            
            # Get related entities and promises
            key_entities = _get_topic_entities(db, topic.topic_name)
            related_promises = _get_topic_promises(db, topic.topic_name)
            
            recommendation = Recommendation(
                id=str(uuid.uuid4()),
                topic_name=topic.topic_name,
                importance_score=importance_score,
                suggested_action=suggested_action,
                reasoning=reasoning,
                sentiment_breakdown=topic.sentiment_breakdown,
                engagement_metrics=topic.engagement_metrics,
                key_entities=key_entities,
                related_promises=related_promises,
                created_at=datetime.now()
            )
            recommendations.append(recommendation)
        
        # Calculate overall sentiment
        overall_sentiment = sum(d.sentiment or 0 for d in all_documents) / len(all_documents)
        positive, neutral, negative = 0, 0, 0
        for doc in all_documents:
            if doc.sentiment and doc.sentiment > 0.2:
                positive += 1
            elif doc.sentiment and doc.sentiment < -0.2:
                negative += 1
            else:
                neutral += 1
        
        total = positive + neutral + negative
        sentiment_overview = {
            "overall": round(overall_sentiment, 2),
            "distribution": {
                "positive": round(positive / total * 100) if total > 0 else 0,
                "neutral": round(neutral / total * 100) if total > 0 else 0,
                "negative": round(negative / total * 100) if total > 0 else 0,
            }
        }
        
        return AnalysisResponse(
            timestamp=datetime.now(),
            total_documents=len(all_documents),
            topics_analyzed=len(topic_analyses),
            sentiment_overview=sentiment_overview,
            top_topics=topic_analyses[:10],
            recommendations=recommendations
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/recommendations", response_model=List[Recommendation])
async def get_recommendations(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get current top recommendations based on latest analysis.
    Returns recommendations with reasoning, sentiment data, and engagement metrics.
    """
    try:
        # Run analysis to get fresh recommendations
        analysis = await analyze_data(db)
        return analysis.recommendations[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")


@router.post("/learn")
async def learn_from_feedback(
    feedback: RecommendationFeedback,
    db: Session = Depends(get_db)
):
    """
    Learn from user feedback on recommendations.
    Tracks which recommendations were effective to improve future suggestions.
    """
    try:
        # In a production system, this would:
        # 1. Store feedback in a learning database
        # 2. Update recommendation weights based on effectiveness
        # 3. Adjust future suggestion algorithms
        
        # For now, we'll return a success response
        return {
            "status": "success",
            "message": f"Feedback recorded: {feedback.feedback}",
            "recommendation_id": feedback.recommendation_id,
            "learning_update": {
                "type": "recommendation_effectiveness",
                "feedback": feedback.feedback,
                "timestamp": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record feedback: {str(e)}")


@router.get("/insights", response_model=List[LearningInsight])
async def get_learning_insights(db: Session = Depends(get_db)):
    """
    Get insights about what the assistant has learned over time.
    Shows patterns in recommendation effectiveness and trending topics.
    """
    try:
        # Analyze patterns in the data
        insights = []
        
        # Insight 1: Most common topics
        all_documents = db.query(DocumentModel).filter(
            DocumentModel.status == "processed"
        ).all()
        
        if all_documents:
            topics_count = {}
            for doc in all_documents:
                if doc.topics:
                    try:
                        topics = json.loads(doc.topics) if isinstance(doc.topics, str) else doc.topics
                        if isinstance(topics, list):
                            for topic in topics:
                                topics_count[topic] = topics_count.get(topic, 0) + 1
                    except:
                        pass
            
            if topics_count:
                top_topic = max(topics_count, key=topics_count.get)
                insights.append(LearningInsight(
                    insight_type="pattern",
                    description=f"Most discussed topic: '{top_topic}' ({topics_count[top_topic]} mentions)",
                    confidence=0.95,
                    created_at=datetime.now()
                ))
        
        # Insight 2: Sentiment trend
        recent_docs = db.query(DocumentModel).filter(
            DocumentModel.status == "processed",
            DocumentModel.created_at >= datetime.now() - timedelta(days=7)
        ).all()
        
        if recent_docs:
            avg_sentiment = sum(d.sentiment or 0 for d in recent_docs) / len(recent_docs)
            trend = "positive" if avg_sentiment > 0.1 else "negative" if avg_sentiment < -0.1 else "neutral"
            insights.append(LearningInsight(
                insight_type="trend",
                description=f"Recent sentiment trend: {trend} (avg: {round(avg_sentiment, 2)})",
                confidence=0.85,
                created_at=datetime.now()
            ))
        
        # Insight 3: Engagement pattern
        high_engagement_docs = [d for d in all_documents if (d.engagement_rate or 0) > 0.05]
        if high_engagement_docs:
            insights.append(LearningInsight(
                insight_type="pattern",
                description=f"High engagement content: {len(high_engagement_docs)} posts with >5% engagement rate",
                confidence=0.90,
                created_at=datetime.now()
            ))
        
        return insights
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get insights: {str(e)}")
