# AI Assistant - Testing Guide

## Pre-Testing Checklist

- [ ] Backend API server is running (`python3 -m uvicorn main:app --reload`)
- [ ] Frontend dev server is running (`npm run dev`)
- [ ] Database is populated with processed documents
- [ ] User is authenticated in the admin portal

## Manual Testing Steps

### 1. Navigation Test

**Objective**: Verify the AI Assistant link appears in the sidebar

**Steps**:
1. Open admin portal at `http://localhost:3000/admin`
2. Look at the left sidebar
3. Find "Research" section
4. Verify "AI Assistant" link is visible with Brain icon
5. Click on "AI Assistant"

**Expected Result**: 
- Page loads without errors
- URL changes to `/admin/assistant`
- Page title shows "AI Assistant"

---

### 2. Page Load Test

**Objective**: Verify the assistant page loads correctly

**Steps**:
1. Navigate to `/admin/assistant`
2. Wait for page to load
3. Check for loading spinner
4. Wait for data to appear

**Expected Result**:
- Loading spinner appears briefly
- Overview statistics display (Documents Analyzed, Topics Analyzed, etc.)
- Three tabs visible: Recommendations, Topics Analysis, Learning Insights
- Refresh Analysis button is clickable

---

### 3. Analysis Test

**Objective**: Verify analysis generates recommendations

**Steps**:
1. On Assistant page, click "Refresh Analysis" button
2. Wait for analysis to complete (may take 2-5 seconds)
3. Check if recommendations appear

**Expected Result**:
- Button shows loading spinner while analyzing
- Recommendations appear in grid layout
- Each recommendation shows:
  - Topic name
  - Importance score (0-100)
  - Suggested action (Raise Your Voice/Monitor/Investigate)
  - Sentiment breakdown
  - Engagement metrics

---

### 4. Recommendation Card Test

**Objective**: Verify recommendation cards display all information

**Steps**:
1. Look at first recommendation card
2. Verify all sections are present:
   - Topic name and reasoning
   - Action badge (colored)
   - Importance score with progress bar
   - Sentiment breakdown (3 cards)
   - Engagement metrics (4 cards)
   - Key entities (if any)
   - Related promises (if any)
   - Accept/Reject buttons

**Expected Result**:
- All information displays correctly
- Colors match action type:
  - Red for "Raise Your Voice"
  - Yellow for "Monitor"
  - Blue for "Investigate"
- Progress bar fills to importance score

---

### 5. Feedback Test

**Objective**: Verify feedback submission works

**Steps**:
1. Click "Accept" button on a recommendation
2. Observe button state changes
3. Click "Reject" button on another recommendation
4. Observe button state changes
5. Open browser console (F12)
6. Check for any errors

**Expected Result**:
- Buttons become disabled after clicking
- No console errors
- Feedback is recorded (check network tab)
- POST request to `/api/assistant/learn` succeeds

---

### 6. Topics Analysis Tab Test

**Objective**: Verify topics analysis displays correctly

**Steps**:
1. Click "Topics Analysis" tab
2. Wait for content to load
3. Scroll through topic cards
4. Verify each topic shows:
   - Topic name
   - Sentiment badge (Positive/Neutral/Negative)
   - Trend indicator (Rising/Stable/Declining)
   - Sentiment breakdown
   - Engagement metrics

**Expected Result**:
- Topics display in list format
- Sentiment badges show correct colors
- Trend indicators show correct icons
- All metrics are visible

---

### 7. Learning Insights Tab Test

**Objective**: Verify learning insights display

**Steps**:
1. Click "Learning Insights" tab
2. Wait for content to load
3. Check if insights appear
4. Verify each insight shows:
   - Insight type (pattern/trend/effectiveness)
   - Description
   - Confidence score

**Expected Result**:
- Insights display in card format
- Each insight has icon, type, description, and confidence
- Confidence shown as percentage

---

### 8. Empty State Test

**Objective**: Verify empty states display correctly

**Steps**:
1. If no recommendations exist, check Recommendations tab
2. If no topics exist, check Topics Analysis tab
3. If no insights exist, check Learning Insights tab

**Expected Result**:
- Empty state message displays
- Icon and helpful text shown
- No errors in console

---

### 9. Responsive Design Test

**Objective**: Verify page works on different screen sizes

**Steps**:
1. Open DevTools (F12)
2. Toggle device toolbar
3. Test on mobile (375px)
4. Test on tablet (768px)
5. Test on desktop (1920px)

**Expected Result**:
- Layout adapts to screen size
- Cards stack on mobile
- Grid adjusts columns on tablet
- All content remains readable

---

### 10. Error Handling Test

**Objective**: Verify error handling works

**Steps**:
1. Stop the backend API server
2. Try to refresh analysis
3. Check for error message
4. Restart backend
5. Try again

**Expected Result**:
- Error message displays when API is down
- No console errors
- Page remains usable
- Can retry after API is back

---

## API Testing

### Test Analyze Endpoint

```bash
curl -X POST http://localhost:8000/api/assistant/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "timestamp": "2024-06-23T18:40:00",
  "total_documents": 1250,
  "topics_analyzed": 45,
  "sentiment_overview": {...},
  "top_topics": [...],
  "recommendations": [...]
}
```

### Test Recommendations Endpoint

```bash
curl -X GET "http://localhost:8000/api/assistant/recommendations?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response**: Array of recommendations

### Test Learn Endpoint

```bash
curl -X POST http://localhost:8000/api/assistant/learn \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendation_id": "uuid",
    "feedback": "accepted",
    "notes": "This was helpful"
  }'
```

**Expected Response**:
```json
{
  "status": "success",
  "message": "Feedback recorded: accepted",
  "recommendation_id": "uuid",
  "learning_update": {...}
}
```

### Test Insights Endpoint

```bash
curl -X GET http://localhost:8000/api/assistant/insights \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response**: Array of learning insights

---

## Performance Testing

### Measure Analysis Time

```python
import time
import requests

token = "YOUR_TOKEN"
headers = {"Authorization": f"Bearer {token}"}

start = time.time()
response = requests.post(
    "http://localhost:8000/api/assistant/analyze",
    headers=headers
)
end = time.time()

print(f"Analysis took {end - start:.2f} seconds")
print(f"Response size: {len(response.text)} bytes")
```

**Expected Results**:
- Small dataset: < 1 second
- Medium dataset: 1-3 seconds
- Large dataset: 3-10 seconds

---

## Data Validation Testing

### Test with Different Data Scenarios

**Scenario 1: No Documents**
- Expected: Empty recommendations, no errors

**Scenario 2: All Positive Sentiment**
- Expected: Low importance scores, "Monitor" actions

**Scenario 3: All Negative Sentiment**
- Expected: High importance scores, "Raise Your Voice" actions

**Scenario 4: Mixed Sentiment**
- Expected: Varied importance scores, mixed actions

**Scenario 5: No Topics**
- Expected: Empty analysis, helpful message

---

## Browser Console Testing

### Check for Errors

1. Open DevTools (F12)
2. Go to Console tab
3. Perform all actions
4. Verify no red errors appear

### Check Network Requests

1. Open DevTools (F12)
2. Go to Network tab
3. Perform actions
4. Verify requests:
   - POST /api/assistant/analyze (200)
   - GET /api/assistant/recommendations (200)
   - POST /api/assistant/learn (200)
   - GET /api/assistant/insights (200)

---

## Accessibility Testing

### Keyboard Navigation

1. Press Tab to navigate through page
2. Verify all buttons are reachable
3. Press Enter to activate buttons
4. Verify all interactive elements work

### Screen Reader Testing

1. Use screen reader (NVDA, JAWS, or VoiceOver)
2. Verify page structure is announced correctly
3. Verify all text is readable
4. Verify buttons have proper labels

---

## Cross-Browser Testing

Test on:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

**Expected Result**: Page works identically on all browsers

---

## Load Testing

### Test with Large Dataset

1. Add 10,000+ documents to database
2. Run analysis
3. Measure time and memory usage
4. Verify page remains responsive

**Expected Result**: Analysis completes in reasonable time

---

## Integration Testing

### Test with Real Data

1. Process real documents through the system
2. Run analysis
3. Verify recommendations make sense
4. Verify sentiment scores are accurate
5. Verify engagement metrics are correct

---

## Regression Testing

After any changes:

1. [ ] Run all manual tests above
2. [ ] Verify no new errors
3. [ ] Verify existing functionality still works
4. [ ] Check performance hasn't degraded

---

## Test Results Template

```
Date: ___________
Tester: ___________
Environment: ___________

Test Results:
- Navigation Test: [ ] PASS [ ] FAIL
- Page Load Test: [ ] PASS [ ] FAIL
- Analysis Test: [ ] PASS [ ] FAIL
- Recommendation Card Test: [ ] PASS [ ] FAIL
- Feedback Test: [ ] PASS [ ] FAIL
- Topics Analysis Tab Test: [ ] PASS [ ] FAIL
- Learning Insights Tab Test: [ ] PASS [ ] FAIL
- Empty State Test: [ ] PASS [ ] FAIL
- Responsive Design Test: [ ] PASS [ ] FAIL
- Error Handling Test: [ ] PASS [ ] FAIL

Issues Found:
1. ___________
2. ___________
3. ___________

Notes:
___________
```

---

## Troubleshooting

### Page Won't Load
- Check if backend API is running
- Check if user is authenticated
- Check browser console for errors
- Check network tab for failed requests

### No Recommendations Showing
- Verify database has processed documents
- Check if documents have sentiment scores
- Check if documents have topics
- Try clicking "Refresh Analysis"

### Feedback Not Submitting
- Check network tab for failed requests
- Verify user is authenticated
- Check backend logs for errors
- Try refreshing page

### Slow Performance
- Check database query performance
- Verify indexes are created
- Check if too many documents
- Monitor server CPU/memory usage

---

## Success Criteria

All tests pass when:
- ✅ Page loads without errors
- ✅ Recommendations display correctly
- ✅ Feedback submission works
- ✅ All tabs function properly
- ✅ Responsive design works
- ✅ No console errors
- ✅ API responses are correct
- ✅ Performance is acceptable
