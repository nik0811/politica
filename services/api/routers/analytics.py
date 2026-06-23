from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from datetime import datetime, timedelta
from typing import Optional
from database import get_db
from models.models import Document as DocumentModel, Promise as PromiseModel, PostComment
from services.search import retrieve_context_for_query

router = APIRouter()

# Sentiment thresholds matching the AI processor output (-1.0 to 1.0 scale)
SENTIMENT_POSITIVE_THRESHOLD = 0.2
SENTIMENT_NEGATIVE_THRESHOLD = -0.2


def _sentiment_label(score: float) -> str:
    if score > SENTIMENT_POSITIVE_THRESHOLD:
        return "positive"
    if score < SENTIMENT_NEGATIVE_THRESHOLD:
        return "negative"
    return "neutral"


def _bucket_sentiments(db: Session, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    """Count documents in each sentiment bucket using AI-set Document.sentiment (-1.0 to 1.0)."""
    base_query = db.query(func.count()).filter(DocumentModel.sentiment.isnot(None))
    
    if start_date:
        base_query = base_query.filter(DocumentModel.collected_at >= start_date)
    if end_date:
        base_query = base_query.filter(DocumentModel.collected_at <= end_date)
    
    positive = base_query.filter(
        DocumentModel.sentiment > SENTIMENT_POSITIVE_THRESHOLD
    ).scalar() or 0
    
    neutral_query = db.query(func.count()).filter(
        DocumentModel.sentiment >= SENTIMENT_NEGATIVE_THRESHOLD,
        DocumentModel.sentiment <= SENTIMENT_POSITIVE_THRESHOLD,
    )
    if start_date:
        neutral_query = neutral_query.filter(DocumentModel.collected_at >= start_date)
    if end_date:
        neutral_query = neutral_query.filter(DocumentModel.collected_at <= end_date)
    neutral = neutral_query.scalar() or 0
    
    negative_query = db.query(func.count()).filter(
        DocumentModel.sentiment < SENTIMENT_NEGATIVE_THRESHOLD
    )
    if start_date:
        negative_query = negative_query.filter(DocumentModel.collected_at >= start_date)
    if end_date:
        negative_query = negative_query.filter(DocumentModel.collected_at <= end_date)
    negative = negative_query.scalar() or 0
    
    return positive, neutral, negative


@router.get("/trends")
async def get_trends(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """Trending topics with real database aggregation and AI sentiment scores."""
    # Parse date filters
    start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59) if end_date else None
    
    try:
        date_filter = ""
        if start_dt:
            date_filter += f" AND d.collected_at >= '{start_dt.isoformat()}'"
        if end_dt:
            date_filter += f" AND d.collected_at <= '{end_dt.isoformat()}'"
        
        topic_query = text(f"""
            SELECT t.topic_name, COUNT(*) as count, AVG(d.sentiment) as avg_sentiment
            FROM documents d, json_array_elements_text(d.topics) AS t(topic_name)
            WHERE d.topics IS NOT NULL AND d.topics::text != '[]' AND d.topics::text != 'null'
            {date_filter}
            GROUP BY t.topic_name
            ORDER BY count DESC
            LIMIT 10
        """)
        topic_data = db.execute(topic_query).fetchall()
    except Exception:
        topic_data = []

    topics = []
    for topic in topic_data:
        avg_sent = float(topic.avg_sentiment) if topic.avg_sentiment is not None else 0.0
        topics.append({
            "name": topic.topic_name if topic.topic_name else "Uncategorized",
            "engagement": int(topic.count),
            "sentiment": round(avg_sent, 2),
            "trend": "stable",
            "momentum": "stable",
        })

    sentiment_query = db.query(func.avg(DocumentModel.sentiment)).filter(
        DocumentModel.sentiment.isnot(None)
    )
    if start_dt:
        sentiment_query = sentiment_query.filter(DocumentModel.collected_at >= start_dt)
    if end_dt:
        sentiment_query = sentiment_query.filter(DocumentModel.collected_at <= end_dt)
    overall_sentiment = sentiment_query.scalar()

    positive, neutral, negative = _bucket_sentiments(db, start_dt, end_dt)
    total = positive + neutral + negative

    return {
        "topics": topics,
        "sentiment_overview": {
            "overall": round(float(overall_sentiment) if overall_sentiment else 0.0, 2),
            "distribution": {
                "positive": round(positive / total * 100) if total > 0 else 0,
                "neutral": round(neutral / total * 100) if total > 0 else 0,
                "negative": round(negative / total * 100) if total > 0 else 0,
            },
        },
        "date_range": {
            "start": start_date,
            "end": end_date,
        }
    }


@router.get("/sentiment/{topic}")
async def get_topic_sentiment(topic: str, db: Session = Depends(get_db)):
    """Sentiment breakdown for a specific topic using AI-set scores (-1.0 to 1.0)."""
    try:
        topic_docs = db.query(DocumentModel).filter(
            func.jsonb_array_elements_text(DocumentModel.topics).op('@>')(f'"{topic}"')
        ).all()
    except Exception:
        topic_docs = []

    if not topic_docs:
        return {
            "topic": topic,
            "overall_sentiment": 0.0,
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
            "trend": "no data",
            "change": "0",
        }

    sentiments = [doc.sentiment for doc in topic_docs if doc.sentiment is not None]
    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.0

    positive = len([s for s in sentiments if s > SENTIMENT_POSITIVE_THRESHOLD])
    neutral = len([s for s in sentiments if SENTIMENT_NEGATIVE_THRESHOLD <= s <= SENTIMENT_POSITIVE_THRESHOLD])
    negative = len([s for s in sentiments if s < SENTIMENT_NEGATIVE_THRESHOLD])
    total = len(sentiments)

    return {
        "topic": topic,
        "overall_sentiment": round(avg_sentiment, 2),
        "sentiment_distribution": {
            "positive": round(positive / total * 100) if total > 0 else 0,
            "neutral": round(neutral / total * 100) if total > 0 else 0,
            "negative": round(negative / total * 100) if total > 0 else 0,
        },
        "trend": "stable",
        "change": "0",
    }


@router.get("/engagement")
async def get_engagement_stats(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Engagement statistics: top posts, posting frequency, top commenters, platform breakdown, sentiment.
    Uses RAG to ground analysis in actual collected data.
    Supports date range filtering.
    """
    # Parse date filters
    start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59) if end_date else None
    
    # Base query with date filters
    base_query = db.query(DocumentModel).filter(DocumentModel.status != "pending_ai_review")
    if start_dt:
        base_query = base_query.filter(DocumentModel.collected_at >= start_dt)
    if end_dt:
        base_query = base_query.filter(DocumentModel.collected_at <= end_dt)
    
    top_posts = (
        base_query
        .order_by(
            desc(
                (DocumentModel.likes_count or 0)
                + (DocumentModel.comments_count or 0)
                + (DocumentModel.shares_count or 0)
            )
        )
        .limit(10)
        .all()
    )

    top_posts_data = []
    for d in top_posts:
        # Retrieve context documents for each top post
        context_docs = retrieve_context_for_query(db, d.title or d.content[:100], top_k=1)
        
        post_data = {
            "id": d.id,
            "title": d.title,
            "platform": d.platform,
            "author": d.author or d.author_handle,
            "likes": d.likes_count or 0,
            "comments": d.comments_count or 0,
            "shares": d.shares_count or 0,
            "total_engagement": (d.likes_count or 0) + (d.comments_count or 0) + (d.shares_count or 0),
            "collected_at": d.collected_at.isoformat() if d.collected_at else None,
            "context_documents": len(context_docs),  # Number of related documents
        }
        top_posts_data.append(post_data)

    # Posting frequency — last 14 days grouped by date
    posting_freq = []
    for i in range(13, -1, -1):
        day = datetime.now() - timedelta(days=i)
        date_str = day.strftime("%Y-%m-%d")
        count = db.query(func.count()).filter(
            func.date(DocumentModel.collected_at) == day.date(),
            DocumentModel.status != "pending_ai_review",
        ).scalar() or 0
        posting_freq.append({"date": date_str, "count": int(count)})

    avg_engagement = db.query(func.avg(DocumentModel.engagement_rate)).filter(
        DocumentModel.engagement_rate.isnot(None)
    ).scalar()

    avg_likes = db.query(func.avg(DocumentModel.likes_count)).filter(
        DocumentModel.likes_count.isnot(None)
    ).scalar()

    avg_comments = db.query(func.avg(DocumentModel.comments_count)).filter(
        DocumentModel.comments_count.isnot(None)
    ).scalar()

    # Get unique commenters count
    unique_commenters_count = db.query(func.count(func.distinct(PostComment.author_handle))).filter(
        PostComment.author_handle.isnot(None)
    ).scalar() or 0

    top_commenters = (
        db.query(
            PostComment.author_handle,
            PostComment.author,
            func.count(PostComment.id).label("comment_count"),
            func.avg(PostComment.likes_count).label("avg_likes"),
            func.sum(PostComment.likes_count).label("total_likes"),
        )
        .filter(PostComment.author_handle.isnot(None))
        .group_by(PostComment.author_handle, PostComment.author)
        .order_by(desc("comment_count"))
        .limit(15)
        .all()
    )

    top_commenters_data = [
        {
            "handle": row.author_handle,
            "name": row.author,
            "comment_count": int(row.comment_count),
            "avg_likes": round(float(row.avg_likes or 0), 1),
            "total_likes": int(row.total_likes or 0),
        }
        for row in top_commenters
    ]

    platform_counts = (
        db.query(DocumentModel.platform, func.count(DocumentModel.id).label("count"))
        .filter(DocumentModel.status != "pending_ai_review")
        .group_by(DocumentModel.platform)
        .all()
    )
    total_docs = sum(r.count for r in platform_counts) or 1
    platform_breakdown = [
        {
            "platform": row.platform,
            "count": int(row.count),
            "percentage": round(row.count / total_docs * 100, 1),
        }
        for row in sorted(platform_counts, key=lambda r: r.count, reverse=True)
    ]

    processed_total = db.query(func.count()).filter(
        DocumentModel.sentiment.isnot(None)
    ).scalar() or 0

    positive, neutral, negative = _bucket_sentiments(db)

    return {
        "top_posts": top_posts_data,
        "posting_frequency": posting_freq,
        "averages": {
            "engagement_rate": round(float(avg_engagement), 4) if avg_engagement else None,
            "likes_per_post": round(float(avg_likes), 1) if avg_likes else 0,
            "comments_per_post": round(float(avg_comments), 1) if avg_comments else 0,
        },
        "top_commenters": top_commenters_data,
        "unique_commenters_count": unique_commenters_count,
        "platform_breakdown": platform_breakdown,
        "sentiment_distribution": {
            "total_processed": processed_total,
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
        },
    }


@router.get("/topics-engagement")
async def get_topics_engagement(db: Session = Depends(get_db)):
    """Top topics ranked by total engagement with AI sentiment scores."""
    try:
        query = text("""
            SELECT
                t.topic_name,
                COUNT(DISTINCT d.id)                                   AS doc_count,
                COALESCE(SUM(d.likes_count), 0)
                  + COALESCE(SUM(d.comments_count), 0)
                  + COALESCE(SUM(d.shares_count), 0)                  AS total_engagement,
                AVG(d.sentiment)                                       AS avg_sentiment,
                MAX(d.likes_count + COALESCE(d.comments_count, 0))    AS top_post_likes
            FROM documents d,
                 json_array_elements_text(d.topics) AS t(topic_name)
            WHERE d.topics IS NOT NULL
              AND d.topics::text NOT IN ('[]', 'null')
            GROUP BY t.topic_name
            ORDER BY total_engagement DESC
            LIMIT 10
        """)
        rows = db.execute(query).fetchall()
    except Exception:
        rows = []

    results = []
    for row in rows:
        try:
            best_post_q = text("""
                SELECT d.title, d.content, d.platform,
                       COALESCE(d.likes_count,0) + COALESCE(d.comments_count,0) + COALESCE(d.shares_count,0) AS eng
                FROM documents d,
                     json_array_elements_text(d.topics) AS t(topic_name)
                WHERE t.topic_name = :topic
                ORDER BY eng DESC
                LIMIT 1
            """)
            best = db.execute(best_post_q, {"topic": row.topic_name}).fetchone()
        except Exception:
            best = None

        avg_sent = float(row.avg_sentiment) if row.avg_sentiment is not None else 0.0
        results.append({
            "topic": row.topic_name,
            "doc_count": int(row.doc_count),
            "total_engagement": int(row.total_engagement),
            "avg_sentiment": round(avg_sent, 3),
            "sentiment_label": _sentiment_label(avg_sent),
            "top_post_title": best.title if best else None,
            "top_post_snippet": (best.content[:160] + "…") if best and best.content else None,
            "top_post_platform": best.platform if best else None,
            "top_post_engagement": int(best.eng) if best else 0,
        })

    return {"topics": results}


@router.get("/weekly-trends")
async def get_weekly_trends(db: Session = Depends(get_db)):
    """Weekly collection trends: documents grouped by week with sentiment."""
    try:
        query = text("""
            SELECT 
                DATE_TRUNC('week', d.collected_at)::date as week_start,
                COUNT(*) as doc_count,
                AVG(d.sentiment) as avg_sentiment
            FROM documents d
            WHERE d.status != 'pending_ai_review'
            GROUP BY DATE_TRUNC('week', d.collected_at)
            ORDER BY week_start DESC
            LIMIT 12
        """)
        rows = db.execute(query).fetchall()
    except Exception:
        rows = []

    weekly_data = []
    for row in reversed(rows):  # Reverse to show oldest first
        if row.week_start:
            week_label = row.week_start.strftime("%b %d")
            avg_sent = float(row.avg_sentiment) if row.avg_sentiment is not None else 0.0
            weekly_data.append({
                "week": week_label,
                "week_start": row.week_start.isoformat(),
                "documents": int(row.doc_count),
                "avg_sentiment": round(avg_sent, 2),
                "sentiment_label": _sentiment_label(avg_sent),
            })

    return {"weekly_trends": weekly_data}


@router.get("/sentiment-segmentation")
async def get_sentiment_segmentation(db: Session = Depends(get_db)):
    """Pro-government vs Against-government sentiment analysis based on comment keywords."""
    # Keywords for pro-government sentiment
    pro_keywords = [
        "support", "good", "excellent", "great", "positive", "progress", "development",
        "achievement", "success", "improvement", "well done", "appreciate", "thank",
        "proud", "hope", "believe", "trust", "confidence", "strong", "leadership"
    ]
    
    # Keywords for against-government sentiment
    against_keywords = [
        "against", "bad", "terrible", "poor", "negative", "failure", "problem",
        "issue", "concern", "criticism", "disappointed", "angry", "frustrated",
        "unfair", "corrupt", "wrong", "mistake", "blame", "protest", "oppose"
    ]

    # Count comments with pro-government keywords
    pro_count = 0
    against_count = 0
    neutral_count = 0

    try:
        # Get all comments with sentiment
        comments = db.query(PostComment).all()
        
        for comment in comments:
            content_lower = (comment.content or "").lower()
            
            pro_matches = sum(1 for kw in pro_keywords if kw in content_lower)
            against_matches = sum(1 for kw in against_keywords if kw in content_lower)
            
            if pro_matches > against_matches:
                pro_count += 1
            elif against_matches > pro_matches:
                against_count += 1
            else:
                neutral_count += 1
    except Exception:
        pass

    total = pro_count + against_count + neutral_count or 1

    return {
        "pro_government": {
            "count": pro_count,
            "percentage": round(pro_count / total * 100, 1),
        },
        "against_government": {
            "count": against_count,
            "percentage": round(against_count / total * 100, 1),
        },
        "neutral": {
            "count": neutral_count,
            "percentage": round(neutral_count / total * 100, 1),
        },
        "total_comments": total,
    }
