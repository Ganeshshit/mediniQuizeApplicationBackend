# Batch Monitoring Guide - Monitor Multiple Quizzes at Once

## Overview

Trainers can now monitor multiple quizzes simultaneously through a single API call, eliminating the need to make separate requests for each quiz. This batch monitoring approach is:

- **More Efficient**: One API call instead of multiple
- **Faster**: Parallel processing of quiz data
- **Comprehensive**: Get complete overview of all quizzes
- **Real-Time**: Optional live monitoring of active attempts

---

## 🚀 New Batch Monitoring Endpoints

### 1. Batch Monitoring - Multiple Quizzes

**Endpoint**: `POST /api/monitoring/batch`

**Authentication**: Required (Trainer/Admin)

**Description**: Get monitoring data for multiple quizzes in a single request

**Request Body**:
```json
{
  "quizIds": ["quizId1", "quizId2", "quizId3"],
  "includeRealTime": true,
  "includeStats": true
}
```

**Parameters**:
- `quizIds` (required): Array of quiz IDs (max 20 quizzes)
- `includeRealTime` (optional): Include real-time active attempts (default: false)
- `includeStats` (optional): Include quiz statistics (default: true)

**Response**:
```json
{
  "success": true,
  "data": {
    "quizzes": {
      "quizId1": {
        "id": "507f1f77bcf86cd799439012",
        "title": "JavaScript Fundamentals",
        "antiCheatSettings": {
          "enableTabSwitchDetection": true,
          "maxTabSwitches": 5
        },
        "statistics": {
          "totalAttempts": 45,
          "suspiciousAttempts": 3,
          "suspiciousRate": "6.67",
          "avgRiskScore": "4.2",
          "activeAttempts": 2
        },
        "activeAttemptsDetails": [
          {
            "attemptId": "507f1f77bcf86cd799439011",
            "student": {
              "name": "John Doe",
              "email": "john@example.com"
            },
            "startTime": "2026-09-08T10:00:00.000Z",
            "timeRemaining": 900,
            "riskScore": 8,
            "riskLevel": "medium",
            "lastHeartbeatSecondsAgo": 15
          }
        ]
      },
      "quizId2": {
        "id": "507f1f77bcf86cd799439013",
        "title": "React Basics",
        "statistics": {
          "totalAttempts": 32,
          "suspiciousAttempts": 5,
          "suspiciousRate": "15.63",
          "avgRiskScore": "7.8",
          "activeAttempts": 0
        }
      }
    },
    "summary": {
      "totalQuizzes": 2,
      "totalActiveAttempts": 2,
      "totalSuspiciousAttempts": 8,
      "avgRiskScore": "6.0",
      "highRiskQuizzes": [
        {
          "quizId": "quizId2",
          "title": "React Basics",
          "avgRiskScore": "7.8",
          "suspiciousRate": "15.63"
        }
      ]
    },
    "timestamp": "2026-09-08T10:15:00.000Z"
  }
}
```

**Implementation Example**:
```javascript
const monitorMultipleQuizzes = async (quizIds) => {
  const response = await fetch('/api/monitoring/batch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      quizIds,
      includeRealTime: true,
      includeStats: true
    })
  });
  
  const data = await response.json();
  return data.data;
};

// Monitor all active quizzes
const activeQuizIds = ['quiz1', 'quiz2', 'quiz3', 'quiz4', 'quiz5'];
const batchData = await monitorMultipleQuizzes(activeQuizIds);

// Display summary
console.log(`Monitoring ${batchData.summary.totalQuizzes} quizzes`);
console.log(`Active attempts: ${batchData.summary.totalActiveAttempts}`);
console.log(`High-risk quizzes: ${batchData.summary.highRiskQuizzes.length}`);
```

---

### 2. Trainer Dashboard Summary

**Endpoint**: `GET /api/monitoring/trainer/dashboard`

**Authentication**: Required (Trainer)

**Description**: Get complete dashboard summary for all quizzes created by the trainer

**Response**:
```json
{
  "success": true,
  "data": {
    "trainerId": "507f1f77bcf86cd799439020",
    "totalQuizzes": 5,
    "quizzes": {
      "quizId1": {
        "id": "507f1f77bcf86cd799439012",
        "title": "JavaScript Fundamentals",
        "statistics": {
          "totalAttempts": 45,
          "suspiciousAttempts": 3,
          "suspiciousRate": "6.67",
          "avgRiskScore": "4.2",
          "activeAttempts": 2
        },
        "activeAttemptsDetails": [...]
      },
      "quizId2": {
        "id": "507f1f77bcf86cd799439013",
        "title": "React Basics",
        "statistics": {
          "totalAttempts": 32,
          "suspiciousAttempts": 5,
          "suspiciousRate": "15.63",
          "avgRiskScore": "7.8",
          "activeAttempts": 0
        }
      }
    },
    "summary": {
      "totalAttempts": 125,
      "totalActive": 3,
      "totalSuspicious": 12,
      "avgRiskScore": "5.8",
      "urgentAttention": [
        {
          "quizId": "quizId2",
          "title": "React Basics",
          "reason": "High suspicious rate",
          "value": "15.63%"
        }
      ]
    },
    "timestamp": "2026-09-08T10:15:00.000Z"
  }
}
```

**Implementation Example**:
```javascript
const getTrainerDashboard = async () => {
  const response = await fetch('/api/monitoring/trainer/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.data;
};

// Auto-refresh trainer dashboard
const startDashboardRefresh = () => {
  setInterval(async () => {
    const dashboardData = await getTrainerDashboard();
    updateDashboardUI(dashboardData);
    
    // Show alerts for urgent attention
    if (dashboardData.summary.urgentAttention.length > 0) {
      showUrgentAlerts(dashboardData.summary.urgentAttention);
    }
  }, 15000); // Refresh every 15 seconds
};
```

---

### 3. Comparative Analysis

**Endpoint**: `POST /api/monitoring/compare`

**Authentication**: Required (Trainer/Admin)

**Description**: Compare anti-cheating metrics between multiple quizzes

**Request Body**:
```json
{
  "quizIds": ["quizId1", "quizId2", "quizId3"],
  "startDate": "2026-09-01",
  "endDate": "2026-09-08"
}
```

**Parameters**:
- `quizIds` (required): Array of quiz IDs (min 2, max 10)
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response**:
```json
{
  "success": true,
  "data": {
    "comparison": {
      "quizId1": {
        "quizId": "quizId1",
        "attempts": [...],
        "statistics": {
          "totalAttempts": 45,
          "suspiciousAttempts": 3,
          "suspiciousRate": "6.67",
          "avgRiskScore": "4.2",
          "avgDuration": 1450,
          "completionRate": "93.33"
        }
      },
      "quizId2": {
        "quizId": "quizId2",
        "attempts": [...],
        "statistics": {
          "totalAttempts": 32,
          "suspiciousAttempts": 5,
          "suspiciousRate": "15.63",
          "avgRiskScore": "7.8",
          "avgDuration": 1200,
          "completionRate": "87.50"
        }
      }
    },
    "summary": {
      "totalQuizzes": 2,
      "totalAttempts": 77,
      "bestQuiz": {
        "quizId": "quizId1",
        "suspiciousRate": "6.67"
      },
      "worstQuiz": {
        "quizId": "quizId2",
        "suspiciousRate": "15.63"
      }
    },
    "timestamp": "2026-09-08T10:15:00.000Z"
  }
}
```

**Implementation Example**:
```javascript
const compareQuizzes = async (quizIds, dateRange) => {
  const response = await fetch('/api/monitoring/compare', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      quizIds,
      ...dateRange
    })
  });
  
  const data = await response.json();
  return data.data;
};

// Compare recent quiz performance
const quizIds = ['quiz1', 'quiz2', 'quiz3'];
const comparison = await compareQuizzes(quizIds, {
  startDate: '2026-09-01',
  endDate: '2026-09-08'
});

// Display comparison chart
renderComparisonChart(comparison.comparison);
highlightBestWorst(comparison.summary);
```

---

## 🎯 Use Cases

### 1. Real-Time Multi-Quiz Monitoring

**Scenario**: A trainer has 5 active quizzes running simultaneously and wants to monitor all of them in real-time.

**Solution**:
```javascript
const monitorAllActiveQuizzes = async () => {
  // Get all active quiz IDs
  const activeQuizzes = await getActiveQuizzes();
  const quizIds = activeQuizzes.map(q => q.id);
  
  // Single API call for all quizzes
  const batchData = await monitorMultipleQuizzes(quizIds, {
    includeRealTime: true,
    includeStats: true
  });
  
  // Display comprehensive dashboard
  renderMultiQuizDashboard(batchData);
  
  // Highlight high-risk quizzes
  if (batchData.summary.highRiskQuizzes.length > 0) {
    showHighRiskAlert(batchData.summary.highRiskQuizzes);
  }
};

// Auto-refresh every 10 seconds
setInterval(monitorAllActiveQuizzes, 10000);
```

### 2. Trainer Overview Dashboard

**Scenario**: A trainer wants to see the status of all their quizzes at a glance when they log in.

**Solution**:
```javascript
const loadTrainerDashboard = async () => {
  // Single API call gets all quiz data
  const dashboardData = await getTrainerDashboard();
  
  // Display summary cards
  renderSummaryCards(dashboardData.summary);
  
  // Show individual quiz cards
  renderQuizCards(dashboardData.quizzes);
  
  // Highlight urgent attention items
  if (dashboardData.summary.urgentAttention.length > 0) {
    showUrgentAttentionPanel(dashboardData.summary.urgentAttention);
  }
};
```

### 3. Quiz Performance Comparison

**Scenario**: A trainer wants to compare anti-cheating metrics across different quiz versions to identify which settings work best.

**Solution**:
```javascript
const compareQuizVersions = async () => {
  const versionIds = ['quiz_v1', 'quiz_v2', 'quiz_v3'];
  
  const comparison = await compareQuizzes(versionIds, {
    startDate: '2026-09-01',
    endDate: '2026-09-08'
  });
  
  // Display comparison table
  renderComparisonTable(comparison.comparison);
  
  // Highlight best performing version
  highlightBestQuiz(comparison.summary.bestQuiz);
  
  // Identify areas for improvement
  suggestImprovements(comparison.comparison);
};
```

### 4. Periodic Health Check

**Scenario**: An admin wants to run a daily health check on all quizzes to identify any issues.

**Solution**:
```javascript
const runDailyHealthCheck = async () => {
  // Get all quiz IDs in the system
  const allQuizzes = await getAllQuizzes();
  const quizIds = allQuizzes.map(q => q.id);
  
  // Batch monitor all quizzes (chunks of 20)
  const chunks = chunkArray(quizIds, 20);
  const allResults = [];
  
  for (const chunk of chunks) {
    const batchData = await monitorMultipleQuizzes(chunk);
    allResults.push(...Object.values(batchData.quizzes));
  }
  
  // Generate health report
  const healthReport = generateHealthReport(allResults);
  
  // Send alert if issues found
  if (healthReport.criticalIssues.length > 0) {
    sendHealthAlert(healthReport);
  }
  
  return healthReport;
};
```

---

## 📊 Dashboard Implementation Examples

### React Multi-Quiz Dashboard Component

```javascript
import React, { useState, useEffect } from 'react';

const MultiQuizDashboard = () => {
  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuizIds, setSelectedQuizIds] = useState([]);

  useEffect(() => {
    loadBatchData();
    const interval = setInterval(loadBatchData, 15000);
    return () => clearInterval(interval);
  }, [selectedQuizIds]);

  const loadBatchData = async () => {
    if (selectedQuizIds.length === 0) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/monitoring/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizIds: selectedQuizIds,
          includeRealTime: true,
          includeStats: true
        })
      });
      
      const data = await response.json();
      setBatchData(data.data);
    } catch (error) {
      console.error('Failed to load batch data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="multi-quiz-dashboard">
      {/* Summary Section */}
      <div className="summary-section">
        <h2>Monitoring Summary</h2>
        <div className="summary-cards">
          <SummaryCard 
            title="Total Quizzes" 
            value={batchData.summary.totalQuizzes} 
          />
          <SummaryCard 
            title="Active Attempts" 
            value={batchData.summary.totalActiveAttempts}
            trend={batchData.summary.totalActiveAttempts > 0 ? 'active' : 'normal'}
          />
          <SummaryCard 
            title="Suspicious Attempts" 
            value={batchData.summary.totalSuspiciousAttempts}
            alert={batchData.summary.totalSuspiciousAttempts > 0}
          />
          <SummaryCard 
            title="Avg Risk Score" 
            value={batchData.summary.avgRiskScore}
            color={getRiskColor(batchData.summary.avgRiskScore)}
          />
        </div>
      </div>

      {/* High Risk Alerts */}
      {batchData.summary.highRiskQuizzes.length > 0 && (
        <div className="alerts-section">
          <h2>⚠️ High Risk Quizzes</h2>
          {batchData.summary.highRiskQuizzes.map(quiz => (
            <AlertCard key={quiz.quizId} quiz={quiz} />
          ))}
        </div>
      )}

      {/* Individual Quiz Cards */}
      <div className="quizzes-section">
        <h2>Quiz Details</h2>
        <div className="quiz-grid">
          {Object.values(batchData.quizzes).map(quiz => (
            <QuizCard key={quiz.id} quiz={quiz} />
          ))}
        </div>
      </div>
    </div>
  );
};

const QuizCard = ({ quiz }) => (
  <div className={`quiz-card ${quiz.statistics.activeAttempts > 0 ? 'active' : ''}`}>
    <h3>{quiz.title}</h3>
    <div className="quiz-stats">
      <Stat label="Total Attempts" value={quiz.statistics.totalAttempts} />
      <Stat label="Suspicious Rate" value={`${quiz.statistics.suspiciousRate}%`} />
      <Stat label="Avg Risk Score" value={quiz.statistics.avgRiskScore} />
      <Stat label="Active Now" value={quiz.statistics.activeAttempts} />
    </div>
    
    {quiz.activeAttemptsDetails && quiz.activeAttemptsDetails.length > 0 && (
      <div className="active-attempts">
        <h4>Active Attempts</h4>
        {quiz.activeAttemptsDetails.map(attempt => (
          <AttemptRow key={attempt.attemptId} attempt={attempt} />
        ))}
      </div>
    )}
  </div>
);
```

### Vue.js Trainer Dashboard Component

```javascript
<template>
  <div class="trainer-dashboard">
    <!-- Summary Section -->
    <div class="summary-section">
      <h2>My Quiz Dashboard</h2>
      <div class="summary-cards">
        <SummaryCard 
          title="Total Quizzes" 
          :value="dashboardData.totalQuizzes" 
        />
        <SummaryCard 
          title="Total Attempts" 
          :value="dashboardData.summary.totalAttempts" 
        />
        <SummaryCard 
          title="Active Now" 
          :value="dashboardData.summary.totalActive"
          :alert="dashboardData.summary.totalActive > 0"
        />
        <SummaryCard 
          title="Suspicious Rate" 
          :value="`${calculateSuspiciousRate()}%`"
          :color="getSuspiciousRateColor()"
        />
      </div>
    </div>

    <!-- Urgent Attention -->
    <div v-if="dashboardData.summary.urgentAttention.length > 0" 
         class="urgent-section">
      <h2>🚨 Requires Attention</h2>
      <div class="urgent-list">
        <UrgentItem 
          v-for="item in dashboardData.summary.urgentAttention" 
          :key="item.quizId"
          :item="item"
        />
      </div>
    </div>

    <!-- Quiz Grid -->
    <div class="quiz-grid">
      <QuizCard 
        v-for="(quiz, id) in dashboardData.quizzes" 
        :key="id"
        :quiz="quiz"
      />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      dashboardData: null,
      loading: true,
      refreshInterval: null
    };
  },
  
  async mounted() {
    await this.loadDashboard();
    this.refreshInterval = setInterval(this.loadDashboard, 15000);
  },
  
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
  
  methods: {
    async loadDashboard() {
      try {
        const response = await fetch('/api/monitoring/trainer/dashboard', {
          headers: {
            'Authorization': `Bearer ${this.$store.state.token}`
          }
        });
        
        const data = await response.json();
        this.dashboardData = data.data;
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        this.loading = false;
      }
    },
    
    calculateSuspiciousRate() {
      if (!this.dashboardData) return 0;
      const { totalAttempts, totalSuspicious } = this.dashboardData.summary;
      return totalAttempts > 0 ? (totalSuspicious / totalAttempts * 100).toFixed(2) : 0;
    },
    
    getSuspiciousRateColor() {
      const rate = parseFloat(this.calculateSuspiciousRate());
      if (rate > 15) return '#F44336';
      if (rate > 10) return '#FF9800';
      return '#4CAF50';
    }
  }
};
</script>
```

---

## 🔧 Performance Optimization

### Efficient Batch Processing

The batch monitoring system is optimized for performance:

1. **Parallel Processing**: All quizzes are processed simultaneously
2. **Database Indexing**: Optimized queries with proper indexes
3. **Result Limiting**: Maximum 20 quizzes per batch to prevent overload
4. **Caching**: Frequently accessed data is cached
5. **Selective Loading**: Optional includes to reduce data transfer

### Best Practices

**For Large Numbers of Quizzes**:
```javascript
// Process in chunks of 20
const monitorAllQuizzes = async (allQuizIds) => {
  const chunks = chunkArray(allQuizIds, 20);
  const results = [];
  
  for (const chunk of chunks) {
    const batchData = await monitorMultipleQuizzes(chunk);
    results.push(...Object.values(batchData.quizzes));
  }
  
  return results;
};
```

**For Real-Time Updates**:
```javascript
// Use webhooks or WebSocket for real-time updates instead of polling
const useWebSocketMonitoring = () => {
  const socket = new WebSocket('wss://your-api.com/monitoring');
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateDashboard(data);
  };
};
```

---

## 📈 Data Visualization Examples

### Multi-Quiz Comparison Chart

```javascript
const renderComparisonChart = (comparisonData) => {
  const labels = Object.keys(comparisonData).map(quizId => 
    comparisonData[quizId].title
  );
  
  const suspiciousRates = Object.values(comparisonData).map(quiz => 
    parseFloat(quiz.statistics.suspiciousRate)
  );
  
  const avgRiskScores = Object.values(comparisonData).map(quiz => 
    parseFloat(quiz.statistics.avgRiskScore)
  );
  
  new Chart(document.getElementById('comparisonChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Suspicious Rate %',
          data: suspiciousRates,
          backgroundColor: 'rgba(244, 67, 54, 0.6)'
        },
        {
          label: 'Avg Risk Score',
          data: avgRiskScores,
          backgroundColor: 'rgba(255, 152, 0, 0.6)'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
};
```

### Risk Trend Across Quizzes

```javascript
const renderRiskTrendChart = (batchData) => {
  const quizzes = Object.values(batchData.quizzes);
  
  new Chart(document.getElementById('riskTrendChart'), {
    type: 'line',
    data: {
      labels: quizzes.map(q => q.title),
      datasets: [{
        label: 'Average Risk Score',
        data: quizzes.map(q => parseFloat(q.statistics.avgRiskScore)),
        borderColor: '#F44336',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 30
        }
      }
    }
  });
};
```

---

## 🎯 Key Benefits

### Before Batch Monitoring
```javascript
// OLD WAY - Multiple API calls
const quiz1Stats = await getQuizStats('quiz1');
const quiz2Stats = await getQuizStats('quiz2');
const quiz3Stats = await getQuizStats('quiz3');
const quiz4Stats = await getQuizStats('quiz4');
const quiz5Stats = await getQuizStats('quiz5');
// 5 separate API calls = 5x network latency
```

### After Batch Monitoring
```javascript
// NEW WAY - Single API call
const allQuizStats = await monitorMultipleQuizzes(['quiz1', 'quiz2', 'quiz3', 'quiz4', 'quiz5']);
// 1 API call = 1x network latency, parallel processing
```

**Performance Improvement**:
- **5x faster** for 5 quizzes
- **10x faster** for 10 quizzes
- **20x faster** for 20 quizzes (maximum batch size)

---

## 🔒 Security Considerations

### Access Control
- Only trainers and admins can access batch monitoring
- Trainers can only see their own quizzes (dashboard endpoint)
- Admins can monitor all quizzes in the system

### Rate Limiting
- Batch monitoring endpoints have rate limits
- Maximum 20 quizzes per batch to prevent overload
- Request validation to prevent abuse

### Data Privacy
- Student data is only shown to authorized trainers
- IP addresses and detailed logs are protected
- Audit trail of who accessed what data

---

## 🚀 Next Steps

1. **Integrate Batch Monitoring** into your dashboard
2. **Set Up Auto-Refresh** for real-time updates
3. **Configure Alert Thresholds** based on your needs
4. **Create Comparison Views** for quiz analysis
5. **Implement Health Checks** for periodic monitoring

The batch monitoring system is now ready for implementation! Trainers can monitor multiple quizzes efficiently through a single API call. 🎉
