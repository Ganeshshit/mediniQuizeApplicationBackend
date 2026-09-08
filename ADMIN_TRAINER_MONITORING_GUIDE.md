# Admin & Trainer Anti-Cheating Monitoring Guide

## Table of Contents
1. [Overview](#overview)
2. [Monitoring Dashboard Features](#monitoring-dashboard-features)
3. [API Endpoints](#api-endpoints)
4. [Implementation Guide](#implementation-guide)
5. [Data Interpretation](#data-interpretation)
6. [Alert Configuration](#alert-configuration)
7. [Best Practices](#best-practices)

---

## Overview

The anti-cheating monitoring system provides comprehensive tools for administrators and trainers to detect, analyze, and respond to suspicious quiz activities. The system offers real-time monitoring, detailed analytics, and automated risk assessment.

### Key Monitoring Capabilities:
- **Real-time Monitoring**: Live view of active quiz attempts
- **Risk-Based Alerts**: Automatic flagging based on risk scores
- **Detailed Audit Trails**: Complete event logging and analysis
- **Student History Tracking**: Pattern analysis across multiple attempts
- **Quiz-Specific Analytics**: Per-quiz anti-cheating statistics
- **Export Capabilities**: Data export for external analysis

---

## Monitoring Dashboard Features

### 1. Real-Time Monitoring Dashboard

**Purpose**: Monitor active quiz attempts in real-time

**Key Metrics Displayed**:
- Currently active attempts
- High-risk active attempts
- Students with recent suspicious activity
- Real-time event stream
- Heartbeat status monitoring

**Use Cases**:
- Live proctoring during active quizzes
- Immediate intervention for high-risk behavior
- Monitoring quiz integrity during exams

### 2. Suspicious Activity Dashboard

**Purpose**: View and manage flagged attempts

**Key Features**:
- Risk-score sorted list of suspicious attempts
- Filter by risk level (medium, high, critical)
- Filter by specific quiz
- Quick access to detailed audit logs
- Bulk action capabilities

**Use Cases**:
- Review flagged attempts after quiz completion
- Prioritize critical cases for immediate review
- Identify patterns in cheating behavior

### 3. Quiz Analytics Dashboard

**Purpose**: Analyze anti-cheating metrics per quiz

**Key Metrics**:
- Total attempts vs. suspicious attempts
- Average risk score per quiz
- Most common violation types
- Time-based analysis of violations
- Comparison across quiz versions

**Use Cases**:
- Evaluate quiz difficulty vs. cheating attempts
- Identify problematic question types
- Improve quiz design based on patterns

### 4. Student History Dashboard

**Purpose**: Track individual student behavior patterns

**Key Features**:
- Complete attempt history with risk scores
- Risk trend analysis over time
- Comparison with class average
- Violation pattern recognition
- Intervention recommendations

**Use Cases**:
- Identify habitual cheaters
- Provide evidence for academic integrity discussions
- Track improvement after interventions

---

## API Endpoints

### 1. Get Overall Statistics

**Endpoint**: `GET /api/monitoring/overview`

**Authentication**: Required (Trainer/Admin)

**Description**: Get comprehensive anti-cheating statistics across all quizzes

**Query Parameters**:
- `startDate` (optional): Filter by start date (ISO format)
- `endDate` (optional): Filter by end date (ISO format)
- `quizId` (optional): Filter by specific quiz

**Response**:
```json
{
  "success": true,
  "data": {
    "totalAttempts": 1250,
    "suspiciousAttempts": 87,
    "suspiciousRate": "6.96",
    "highRiskAttempts": 45,
    "criticalRiskAttempts": 12,
    "avgRiskScore": 3.45,
    "riskDistribution": {
      "low": 850,
      "medium": 268,
      "high": 45,
      "critical": 12
    },
    "eventDistribution": [
      {
        "_id": "tab_switch",
        "count": 342,
        "totalRisk": 1026
      },
      {
        "_id": "copy",
        "count": 156,
        "totalRisk": 312
      }
    ]
  }
}
```

**Implementation Example**:
```javascript
const getOverviewStats = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/monitoring/overview?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Usage
const stats = await getOverviewStats({
  startDate: '2026-09-01',
  endDate: '2026-09-08'
});
```

---

### 2. Get Suspicious Attempts

**Endpoint**: `GET /api/monitoring/suspicious`

**Authentication**: Required (Trainer/Admin)

**Description**: Get list of attempts flagged as suspicious with filtering options

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `quizId` (optional): Filter by specific quiz
- `riskLevel` (optional): Filter by risk level (low, medium, high, critical)
- `minRiskScore` (optional): Minimum risk score threshold

**Response**:
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "user": {
          "_id": "507f1f77bcf86cd799439015",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "quiz": {
          "_id": "507f1f77bcf86cd799439012",
          "title": "JavaScript Fundamentals"
        },
        "startTime": "2026-09-08T10:00:00.000Z",
        "riskScore": 18,
        "riskLevel": "high",
        "suspicious": true,
        "violationCount": 6,
        "status": "flagged"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 87,
      "pages": 5
    }
  }
}
```

**Implementation Example**:
```javascript
const getSuspiciousAttempts = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/monitoring/suspicious?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Get high-risk attempts for a specific quiz
const highRiskAttempts = await getSuspiciousAttempts({
  quizId: 'quiz123',
  riskLevel: 'high',
  minRiskScore: 15
});
```

---

### 3. Get Attempt Audit Details

**Endpoint**: `GET /api/monitoring/attempt/:attemptId/details`

**Authentication**: Required (Trainer/Admin)

**Description**: Get comprehensive audit information for a specific attempt

**Path Parameters**:
- `attemptId` (required): MongoDB ObjectId of the attempt

**Response**:
```json
{
  "success": true,
  "data": {
    "attempt": {
      "id": "507f1f77bcf86cd799439011",
      "student": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "quiz": {
        "title": "JavaScript Fundamentals"
      },
      "startTime": "2026-09-08T10:00:00.000Z",
      "endTime": "2026-09-08T10:25:30.000Z",
      "duration": 1530,
      "status": "flagged",
      "riskScore": 18,
      "riskLevel": "high",
      "suspicious": true,
      "violationCount": 6,
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "ipAtStart": "192.168.1.100",
      "ipAtEnd": "192.168.1.100"
    },
    "eventStats": {
      "tab_switch": {
        "count": 4,
        "totalRisk": 12,
        "firstOccurrence": "2026-09-08T10:05:00.000Z",
        "lastOccurrence": "2026-09-08T10:20:00.000Z",
        "timestamps": [...]
      },
      "copy": {
        "count": 2,
        "totalRisk": 4,
        "firstOccurrence": "2026-09-08T10:08:00.000Z",
        "lastOccurrence": "2026-09-08T10:15:00.000Z",
        "timestamps": [...]
      }
    },
    "timePatterns": {
      "totalDuration": 1530000,
      "eventFrequency": 0.24,
      "rapidEventCount": 3,
      "avgTimeBetweenEvents": 4200,
      "suspiciousRapidActivity": false
    },
    "ipAnalysis": {
      "uniqueIPs": 1,
      "ipChanges": 0,
      "ipCounts": {
        "192.168.1.100": 25
      },
      "ipConsistent": true
    },
    "totalEvents": 25,
    "eventTimeline": [...]
  }
}
```

**Implementation Example**:
```javascript
const getAttemptDetails = async (attemptId) => {
  const response = await fetch(`/api/monitoring/attempt/${attemptId}/details`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Usage for detailed investigation
const details = await getAttemptDetails('attempt123');
console.log('Risk Analysis:', details.data.riskScore);
console.log('Event Timeline:', details.data.eventTimeline);
```

---

### 4. Get Quiz-Specific Statistics

**Endpoint**: `GET /api/monitoring/quiz/:quizId/stats`

**Authentication**: Required (Trainer/Admin)

**Description**: Get anti-cheating statistics for a specific quiz

**Path Parameters**:
- `quizId` (required): MongoDB ObjectId of the quiz

**Response**:
```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "507f1f77bcf86cd799439012",
      "title": "JavaScript Fundamentals",
      "antiCheatSettings": {
        "enableTabSwitchDetection": true,
        "maxTabSwitches": 5,
        "trackIPAddress": true,
        "allowIPChange": false
      }
    },
    "totalAttempts": 150,
    "statistics": {
      "suspiciousRate": "8.67",
      "suspiciousAttempts": 13,
      "avgRiskScore": 4.2,
      "avgDuration": 1450,
      "riskDistribution": {
        "low": 120,
        "medium": 17,
        "high": 10,
        "critical": 3
      },
      "eventDistribution": [
        {
          "_id": "tab_switch",
          "count": 45
        },
        {
          "_id": "copy",
          "count": 28
        }
      ]
    }
  }
}
```

**Implementation Example**:
```javascript
const getQuizStats = async (quizId) => {
  const response = await fetch(`/api/monitoring/quiz/${quizId}/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Analyze quiz effectiveness
const quizStats = await getQuizStats('quiz123');
console.log('Suspicious Rate:', quizStats.data.statistics.suspiciousRate);
```

---

### 5. Get Student Anti-Cheat History

**Endpoint**: `GET /api/monitoring/student/:studentId/history`

**Authentication**: Required (Trainer/Admin)

**Description**: Get complete anti-cheating history for a specific student

**Path Parameters**:
- `studentId` (required): MongoDB ObjectId of the student

**Response**:
```json
{
  "success": true,
  "data": {
    "student": {
      "id": "507f1f77bcf86cd799439015",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "totalAttempts": 8,
    "suspiciousAttempts": 3,
    "suspiciousRate": "37.50",
    "avgRiskScore": 8.5,
    "riskTrend": [
      {
        "attemptId": "507f1f77bcf86cd799439011",
        "quizTitle": "JavaScript Fundamentals",
        "startTime": "2026-09-08T10:00:00.000Z",
        "riskScore": 18,
        "riskLevel": "high",
        "suspicious": true
      },
      {
        "attemptId": "507f1f77bcf86cd799439016",
        "quizTitle": "React Basics",
        "startTime": "2026-09-05T14:00:00.000Z",
        "riskScore": 5,
        "riskLevel": "low",
        "suspicious": false
      }
    ]
  }
}
```

**Implementation Example**:
```javascript
const getStudentHistory = async (studentId) => {
  const response = await fetch(`/api/monitoring/student/${studentId}/history`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Identify habitual cheaters
const history = await getStudentHistory('student123');
if (history.data.suspiciousRate > 30) {
  console.log('Student requires intervention');
}
```

---

### 6. Get Real-Time Monitoring

**Endpoint**: `GET /api/monitoring/realtime`

**Authentication**: Required (Trainer/Admin)

**Description**: Get real-time data of currently active quiz attempts

**Response**:
```json
{
  "success": true,
  "data": {
    "activeAttempts": [
      {
        "attemptId": "507f1f77bcf86cd799439011",
        "student": {
          "name": "John Doe",
          "email": "john@example.com"
        },
        "quiz": {
          "title": "JavaScript Fundamentals"
        },
        "startTime": "2026-09-08T10:00:00.000Z",
        "timeRemaining": 900,
        "riskScore": 8,
        "riskLevel": "medium",
        "lastHeartbeatSecondsAgo": 15,
        "recentEventCount": 3,
        "recentEvents": [...],
        "heartbeatActive": true
      }
    ],
    "totalActive": 12,
    "highRiskActive": 2,
    "timestamp": "2026-09-08T10:15:00.000Z"
  }
}
```

**Implementation Example**:
```javascript
// Real-time monitoring with polling
const startRealTimeMonitoring = () => {
  setInterval(async () => {
    const response = await fetch('/api/monitoring/realtime', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    
    updateDashboard(data.data);
    
    // Alert on high-risk activity
    if (data.data.highRiskActive > 0) {
      showHighRiskAlert(data.data.highRiskActive);
    }
  }, 10000); // Poll every 10 seconds
};
```

---

### 7. Get Flagged Attempts

**Endpoint**: `GET /api/monitoring/flagged`

**Authentication**: Required (Trainer/Admin)

**Description**: Get attempts requiring manual review

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `quizId` (optional): Filter by specific quiz
- `priority` (optional): Filter by priority (critical, high)

**Response**:
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "user": {
          "name": "John Doe",
          "email": "john@example.com"
        },
        "quiz": {
          "title": "JavaScript Fundamentals"
        },
        "startTime": "2026-09-08T10:00:00.000Z",
        "riskScore": 25,
        "riskLevel": "critical",
        "suspicious": true,
        "status": "flagged"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "pages": 1
    }
  }
}
```

**Implementation Example**:
```javascript
const getFlaggedAttempts = async (priority = 'critical') => {
  const response = await fetch(`/api/monitoring/flagged?priority=${priority}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Prioritize critical cases
const criticalCases = await getFlaggedAttempts('critical');
```

---

### 8. Export Monitoring Data

**Endpoint**: `GET /api/monitoring/export`

**Authentication**: Required (Trainer/Admin)

**Description**: Export monitoring data for external analysis

**Query Parameters**:
- `startDate` (optional): Filter by start date (ISO format)
- `endDate` (optional): Filter by end date (ISO format)
- `quizId` (optional): Filter by specific quiz
- `format` (optional): Export format (default: json)

**Response**:
```json
{
  "success": true,
  "data": {
    "format": "json",
    "data": [
      {
        "attemptId": "507f1f77bcf86cd799439011",
        "student": "John Doe",
        "studentEmail": "john@example.com",
        "quiz": "JavaScript Fundamentals",
        "startTime": "2026-09-08T10:00:00.000Z",
        "endTime": "2026-09-08T10:25:30.000Z",
        "duration": 1530,
        "status": "flagged",
        "riskScore": 18,
        "riskLevel": "high",
        "suspicious": true,
        "violationCount": 6,
        "tabSwitches": 4,
        "ipAtStart": "192.168.1.100",
        "ipAtEnd": "192.168.1.100",
        "flaggedReasons": ["High risk score: 18 (high)"]
      }
    ],
    "metadata": {
      "exportDate": "2026-09-08T11:00:00.000Z",
      "totalRecords": 87,
      "filters": {
        "startDate": "2026-09-01",
        "endDate": "2026-09-08"
      }
    }
  }
}
```

**Implementation Example**:
```javascript
const exportData = async (filters) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/monitoring/export?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Export monthly report
const monthlyReport = await exportData({
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  format: 'json'
});

// Download as file
const blob = new Blob([JSON.stringify(monthlyReport.data.data, null, 2)], 
  { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'anti_cheat_report_september_2026.json';
a.click();
```

---

## Implementation Guide

### Dashboard Architecture

```javascript
// Main monitoring dashboard component
class AntiCheatDashboard {
  constructor() {
    this.refreshInterval = 10000; // 10 seconds
    this.currentView = 'overview';
    this.filters = {};
  }

  async initialize() {
    await this.loadOverview();
    this.startRealTimeUpdates();
    this.setupEventListeners();
  }

  async loadOverview() {
    const stats = await this.getOverviewStats();
    this.renderOverview(stats);
  }

  async getOverviewStats() {
    const response = await fetch('/api/monitoring/overview', {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }

  startRealTimeUpdates() {
    setInterval(async () => {
      if (this.currentView === 'realtime') {
        await this.loadRealTimeData();
      }
    }, this.refreshInterval);
  }

  renderOverview(stats) {
    // Update dashboard UI with statistics
    this.updateRiskDistribution(stats.data.riskDistribution);
    this.updateSuspiciousRate(stats.data.suspiciousRate);
    this.updateEventDistribution(stats.data.eventDistribution);
  }

  async loadRealTimeData() {
    const response = await fetch('/api/monitoring/realtime', {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    const data = await response.json();
    this.renderRealTimeData(data.data);
  }

  renderRealTimeData(data) {
    // Update real-time monitoring view
    this.updateActiveAttempts(data.activeAttempts);
    this.checkForAlerts(data);
  }

  checkForAlerts(data) {
    if (data.highRiskActive > 0) {
      this.showAlert(`High-risk activity detected: ${data.highRiskActive} attempts`);
    }
  }
}
```

### Risk Score Visualization

```javascript
// Risk score gauge component
class RiskScoreGauge {
  constructor(container) {
    this.container = container;
  }

  render(riskScore, riskLevel) {
    const percentage = Math.min((riskScore / 30) * 100, 100);
    const color = this.getRiskColor(riskLevel);

    this.container.innerHTML = `
      <div class="risk-gauge">
        <div class="risk-score">${riskScore}</div>
        <div class="risk-level ${riskLevel}">${riskLevel.toUpperCase()}</div>
        <div class="risk-bar">
          <div class="risk-fill" style="width: ${percentage}%; background: ${color}"></div>
        </div>
      </div>
    `;
  }

  getRiskColor(level) {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0'
    };
    return colors[level] || '#4CAF50';
  }
}
```

### Event Timeline Visualization

```javascript
// Event timeline component
class EventTimeline {
  constructor(container) {
    this.container = container;
  }

  render(events) {
    const timelineHTML = events.map(event => `
      <div class="event-item ${event.eventType}">
        <div class="event-time">${new Date(event.serverTimestamp).toLocaleTimeString()}</div>
        <div class="event-type">${event.eventType}</div>
        <div class="event-risk">+${event.riskWeight} risk</div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="event-timeline">
        <h3>Event Timeline</h3>
        <div class="timeline-events">${timelineHTML}</div>
      </div>
    `;
  }
}
```

### Student History Chart

```javascript
// Student risk trend chart
class StudentRiskTrend {
  constructor(container) {
    this.container = container;
  }

  render(riskTrend) {
    const chartData = riskTrend.map(attempt => ({
      x: new Date(attempt.startTime).toLocaleDateString(),
      y: attempt.riskScore,
      color: attempt.suspicious ? '#F44336' : '#4CAF50'
    }));

    // Using Chart.js or similar library
    new Chart(this.container, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.x),
        datasets: [{
          label: 'Risk Score',
          data: chartData.map(d => d.y),
          borderColor: chartData.map(d => d.color),
          backgroundColor: chartData.map(d => d.color + '20')
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
  }
}
```

---

## Data Interpretation

### Risk Score Analysis

| Risk Score Range | Level | Interpretation | Recommended Action |
|------------------|-------|----------------|-------------------|
| 0-6 | Low | Normal activity | No action needed |
| 7-14 | Medium | Some suspicious behavior | Monitor closely |
| 15-24 | High | Significant suspicious activity | Review audit logs, consider intervention |
| 25+ | Critical | Severe cheating indicators | Immediate review, possible academic action |

### Event Pattern Analysis

**Suspicious Patterns**:
- **Rapid successive events**: Multiple events within 1 second
- **Consistent timing**: Events at regular intervals (automation)
- **Clustered violations**: Multiple violation types in short time
- **Early completion**: High risk score with very short duration

**Normal Patterns**:
- **Sporadic events**: Occasional tab switches, copy/paste
- **Decreasing frequency**: Fewer events as student focuses
- **Single violation type**: Only one type of suspicious behavior

### IP Analysis

**IP Change Scenarios**:
- **Legitimate**: Mobile network switching, VPN changes
- **Suspicious**: Different geographic locations, simultaneous attempts
- **Critical**: IP changes during quiz with high violation count

### Time Analysis

**Duration Analysis**:
- **Too fast**: Completion in <10% of allowed time with high risk
- **Normal**: Completion within expected time range
- **Too slow**: Extension requests, possible stalling

---

## Alert Configuration

### Alert Thresholds

```javascript
const alertConfig = {
  riskScore: {
    medium: 7,
    high: 15,
    critical: 25
  },
  suspiciousRate: {
    warning: 5, // 5% suspicious rate
    critical: 10 // 10% suspicious rate
  },
  realTime: {
    highRiskThreshold: 3, // 3+ high-risk active attempts
    rapidEventThreshold: 10 // 10+ rapid events in minute
  }
};

// Alert system implementation
class AlertSystem {
  constructor(config) {
    this.config = config;
    this.activeAlerts = new Set();
  }

  checkRiskScore(riskScore) {
    if (riskScore >= this.config.riskScore.critical) {
      this.triggerAlert('critical', `Critical risk score: ${riskScore}`);
    } else if (riskScore >= this.config.riskScore.high) {
      this.triggerAlert('high', `High risk score: ${riskScore}`);
    } else if (riskScore >= this.config.riskScore.medium) {
      this.triggerAlert('medium', `Medium risk score: ${riskScore}`);
    }
  }

  checkSuspiciousRate(rate) {
    if (rate >= this.config.suspiciousRate.critical) {
      this.triggerAlert('critical', `Critical suspicious rate: ${rate}%`);
    } else if (rate >= this.config.suspiciousRate.warning) {
      this.triggerAlert('warning', `Warning suspicious rate: ${rate}%`);
    }
  }

  triggerAlert(severity, message) {
    const alertId = `${severity}-${Date.now()}`;
    if (!this.activeAlerts.has(alertId)) {
      this.activeAlerts.add(alertId);
      this.displayAlert(severity, message);
      
      // Auto-dismiss after 5 minutes
      setTimeout(() => {
        this.activeAlerts.delete(alertId);
      }, 300000);
    }
  }

  displayAlert(severity, message) {
    // UI implementation for displaying alerts
    console.log(`[${severity.toUpperCase()}] ${message}`);
    // Could integrate with notification system, email, etc.
  }
}
```

---

## Best Practices

### 1. Regular Monitoring

**Recommended Schedule**:
- **Real-time**: During active quiz periods
- **Daily**: Review flagged attempts
- **Weekly**: Analyze trends and patterns
- **Monthly**: Comprehensive reporting

### 2. Response Protocols

**For High-Risk Attempts**:
1. Review detailed audit logs
2. Check student history for patterns
3. Verify IP consistency
4. Document findings
5. Follow institutional academic integrity procedures

**For Critical Cases**:
1. Immediate review
2. Contact student if appropriate
3. Preserve evidence
4. Escalate to academic integrity committee
5. Consider immediate quiz invalidation

### 3. Data Privacy

**Privacy Considerations**:
- Limit access to monitoring data
- Follow institutional privacy policies
- Secure storage of audit logs
- Regular data cleanup (TTL indexes)
- Proper data retention policies

### 4. False Positive Management

**Reducing False Positives**:
- Adjust risk weights based on experience
- Consider context (technical issues, network problems)
- Allow student explanations
- Use human judgment for borderline cases
- Continuously refine detection algorithms

### 5. Integration with Learning Management

**Recommended Integrations**:
- Link with student information systems
- Integrate with gradebook
- Connect with communication tools
- Sync with calendar systems
- Export to analytics platforms

---

## Troubleshooting

### Common Issues

**Issue**: High false positive rate
- **Solution**: Adjust risk weights, review quiz settings

**Issue**: Real-time monitoring not updating
- **Solution**: Check polling interval, verify API connectivity

**Issue**: Missing audit events
- **Solution**: Verify frontend event detection, check network logs

**Issue**: Performance issues with large datasets
- **Solution**: Implement pagination, add database indexes, use caching

---

## Conclusion

The anti-cheating monitoring system provides comprehensive tools for maintaining quiz integrity while respecting student privacy. By following these guidelines and implementing the recommended practices, administrators and trainers can effectively detect and respond to suspicious activities while minimizing false positives and maintaining a fair learning environment.

For technical implementation details, refer to:
- API Documentation: `ANTI_CHEAT_API_DOCUMENTATION.md`
- Quick Reference: `API_QUICK_REFERENCE.md`
- Backend Services: `src/services/monitoring.service.js`
