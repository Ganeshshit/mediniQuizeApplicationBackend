# API Testing Documentation

This document provides comprehensive information about the test suite for the Quiz Application Backend API.

## Overview

The test suite covers all API endpoints with comprehensive edge case testing including:
- Authentication & Authorization
- Input validation
- Error handling
- Role-based access control
- Data integrity
- Boundary conditions

## Test Structure

```
src/tests/
├── setup.js                          # Global test setup (MongoDB Memory Server)
├── helpers/
│   └── test-helpers.js              # Reusable test helper functions
└── integration/
    ├── auth.test.js                 # Authentication endpoints
    ├── subjects.test.js             # Subject management endpoints
    ├── questions.test.js            # Question management endpoints
    ├── quizzes.test.js              # Quiz management endpoints
    ├── quizEnrollment.test.js       # Quiz enrollment endpoints
    ├── attempts.test.js             # Quiz attempt endpoints
    └── monitoring.test.js           # Monitoring & anti-cheat endpoints
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test file
```bash
npm test auth.test.js
npm test quizzes.test.js
```

### Run tests with coverage
```bash
npm test -- --coverage
```

### Run tests in watch mode
```bash
npm test -- --watch
```

## Test Coverage

### Authentication Endpoints (`/api/v1/auth`)
- **POST /register** - User registration
  - Valid registration
  - Duplicate email
  - Invalid email format
  - Weak password
  - Invalid phone number
  - Missing required fields
  - Name length validation
  - Additional fields handling

- **POST /login** - User login
  - Valid credentials
  - Invalid email
  - Invalid password
  - Missing credentials
  - Invalid email format
  - Empty credentials

- **POST /refresh** - Token refresh
  - Valid refresh token
  - Invalid refresh token
  - Expired refresh token
  - Missing refresh token
  - Malformed token

- **POST /forgot-password** - Password reset request
  - Valid email
  - Non-existent email (security)
  - Invalid email format
  - Missing email
  - Empty email

- **POST /reset-password** - Password reset
  - Valid token and password
  - Invalid token
  - Expired token
  - Weak password
  - Missing token
  - Missing new password
  - Empty password

### Subjects Endpoints (`/api/v1/subjects`)
- **GET /** - List subjects
  - Authenticated user
  - Without authentication
  - Invalid token
  - Empty results

- **POST /** - Create subject (Trainer/Admin)
  - Valid creation
  - Missing name
  - Missing code
  - Invalid name length
  - Invalid code length
  - Invalid description length
  - Invalid semester
  - Invalid credits
  - Empty fields
  - Duplicate code
  - Role-based access

- **PUT /:id** - Update subject (Trainer/Admin)
  - Valid update
  - Invalid ID
  - Non-existent subject
  - Invalid field values
  - Partial update
  - Empty update
  - Role-based access

- **DELETE /:id** - Delete subject (Admin only)
  - Valid deletion
  - Invalid ID
  - Non-existent subject
  - Role-based access
  - Cascade deletion handling

### Questions Endpoints (`/api/v1/questions`)
- **GET /** - List questions
  - Authenticated user
  - Without authentication
  - Filter by subject
  - Empty results

- **GET /:id** - Get single question
  - Valid ID
  - Invalid ID format
  - Non-existent question
  - Without authentication

- **POST /** - Create question (Trainer/Admin)
  - MCQ single choice
  - MCQ multiple choice
  - Short answer
  - Numeric answer
  - Missing required fields
  - Invalid field values
  - Invalid subject
  - Non-existent subject
  - Role-based access

- **PUT /:id** - Update question (Trainer/Admin)
  - Valid update
  - Invalid ID
  - Non-existent question
  - Invalid field values
  - Partial update
  - Role-based access

- **DELETE /:id** - Delete question (Trainer/Admin)
  - Valid deletion
  - Invalid ID
  - Non-existent question
  - Role-based access
  - Used in quiz handling

### Quizzes Endpoints (`/api/v1/quizzes`)
- **GET /** - List quizzes
  - Authenticated user
  - Without authentication
  - Filter by status
  - Empty results

- **GET /:id** - Get single quiz
  - Valid ID
  - Invalid ID format
  - Non-existent quiz
  - Without authentication

- **GET /enrolled** - Get enrolled quizzes (Student)
  - Valid request
  - Role-based access
  - Without authentication

- **POST /** - Create quiz (Trainer/Admin)
  - Valid creation
  - Missing title
  - Invalid title length
  - Invalid question mode
  - Invalid duration
  - Invalid attempts allowed
  - Default values
  - Empty/null fields
  - Anti-cheat settings
  - Target audience
  - Invalid status
  - Role-based access

- **PUT /:id** - Update quiz (Trainer/Admin)
  - Valid update
  - Invalid ID
  - Non-existent quiz
  - Invalid field values
  - Partial update
  - Role-based access

- **PATCH /:id/publish** - Publish quiz (Trainer/Admin)
  - Valid publish
  - Invalid ID
  - Non-existent quiz
  - Role-based access

- **POST /:id/enroll** - Enroll in quiz (Student)
  - Valid enrollment
  - Draft quiz
  - Duplicate enrollment
  - Non-existent quiz
  - Role-based access

- **POST /:id/start** - Start quiz (Student)
  - Valid start
  - Without enrollment
  - Exceed max attempts
  - Draft quiz
  - Role-based access

- **POST /:attemptId/submit** - Submit quiz (Student)
  - Valid submission
  - Missing answers
  - Invalid question ID
  - Auto-submit
  - Role-based access

- **GET /:id/my-attempts** - Get my attempts (Student)
  - Valid request
  - Role-based access

- **GET /:id/questions** - Get quiz questions (Trainer/Admin)
  - Valid request
  - Role-based access

- **POST /:id/questions** - Add question to quiz (Trainer/Admin)
  - Valid addition
  - Invalid question ID
  - Role-based access

- **DELETE /:id/questions/:questionId** - Remove question (Trainer/Admin)
  - Valid removal
  - Role-based access

- **POST /:id/questions/manual** - Add manual question (Trainer/Admin)
  - Valid addition
  - Short prompt
  - Invalid choices
  - Role-based access

- **GET /:id/enrollments** - Get quiz enrollments (Trainer/Admin)
  - Valid request
  - Role-based access

- **GET /:id/attempts** - Get quiz attempts (Trainer/Admin)
  - Valid request
  - Filter by status
  - Role-based access

- **GET /:id/statistics** - Get quiz statistics (Trainer/Admin)
  - Valid request
  - Role-based access

- **POST /:attemptId/auto-save** - Auto-save answers (Student)
  - Valid save
  - Null answers
  - Role-based access

### Quiz Enrollment Endpoints (`/api/v1/enrollments`)
- **GET /available-students** - Get available students (Trainer/Admin)
  - Valid request
  - Pagination
  - Search
  - Filter by semester
  - Filter by department
  - Filter by date range
  - Sorting
  - Invalid parameters
  - Role-based access

- **GET /quiz/:quizId/enrolled** - Get enrolled students (Trainer/Admin)
  - Valid request
  - Pagination
  - Search
  - Invalid quiz ID
  - Non-existent quiz
  - Role-based access

- **GET /quiz/:quizId/not-enrolled** - Get not enrolled students (Trainer/Admin)
  - Valid request
  - Filtering
  - Invalid quiz ID
  - Role-based access

- **POST /quiz/:quizId/enroll-single** - Enroll single student (Trainer/Admin)
  - Valid enrollment
  - Missing student ID
  - Invalid student ID
  - Non-existent student
  - Already enrolled
  - Invalid quiz ID
  - Role-based access

- **POST /quiz/:quizId/enroll-multiple** - Enroll multiple students (Trainer/Admin)
  - Valid enrollment
  - Missing student IDs
  - Empty array
  - Exceed maximum
  - Invalid student ID
  - Partial enrollment
  - Role-based access

- **POST /quiz/:quizId/enroll-by-criteria** - Enroll by criteria (Trainer/Admin)
  - By semester
  - By department
  - Enroll all
  - Invalid semester
  - Invalid date
  - Empty criteria
  - Role-based access

- **DELETE /quiz/:quizId/unenroll-single** - Unenroll single student (Trainer/Admin)
  - Valid unenrollment
  - Missing student ID
  - Invalid student ID
  - Not enrolled
  - Invalid quiz ID
  - Role-based access

- **DELETE /quiz/:quizId/unenroll-multiple** - Unenroll multiple students (Trainer/Admin)
  - Valid unenrollment
  - Missing student IDs
  - Empty array
  - Exceed maximum
  - Partial unenrollment
  - Role-based access

- **GET /quiz/:quizId/statistics** - Get enrollment statistics (Trainer/Admin)
  - Valid request
  - Invalid quiz ID
  - Non-existent quiz
  - Zero enrollments
  - With enrollments
  - Role-based access

### Attempts Endpoints (`/api/v1/attempts`)
- **POST /quizzes/:quizId/start** - Start attempt (Student)
  - Valid start
  - Without enrollment
  - Exceed max attempts
  - Draft quiz
  - Invalid quiz ID
  - Role-based access

- **POST /quizzes/:quizId/save** - Save answers (Student)
  - Valid save
  - Missing attempt ID
  - Missing session ID
  - Missing answers
  - Invalid IDs
  - Role-based access

- **POST /quizzes/:quizId/submit** - Submit attempt (Student)
  - Valid submit
  - Missing IDs
  - Already submitted
  - Role-based access

- **GET /quizzes/:quizId/attempts/:attemptId** - Get attempt
  - Own attempt (Student)
  - Other student's attempt (forbidden)
  - Trainer access
  - Invalid IDs
  - Non-existent attempt
  - Without authentication

- **GET /quizzes/:quizId/attempts** - List attempts (Trainer/Admin)
  - Valid request
  - Empty results
  - Role-based access

- **GET /grading/pending** - Get pending grading (Trainer/Admin)
  - Valid request
  - Role-based access

- **GET /grading/:attemptId** - Get attempt for grading (Trainer/Admin)
  - Valid request
  - Invalid ID
  - Non-existent attempt
  - Role-based access

- **POST /grading/:attemptId** - Grade answer (Trainer/Admin)
  - Valid grading
  - Missing question ID
  - Missing score
  - Negative score
  - Invalid question ID
  - Feedback length
  - Optional feedback
  - Role-based access

- **PATCH /grading/:attemptId/finalize** - Finalize grading (Trainer/Admin)
  - Valid finalize
  - Invalid ID
  - Non-existent attempt
  - Already finalized
  - Role-based access

- **POST /audit/event** - Log audit event (Student)
  - Valid event
  - All event types
  - Missing attempt ID
  - Missing event type
  - Invalid event type
  - Optional fields
  - Role-based access

- **GET /audit/:attemptId** - Get audit log (Trainer/Admin)
  - Valid request
  - Invalid ID
  - Non-existent attempt
  - Empty log
  - Role-based access

- **POST /attempts/:attemptId/heartbeat** - Send heartbeat (Student)
  - Valid heartbeat
  - Missing session ID
  - Invalid ID
  - Non-existent attempt
  - Role-based access

### Monitoring Endpoints (`/api/v1/attempts/monitoring`)
- **GET /overview** - Monitoring overview (Trainer/Admin)
  - Valid request
  - Role-based access

- **GET /suspicious** - Get suspicious attempts (Trainer/Admin)
  - Valid request
  - Empty results
  - Role-based access

- **GET /attempt/:attemptId/details** - Get attempt audit details (Trainer/Admin)
  - Valid request
  - Invalid ID
  - Non-existent attempt
  - Role-based access

- **GET /quiz/:quizId/stats** - Get quiz monitoring stats (Trainer/Admin)
  - Valid request
  - Invalid quiz ID
  - Non-existent quiz
  - Zero stats
  - Role-based access

- **GET /student/:studentId/history** - Get student anti-cheat history (Trainer/Admin)
  - Valid request
  - Invalid student ID
  - Non-existent student
  - Empty history
  - Role-based access

- **GET /realtime** - Get real-time monitoring (Trainer/Admin)
  - Valid request
  - Role-based access

- **GET /flagged** - Get flagged attempts (Trainer/Admin)
  - Valid request
  - Empty results
  - Role-based access

- **GET /export** - Export monitoring data (Trainer/Admin)
  - Valid request
  - Role-based access

- **POST /batch** - Get batch monitoring data (Trainer/Admin)
  - Valid request
  - Missing quiz IDs
  - Empty array
  - Below minimum
  - Exceed maximum
  - Invalid quiz ID
  - Default values
  - Optional fields
  - Role-based access

- **GET /trainer/dashboard** - Get trainer dashboard (Trainer only)
  - Valid request
  - Admin forbidden
  - Student forbidden
  - Role-based access

- **POST /compare** - Get comparative analysis (Trainer/Admin)
  - Valid request
  - Missing quiz IDs
  - Below minimum
  - Exceed maximum
  - Invalid quiz ID
  - Optional date range
  - Invalid date format
  - Role-based access

### Quiz Selection & Switching Endpoints
- **GET /quizzes/available** - Get available quizzes (Trainer/Admin)
  - Valid request
  - Empty results
  - Role-based access

- **GET /quizzes/subjects** - Get subjects for filter (Trainer/Admin)
  - Valid request
  - Role-based access

- **POST /quizzes/switch** - Switch to quiz (Trainer/Admin)
  - Valid switch
  - Missing quiz ID
  - Invalid quiz ID
  - Non-existent quiz
  - Default values
  - Optional fields
  - Role-based access

- **GET /quizzes/categories** - Get quiz categories (Trainer/Admin)
  - Valid request
  - Empty results
  - Role-based access

- **POST /quizzes/search** - Search quizzes (Trainer/Admin)
  - Valid search
  - Empty search
  - With filters
  - No matches
  - Role-based access

## Test Helpers

The `test-helpers.js` file provides reusable functions for creating test data:

- `generateToken(userId, role)` - Generate JWT token
- `generateRefreshToken(userId)` - Generate refresh token
- `createTestUser(overrides)` - Create test user
- `createTestSubject(overrides)` - Create test subject
- `createTestQuestion(subjectId, overrides)` - Create test question
- `createTestQuiz(trainerId, subjectId, overrides)` - Create test quiz
- `createTestEnrollment(studentId, quizId, overrides)` - Create test enrollment
- `createTestAttempt(studentId, quizId, overrides)` - Create test attempt
- `cleanCollections()` - Clean all database collections

## Edge Cases Covered

### Input Validation
- Missing required fields
- Invalid data types
- String length validation
- Numeric range validation
- Enum value validation
- ObjectId format validation

### Authentication & Authorization
- Unauthenticated requests
- Invalid tokens
- Expired tokens
- Role-based access control
- Ownership verification

### Data Integrity
- Duplicate data prevention
- Foreign key constraints
- Cascade operations
- Soft/hard deletes

### Business Logic
- Attempt limits
- Enrollment restrictions
- Status transitions
- Time-based operations
- Pagination limits

### Error Handling
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error

## Environment Setup

The tests use MongoDB Memory Server, so no external database is required. The test environment is configured in `jest.config.js` and `setup.js`.

## Best Practices

1. **Isolation**: Each test runs in isolation with clean database state
2. **Descriptive names**: Test names clearly describe what is being tested
3. **Arrange-Act-Assert**: Tests follow the AAA pattern
4. **Edge cases**: Both happy path and edge cases are tested
5. **Role testing**: All endpoints are tested with different user roles
6. **Validation**: All input validation rules are tested

## Troubleshooting

### Tests failing with database connection errors
- Ensure MongoDB Memory Server is properly installed
- Check that no other MongoDB instance is running on the default port

### Tests timing out
- Increase timeout in `jest.config.js` if needed
- Check for infinite loops or long-running operations

### Coverage not generating
- Ensure `--coverage` flag is used
- Check that source files are in the correct directories
