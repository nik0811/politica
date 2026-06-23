# AI Assistant Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     POLITICA ADMIN PORTAL                       │
│                    (Next.js Frontend)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         AI Assistant Page                                │  │
│  │  (/admin/assistant/page.tsx)                             │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ Overview Statistics                             │   │  │
│  │  │ • Total Documents                               │   │  │
│  │  │ • Topics Analyzed                               │   │  │
│  │  │ • Sentiment Distribution                        │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ Tabs                                            │   │  │
│  │  │ ├─ Recommendations                              │   │  │
│  │  │ │  └─ Recommendation Cards (Grid)               │   │  │
│  │  │ ├─ Topics Analysis                              │   │  │
│  │  │ │  └─ Topic Cards (List)                        │   │  │
│  │  │ └─ Learning Insights                            │   │  │
│  │  │    └─ Insight Cards                             │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ API Client Methods                              │   │  │
│  │  │ • analyzeData()                                 │   │  │
│  │  │ • getRecommendations()                          │   │  │
│  │  │ • submitRecommendationFeedback()                │   │  │
│  │  │ • getLearningInsights()                         │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Admin Sidebar                                    │  │
│  │  • Navigation Link: "AI Assistant"                       │  │
│  │  • Icon: Brain                                           │  │
│  │  • Section: Research                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                    POLITICA API SERVER                          │
│                    (FastAPI Backend)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Assistant Router                                 │  │
│  │  (/api/assistant)                                        │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ POST /analyze                                   │   │  │
│  │  │ • Fetch processed documents                     │   │  │
│  │  │ • Extract topics                                │   │  │
│  │  │ • Calculate metrics                             │   │  │
│  │  │ • Generate recommendations                      │   │  │
│  │  │ • Return AnalysisResponse                       │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ GET /recommendations                            │   │  │
│  │  │ • Call analyze()                                │   │  │
│  │  │ • Return top N recommendations                  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ POST /learn                                     │   │  │
│  │  │ • Record user feedback                          │   │  │
│  │  │ • Track recommendation effectiveness            │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ GET /insights                                   │   │  │
│  │  │ • Analyze data patterns                         │   │  │
│  │  │ • Generate learning insights                    │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Helper Functions                                 │  │
│  │ • _sentiment_label()                                     │  │
│  │ • _calculate_sentiment_breakdown()                       │  │
│  │ • _calculate_engagement_metrics()                        │  │
│  │ • _get_topic_documents()                                 │  │
│  │ • _get_topic_entities()                                  │  │
│  │ • _get_topic_promises()                                  │  │
│  │ • _calculate_importance_score()                          │  │
│  │ • _determine_trend()                                     │  │
│  │ • _determine_momentum()                                  │  │
│  │ • _determine_suggested_action()                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ SQL Queries
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                     │
│                    (PostgreSQL)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ documents table                                          │  │
│  │ • id, title, content, url, platform                     │  │
│  │ • sentiment (float: -1.0 to 1.0)                        │  │
│  │ • topics (JSON array)                                   │  │
│  │ • entities (JSON array)                                 │  │
│  │ • likes_count, comments_count, shares_count            │  │
│  │ • views_count, engagement_rate                         │  │
│  │ • status, created_at, published_at                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ promises table                                           │  │
│  │ • id, document_id, promise_text                         │  │
│  │ • created_at                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ entities table                                           │  │
│  │ • id, name, type                                        │  │
│  │ • created_at                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
User Opens AI Assistant Page
         ↓
    [Loading State]
         ↓
Frontend calls POST /api/assistant/analyze
         ↓
Backend:
  1. Query all processed documents
  2. Extract unique topics
  3. For each topic:
     - Get all documents with topic
     - Calculate sentiment breakdown
     - Calculate engagement metrics
     - Determine trend (rising/stable/declining)
     - Determine momentum
     - Calculate importance score
     - Get key entities
     - Get related promises
     - Determine suggested action
     - Generate reasoning
  4. Sort by importance score
  5. Return top 10 recommendations
         ↓
Frontend receives AnalysisResponse
         ↓
Display:
  - Overview statistics
  - Recommendation cards (grid)
  - Topic analysis (list)
  - Learning insights
         ↓
User reviews recommendations
         ↓
User clicks Accept/Reject
         ↓
Frontend calls POST /api/assistant/learn
         ↓
Backend records feedback
         ↓
Feedback stored for learning
```

## Component Hierarchy

```
AssistantPage
├── Header
│   ├── Title + Icon
│   └── Refresh Button
├── Overview Stats (Grid)
│   ├── Documents Analyzed Card
│   ├── Topics Analyzed Card
│   ├── Positive Sentiment Card
│   └── Negative Sentiment Card
└── Tabs
    ├── Recommendations Tab
    │   └── Recommendation Cards (Grid)
    │       ├── Header (Topic + Action Badge)
    │       ├── Importance Score (Progress Bar)
    │       ├── Sentiment Breakdown (3 Cards)
    │       ├── Engagement Metrics (4 Cards)
    │       ├── Key Entities (Badges)
    │       ├── Related Promises (List)
    │       └── Feedback Buttons (Accept/Reject)
    ├── Topics Analysis Tab
    │   └── Topic Cards (List)
    │       ├── Topic Name + Badges
    │       ├── Sentiment Breakdown
    │       └── Engagement Metrics
    └── Learning Insights Tab
        └── Insight Cards (List)
            ├── Icon + Type
            ├── Description
            └── Confidence Badge
```

## Importance Score Calculation

```
Importance Score (0-100) = 
    Engagement Score (0-40) +
    Sentiment Impact (0-40) +
    Frequency Score (0-20)

Where:
  Engagement Score = min(40, (posts/10) + (comments/50) + (shares/20))
  Sentiment Impact = (negative_ratio) × 40
  Frequency Score = min(20, document_count/5)
```

## Recommendation Decision Tree

```
                    Topic Analysis
                          ↓
                ┌─────────┴─────────┐
                ↓                   ↓
        Importance > 70?      Importance > 40?
            ↓                       ↓
          YES                      YES
            ↓                       ↓
    Negative > 50%?         → Monitor
        ↓
      YES
        ↓
    Raise Your Voice
        
        
    Negative > 60% AND
    Low Engagement?
        ↓
      YES
        ↓
    Investigate
```

## API Response Structure

```json
{
  "timestamp": "2024-06-23T18:40:00",
  "total_documents": 1250,
  "topics_analyzed": 45,
  "sentiment_overview": {
    "overall": 0.15,
    "distribution": {
      "positive": 55,
      "neutral": 30,
      "negative": 15
    }
  },
  "top_topics": [
    {
      "topic_name": "Climate Policy",
      "document_count": 125,
      "average_sentiment": -0.35,
      "sentiment_breakdown": {
        "positive": 20,
        "neutral": 35,
        "negative": 70
      },
      "engagement_metrics": {
        "total_posts": 125,
        "total_comments": 450,
        "total_shares": 200,
        "total_views": 5000,
        "average_engagement_rate": 0.08
      },
      "trend": "rising",
      "momentum": "accelerating"
    }
  ],
  "recommendations": [
    {
      "id": "uuid",
      "topic_name": "Climate Policy",
      "importance_score": 85.5,
      "suggested_action": "Raise Your Voice",
      "reasoning": "75% negative sentiment; High engagement (125 posts); Rapidly rising topic",
      "sentiment_breakdown": { ... },
      "engagement_metrics": { ... },
      "key_entities": ["EPA", "Carbon Tax", "Green Energy"],
      "related_promises": ["Reduce emissions by 50%"],
      "created_at": "2024-06-23T18:40:00",
      "user_feedback": null
    }
  ]
}
```

## Technology Stack

```
Frontend:
├── Next.js 14+ (React Framework)
├── TypeScript (Type Safety)
├── Shadcn/ui (Component Library)
├── Lucide Icons (Icons)
└── Fetch API (HTTP Client)

Backend:
├── FastAPI (Web Framework)
├── Python 3.9+ (Language)
├── SQLAlchemy (ORM)
├── Pydantic (Data Validation)
└── PostgreSQL (Database)

Database:
├── PostgreSQL (Primary DB)
├── JSON Arrays (Topics, Entities)
└── Indexes (Performance)
```

## Performance Metrics

```
Analysis Time:
- Small dataset (< 100 docs): ~100ms
- Medium dataset (100-1000 docs): ~500ms
- Large dataset (> 1000 docs): ~2-5s

Memory Usage:
- Per analysis: ~50-100MB
- Caching recommendations: ~10MB

Database Queries:
- Documents fetch: 1 query
- Topic extraction: In-memory processing
- Metrics calculation: Aggregation queries
- Total queries per analysis: ~15-20
```

## Security Considerations

```
Authentication:
├── JWT Token Required
├── Bearer Token in Headers
└── User Context Validation

Authorization:
├── Requires get_current_user dependency
├── All endpoints protected
└── User-scoped data access

Data Privacy:
├── No sensitive data in recommendations
├── Aggregated metrics only
└── User feedback not exposed
```

## Scalability Considerations

```
Current Limitations:
├── Analysis runs synchronously
├── No caching of results
├── All documents loaded in memory
└── No pagination for large datasets

Future Improvements:
├── Async analysis with background tasks
├── Redis caching for results
├── Streaming analysis for large datasets
├── Pagination and filtering
└── Distributed processing
```
