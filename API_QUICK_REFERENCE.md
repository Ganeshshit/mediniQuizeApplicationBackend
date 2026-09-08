# API Quick Reference - Anti-Cheating Endpoints

## Core Anti-Cheating Endpoints

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| POST | `/api/quizzes/:quizId/start` | Required | Student | Start quiz with session management |
| POST | `/api/quizzes/:quizId/save` | Required | Student | Auto-save answers with validation |
| POST | `/api/quizzes/:quizId/submit` | Required | Student | Submit with server-side validation |
| POST | `/api/audit/event` | Required | Student | Log anti-cheating events |
| POST | `/api/attempts/:attemptId/heartbeat` | Required | Student | Keep attempt alive |
| GET | `/api/audit/:attemptId` | Required | Trainer/Admin | Get audit log |

## Event Types & Risk Weights

| Event Type | Risk Weight | Description |
|------------|-------------|-------------|
| `tab_switch` | +3 | User switched browser tabs |
| `visibility_change` | +2 | Page visibility changed |
| `window_blur` | +2 | Window lost focus |
| `window_focus` | 0 | Window gained focus |
| `fullscreen_enter` | 0 | Entered fullscreen mode |
| `fullscreen_exit` | +4 | Exited fullscreen mode |
| `copy` | +2 | User copied content |
| `paste` | +3 | User pasted content |
| `cut` | +2 | User cut content |
| `context_menu` | +1 | User opened context menu |
| `keyboard_shortcut` | +2 | Suspicious keyboard shortcut |
| `heartbeat` | 0 | Regular heartbeat |
| `multiple_session` | +5 | Multiple session detected |
| `ip_change` | +5 | IP address changed |
| `suspicious_timing` | +4 | Suspicious timing pattern |
| `invalid_request` | +10 | Invalid request detected |

## Risk Levels

| Score Range | Level | Action |
|-------------|-------|--------|
| 0-6 | Low | Normal operation |
| 7-14 | Medium | Monitor closely |
| 15-24 | High | Flag for review |
| 25+ | Critical | Immediate action |

## Request Headers

### Standard Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Session Validation Header
```
X-Quiz-Session: <session_id>
```

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error, expired attempt) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (invalid session, access denied) |
| 404 | Not Found (attempt not found) |
| 500 | Server Error |

## Session Data Structure

```javascript
{
  attemptId: "MongoDB ObjectId",
  sessionId: "UUID v4",
  attemptToken: "UUID v4",
  expiresAt: "ISO Date",
  startTime: "ISO Date"
}
```

## Quick Implementation Steps

### 1. Start Quiz
```javascript
POST /api/quizzes/{quizId}/start
→ Store sessionId, attemptToken, expiresAt
→ Start timer based on expiresAt
→ Setup event listeners
```

### 2. During Quiz
```javascript
// Every 15 seconds
POST /api/attempts/{attemptId}/heartbeat
→ Validate session
→ Sync server time
→ Check risk level

// On events
POST /api/audit/event
→ Log event type
→ Update risk display

// Every 30-60 seconds
POST /api/quizzes/{quizId}/save
→ Save current answers
→ Validate session
```

### 3. Submit Quiz
```javascript
POST /api/quizzes/{quizId}/submit
→ Validate session
→ Server-side violation counting
→ Risk assessment
→ Return results
```

## Frontend Event Listeners

```javascript
// Tab/Window detection
document.addEventListener('visibilitychange', handler);
window.addEventListener('blur', handler);
window.addEventListener('focus', handler);

// Fullscreen detection
document.addEventListener('fullscreenchange', handler);

// Copy/Paste/Cut detection
document.addEventListener('copy', handler);
document.addEventListener('paste', handler);
document.addEventListener('cut', handler);

// Context menu
document.addEventListener('contextmenu', handler);

// Keyboard shortcuts
document.addEventListener('keydown', handler);
```

## Backend Security Features

✅ Server-side timer validation
✅ Session ID generation and validation
✅ Risk-based scoring system
✅ Comprehensive audit logging
✅ IP change detection
✅ Multiple session detection
✅ Server-side violation counting
✅ Heartbeat monitoring
✅ Role-based access control
✅ Request validation

## File Structure

```
backend/
├── src/
│   ├── models/
│   │   ├── auditEvent.model.js (NEW)
│   │   └── QuizAttempt.js (ENHANCED)
│   ├── services/
│   │   ├── audit.service.js (NEW)
│   │   └── riskEngine.js (NEW)
│   ├── controllers/
│   │   └── attempts.controller.js (ENHANCED)
│   └── routes/
│       └── attempts.routes.js (ENHANCED)
```

## Testing Checklist

- [ ] Start quiz generates unique session ID
- [ ] Timer uses server expiresAt
- [ ] Invalid session ID is rejected
- [ ] Audit events update risk score
- [ ] Heartbeat validates session
- [ ] IP changes are logged
- [ ] Multiple sessions are detected
- [ ] Submit uses server-side validation
- [ ] Risk levels are calculated correctly
- [ ] Audit log shows all events

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Session validation fails | Ensure sessionId is stored and sent correctly |
| Timer shows wrong time | Use server expiresAt, not client calculation |
| Events not logging | Check event listener setup and network requests |
| Risk score not updating | Verify audit event endpoint is called correctly |
| Submit fails | Validate session ID and attempt status before submit |

## Monitoring Endpoints

### Get Attempt Status
```bash
GET /api/quizzes/{quizId}/attempts/{attemptId}
```

### Get Audit Log
```bash
GET /api/audit/{attemptId}
```

### List All Attempts (Admin)
```bash
GET /api/quizzes/{quizId}/attempts?page=1&limit=20
```

## Rate Limits

- Audit Events: 10/minute per attempt
- Heartbeat: 1/10 seconds per attempt
- Save Answers: 1/5 seconds per attempt
- Submit: 1 per attempt

## Security Headers

Always include:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`
- `X-Quiz-Session: <sessionId>` (optional but recommended)

## Error Handling

Always handle:
- Network failures (retry logic)
- Session validation errors (redirect to login)
- Attempt expiration (auto-submit)
- Rate limiting (queue events)

## Support Files

- Full Documentation: `ANTI_CHEAT_API_DOCUMENTATION.md`
- Backend Models: `src/models/`
- Backend Services: `src/services/`
- Backend Controllers: `src/controllers/`
- Backend Routes: `src/routes/`
