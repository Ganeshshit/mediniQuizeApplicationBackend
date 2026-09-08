# Quiz Selection & Switching Guide

## Overview

Admins and trainers can now easily switch between monitoring different quizzes through an intuitive selection system. This feature allows users to:

- **Browse available quizzes** with filtering and search
- **Switch between quizzes** instantly without page reloads
- **Filter by subject, duration, marks, etc.**
- **Search quizzes by title or description**
- **See monitoring metadata** for each quiz before selecting

---

## 🎯 Use Case Example

### Scenario: Admin Monitoring Multiple Institution Quizzes

**Morning**: Admin wants to monitor Civil Engineering quiz at IIT
- Selects "Civil Engineering" from subject filter
- Finds "IIT Civil Engineering Quiz" 
- Clicks to monitor → sees real-time data

**Afternoon**: Admin switches to AICTE quiz
- Uses search to find "AICTE"
- Selects "AICTE Technical Quiz"
- Instantly switches monitoring view

**Evening**: Admin checks both quizzes together
- Uses batch monitoring to see both
- Switches between detailed views as needed

---

## 🚀 New Quiz Selection Endpoints

### 1. Get Available Quizzes

**Endpoint**: `GET /api/monitoring/quizzes/available`

**Authentication**: Required (Trainer/Admin)

**Description**: Get list of available quizzes with monitoring metadata and filtering

**Query Parameters**:
- `subject` (optional): Filter by subject ID
- `search` (optional): Search by title/description
- `status` (optional): Filter by status (default: published)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response**:
```json
{
  "success": true,
  "data": {
    "quizzes": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "title": "Civil Engineering Fundamentals",
        "description": "Basic civil engineering concepts",
        "subject": {
          "_id": "507f1f77bcf86cd799439030",
          "name": "Civil Engineering"
        },
        "durationMinutes": 30,
        "totalMarks": 100,
        "createdAt": "2026-09-01T10:00:00.000Z",
        "status": "published",
        "antiCheatSettings": {
          "enableTabSwitchDetection": true,
          "maxTabSwitches": 5
        },
        "monitoring": {
          "totalAttempts": 45,
          "activeAttempts": 3,
          "suspiciousAttempts": 2,
          "avgRiskScore": "4.5",
          "lastActivity": "2026-09-08T10:15:00.000Z"
        }
      },
      {
        "_id": "507f1f77bcf86cd799439013",
        "title": "AICTE Technical Assessment",
        "description": "AICTE standardized technical test",
        "subject": {
          "_id": "507f1f77bcf86cd799439031",
          "name": "Technical"
        },
        "durationMinutes": 45,
        "totalMarks": 150,
        "createdAt": "2026-09-05T14:00:00.000Z",
        "status": "published",
        "antiCheatSettings": {
          "enableTabSwitchDetection": true,
          "trackIPAddress": true
        },
        "monitoring": {
          "totalAttempts": 28,
          "activeAttempts": 5,
          "suspiciousAttempts": 1,
          "avgRiskScore": "3.2",
          "lastActivity": "2026-09-08T10:10:00.000Z"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 12,
      "pages": 1
    },
    "filters": {
      "subject": null,
      "search": null,
      "status": "published"
    }
  }
}
```

**Implementation Example**:
```javascript
const getAvailableQuizzes = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/monitoring/quizzes/available?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Load quizzes for Civil Engineering subject
const civilQuizzes = await getAvailableQuizzes({ subject: 'civilEngId' });

// Search for AICTE quizzes
const aicteQuizzes = await getAvailableQuizzes({ search: 'AICTE' });
```

---

### 2. Get Subjects for Filtering

**Endpoint**: `GET /api/monitoring/quizzes/subjects`

**Authentication**: Required (Trainer/Admin)

**Description**: Get list of available subjects for filtering

**Response**:
```json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "id": "507f1f77bcf86cd799439030",
        "name": "Civil Engineering",
        "description": "Civil engineering courses"
      },
      {
        "id": "507f1f77bcf86cd799439031",
        "name": "Technical",
        "description": "Technical assessments"
      },
      {
        "id": "507f1f77bcf86cd799439032",
        "name": "Computer Science",
        "description": "Computer science courses"
      }
    ]
  }
}
```

**Implementation Example**:
```javascript
const getSubjects = async () => {
  const response = await fetch('/api/monitoring/quizzes/subjects', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Load subjects for dropdown filter
const subjects = await getSubjects();
renderSubjectDropdown(subjects.data.subjects);
```

---

### 3. Switch to Quiz

**Endpoint**: `POST /api/monitoring/quizzes/switch`

**Authentication**: Required (Trainer/Admin)

**Description**: Switch monitoring view to a specific quiz

**Request Body**:
```json
{
  "quizId": "507f1f77bcf86cd799439012",
  "includeRealTime": true,
  "includeStats": true
}
```

**Parameters**:
- `quizId` (required): The quiz ID to monitor
- `includeRealTime` (optional): Include real-time active attempts (default: true)
- `includeStats` (optional): Include quiz statistics (default: true)

**Response**:
```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "507f1f77bcf86cd799439012",
      "title": "Civil Engineering Fundamentals",
      "description": "Basic civil engineering concepts",
      "subject": {
        "_id": "507f1f77bcf86cd799439030",
        "name": "Civil Engineering"
      },
      "durationMinutes": 30,
      "totalMarks": 100,
      "antiCheatSettings": {
        "enableTabSwitchDetection": true,
        "maxTabSwitches": 5,
        "trackIPAddress": true
      },
      "createdAt": "2026-09-01T10:00:00.000Z"
    },
    "statistics": {
      "totalAttempts": 45,
      "suspiciousAttempts": 2,
      "suspiciousRate": "4.44",
      "avgRiskScore": "4.5",
      "avgDuration": 1450,
      "riskDistribution": {
        "low": 40,
        "medium": 3,
        "high": 2,
        "critical": 0
      },
      "eventDistribution": [...]
    },
    "realTime": {
      "activeAttempts": [
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
      ],
      "totalActive": 3,
      "highRiskActive": 1,
      "timestamp": "2026-09-08T10:15:00.000Z"
    },
    "timestamp": "2026-09-08T10:15:00.000Z"
  }
}
```

**Implementation Example**:
```javascript
const switchToQuiz = async (quizId) => {
  const response = await fetch('/api/monitoring/quizzes/switch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      quizId,
      includeRealTime: true,
      includeStats: true
    })
  });
  
  const data = await response.json();
  return data.data;
};

// Switch monitoring view
const quizData = await switchToQuiz('quiz123');
renderQuizMonitoringView(quizData);
```

---

### 4. Get Quiz Categories

**Endpoint**: `GET /api/monitoring/quizzes/categories`

**Authentication**: Required (Trainer/Admin)

**Description**: Get available categories and filters for advanced quiz search

**Response**:
```json
{
  "success": true,
  "data": {
    "subjects": [
      { "id": "507f1f77bcf86cd799439030", "name": "Civil Engineering" },
      { "id": "507f1f77bcf86cd799439031", "name": "Technical" }
    ],
    "durations": [
      { "value": 15, "label": "15 minutes" },
      { "value": 30, "label": "30 minutes" },
      { "value": 45, "label": "45 minutes" },
      { "value": 60, "label": "60 minutes" }
    ],
    "marksRanges": [
      { "min": 0, "max": 50, "label": "0-50 marks" },
      { "min": 51, "max": 100, "label": "51-100 marks" },
      { "min": 101, "max": 200, "label": "101-200 marks" }
    ],
    "antiCheatLevels": [
      { "value": "strict", "label": "Strict (all features)" },
      { "value": "moderate", "label": "Moderate (basic features)" },
      { "value": "lenient", "label": "Lenient (minimal features)" }
    ]
  }
}
```

**Implementation Example**:
```javascript
const getCategories = async () => {
  const response = await fetch('/api/monitoring/quizzes/categories', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Load advanced filter options
const categories = await getCategories();
renderAdvancedFilters(categories.data);
```

---

### 5. Search Quizzes

**Endpoint**: `POST /api/monitoring/quizzes/search`

**Authentication**: Required (Trainer/Admin)

**Description**: Advanced search with multiple criteria

**Request Body**:
```json
{
  "title": "Engineering",
  "subject": "507f1f77bcf86cd799439030",
  "minDuration": 30,
  "maxDuration": 60,
  "minMarks": 50,
  "maxMarks": 150,
  "antiCheatLevel": "strict",
  "createdAfter": "2026-09-01",
  "createdBefore": "2026-09-30",
  "page": 1,
  "limit": 20
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "quizzes": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "title": "Civil Engineering Fundamentals",
        "description": "Basic civil engineering concepts",
        "subject": {
          "_id": "507f1f77bcf86cd799439030",
          "name": "Civil Engineering"
        },
        "durationMinutes": 30,
        "totalMarks": 100,
        "antiCheatSettings": {
          "enableTabSwitchDetection": true
        },
        "createdAt": "2026-09-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    },
    "searchCriteria": {
      "title": "Engineering",
      "subject": "507f1f77bcf86cd799439030",
      "minDuration": 30,
      "maxDuration": 60
    }
  }
}
```

**Implementation Example**:
```javascript
const searchQuizzes = async (criteria) => {
  const response = await fetch('/api/monitoring/quizzes/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(criteria)
  });
  
  return response.json();
};

// Advanced search
const results = await searchQuizzes({
  title: 'Engineering',
  minDuration: 30,
  maxMarks: 150,
  antiCheatLevel: 'strict'
});
```

---

## 🎨 Frontend Implementation

### React Quiz Selection Component

```javascript
import React, { useState, useEffect } from 'react';

const QuizSelector = ({ onQuizSelect }) => {
  const [quizzes, setQuizzes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState(null);
  const [filters, setFilters] = useState({
    subject: '',
    search: '',
    page: 1
  });
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [filters]);

  const loadInitialData = async () => {
    try {
      const [subjectsRes, categoriesRes] = await Promise.all([
        fetch('/api/monitoring/quizzes/subjects', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch('/api/monitoring/quizzes/categories', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ]);

      const subjectsData = await subjectsRes.json();
      const categoriesData = await categoriesRes.json();

      setSubjects(subjectsData.data.subjects);
      setCategories(categoriesData.data);
      loadQuizzes();
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzes = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/monitoring/quizzes/available?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      const data = await response.json();
      setQuizzes(data.data.quizzes);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
    }
  };

  const handleQuizSelect = async (quizId) => {
    try {
      const response = await fetch('/api/monitoring/quizzes/switch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId,
          includeRealTime: true,
          includeStats: true
        })
      });

      const data = await response.json();
      setSelectedQuiz(data.data);
      onQuizSelect(data.data);
    } catch (error) {
      console.error('Failed to switch quiz:', error);
    }
  };

  const handleSearch = (searchTerm) => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }));
  };

  const handleSubjectFilter = (subjectId) => {
    setFilters(prev => ({ ...prev, subject: subjectId, page: 1 }));
  };

  if (loading) return <div>Loading quizzes...</div>;

  return (
    <div className="quiz-selector">
      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search quizzes..."
          value={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Subject Filter */}
      <div className="subject-filter">
        <select
          value={filters.subject}
          onChange={(e) => handleSubjectFilter(e.target.value)}
          className="subject-select"
        >
          <option value="">All Subjects</option>
          {subjects.map(subject => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quiz List */}
      <div className="quiz-list">
        {quizzes.map(quiz => (
          <QuizCard
            key={quiz._id}
            quiz={quiz}
            isSelected={selectedQuiz?.quiz?.id === quiz._id}
            onSelect={() => handleQuizSelect(quiz._id)}
          />
        ))}
      </div>

      {/* Selected Quiz View */}
      {selectedQuiz && (
        <QuizMonitoringView quizData={selectedQuiz} />
      )}
    </div>
  );
};

const QuizCard = ({ quiz, isSelected, onSelect }) => (
  <div 
    className={`quiz-card ${isSelected ? 'selected' : ''}`}
    onClick={onSelect}
  >
    <h3>{quiz.title}</h3>
    <p className="description">{quiz.description}</p>
    <div className="quiz-meta">
      <span className="subject">{quiz.subject?.name}</span>
      <span className="duration">{quiz.durationMinutes} min</span>
      <span className="marks">{quiz.totalMarks} marks</span>
    </div>
    <div className="monitoring-stats">
      <div className="stat">
        <span className="label">Total Attempts:</span>
        <span className="value">{quiz.monitoring.totalAttempts}</span>
      </div>
      <div className="stat">
        <span className="label">Active Now:</span>
        <span className={`value ${quiz.monitoring.activeAttempts > 0 ? 'active' : ''}`}>
          {quiz.monitoring.activeAttempts}
        </span>
      </div>
      <div className="stat">
        <span className="label">Avg Risk:</span>
        <span className={`value ${getRiskColorClass(quiz.monitoring.avgRiskScore)}`}>
          {quiz.monitoring.avgRiskScore}
        </span>
      </div>
    </div>
  </div>
);
```

### Vue.js Quiz Selection Component

```javascript
<template>
  <div class="quiz-selector">
    <!-- Search and Filter Bar -->
    <div class="filter-bar">
      <input
        v-model="filters.search"
        @input="debouncedSearch"
        placeholder="Search quizzes..."
        class="search-input"
      />
      
      <select
        v-model="filters.subject"
        @change="loadQuizzes"
        class="subject-select"
      >
        <option value="">All Subjects</option>
        <option
          v-for="subject in subjects"
          :key="subject.id"
          :value="subject.id"
        >
          {{ subject.name }}
        </option>
      </select>

      <button
        @click="showAdvancedFilters = !showAdvancedFilters"
        class="advanced-filters-btn"
      >
        Advanced Filters
      </button>
    </div>

    <!-- Advanced Filters Panel -->
    <div v-if="showAdvancedFilters && categories" class="advanced-filters">
      <div class="filter-group">
        <label>Duration:</label>
        <select v-model="advancedFilters.minDuration">
          <option value="">Min Duration</option>
          <option
            v-for="duration in categories.durations"
            :key="duration.value"
            :value="duration.value"
          >
            {{ duration.label }}
          </option>
        </select>
        <select v-model="advancedFilters.maxDuration">
          <option value="">Max Duration</option>
          <option
            v-for="duration in categories.durations"
            :key="duration.value"
            :value="duration.value"
          >
            {{ duration.label }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Marks Range:</label>
        <select v-model="advancedFilters.marksRange">
          <option value="">Any</option>
          <option
            v-for="range in categories.marksRanges"
            :key="range.label"
            :value="range"
          >
            {{ range.label }}
          </option>
        </select>
      </div>

      <button @click="applyAdvancedFilters" class="apply-btn">
        Apply Filters
      </button>
    </div>

    <!-- Quiz Grid -->
    <div class="quiz-grid">
      <div
        v-for="quiz in quizzes"
        :key="quiz._id"
        :class="['quiz-card', { selected: selectedQuizId === quiz._id }]"
        @click="selectQuiz(quiz._id)"
      >
        <h3>{{ quiz.title }}</h3>
        <p class="description">{{ quiz.description }}</p>
        
        <div class="quiz-meta">
          <span class="subject">{{ quiz.subject?.name }}</span>
          <span class="duration">{{ quiz.durationMinutes }} min</span>
          <span class="marks">{{ quiz.totalMarks }} marks</span>
        </div>

        <div class="monitoring-preview">
          <div class="preview-item">
            <span class="label">Attempts:</span>
            <span class="value">{{ quiz.monitoring.totalAttempts }}</span>
          </div>
          <div class="preview-item">
            <span class="label">Active:</span>
            <span class="value active">{{ quiz.monitoring.activeAttempts }}</span>
          </div>
          <div class="preview-item">
            <span class="label">Risk:</span>
            <span class="value" :class="getRiskClass(quiz.monitoring.avgRiskScore)">
              {{ quiz.monitoring.avgRiskScore }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Quiz Monitoring View -->
    <div v-if="selectedQuizData" class="selected-quiz-view">
      <QuizMonitoringView :quizData="selectedQuizData" />
    </div>
  </div>
</template>

<script>
import { debounce } from 'lodash';

export default {
  data() {
    return {
      quizzes: [],
      subjects: [],
      categories: null,
      filters: {
        subject: '',
        search: '',
        page: 1
      },
      advancedFilters: {
        minDuration: '',
        maxDuration: '',
        marksRange: null
      },
      selectedQuizId: null,
      selectedQuizData: null,
      loading: true,
      showAdvancedFilters: false
    };
  },

  created() {
    this.debouncedSearch = debounce(this.loadQuizzes, 300);
    this.loadInitialData();
  },

  methods: {
    async loadInitialData() {
      try {
        const [subjectsRes, categoriesRes] = await Promise.all([
          this.$http.get('/api/monitoring/quizzes/subjects'),
          this.$http.get('/api/monitoring/quizzes/categories')
        ]);

        this.subjects = subjectsRes.data.data.subjects;
        this.categories = categoriesRes.data.data;
        await this.loadQuizzes();
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        this.loading = false;
      }
    },

    async loadQuizzes() {
      try {
        const params = { ...this.filters };
        const response = await this.$http.get('/api/monitoring/quizzes/available', {
          params
        });
        this.quizzes = response.data.data.quizzes;
      } catch (error) {
        console.error('Failed to load quizzes:', error);
      }
    },

    async selectQuiz(quizId) {
      try {
        this.selectedQuizId = quizId;
        const response = await this.$http.post('/api/monitoring/quizzes/switch', {
          quizId,
          includeRealTime: true,
          includeStats: true
        });
        
        this.selectedQuizData = response.data.data;
        this.$emit('quiz-selected', this.selectedQuizData);
      } catch (error) {
        console.error('Failed to select quiz:', error);
      }
    },

    async applyAdvancedFilters() {
      try {
        const searchCriteria = {
          ...this.advancedFilters,
          subject: this.filters.subject,
          title: this.filters.search
        };

        const response = await this.$http.post('/api/monitoring/quizzes/search', searchCriteria);
        this.quizzes = response.data.data.quizzes;
      } catch (error) {
        console.error('Failed to apply advanced filters:', error);
      }
    },

    getRiskClass(riskScore) {
      const score = parseFloat(riskScore);
      if (score >= 15) return 'high';
      if (score >= 7) return 'medium';
      return 'low';
    }
  }
};
</script>
```

---

## 🔄 Quiz Switching Workflow

### User Experience Flow

1. **Initial Load**
   - User lands on monitoring dashboard
   - System loads available quizzes with subjects
   - Shows quiz list with monitoring metadata

2. **Filter/Search**
   - User selects subject filter (e.g., "Civil Engineering")
   - User types search term (e.g., "IIT")
   - List updates automatically with matching quizzes

3. **Quiz Selection**
   - User sees quiz cards with preview stats
   - User clicks on "Civil Engineering at IIT" quiz
   - System instantly switches to detailed monitoring view

4. **Monitoring View**
   - Shows real-time active attempts
   - Displays quiz statistics
   - Shows risk analysis
   - Auto-refreshes every 15 seconds

5. **Quick Switch**
   - User wants to check AICTE quiz
   - Uses search: "AICTE"
   - Clicks on AICTE quiz
   - View instantly switches to AICTE quiz

6. **Batch View** (Optional)
   - User selects multiple quizzes
   - Uses batch monitoring to see overview
   - Can switch to detailed view of any quiz

---

## 🎯 Real-World Implementation Examples

### Example 1: Admin Monitoring Multiple Institutions

```javascript
const InstitutionMonitoringDashboard = () => {
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);

  const handleQuizSwitch = async (quizId) => {
    // Add to history for quick navigation
    setQuizHistory(prev => [...prev, currentQuiz].filter(Boolean));
    
    // Switch to new quiz
    const quizData = await switchToQuiz(quizId);
    setCurrentQuiz(quizData);
  };

  const quickSwitchToPrevious = () => {
    if (quizHistory.length > 0) {
      const previousQuiz = quizHistory[quizHistory.length - 1];
      setQuizHistory(prev => prev.slice(0, -1));
      setCurrentQuiz(previousQuiz);
    }
  };

  return (
    <div className="institution-dashboard">
      {/* Quick Navigation */}
      <div className="quick-nav">
        <button onClick={quickSwitchToPrevious} disabled={quizHistory.length === 0}>
          ← Previous Quiz
        </button>
        <span className="current-quiz">
          {currentQuiz?.quiz?.title || 'Select a quiz'}
        </span>
      </div>

      {/* Quiz Selector */}
      <QuizSelector onQuizSelect={handleQuizSwitch} />

      {/* Current Quiz View */}
      {currentQuiz && <QuizMonitoringView quizData={currentQuiz} />}
    </div>
  );
};
```

### Example 2: Trainer Managing Multiple Active Quizzes

```javascript
const TrainerQuizManager = () => {
  const [activeQuizzes, setActiveQuizzes] = useState([]);
  const [monitoredQuiz, setMonitoredQuiz] = useState(null);

  useEffect(() => {
    loadActiveQuizzes();
    const interval = setInterval(loadActiveQuizzes, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadActiveQuizzes = async () => {
    const response = await fetch('/api/monitoring/quizzes/available?search=active', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    
    // Filter quizzes with active attempts
    const quizzesWithActivity = data.data.quizzes.filter(
      quiz => quiz.monitoring.activeAttempts > 0
    );
    setActiveQuizzes(quizzesWithActivity);
  };

  return (
    <div className="trainer-manager">
      {/* Active Quizzes Bar */}
      <div className="active-quizzes-bar">
        <h3>Active Quizzes ({activeQuizzes.length})</h3>
        <div className="quiz-tabs">
          {activeQuizzes.map(quiz => (
            <button
              key={quiz._id}
              className={`quiz-tab ${monitoredQuiz?.quiz?.id === quiz._id ? 'active' : ''}`}
              onClick={() => switchToQuiz(quiz._id)}
            >
              {quiz.title}
              <span className="active-count">
                ({quiz.monitoring.activeAttempts})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Current Quiz View */}
      {monitoredQuiz && (
        <QuizMonitoringView quizData={monitoredQuiz} />
      )}

      {/* Quiz Selector for additional quizzes */}
      <QuizSelector onQuizSelect={setMonitoredQuiz} />
    </div>
  );
};
```

### Example 3: Quick Quiz Switcher Component

```javascript
const QuickQuizSwitcher = ({ currentQuizId, onSwitch }) => {
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadRecentQuizzes();
  }, []);

  const loadRecentQuizzes = async () => {
    const response = await fetch('/api/monitoring/quizzes/available?limit=5', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    setRecentQuizzes(data.data.quizzes);
  };

  return (
    <div className="quick-switcher">
      <button
        className="switcher-button"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        🔄 Switch Quiz
      </button>

      {showDropdown && (
        <div className="switcher-dropdown">
          {recentQuizzes.map(quiz => (
            <div
              key={quiz._id}
              className="quiz-option"
              onClick={() => {
                onSwitch(quiz._id);
                setShowDropdown(false);
              }}
            >
              <div className="quiz-title">{quiz.title}</div>
              <div className="quiz-info">
                <span>{quiz.subject?.name}</span>
                <span>{quiz.monitoring.activeAttempts} active</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 📊 Quiz Selection UI Components

### Simple Quiz Dropdown

```javascript
const QuizDropdown = ({ quizzes, selectedQuizId, onSelect }) => (
  <select
    value={selectedQuizId}
    onChange={(e) => onSelect(e.target.value)}
    className="quiz-dropdown"
  >
    <option value="">Select a quiz to monitor...</option>
    {quizzes.map(quiz => (
      <option key={quiz._id} value={quiz._id}>
        {quiz.title} ({quiz.monitoring.activeAttempts} active)
      </option>
    ))}
  </select>
);
```

### Quiz Card with Monitoring Preview

```javascript
const QuizCard = ({ quiz, onSelect }) => (
  <div className="quiz-card" onClick={() => onSelect(quiz._id)}>
    <div className="quiz-header">
      <h3>{quiz.title}</h3>
      <span className="subject-badge">{quiz.subject?.name}</span>
    </div>
    
    <p className="quiz-description">{quiz.description}</p>
    
    <div className="quiz-details">
      <div className="detail-item">
        <span className="icon">⏱️</span>
        <span>{quiz.durationMinutes} min</span>
      </div>
      <div className="detail-item">
        <span className="icon">📊</span>
        <span>{quiz.totalMarks} marks</span>
      </div>
    </div>

    <div className="monitoring-summary">
      <div className="summary-item">
        <span className="label">Total Attempts</span>
        <span className="value">{quiz.monitoring.totalAttempts}</span>
      </div>
      <div className="summary-item">
        <span className="label">Active Now</span>
        <span className={`value ${quiz.monitoring.activeAttempts > 0 ? 'active' : ''}`}>
          {quiz.monitoring.activeAttempts}
        </span>
      </div>
      <div className="summary-item">
        <span className="label">Avg Risk</span>
        <span className={`value ${getRiskClass(quiz.monitoring.avgRiskScore)}`}>
          {quiz.monitoring.avgRiskScore}
        </span>
      </div>
    </div>
  </div>
);
```

---

## 🔧 Advanced Features

### 1. Quiz History Navigation

```javascript
const QuizHistory = () => {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addToHistory = (quizData) => {
    setHistory(prev => [...prev.slice(0, currentIndex + 1), quizData]);
    setCurrentIndex(prev => prev + 1);
  };

  const navigateBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
  };

  const navigateForward = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
  };

  return (
    <div className="quiz-history">
      <button onClick={navigateBack} disabled={currentIndex <= 0}>
        ← Back
      </button>
      <span>
        {currentIndex + 1} / {history.length}
      </span>
      <button onClick={navigateForward} disabled={currentIndex >= history.length - 1}>
        Forward →
      </button>
    </div>
  );
};
```

### 2. Quiz Bookmarking

```javascript
const QuizBookmarks = () => {
  const [bookmarks, setBookmarks] = useState([]);

  const addBookmark = (quiz) => {
    setBookmarks(prev => {
      if (!prev.find(b => b.id === quiz._id)) {
        return [...prev, {
          id: quiz._id,
          title: quiz.title,
          subject: quiz.subject?.name,
          addedAt: new Date()
        }];
      }
      return prev;
    });
  };

  const removeBookmark = (quizId) => {
    setBookmarks(prev => prev.filter(b => b.id !== quizId));
  };

  return (
    <div className="quiz-bookmarks">
      <h3>Bookmarked Quizzes</h3>
      {bookmarks.map(bookmark => (
        <div key={bookmark.id} className="bookmark-item">
          <span>{bookmark.title}</span>
          <button onClick={() => removeBookmark(bookmark.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
};
```

### 3. Quiz Comparison View

```javascript
const QuizComparison = ({ quizIds }) => {
  const [comparisonData, setComparisonData] = useState(null);

  useEffect(() => {
    loadComparison();
  }, [quizIds]);

  const loadComparison = async () => {
    const response = await fetch('/api/monitoring/compare', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quizIds })
    });
    const data = await response.json();
    setComparisonData(data.data);
  };

  return (
    <div className="quiz-comparison">
      {comparisonData && (
        <ComparisonTable data={comparisonData.comparison} />
      )}
    </div>
  );
};
```

---

## 🎯 Best Practices

### 1. Performance Optimization
- Debounce search inputs (300ms delay)
- Cache quiz lists locally
- Use pagination for large quiz lists
- Lazy load monitoring data only when needed

### 2. User Experience
- Show loading states during API calls
- Provide clear visual feedback for selected quiz
- Enable keyboard navigation (arrow keys)
- Maintain scroll position when switching

### 3. Error Handling
- Handle network failures gracefully
- Show retry options for failed loads
- Cache previously loaded data for offline use
- Provide clear error messages

### 4. Accessibility
- Use semantic HTML elements
- Support keyboard navigation
- Provide ARIA labels
- Ensure color contrast ratios

---

## 🚀 Implementation Checklist

### Backend ✅
- [x] Get available quizzes endpoint
- [x] Get subjects for filtering endpoint
- [x] Switch to quiz endpoint
- [x] Get quiz categories endpoint
- [x] Advanced search endpoint
- [x] All files syntax-validated

### Frontend (Required)
- [ ] Quiz selector component
- [ ] Subject filter dropdown
- [ ] Search functionality
- [ ] Quiz card with monitoring preview
- [ ] Quick switcher component
- [ ] Quiz history navigation
- [ ] Bookmarking functionality

### Documentation ✅
- [x] API documentation
- [x] Implementation examples
- [x] Use case scenarios
- [x] Best practices guide

---

## 📚 Additional Resources

- **Full Monitoring Guide**: `ADMIN_TRAINER_MONITORING_GUIDE.md`
- **Batch Monitoring**: `BATCH_MONITORING_GUIDE.md`
- **API Reference**: `ANTI_CHEAT_API_DOCUMENTATION.md`
- **Quick Reference**: `API_QUICK_REFERENCE.md`

The quiz selection and switching system is now fully implemented and ready for frontend integration! Admins and trainers can easily switch between monitoring different quizzes with intuitive filtering and search capabilities. 🎉
