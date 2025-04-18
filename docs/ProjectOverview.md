# CareerAI: Project Overview Document

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Features Inventory](#features-inventory)
4. [Folder Structure](#folder-structure)
5. [Database Schema](#database-schema)
6. [API Routes](#api-routes)
7. [Dependencies](#dependencies)
8. [Known Issues & Bottlenecks](#known-issues--bottlenecks)
9. [Security Checklist](#security-checklist)
10. [Future Improvements](#future-improvements)

## Introduction

CareerAI is an advanced career tools platform powered by artificial intelligence that helps users optimize their professional profiles. The platform offers resume analysis, cover letter generation, and LinkedIn profile optimization with personalized feedback and recommendations.

The application uses a React frontend with Tailwind CSS for styling and an Express.js backend. It integrates with the OpenAI API for AI-powered analysis and recommendations. User data is stored in a PostgreSQL database accessed through Drizzle ORM.

## Architecture Overview

```
┌─────────────────┐      ┌───────────────┐      ┌──────────────────┐
│                 │      │               │      │                  │
│  React Frontend │◄────►│ Express.js API│◄────►│ PostgreSQL (Neon)│
│  (Vite)         │      │               │      │                  │
│                 │      │               │      │                  │
└─────────────────┘      └───────┬───────┘      └──────────────────┘
                                 │
                                 ▼
                         ┌───────────────┐      ┌──────────────────┐
                         │               │      │                  │
                         │  OpenAI API   │      │  Supabase Auth   │
                         │               │      │                  │
                         └───────────────┘      └──────────────────┘
```

- **Frontend**: React with Tailwind CSS, using shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL (Neon Serverless)
- **Authentication**: Supabase Authentication
- **AI Integration**: OpenAI API (GPT-3.5 & GPT-4)
- **File Processing**: Multiple PDF parsing libraries for resilience

## Features Inventory

### 1. Resume Analysis

**Description**: AI-powered analysis of resumes to provide scores, feedback, and improvement suggestions.

**Components**:
- `server/services/openai.ts`: Centralized OpenAI API integration with error handling
- `server/services/resume-analyzer.ts`: Unified resume analysis with preprocessing and caching
- `server/services/pdf-parser.ts`: Enhanced PDF parsing with fallback mechanisms
- `server/routes.ts`: API endpoints for resume analysis
- `client/src/pages/resume-analyzer.tsx`: Frontend page for resume analysis

**API Routes**:
- `POST /api/resume-analyze`: Submit resume for analysis (accepts text or PDF)
- `GET /api/resume-analysis/:id`: Retrieve a specific analysis
- `GET /api/user/analyses`: List all analyses for the current user

**Flow Types**:
- **Without Job**: Simple resume analysis with general feedback
- **With Job**: Tailored resume analysis comparing against a job description

**Key Functions**:
- `analyzeResume()`: Unified resume analysis with optional job description matching
- `withExponentialBackoff()`: OpenAI API request with retry logic and exponential backoff
- `parsePdf()`: Enhanced PDF parsing with multiple fallbacks
- `preprocessText()`: Optimizes large resumes by chunking and summarizing 
- `storage.saveResumeAnalysis()`: Data persistence with Zod schema validation

### 2. Cover Letter Generation

**Description**: Creates tailored cover letters based on resume data and job information.

**Components**:
- `server/routes.ts`: Contains `generateCoverLetterContent()` function
- `client/src/pages/cover-letter-generator.tsx`: Frontend interface

**API Routes**:
- `POST /api/generate-cover-letter`: Generate cover letter in multiple formats

**Key Functions**:
- `generateCoverLetterContent()`: Creates cover letters in different formats (standard, email, video script, LinkedIn)

### 3. LinkedIn Profile Optimizer

**Description**: Analyzes LinkedIn profile sections and provides recommendations for improvement.

**Components**:
- `server/routes.ts`: Contains `analyzeLinkedInContent()` function
- `client/src/pages/linkedin-optimizer.tsx`: Frontend interface

**API Routes**:
- `POST /api/analyze-linkedin-content`: Analyze LinkedIn profile sections

**Key Functions**:
- `analyzeLinkedInContent()`: Analyzes LinkedIn sections and returns improvement suggestions

### 4. Authentication System

**Description**: Passwordless authentication via Supabase.

**Components**:
- `client/src/hooks/use-auth.tsx`: Authentication hook
- `client/src/lib/supabase.ts`: Supabase client configuration
- `server/storage.ts`: User storage and session management

**API Routes**:
- `GET /api/config`: Returns Supabase configuration for the frontend
- User authentication handled client-side through Supabase

## Folder Structure

### Client-side (`client/`)

```
client/src/
├── components/       # UI components
│   ├── ui/           # shadcn component library
│   └── resume/       # Resume-specific components
├── hooks/            # React hooks
│   ├── use-auth.tsx  # Authentication hook
│   ├── use-mobile.tsx # Mobile detection
│   └── use-toast.ts  # Toast notifications
├── lib/              # Utility libraries
│   ├── queryClient.ts # API request handling
│   ├── supabase.ts   # Supabase client
│   └── utils.ts      # Helper functions
├── pages/            # Page components
│   ├── auth.tsx      # Authentication page
│   ├── resume-analyzer.tsx # Resume analysis page
│   ├── cover-letter-generator.tsx # Cover letter page
│   └── linkedin-optimizer.tsx # LinkedIn optimization page
├── App.tsx           # Main application component
└── main.tsx          # Application entry point
```

### Server-side (`server/`)

```
server/
├── services/         # Service modules
│   ├── openai.ts     # Centralized OpenAI API integration with error handling
│   ├── pdf-parser.ts # Enhanced PDF parsing with fallback mechanisms
│   ├── resume-analyzer.ts # Unified resume analysis service
│   └── job-description.ts # Job description parsing
├── db.ts             # Database connection
├── index.ts          # Server entry point
├── routes.ts         # API route definitions
├── storage.ts        # Data storage interface with Zod validation
└── vite.ts           # Vite server configuration
```

### Shared (`shared/`)

```
shared/
└── schema.ts         # Database and validation schemas
```

## Database Schema

The application uses Drizzle ORM with the following tables:

### Users Table

```typescript
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Resume Analyses Table

```typescript
export const resumeAnalyses = pgTable("resume_analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  jobDescription: jsonb("job_description").default(null),
  score: integer("score").notNull(),
  scores: jsonb("scores").notNull(),
  resumeSections: jsonb("resume_sections").notNull(),
  identifiedSkills: text("identified_skills").array(),
  primaryKeywords: text("primary_keywords").array(),
  suggestedImprovements: text("suggested_improvements").array(),
  generalFeedback: text("general_feedback"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

## API Routes

The following API routes are implemented in the application:

### Resume Analysis
- `POST /api/resume-analyze`: Submit a resume for analysis
- `GET /api/resume-analysis/:id`: Get a specific analysis by ID
- `GET /api/user/analyses`: Get all analyses for the current user

### Cover Letter Generation
- `POST /api/generate-cover-letter`: Generate a cover letter based on job details and optional resume data

### LinkedIn Profile Optimization
- `POST /api/analyze-linkedin-content`: Analyze LinkedIn profile sections

### Authentication & Configuration
- `GET /api/config`: Get Supabase configuration for client-side authentication
- `GET /api/ping`: Simple endpoint to verify API is running

## Dependencies

### Frontend Dependencies

- **UI Framework**: React
- **Styling**: Tailwind CSS, shadcn/ui components
- **Routing**: wouter
- **State Management**: @tanstack/react-query
- **Form Handling**: react-hook-form
- **Validation**: zod
- **Authentication**: Supabase

### Backend Dependencies

- **Server**: Express.js
- **Database ORM**: Drizzle ORM
- **Database Client**: @neondatabase/serverless
- **AI Integration**: OpenAI API
- **PDF Processing**:
  - pdf-parse
  - pdf.js-extract
  - pdfjs-dist
  - pdf-lib
- **Authentication**: express-session, passport

### Potential Redundancies

The application uses multiple PDF parsing libraries for resilience, which creates some redundancy but improves reliability:

1. **pdf-parse**: Primary parser (simplest)
2. **pdf.js-extract**: Secondary parser (more complex but more robust)
3. **pdfjs-dist**: Used as a fallback
4. **pdf-lib**: Used for specific PDF manipulation tasks

## Known Issues & Bottlenecks

1. **Performance Bottlenecks**:
   - Large resume processing (>12,000 chars) can cause timeouts
   - OpenAI API calls can be slow during peak times

2. **Scalability Concerns**:
   - Current implementation uses a single-threaded approach
   - Large concurrent requests could overwhelm the server

3. **"Add Job Description" Functionality**:
   - The job description parsing can be unreliable
   - The comparison algorithm needs refinement

4. **Technical Debt**:
   - Multiple PDF parsing libraries create maintenance overhead
   - Some hardcoded timeout values 
   - ✓ Improved error handling approaches across services with centralized OpenAI service
   - ✓ Added proper schema validation for database operations
   - ✓ Enhanced type safety with Zod throughout the application flow

## Security Checklist

### Environment Variables

| Variable | Type | Exposure | Purpose |
|----------|------|----------|---------|
| DATABASE_URL | Secret | Server-only | PostgreSQL connection string |
| OPENAI_API_KEY | Secret | Server-only | OpenAI API authentication |
| SUPABASE_URL | Public | Client & Server | Supabase instance URL |
| SUPABASE_ANON_KEY | Public | Client & Server | Supabase anonymous key |
| VITE_SUPABASE_URL | Public | Client-only | Supabase URL for client |
| VITE_SUPABASE_ANON_KEY | Public | Client-only | Supabase anon key for client |
| SESSION_SECRET | Secret | Server-only | Express session encryption |

### Authentication

- **Method**: Passwordless email authentication via Supabase
- **Session Management**: Express sessions with PostgreSQL session store
- **Security Measures**:
  - HTTPS-only cookies
  - CSRF protection

### Input Validation

- **Forms**: Validated with Zod schemas
- **File Uploads**: Restricted to PDF and TXT files with size limits (15MB)
- **API Inputs**: Validated with Zod schemas

### Data Security

- **Resume Content**: Stored in database, transmitted over HTTPS
- **User Data**: Email addresses stored with Supabase authentication
- **Analysis Results**: Stored in PostgreSQL database

### Security Vulnerabilities to Address

1. **Client-Side Security**:
   - [ ] Implement proper CSRF protection
   - [ ] Add rate limiting for authentication attempts
   - [ ] Add Content Security Policy headers

2. **Server-Side Security**:
   - [ ] Add API rate limiting
   - [ ] Implement proper request validation middleware
   - [ ] Add security headers (Helmet.js)

3. **Data Security**:
   - [ ] Add data encryption for sensitive resume content
   - [ ] Implement proper data retention policies
   - [ ] Add audit logging for sensitive operations

## Future Improvements

1. **Performance Optimization**:
   - Implement caching for common analysis patterns
   - Add worker threads for parallel processing
   - Optimize PDF parsing for large documents

2. **Feature Enhancements**:
   - Improve job matching algorithm
   - Add resume formatting suggestions
   - Implement revision history for analyses

3. **Technical Improvements**:
   - Consolidate PDF parsing libraries
   - Implement comprehensive error tracking
   - Add end-to-end testing

4. **User Experience**:
   - Add guided onboarding flow
   - Implement progress tracking for improvement suggestions
   - Add dashboard with analytics

5. **Security Enhancements**:
   - Implement proper role-based access control
   - Add data encryption at rest
   - Enhance authentication with MFA options