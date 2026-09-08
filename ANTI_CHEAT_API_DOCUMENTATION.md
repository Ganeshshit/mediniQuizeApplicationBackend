# Quiz Application API Documentation - Anti-Cheating System

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Anti-Cheating Endpoints](#anti-cheating-endpoints)
4. [Quiz Attempt Endpoints](#quiz-attempt-endpoints)
5. [Implementation Strategy](#implementation-strategy)
6. [Security Best Practices](#security-best-practices)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Overview

This API documentation covers the quiz application backend with comprehensive anti-cheating mechanisms. The system uses server-side validation, risk-based scoring, session management, and detailed audit logging to ensure quiz integrity.

### Key Anti-Cheating Features:
- **Server-Side Authority**: Backend controls timing, validation, and scoring
- **Risk-Based Scoring**: Events contribute to a risk score with severity levels
- **Session Management**: Unique session IDs prevent multiple browser usage
- **IP Tracking**: Optional IP change detection and logging
- **Comprehensive Audit Trail**: All events logged with server timestamps
- **Heartbeat System**: Monitors active attempts and detects abandonment

---

## Authentication

All endpoints require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### Role-Based Access:
- **Student**: Can start, save, submit attempts, and log audit events
- **Trainer/Admin**: Can view attempts, audit logs, and manage grading

---

## Anti-Cheating Endpoints

### 1. Start Quiz Attempt

**Endpoint:** `POST /api/quizzes/:quizId/start`

**Authentication:** Required (Student role)

**Description:** Initiates a new quiz attempt with anti-cheating session management.

**Request Parameters:**
- `quizId` (path, required): MongoDB ObjectId of the quiz

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "attemptId": "507f1f77bcf86cd799439011",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "attemptToken": "660e8400-e29b-41d4-a716-446655440001",
    "quiz": {
      "id": "507f1f77bcf86cd799439012",
      "title": "JavaScript Fundamentals",
      "description": "Test your JavaScript knowledge",
      "durationMinutes": 30,
      "totalMarks": 100,
      "instructions": "Read each question carefully",
      "antiCheatSettings": {
        "enableTabSwitchDetection": true,
        "maxTabSwitches": 5,
        "trackIPAddress": true,
        "allowIPChange": false,
        "enableFullScreen": true,
        "disableCopyPaste": true,
        "randomizeQuestionOrder": true
      }
    },
    "questions": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "type": "mcq_single",
        "prompt": "What is the output of typeof null?",
        "choices": [
          { "id": "A", "text": "null" },
          { "id": "B", "text": "object" },
          { "id": "C", "text": "undefined" }
        ],
        "marks": 5
      }
    ],
    "startTime": "2026-09-08T10:00:00.000Z",
    "expiresAt": "2026-09-08T10:30:00.000Z",
    "serverTime": "2026-09-08T10:00:00.000Z",
    "maxScore": 100
  }
}
```

**Implementation Strategy:**
1. Store `sessionId` and `attemptToken` securely in frontend state
2. Use `expiresAt` for timer countdown (not client calculation)
3. Send `sessionId` with all subsequent requests
4. Implement question randomization if enabled
5. Apply anti-cheat settings based on quiz configuration

---

### 2. Save Answers (Auto-Save)

**Endpoint:** `POST /api/quizzes/:quizId/save`

**Authentication:** Required (Student role)

**Description:** Incrementally saves answers with session validation and IP tracking.

**Request Parameters:**
- `quizId` (path, required): MongoDB ObjectId of the quiz

**Request Body:**
```json
{
  "attemptId": "507f1f77bcf86cd799439011",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "answers": [
    {
      "questionId": "507f1f77bcf86cd799439013",
      "answer": "B",
      "clientTimestamp": "2026-09-08T10:05:30.000Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Answers saved",
  "savedCount": 1,
  "totalAnswered": 1
}
```

**Implementation Strategy:**
1. Auto-save every 30-60 seconds or on answer change
2. Always include `sessionId` for validation
3. Handle session validation errors gracefully
4. Display save confirmation to user
5. Queue failed saves for retry

---

### 3. Submit Quiz Attempt

**Endpoint:** `POST /api/quizzes/:quizId/submit`

**Authentication:** Required (Student role)

**Description:** Submits the quiz attempt with server-side validation and risk assessment.

**Request Parameters:**
- `quizId` (path, required): MongoDB ObjectId of the quiz

**Request Body:**
```json
{
  "attemptId": "507f1f77bcf86cd799439011",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "attemptId": "507f1f77bcf86cd799439011",
    "status": "auto_graded",
    "endTime": "2026-09-08T10:25:30.000Z",
    "flaggedReasons": [],
    "riskScore": 5,
    "riskLevel": "low",
    "totalScore": 85,
    "maxScore": 100,
    "percentage": "85.00",
    "passed": true
  }
}
```

**Implementation Strategy:**
1. Validate session before submission
2. Show warning if risk score is elevated
3. Display server-calculated time spent
4. Handle different status responses (auto_graded, flagged, needs_manual_review)
5. Show results based on quiz settings

---

### 4. Log Audit Event

**Endpoint:** `POST /api/audit/event`

**Authentication:** Required (Student role)

**Description:** Logs anti-cheating events with risk scoring and IP tracking.

**Request Body:**
```json
{
  "attemptId": "507f1f77bcf86cd799439011",
  "eventType": "tab_switch",
  "clientTimestamp": "2026-09-08T10:10:15.000Z",
  "meta": {
    "details": "User switched to another tab"
  }
}
```

**Supported Event Types:**
- `tab_switch` - User switched browser tabs (+3 risk)
- `visibility_change` - Page visibility changed (+2 risk)
- `window_blur` - Window lost focus (+2 risk)
- `window_focus` - Window gained focus (0 risk)
- `fullscreen_enter` - Entered fullscreen mode (0 risk)
- `fullscreen_exit` - Exited fullscreen mode (+4 risk)
- `copy` - User copied content (+2 risk)
- `paste` - User pasted content (+3 risk)
- `cut` - User cut content (+2 risk)
- `context_menu` - User opened context menu (+1 risk)
- `keyboard_shortcut` - Suspicious keyboard shortcut (+2 risk)
- `heartbeat` - Regular heartbeat (0 risk)

**Response:**
```json
{
  "success": true,
  "message": "Event logged",
  "eventId": "507f1f77bcf86cd799439014",
  "riskScore": 3,
  "riskLevel": "low"
}
```

**Implementation Strategy:**
1. Implement browser event listeners for all event types
2. Send events immediately when detected
3. Include client timestamp for analysis
4. Display warnings based on risk level changes
5. Rate-limit event submission to prevent spam

---

### 5. Heartbeat

**Endpoint:** `POST /api/attempts/:attemptId/heartbeat`

**Authentication:** Required (Student role)

**Description:** Keeps the attempt alive and validates session integrity.

**Request Parameters:**
- `attemptId` (path, required): MongoDB ObjectId of the attempt

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "serverTime": "2026-09-08T10:15:00.000Z",
  "expiresAt": "2026-09-08T10:30:00.000Z",
  "riskScore": 5,
  "riskLevel": "low"
}
```

**Implementation Strategy:**
1. Send heartbeat every 10-15 seconds
2. Use server time for timer synchronization
3. Handle session validation errors
4. Detect network issues and retry
5. Show connection status to user

---

### 6. Get Audit Log

**Endpoint:** `GET /api/audit/:attemptId`

**Authentication:** Required (Trainer/Admin role)

**Description:** Retrieves comprehensive audit log for an attempt with risk summary.

**Request Parameters:**
- `attemptId` (path, required): MongoDB ObjectId of the attempt

**Response:**
```json
{
  "success": true,
  "data": {
    "attemptId": "507f1f77bcf86cd799439011",
    "summary": {
      "tab_switch": 3,
      "copy": 1,
      "paste": 0,
      "fullscreen_exit": 1,
      "totalRisk": 13,
      "totalEvents": 5
    },
    "events": [
      {
        "_id": "507f1f77bcf86cd799439014",
        "attemptId": "507f1f77bcf86cd799439011",
        "studentId": "507f1f77bcf86cd799439015",
        "quizId": "507f1f77bcf86cd799439012",
        "eventType": "tab_switch",
        "riskWeight": 3,
        "meta": {},
        "clientTimestamp": "2026-09-08T10:10:15.000Z",
        "serverTimestamp": "2026-09-08T10:10:15.500Z",
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2026-09-08T10:10:15.500Z",
        "updatedAt": "2026-09-08T10:10:15.500Z"
      }
    ],
    "totalEvents": 5,
    "pagination": {
      "limit": 100,
      "skip": 0,
      "total": 5
    }
  }
}
```

**Implementation Strategy:**
1. Display event timeline with timestamps
2. Show risk score progression
3. Highlight high-risk events
4. Provide filtering by event type
5. Export audit log for review

---

## Quiz Attempt Endpoints

### 7. Get Attempt Results

**Endpoint:** `GET /api/quizzes/:quizId/attempts/:attemptId`

**Authentication:** Required

**Description:** Retrieves attempt results with role-based data filtering.

**Request Parameters:**
- `quizId` (path, required): MongoDB ObjectId of the quiz
- `attemptId` (path, required): MongoDB ObjectId of the attempt

**Response (Student):**
```json
{
  "success": true,
  "data": {
    "attemptId": "507f1f77bcf86cd799439011",
    "quiz": {
      "id": "507f1f77bcf86cd799439012",
      "title": "JavaScript Fundamentals"
    },
    "status": "auto_graded",
    "startTime": "2026-09-08T10:00:00.000Z",
    "endTime": "2026-09-08T10:25:30.000Z",
    "attemptIndex": 1,
    "totalScore": 85,
    "maxScore": 100,
    "percentage": "85.00",
    "passed": true
  }
}
```

**Response (Trainer/Admin):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "quiz": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439015",
    "status": "auto_graded",
    "riskScore": 5,
    "riskLevel": "low",
    "suspicious": false,
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "startTime": "2026-09-08T10:00:00.000Z",
    "endTime": "2026-09-08T10:25:30.000Z",
    "totalScore": 85,
    "maxScore": 100,
    "tabSwitches": 3,
    "flaggedReasons": []
  }
}
```

---

### 8. List Attempts (Trainer/Admin)

**Endpoint:** `GET /api/quizzes/:quizId/attempts`

**Authentication:** Required (Trainer/Admin role)

**Description:** Lists all attempts for a quiz with filtering and pagination.

**Request Parameters:**
- `quizId` (path, required): MongoDB ObjectId of the quiz
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 20)
- `status` (query, optional): Filter by status
- `userId` (query, optional): Filter by user

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "user": {
        "_id": "507f1f77bcf86cd799439015",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "status": "auto_graded",
      "riskScore": 5,
      "riskLevel": "low",
      "suspicious": false,
      "startTime": "2026-09-08T10:00:00.000Z",
      "endTime": "2026-09-08T10:25:30.000Z",
      "totalScore": 85,
      "maxScore": 100
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

## Implementation Strategy

### Frontend Implementation Steps

#### 1. Session Management
```javascript
// Store session data securely
const quizSession = {
  attemptId: null,
  sessionId: null,
  attemptToken: null,
  expiresAt: null,
  startTime: null
};

// On quiz start
const startQuiz = async (quizId) => {
  const response = await fetch(`/api/quizzes/${quizId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  quizSession.attemptId = data.data.attemptId;
  quizSession.sessionId = data.data.sessionId;
  quizSession.attemptToken = data.data.attemptToken;
  quizSession.expiresAt = data.data.expiresAt;
  quizSession.startTime = data.data.startTime;
  
  return data;
};
```

#### 2. Timer Implementation
```javascript
// Use server expiresAt for accurate countdown
const startTimer = () => {
  const updateTimer = () => {
    const now = new Date();
    const expiresAt = new Date(quizSession.expiresAt);
    const remaining = Math.max(0, expiresAt - now);
    
    if (remaining === 0) {
      handleTimeout();
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    displayTimer(`${minutes}:${seconds.toString().padStart(2, '0')}`);
  };
  
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
};
```

#### 3. Event Detection
```javascript
// Implement comprehensive event listeners
const setupEventListeners = () => {
  // Tab switch detection
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      logAuditEvent('visibility_change');
    } else {
      logAuditEvent('window_focus');
    }
  });
  
  // Window focus/blur
  window.addEventListener('blur', () => {
    logAuditEvent('window_blur');
  });
  
  window.addEventListener('focus', () => {
    logAuditEvent('window_focus');
  });
  
  // Fullscreen detection
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      logAuditEvent('fullscreen_enter');
    } else {
      logAuditEvent('fullscreen_exit');
    }
  });
  
  // Copy/paste/cut detection
  document.addEventListener('copy', (e) => {
    logAuditEvent('copy', { text: window.getSelection().toString() });
  });
  
  document.addEventListener('paste', (e) => {
    logAuditEvent('paste', { length: e.clipboardData.items.length });
  });
  
  document.addEventListener('cut', (e) => {
    logAuditEvent('cut');
  });
  
  // Context menu detection
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    logAuditEvent('context_menu');
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Detect suspicious shortcuts like Ctrl+C, Ctrl+V, etc.
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
      logAuditEvent('keyboard_shortcut', { key: e.key });
    }
  });
};
```

#### 4. Audit Event Logging
```javascript
const logAuditEvent = async (eventType, meta = {}) => {
  try {
    const response = await fetch('/api/audit/event', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Quiz-Session': quizSession.sessionId
      },
      body: JSON.stringify({
        attemptId: quizSession.attemptId,
        eventType,
        clientTimestamp: new Date().toISOString(),
        meta
      })
    });
    
    const data = await response.json();
    
    // Update risk display
    if (data.data.riskLevel !== currentRiskLevel) {
      currentRiskLevel = data.data.riskLevel;
      updateRiskDisplay(data.data.riskScore, data.data.riskLevel);
    }
    
    return data;
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Queue failed events for retry
    eventQueue.push({ eventType, meta, timestamp: Date.now() });
  }
};
```

#### 5. Heartbeat Implementation
```javascript
const startHeartbeat = () => {
  const sendHeartbeat = async () => {
    try {
      const response = await fetch(`/api/attempts/${quizSession.attemptId}/heartbeat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: quizSession.sessionId
        })
      });
      
      const data = await response.json();
      
      // Sync server time
      syncServerTime(data.data.serverTime);
      
      // Update risk display
      updateRiskDisplay(data.data.riskScore, data.data.riskLevel);
      
    } catch (error) {
      console.error('Heartbeat failed:', error);
      showConnectionWarning();
    }
  };
  
  // Send heartbeat every 15 seconds
  heartbeatInterval = setInterval(sendHeartbeat, 15000);
  sendHeartbeat(); // Initial heartbeat
};
```

#### 6. Answer Saving
```javascript
const saveAnswers = async (answers) => {
  try {
    const response = await fetch(`/api/quizzes/${quizId}/save`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attemptId: quizSession.attemptId,
        sessionId: quizSession.sessionId,
        answers
      })
    });
    
    const data = await response.json();
    showSaveConfirmation(data.message);
    return data;
  } catch (error) {
    console.error('Save failed:', error);
    showSaveError();
  }
};
```

#### 7. Quiz Submission
```javascript
const submitQuiz = async () => {
  try {
    // Show confirmation dialog
    const confirmed = await showSubmitConfirmation();
    if (!confirmed) return;
    
    const response = await fetch(`/api/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        attemptId: quizSession.attemptId,
        sessionId: quizSession.sessionId
      })
    });
    
    const data = await response.json();
    
    // Clear intervals
    clearInterval(timerInterval);
    clearInterval(heartbeatInterval);
    
    // Show results
    displayResults(data.data);
    
  } catch (error) {
    console.error('Submission failed:', error);
    showSubmissionError();
  }
};
```

### Backend Security Checklist

#### ✅ Implemented Features:
- [x] Server-side timer validation using `expiresAt`
- [x] Session ID generation and validation
- [x] Risk-based scoring system
- [x] Comprehensive audit logging
- [x] IP change detection
- [x] Multiple session detection
- [x] Server-side violation counting
- [x] Heartbeat monitoring
- [x] Role-based access control
- [x] Request validation

#### 🔒 Security Considerations:
1. **Never Trust Client Data**: All security decisions based on server-side data
2. **Authoritative Timestamps**: Use `serverTimestamp` for all time-based decisions
3. **Session Integrity**: Validate session ID on every request
4. **Rate Limiting**: Implement rate limiting on audit event endpoints
5. **Input Validation**: Validate all inputs using Joi schemas
6. **Error Handling**: Don't expose sensitive information in error messages

---

## Security Best Practices

### 1. Session Management
- Always include `sessionId` in requests
- Use `X-Quiz-Session` header for additional validation
- Clear session data on quiz completion
- Implement session timeout handling

### 2. Event Detection
- Detect events at browser level, not application level
- Use native browser APIs for detection
- Handle event detection failures gracefully
- Rate-limit event submission

### 3. Data Validation
- Validate all user inputs
- Sanitize data before storage
- Use parameterized queries
- Implement type checking

### 4. Error Handling
- Never expose stack traces
- Use generic error messages for security issues
- Log errors server-side
- Implement retry logic for transient failures

### 5. Performance
- Batch audit events when possible
- Use efficient database queries
- Implement caching where appropriate
- Monitor API response times

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```
**Solution:** Ensure valid JWT token is provided.

#### 403 Forbidden
```json
{
  "success": false,
  "error": "Invalid session detected"
}
```
**Solution:** Session ID mismatch detected. Possible multiple session usage.

#### 404 Not Found
```json
{
  "success": false,
  "error": "Active attempt not found"
}
```
**Solution:** Attempt may have expired or been submitted already.

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Attempt has expired"
}
```
**Solution:** Quiz time limit exceeded. Attempt auto-submitted.

---

## Rate Limiting

### Recommended Rate Limits:
- **Audit Events**: 10 requests per minute per attempt
- **Heartbeat**: 1 request per 10 seconds per attempt
- **Save Answers**: 1 request per 5 seconds per attempt
- **Submit**: 1 request per attempt

### Implementation:
```javascript
// Rate limiting middleware example
const rateLimit = require('express-rate-limit');

const auditEventLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many audit events, please try again later'
});

router.post('/audit/event', auditEventLimiter, attemptsController.logAuditEvent);
```

---

## Monitoring and Alerts

### Key Metrics to Monitor:
1. **High Risk Attempts**: Attempts with risk score ≥ 15
2. **Multiple Session Detection**: Frequency of session violations
3. **IP Changes**: Frequency of IP change events
4. **Abnormal Timing**: Attempts submitted too quickly
5. **Heartbeat Failures**: Frequency of missed heartbeats

### Alert Thresholds:
- **Critical**: Risk score ≥ 25
- **High**: Risk score ≥ 15
- **Warning**: Risk score ≥ 7
- **Info**: Risk score < 7

---

## Conclusion

This anti-cheating system provides comprehensive protection for quiz integrity through:

1. **Server-Side Authority**: Backend controls all security decisions
2. **Risk-Based Scoring**: Granular event detection with weighted risk
3. **Session Management**: Prevents multiple browser usage
4. **Comprehensive Auditing**: Detailed event logging for review
5. **Real-Time Monitoring**: Heartbeat system for active attempts

The system is designed to be secure while maintaining a good user experience for legitimate students.

---

## Support

For issues or questions regarding the anti-cheating system, please refer to:
- Backend code: `src/controllers/attempts.controller.js`
- Services: `src/services/audit.service.js`, `src/services/riskEngine.js`
- Models: `src/models/auditEvent.model.js`, `src/models/QuizAttempt.js`
- Routes: `src/routes/attempts.routes.js`
