# AI Assistant - Quick Start Guide

## What Was Built

A complete AI Assistant system that analyzes your processed documents and provides intelligent recommendations on which topics to focus on.

## Key Components

### 1. Backend Service (`services/api/routers/assistant.py`)
- **Analyzes** all processed documents
- **Calculates** sentiment, engagement, and trends
- **Generates** recommendations with importance scores
- **Learns** from user feedback

### 2. Frontend Page (`politica-admin-portal/app/admin/assistant/page.tsx`)
- Beautiful dashboard with analysis overview
- Recommendation cards with actionable insights
- Topic analysis with sentiment breakdown
- Learning insights showing discovered patterns

### 3. Navigation
- Added "AI Assistant" link in admin sidebar under "Research" section
- Easy access from main dashboard

## How to Use

### Accessing the Assistant
1. Log in to the admin portal
2. Click "AI Assistant" in the left sidebar (under Research section)
3. View the analysis dashboard

### Understanding Recommendations

Each recommendation shows:
- **Topic Name**: What the recommendation is about
- **Importance Score** (0-100): How important this topic is
  - 0-40: Low priority
  - 40-70: Medium priority
  - 70-100: High priority
- **Suggested Action**:
  - 🔴 **Raise Your Voice**: Urgent - high engagement + negative sentiment
  - 🟡 **Monitor**: Keep watching this topic
  - 🔵 **Investigate**: Low engagement but concerning sentiment
- **Sentiment Breakdown**: How many posts are positive/neutral/negative
- **Engagement Metrics**: Posts, comments, shares, views
- **Key Entities**: Important people/organizations mentioned
- **Related Promises**: Promises connected to this topic

### Providing Feedback

For each recommendation, you can:
- ✅ **Accept**: This recommendation is useful
- ❌ **Reject**: This recommendation is not helpful

The system learns from your feedback to improve future recommendations.

### Viewing Analysis Details

**Recommendations Tab**: See all AI-generated recommendations ranked by importance

**Topics Analysis Tab**: Deep dive into each topic with:
- Sentiment trend (rising/stable/declining)
- Momentum (accelerating/steady/decelerating)
- Detailed engagement metrics

**Learning Insights Tab**: Patterns the assistant has discovered:
- Most discussed topics
- Sentiment trends
- High engagement content patterns

## API Endpoints

### Analyze Data
```bash
POST /api/assistant/analyze
```
Analyzes all processed documents and returns recommendations.

### Get Recommendations
```bash
GET /api/assistant/recommendations?limit=10
```
Returns top recommendations (default: 10).

### Submit Feedback
```bash
POST /api/assistant/learn
{
  "recommendation_id": "uuid",
  "feedback": "accepted" | "rejected",
  "notes": "optional notes"
}
```

### Get Insights
```bash
GET /api/assistant/insights
```
Returns learning insights about data patterns.

## Understanding the Importance Score

The importance score (0-100) is calculated from:

1. **Engagement** (40 points)
   - Number of posts about the topic
   - Comments and shares
   - Views and interactions

2. **Sentiment Impact** (40 points)
   - Negative sentiment increases importance
   - Positive sentiment decreases importance
   - Neutral sentiment has minimal impact

3. **Frequency** (20 points)
   - How often the topic appears
   - Trending topics get higher scores

**Example**: A topic with 250 posts, 75% negative sentiment, and rising trend would score ~85/100 (High Priority).

## Suggested Actions Explained

### 🔴 Raise Your Voice
**When**: High importance (>70) + High negative sentiment (>50%)
**Why**: This topic has significant engagement and people are expressing concerns
**Action**: Consider creating content to address concerns or provide your perspective

### 🟡 Monitor
**When**: Medium importance (40-70)
**Why**: This topic is getting attention and worth keeping an eye on
**Action**: Track how sentiment and engagement evolve over time

### 🔵 Investigate
**When**: Low engagement but concerning sentiment (>60% negative)
**Why**: Few people are talking about it, but those who are have concerns
**Action**: Research deeper to understand the issue before it grows

## Example Workflow

1. **Day 1**: Open AI Assistant, see 5 recommendations
2. **Review**: Read through each recommendation and understand the reasoning
3. **Feedback**: Accept recommendations that are useful, reject others
4. **Action**: Create content or responses for "Raise Your Voice" topics
5. **Monitor**: Check back in a few days to see how topics evolved
6. **Learn**: The system improves recommendations based on your feedback

## Tips for Best Results

1. **Process Documents Regularly**: More data = better analysis
2. **Provide Feedback**: Accept/reject recommendations to help the system learn
3. **Check Insights**: Review the Learning Insights tab to understand patterns
4. **Refresh Analysis**: Click "Refresh Analysis" to get latest recommendations
5. **Cross-Reference**: Compare recommendations with your own knowledge

## Troubleshooting

**No recommendations showing?**
- Make sure you have processed documents in the system
- Click "Refresh Analysis" to trigger analysis

**Recommendations seem off?**
- Provide feedback (accept/reject) to help the system learn
- Check if document sentiment scores are accurate

**Page loading slowly?**
- This is normal for large datasets
- Analysis runs in the background
- Try refreshing after a few seconds

## Next Steps

1. ✅ Navigate to AI Assistant page
2. ✅ Review the recommendations
3. ✅ Provide feedback on recommendations
4. ✅ Check Learning Insights
5. ✅ Take action on high-priority topics

## Support

For issues or questions:
1. Check the Learning Insights for patterns
2. Review the reasoning for each recommendation
3. Provide feedback to help the system improve
4. Check logs for any errors

---

**The AI Assistant is now ready to help you make data-driven decisions!**
