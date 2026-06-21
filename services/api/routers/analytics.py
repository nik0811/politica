from fastapi import APIRouter
from datetime import datetime, timedelta
import random

router = APIRouter()

@router.get("/trends")
async def get_trends():
    """Get trending topics and sentiment"""
    return {
        "topics": [
            {
                "name": "Healthcare",
                "engagement": 3245,
                "sentiment": 0.72,
                "trend": "+15%",
                "momentum": "increasing"
            },
            {
                "name": "Education",
                "engagement": 2890,
                "sentiment": 0.65,
                "trend": "+8%",
                "momentum": "stable"
            },
            {
                "name": "Infrastructure",
                "engagement": 2456,
                "sentiment": 0.58,
                "trend": "-3%",
                "momentum": "declining"
            }
        ],
        "sentiment_overview": {
            "overall": 0.68,
            "distribution": {"positive": 65, "neutral": 25, "negative": 10}
        }
    }

@router.get("/engagement")
async def get_engagement_stats():
    """Get engagement statistics over time"""
    dates = [(datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7, 0, -1)]
    
    return {
        "daily_stats": [
            {
                "date": date,
                "documents": random.randint(150, 250),
                "engagement": random.randint(5000, 10000),
                "sentiment": round(random.uniform(0.6, 0.8), 2)
            }
            for date in dates
        ]
    }

@router.get("/sentiment/{topic}")
async def get_topic_sentiment(topic: str):
    """Get sentiment analysis for a specific topic"""
    return {
        "topic": topic,
        "overall_sentiment": 0.72,
        "sentiment_distribution": {
            "positive": 68,
            "neutral": 22,
            "negative": 10
        },
        "emotions": {
            "hope": 45,
            "concern": 30,
            "satisfaction": 15,
            "frustration": 10
        },
        "trend": "improving",
        "change": "+0.08"
    }
