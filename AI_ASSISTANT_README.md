# 🧠 Politica AI Assistant

> Intelligent analysis and recommendations for public sentiment and engagement trends

## 🎯 What Is It?

The AI Assistant analyzes all your processed documents and provides intelligent recommendations on which topics to focus on. It combines sentiment analysis, engagement metrics, and trend detection to help you understand what matters most to your audience.

## ✨ Key Features

- **📊 Intelligent Analysis**: Analyzes sentiment, engagement, and trends across all documents
- **🎯 Smart Recommendations**: Generates actionable recommendations ranked by importance
- **📈 Trend Detection**: Identifies rising, stable, and declining topics
- **💡 Learning System**: Learns from your feedback to improve recommendations
- **🎨 Beautiful UI**: Modern, responsive dashboard with detailed metrics
- **⚡ Real-time Updates**: Refresh analysis anytime to get latest insights

## 🚀 Quick Start

### Access the Assistant
1. Log in to the admin portal
2. Click **"AI Assistant"** in the left sidebar (Research section)
3. View your analysis and recommendations

### Understanding Recommendations

Each recommendation shows:
- **Importance Score** (0-100): How important this topic is
- **Suggested Action**: What to do about it
  - 🔴 **Raise Your Voice**: High importance + negative sentiment
  - 🟡 **Monitor**: Medium importance
  - 🔵 **Investigate**: Low engagement but concerning sentiment
- **Sentiment Breakdown**: Positive/neutral/negative counts
- **Engagement Metrics**: Posts, comments, shares, views
- **Key Entities**: Important people/organizations mentioned

### Provide Feedback
- ✅ **Accept**: This recommendation is useful
- ❌ **Reject**: This recommendation is not helpful

The system learns from your feedback to improve future recommendations.

## 📊 Dashboard Sections

### Overview Statistics
- Total documents analyzed
- Topics analyzed count
- Positive/negative sentiment percentages

### Recommendations Tab
- AI-generated recommendations ranked by importance
- Detailed metrics for each recommendation
- Accept/reject feedback buttons

### Topics Analysis Tab
- Deep dive into each topic
- Sentiment trends and momentum
- Detailed engagement metrics

### Learning Insights Tab
- Patterns discovered by the assistant
- Confidence scores
- Actionable insights

## 🔧 How It Works

```
1. Analyze Documents
   ↓
2. Extract Topics & Metrics
   ↓
3. Calculate Importance Scores
   ↓
4. Generate Recommendations
   ↓
5. Display Results
   ↓
6. Learn from Feedback
```

## 📈 Importance Score

The importance score (0-100) is calculated from:

- **Engagement** (40%): Posts, comments, shares
- **Sentiment Impact** (40%): Negative sentiment increases importance
- **Frequency** (20%): How often topic appears

**Example**: A topic with 250 posts, 75% negative sentiment, and rising trend scores ~85/100 (High Priority).

## 🎯 Suggested Actions

### 🔴 Raise Your Voice
- **When**: High importance (>70) + High negative sentiment (>50%)
- **Why**: Significant engagement with concerns
- **Action**: Create content to address concerns

### 🟡 Monitor
- **When**: Medium importance (40-70)
- **Why**: Getting attention and worth watching
- **Action**: Track how sentiment evolves

### 🔵 Investigate
- **When**: Low engagement but concerning sentiment (>60% negative)
- **Why**: Few people talking but those who are have concerns
- **Action**: Research deeper before it grows

## 📚 Documentation

- **[Quick Start Guide](./AI_ASSISTANT_QUICK_START.md)** - User guide
- **[Implementation Guide](./AI_ASSISTANT_IMPLEMENTATION.md)** - Technical details
- **[Architecture Guide](./AI_ASSISTANT_ARCHITECTURE.md)** - System design
- **[Testing Guide](./AI_ASSISTANT_TESTING.md)** - Testing procedures
- **[Complete Summary](./AI_ASSISTANT_COMPLETE_SUMMARY.md)** - Full overview

## 🛠️ API Endpoints

```bash
# Analyze data
POST /api/assistant/analyze

# Get recommendations
GET /api/assistant/recommendations?limit=10

# Submit feedback
POST /api/assistant/learn

# Get insights
GET /api/assistant/insights
```

## 💡 Tips for Best Results

1. **Process Documents Regularly**: More data = better analysis
2. **Provide Feedback**: Accept/reject recommendations to help the system learn
3. **Check Insights**: Review patterns to understand trends
4. **Refresh Analysis**: Click "Refresh Analysis" for latest recommendations
5. **Cross-Reference**: Compare with your own knowledge

## 🐛 Troubleshooting

**Q: No recommendations showing?**
- Make sure you have processed documents
- Click "Refresh Analysis" to trigger analysis

**Q: Recommendations seem off?**
- Provide feedback (accept/reject) to help the system learn
- Check if document sentiment scores are accurate

**Q: Page loading slowly?**
- This is normal for large datasets
- Try refreshing after a few seconds

## 📊 Example Workflow

1. **Day 1**: Open AI Assistant, see 5 recommendations
2. **Review**: Read through each recommendation
3. **Feedback**: Accept useful recommendations, reject others
4. **Action**: Create content for "Raise Your Voice" topics
5. **Monitor**: Check back in a few days to see how topics evolved
6. **Learn**: System improves recommendations based on your feedback

## 🎓 Understanding the Data

### Sentiment Scale
- **> 0.2**: Positive
- **-0.2 to 0.2**: Neutral
- **< -0.2**: Negative

### Engagement Rate
- Calculated from: (likes + comments + shares) / views
- Displayed as percentage

### Trend
- **Rising**: Topic getting more attention
- **Stable**: Topic maintaining attention
- **Declining**: Topic losing attention

### Momentum
- **Accelerating**: Strong negative sentiment
- **Steady**: Moderate sentiment
- **Decelerating**: Positive sentiment

## 🚀 Getting Started

1. ✅ Navigate to AI Assistant page
2. ✅ Review the recommendations
3. ✅ Provide feedback on recommendations
4. ✅ Check Learning Insights
5. ✅ Take action on high-priority topics

## 📞 Need Help?

- Check the [Quick Start Guide](./AI_ASSISTANT_QUICK_START.md)
- Review the [Implementation Guide](./AI_ASSISTANT_IMPLEMENTATION.md)
- See the [Testing Guide](./AI_ASSISTANT_TESTING.md)
- Read the [Complete Summary](./AI_ASSISTANT_COMPLETE_SUMMARY.md)

## 📊 Stats

- **Backend**: 521 lines of Python
- **Frontend**: 535 lines of TypeScript/React
- **Documentation**: 2,000+ lines
- **API Endpoints**: 4
- **Features**: 15+

## ✅ Status

**Status**: ✅ Complete and Ready for Use

The AI Assistant is fully integrated into Politica and ready to help you make data-driven decisions!

---

**Built with ❤️ for Politica**

*Last Updated: June 23, 2026*
