from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import get_db
from models.models import Document as DocumentModel, Promise as PromiseModel, Topic as TopicModel
from datetime import datetime, timedelta
from typing import List

router = APIRouter()

@router.get("/daily")
async def get_daily_summary(db: Session = Depends(get_db)):
    """Generate daily summary from documents"""
    today = datetime.now().date()
    
    # Get today's documents
    today_docs = db.query(DocumentModel).filter(
        func.date(DocumentModel.created_at) == today
    ).all()
    
    if not today_docs:
        return {
            "id": f"daily-{today.isoformat()}",
            "type": "daily",
            "title": f"Daily Summary - {today.strftime('%B %d, %Y')}",
            "date": today.isoformat(),
            "status": "no_data",
            "word_count": 0,
            "topics": [],
            "key_insights": ["No documents processed today yet."]
        }
    
    # Get top topics from today
    topics_today = {}
    for doc in today_docs:
        if doc.topics:
            for topic in doc.topics:
                topics_today[topic] = topics_today.get(topic, 0) + 1
    
    top_topics = sorted(topics_today.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Generate insights
    insights = [
        f"Processed {len(today_docs)} documents today across {len(set([d.platform for d in today_docs]))} platforms",
        f"Top topic: {top_topics[0][0]} with {top_topics[0][1]} mentions" if top_topics else "No clear topic trends",
        f"Average sentiment: {sum([d.sentiment for d in today_docs if d.sentiment]) / len([d for d in today_docs if d.sentiment]):.2f}" if any(d.sentiment for d in today_docs) else "Sentiment analysis pending"
    ]
    
    # Get today's promises
    today_promises = db.query(PromiseModel).filter(
        func.date(PromiseModel.created_at) == today
    ).count()
    
    if today_promises > 0:
        insights.append(f"Extracted {today_promises} new political promises")
    
    return {
        "id": f"daily-{today.isoformat()}",
        "type": "daily",
        "title": f"Daily Intelligence Brief - {today.strftime('%B %d, %Y')}",
        "date": today.isoformat(),
        "status": "generated",
        "word_count": len(today_docs) * 150,  # Estimate
        "topics": [t[0] for t in top_topics],
        "key_insights": insights
    }

@router.get("/weekly")
async def get_weekly_summary(db: Session = Depends(get_db)):
    """Generate weekly summary"""
    week_start = datetime.now() - timedelta(days=7)
    
    # Get this week's documents
    week_docs = db.query(DocumentModel).filter(
        DocumentModel.created_at >= week_start
    ).all()
    
    if not week_docs:
        return {
            "id": f"weekly-{week_start.date().isoformat()}",
            "type": "weekly",
            "title": "Weekly Summary - No Data",
            "date": week_start.date().isoformat(),
            "status": "no_data",
            "word_count": 0,
            "topics": [],
            "key_insights": ["No documents processed this week yet."]
        }
    
    # Aggregate topics
    topics_week = {}
    sentiments = []
    
    for doc in week_docs:
        if doc.topics:
            for topic in doc.topics:
                topics_week[topic] = topics_week.get(topic, 0) + 1
        if doc.sentiment:
            sentiments.append(doc.sentiment)
    
    top_topics = sorted(topics_week.items(), key=lambda x: x[1], reverse=True)[:10]
    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.5
    
    # Count promises
    week_promises = db.query(PromiseModel).filter(
        PromiseModel.created_at >= week_start
    ).count()
    
    # Generate insights
    insights = [
        f"Analyzed {len(week_docs)} documents from {len(set([d.platform for d in week_docs]))} platforms this week",
        f"Trending topics: {', '.join([t[0] for t in top_topics[:3]])}",
        f"Overall sentiment: {'Positive' if avg_sentiment > 0.6 else 'Neutral' if avg_sentiment > 0.4 else 'Negative'} ({avg_sentiment:.2f})",
        f"Political promises extracted: {week_promises}"
    ]
    
    # Get top entities this week
    entities_mentioned = {}
    for doc in week_docs:
        if doc.entities:
            for entity in doc.entities:
                if isinstance(entity, dict) and 'name' in entity:
                    entities_mentioned[entity['name']] = entities_mentioned.get(entity['name'], 0) + 1
    
    if entities_mentioned:
        top_entity = max(entities_mentioned.items(), key=lambda x: x[1])
        insights.append(f"Most mentioned: {top_entity[0]} ({top_entity[1]} times)")
    
    return {
        "id": f"weekly-{week_start.date().isoformat()}",
        "type": "weekly",
        "title": f"Weekly Intelligence Report - Week of {week_start.strftime('%B %d, %Y')}",
        "date": week_start.date().isoformat(),
        "status": "generated",
        "word_count": len(week_docs) * 150,
        "topics": [t[0] for t in top_topics],
        "key_insights": insights
    }

@router.get("/topic/{topic_name}")
async def get_topic_summary(topic_name: str, db: Session = Depends(get_db)):
    """Generate summary for a specific topic"""
    # Get documents with this topic
    topic_docs = db.query(DocumentModel).filter(
        func.jsonb_array_elements_text(DocumentModel.topics).op('=')(topic_name)
    ).all()
    
    if not topic_docs:
        return {
            "id": f"topic-{topic_name.lower().replace(' ', '-')}",
            "type": "topic",
            "title": f"Topic Analysis: {topic_name}",
            "date": datetime.now().date().isoformat(),
            "status": "no_data",
            "word_count": 0,
            "topics": [topic_name],
            "key_insights": [f"No documents found for topic '{topic_name}'."]
        }
    
    # Analyze
    platforms = set([d.platform for d in topic_docs])
    sentiments = [d.sentiment for d in topic_docs if d.sentiment]
    avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.5
    
    # Get promises for this topic
    topic_promises = db.query(PromiseModel).filter(
        PromiseModel.topic == topic_name
    ).all()
    
    insights = [
        f"Found {len(topic_docs)} documents discussing {topic_name}",
        f"Coverage across: {', '.join(platforms)}",
        f"Sentiment: {'Positive' if avg_sentiment > 0.6 else 'Neutral' if avg_sentiment > 0.4 else 'Negative'} ({avg_sentiment:.2f})",
        f"{len(topic_promises)} political promises related to {topic_name}"
    ]
    
    if topic_promises:
        top_entities = {}
        for p in topic_promises:
            top_entities[p.entity] = top_entities.get(p.entity, 0) + 1
        
        top_entity = max(top_entities.items(), key=lambda x: x[1])
        insights.append(f"Most active: {top_entity[0]} ({top_entity[1]} promises)")
    
    return {
        "id": f"topic-{topic_name.lower().replace(' ', '-')}",
        "type": "topic",
        "title": f"Deep Dive: {topic_name}",
        "date": datetime.now().date().isoformat(),
        "status": "generated",
        "word_count": len(topic_docs) * 200,
        "topics": [topic_name],
        "key_insights": insights
    }

@router.get("/all")
async def get_all_summaries(db: Session = Depends(get_db)):
    """Get all available summaries"""
    summaries = []
    
    # Add daily summary
    daily = await get_daily_summary(db)
    summaries.append(daily)
    
    # Add weekly summary
    weekly = await get_weekly_summary(db)
    summaries.append(weekly)
    
    # Add top topic summaries (only if documents with topics exist)
    try:
        top_topics = db.query(
            func.jsonb_array_elements_text(DocumentModel.topics).label('topic'),
            func.count().label('count')
        ).filter(DocumentModel.topics.isnot(None)).group_by('topic').order_by(desc('count')).limit(3).all()
        
        for topic_row in top_topics:
            if topic_row.topic:
                topic_summary = await get_topic_summary(topic_row.topic, db)
                summaries.append(topic_summary)
    except Exception:
        pass
    
    return {"summaries": summaries}
