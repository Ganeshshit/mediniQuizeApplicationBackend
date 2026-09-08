# Anti-Cheating Monitoring - Quick Start Guide

## 🎯 What Admins & Trainers Can Monitor

### Real-Time Monitoring
- **Live Dashboard**: See all active quiz attempts in real-time
- **Risk Alerts**: Instant notifications for high-risk activities
- **Heartbeat Status**: Monitor student connection stability
- **Event Stream**: Live view of suspicious events as they occur

### Analytics & Reporting
- **Overall Statistics**: System-wide anti-cheating metrics
- **Quiz-Specific Analysis**: Per-quiz violation patterns
- **Student History**: Individual behavior tracking
- **Trend Analysis**: Risk patterns over time

### Investigation Tools
- **Detailed Audit Logs**: Complete event timeline for each attempt
- **IP Analysis**: Track IP changes and consistency
- **Time Pattern Analysis**: Detect automated behavior
- **Event Distribution**: Most common violation types

### 🆕 Batch Monitoring (NEW!)
- **Multi-Quiz Overview**: Monitor up to 20 quizzes in a single API call
- **Trainer Dashboard**: Complete overview of all trainer's quizzes at once
- **Comparative Analysis**: Compare performance across multiple quizzes
- **Efficient Processing**: Parallel processing for faster results

### 🆕 Quiz Selection & Switching (NEW!)
- **Easy Quiz Browsing**: Filter and search available quizzes
- **Quick Switching**: Instantly switch between different quizzes
- **Subject Filtering**: Filter quizzes by subject/department
- **Advanced Search**: Search by title, duration, marks, etc.
- **Monitoring Preview**: See quiz stats before selecting

---

## 🚀 Quick API Reference

### 1. Overall Statistics
```bash
GET /api/monitoring/overview
```
**Use**: Get system-wide anti-cheating statistics

### 2. Suspicious Attempts
```bash
GET /api/monitoring/suspicious?riskLevel=high&page=1
```
**Use**: View all flagged attempts, filter by risk level

### 3. Attempt Details
```bash
GET /api/monitoring/attempt/:attemptId/details
```
**Use**: Deep dive into specific attempt with full audit trail

### 4. Quiz Statistics
```bash
GET /api/monitoring/quiz/:quizId/stats
```
**Use**: Analyze anti-cheating metrics for specific quiz

### 5. Student History
```bash
GET /api/monitoring/student/:studentId/history
```
**Use**: Track student behavior across multiple attempts

### 6. Real-Time Monitoring
```bash
GET /api/monitoring/realtime
```
**Use**: Live view of currently active attempts

### 7. Flagged Attempts
```bash
GET /api/monitoring/flagged?priority=critical
```
**Use**: Get attempts requiring immediate review

### 8. Export Data
```bash
GET /api/monitoring/export?startDate=2026-09-01&endDate=2026-09-30
```
**Use**: Export data for external analysis

### 9. Batch Monitoring (NEW!)
```bash
POST /api/monitoring/batch
```
**Use**: Monitor multiple quizzes in a single API call

### 10. Trainer Dashboard (NEW!)
```bash
GET /api/monitoring/trainer/dashboard
```
**Use**: Get complete dashboard for all trainer's quizzes

### 11. Comparative Analysis (NEW!)
```bash
POST /api/monitoring/compare
```
**Use**: Compare anti-cheating metrics between quizzes

### 12. Get Available Quizzes (NEW!)
```bash
GET /api/monitoring/quizzes/available
```
**Use**: Get list of quizzes with monitoring metadata and filtering

### 13. Get Subjects for Filter (NEW!)
```bash
GET /api/monitoring/quizzes/subjects
```
**Use**: Get available subjects for quiz filtering

### 14. Switch to Quiz (NEW!)
```bash
POST /api/monitoring/quizzes/switch
```
**Use**: Switch monitoring view to a specific quiz

### 15. Get Quiz Categories (NEW!)
```bash
GET /api/monitoring/quizzes/categories
```
**Use**: Get advanced filter categories for quiz search

### 16. Search Quizzes (NEW!)
```bash
POST /api/monitoring/quizzes/search
```
**Use**: Advanced search with multiple criteria

---

## 📊 Key Metrics Explained

### Risk Score
- **0-6**: Low risk (normal activity)
- **7-14**: Medium risk (monitor closely)
- **15-24**: High risk (review required)
- **25+**: Critical (immediate action)

### Suspicious Rate
Percentage of attempts flagged as suspicious. Use this to identify problematic quizzes or time periods.

### Event Distribution
Shows which types of violations are most common. Helps identify which anti-cheat measures are most needed.

### IP Consistency
Tracks whether students changed IP addresses during quizzes. Can indicate multiple locations or network issues.

---

## 🎨 Dashboard Components

### Overview Dashboard
```javascript
// Key metrics to display
- Total attempts vs suspicious attempts
- Average risk score
- Risk level distribution
- Most common event types
- Suspicious rate trend
```

### Real-Time Dashboard
```javascript
// Live monitoring data
- Currently active attempts
- High-risk active attempts
- Student names and quiz titles
- Time remaining for each attempt
- Recent suspicious events
- Heartbeat status
```

### Student Profile
```javascript
// Individual student tracking
- Complete attempt history
- Risk score trend over time
- Comparison with class average
- Most common violation types
- Intervention recommendations
```

### Quiz Analysis
```javascript
// Per-quiz analytics
- Total attempts and completion rate
- Suspicious rate
- Average risk score
- Event type distribution
- Time-based violation patterns
```

---

## 🔔 Alert Configuration

### Recommended Alert Thresholds

**Risk Score Alerts**:
- Medium (7+): Informational alert
- High (15+): Warning alert
- Critical (25+): Critical alert

**System-Wide Alerts**:
- Suspicious rate > 10%: Review quiz settings
- 3+ critical active attempts: Immediate attention
- Rapid event pattern: Possible automation

---

## 🛠️ Implementation Checklist

### Backend Setup ✅
- [x] Monitoring service created
- [x] Controller endpoints implemented
- [x] Routes configured with auth
- [x] All files syntax-validated
- [x] Batch monitoring endpoints added ✨ NEW
- [x] Trainer dashboard endpoint added ✨ NEW
- [x] Comparative analysis endpoint added ✨ NEW

### Frontend Setup (Required)
- [ ] Create monitoring dashboard UI
- [ ] Implement real-time polling
- [ ] Add alert notification system
- [ ] Create data visualization components
- [ ] Implement export functionality
- [ ] Add filtering and search capabilities
- [ ] Implement batch monitoring UI ✨ NEW
- [ ] Create multi-quiz comparison views ✨ NEW

### Integration Steps
1. **Create Dashboard Layout**
   - Overview cards with key metrics
   - Real-time monitoring panel
   - Suspicious attempts list
   - Detailed investigation view

2. **Implement Data Fetching**
   - Set up API service layer
   - Implement error handling
   - Add loading states
   - Cache frequently accessed data

3. **Add Visualizations**
   - Risk score gauges
   - Event timeline charts
   - Risk trend graphs
   - Distribution pie charts

4. **Configure Alerts**
   - Set up notification system
   - Define alert thresholds
   - Create alert history
   - Add alert dismissal

---

## 📱 Quick Implementation Example

### Basic Dashboard Component
```javascript
import React, { useState, useEffect } from 'react';

const AntiCheatDashboard = () => {
  const [stats, setStats] = useState(null);
  const [realTimeData, setRealTimeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
    startRealTimeUpdates();
  }, []);

  const loadOverview = async () => {
    try {
      const response = await fetch('/api/monitoring/overview', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Failed to load overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const startRealTimeUpdates = () => {
    setInterval(async () => {
      const response = await fetch('/api/monitoring/realtime', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setRealTimeData(data.data);
    }, 10000); // Update every 10 seconds
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <h1>Anti-Cheating Monitor</h1>
      
      {/* Overview Cards */}
      <div className="stats-grid">
        <StatCard 
          title="Total Attempts" 
          value={stats.totalAttempts} 
        />
        <StatCard 
          title="Suspicious Rate" 
          value={`${stats.suspiciousRate}%`}
          trend={stats.suspiciousRate > 5 ? 'up' : 'down'}
        />
        <StatCard 
          title="Avg Risk Score" 
          value={stats.avgRiskScore.toFixed(1)} 
        />
        <StatCard 
          title="Critical Cases" 
          value={stats.criticalRiskAttempts}
          alert={stats.criticalRiskAttempts > 0}
        />
      </div>

      {/* Real-Time Monitoring */}
      {realTimeData && (
        <div className="realtime-panel">
          <h2>Active Attempts ({realTimeData.totalActive})</h2>
          {realTimeData.activeAttempts.map(attempt => (
            <AttemptCard key={attempt.attemptId} attempt={attempt} />
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 🔍 Investigation Workflow

### When a Student is Flagged

1. **Review Overview**
   - Check risk score and level
   - Review violation count
   - Check time spent on quiz

2. **Deep Dive**
   - Get detailed audit logs
   - Analyze event timeline
   - Check IP consistency
   - Review time patterns

3. **Context Check**
   - Review student history
   - Check quiz difficulty
   - Consider technical issues
   - Verify anti-cheat settings

4. **Decision**
   - Determine if action needed
   - Document findings
   - Follow institutional procedures
   - Update student record if needed

---

## 📈 Usage Examples

### Daily Monitoring Routine
```javascript
// Morning check
const dailyStats = await getOverviewStats();
if (dailyStats.suspiciousRate > 10) {
  console.log('High suspicious rate detected');
  await reviewFlaggedAttempts('critical');
}

// During active quizzes
const realTimeData = await getRealTimeMonitoring();
if (realTimeData.highRiskActive > 2) {
  sendAlert('Multiple high-risk attempts active');
}

// Evening review
const flaggedAttempts = await getFlaggedAttempts();
flaggedAttempts.data.attempts.forEach(attempt => {
  console.log(`Review attempt: ${attempt._id}`);
});
```

### Weekly Analysis
```javascript
const weeklyReport = await exportMonitoringData({
  startDate: getWeekStart(),
  endDate: getWeekEnd()
});

// Analyze trends
const trends = analyzeTrends(weeklyReport.data.data);
generateWeeklyReport(trends);
```

---

## 🎯 Success Metrics

### Effective Monitoring Indicators
- **Reduced suspicious rate** over time
- **Faster detection** of critical cases
- **Accurate risk scoring** (fewer false positives)
- **Timely interventions** for high-risk cases
- **Improved quiz integrity** based on patterns

### Dashboard Usage Metrics
- **Regular monitoring** by staff
- **Quick response** to alerts
- **Thorough investigation** of flagged cases
- **Data-driven decisions** on quiz settings
- **Continuous improvement** of anti-cheat measures

---

## 🆘 Troubleshooting

### Common Issues

**Dashboard not loading**
- Check API connectivity
- Verify authentication token
- Check browser console for errors

**Data not updating**
- Verify polling interval
- Check API response times
- Review network connectivity

**Incorrect risk scores**
- Review risk weight configuration
- Check event detection on frontend
- Verify audit event logging

**Too many false positives**
- Adjust risk weights in backend
- Review quiz anti-cheat settings
- Consider student context

---

## 📚 Additional Resources

- **Full Documentation**: `ADMIN_TRAINER_MONITORING_GUIDE.md`
- **API Reference**: `ANTI_CHEAT_API_DOCUMENTATION.md`
- **Quick Reference**: `API_QUICK_REFERENCE.md`
- **Backend Service**: `src/services/monitoring.service.js`

---

## 🎉 Next Steps

1. **Review the full monitoring guide** for detailed implementation
2. **Set up your dashboard UI** using the provided examples
3. **Configure alert thresholds** based on your institution's needs
4. **Test with sample data** to verify functionality
5. **Train staff** on using the monitoring tools
6. **Establish response protocols** for different risk levels

The monitoring system is now ready for frontend integration! 🚀
