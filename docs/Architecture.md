# CareerAI: Architecture Document

## Overview

CareerAI is built with a modern stack featuring a React frontend and Express.js backend. This document outlines the architectural design, data flow, and component interaction within the application.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React/Vite)                       │
│                                                                 │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │               │   │               │   │                   │  │
│  │  Resume Tool  │   │ Cover Letter  │   │ LinkedIn Profile  │  │
│  │               │   │  Generator    │   │    Optimizer      │  │
│  └───────┬───────┘   └───────┬───────┘   └─────────┬─────────┘  │
│          │                   │                     │            │
│  ┌───────▼───────────────────▼─────────────────────▼─────────┐  │
│  │                                                           │  │
│  │                   React Query / Hooks                     │  │
│  │                                                           │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               │ HTTP/HTTPS
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                                                           │  │
│  │                     EXPRESS SERVER                        │  │
│  │                                                           │  │
│  └───┬───────────────────┬────────────────────────────┬─────┘  │
│      │                   │                            │        │
│      │                   │                            │        │
│  ┌───▼───────┐     ┌─────▼────────┐           ┌───────▼─────┐  │
│  │           │     │              │           │             │  │
│  │  Storage  │     │   Services   │           │   Session   │  │
│  │  Layer    │     │              │           │   Store     │  │
│  │           │     │              │           │             │  │
│  └───┬───────┘     └──┬─────┬─────┘           └─────────────┘  │
│      │               /       \                                 │
│ ┌────▼─────┐   ┌─────▼┐    ┌─▼──────┐                          │
│ │          │   │      │    │        │                          │
│ │ Database │   │OpenAI│    │PDF     │                          │
│ │  (Neon)  │   │      │    │Parsing │                          │
│ │          │   │      │    │        │                          │
│ └──────────┘   └──────┘    └────────┘                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                          │
                          │
┌─────────────────────────▼─────────────────────────────────────┐
│                                                               │
│                      EXTERNAL SERVICES                         │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │                 │  │                 │  │               │  │
│  │  OpenAI API     │  │  Supabase Auth  │  │  Storage      │  │
│  │  (GPT-3.5/4)    │  │                 │  │  (Files/Media)│  │
│  │                 │  │                 │  │               │  │
│  └─────────────────┘  └─────────────────┘  └───────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Core Components

### Frontend Components

1. **Pages**: Main page components for each feature
   - `resume-analyzer.tsx`: Resume analysis interface
   - `cover-letter-generator.tsx`: Cover letter creation interface
   - `linkedin-optimizer.tsx`: LinkedIn profile optimization interface
   - `auth-page.tsx`: Authentication interfaces

2. **React Query Layer**: Manages API communication and state
   - Implements data fetching, caching, and synchronization
   - Handles loading states and error boundaries
   - Manages optimistic updates

3. **UI Components**: Reusable interface elements
   - Built using shadcn/ui component library
   - Styled with Tailwind CSS

4. **Authentication**: Supabase integration
   - Passwordless email authentication
   - Session management
   - User profile data

### Backend Components

1. **Express Server**: Central API handler
   - Route definitions and handling
   - Request validation
   - Authentication middleware
   - Error handling

2. **Services Layer**: Core business logic
   - `openai.ts`: AI analysis and generation
   - `pdf-parser.ts`: PDF parsing and text extraction
   - `job-description.ts`: Job posting analysis

3. **Storage Layer**: Data persistence
   - Database operations through Drizzle ORM
   - User data management
   - Analysis results storage

4. **Session Store**: Authentication state
   - Secure session management
   - User identity and permissions

## Data Flow

### Resume Analysis Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│ User Upload │────►│ PDF Parsing │────►│ Text Pre-   │────►│ Initial     │
│             │     │             │     │ processing  │     │ Analysis    │
│             │     │             │     │             │     │ (GPT-3.5)   │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────▼──────┐
│             │     │             │     │             │     │             │
│ Store       │◄────│ Create      │◄────│ Enhance     │◄────│ In-depth    │
│ Results     │     │ Response    │     │ Response    │     │ Analysis    │
│             │     │             │     │             │     │ (GPT-4)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Cover Letter Generation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│ Job Details │────►│ Optional    │────►│ AI Prompt   │────►│ Generate    │
│ Input       │     │ Resume Data │     │ Construction│     │ Content     │
│             │     │             │     │             │     │ (GPT-4)     │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                    ┌─────────────┐     ┌─────────────┐     ┌──────▼──────┐
                    │             │     │             │     │             │
                    │ Return      │◄────│ Format      │◄────│ Process     │
                    │ Response    │     │ Response    │     │ Each Format │
                    │             │     │             │     │             │
                    └─────────────┘     └─────────────┘     └─────────────┘
```

### LinkedIn Profile Optimization Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│ Section     │────►│ Construct   │────►│ Generate    │────►│ Parse JSON  │
│ Content     │     │ Analysis    │     │ Analysis    │     │ Response    │
│ Input       │     │ Prompt      │     │ (GPT-4)     │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                                        ┌─────────────┐     ┌──────▼──────┐
                                        │             │     │             │
                                        │ Return      │◄────│ Format      │
                                        │ Response    │     │ Response    │
                                        │             │     │             │
                                        └─────────────┘     └─────────────┘
```

## Key Technical Implementations

### Two-Stage AI Analysis

The resume analysis uses a two-stage approach to balance performance and quality:

1. **Initial Analysis (GPT-3.5)**:
   - Faster, less expensive model
   - Extracts basic resume information
   - Identifies technical skills, keywords, and achievements

2. **In-depth Analysis (GPT-4)**:
   - More sophisticated model with better reasoning
   - Uses output from initial analysis to focus
   - Provides detailed feedback and scoring

### Resilient PDF Parsing

The application implements a multi-layered approach to PDF parsing:

1. **Primary Parser**: Uses `pdf-parse` for initial attempt
2. **Secondary Parser**: Falls back to `pdf.js-extract` if primary fails
3. **Timeout Handling**: Sets appropriate timeouts to prevent hanging
4. **Text Cleaning**: Applies resume-specific text normalization
5. **Error Recovery**: Multiple fallback mechanisms

### Optimized Request Handling

1. **Request Queue**: Manages API request flow to prevent overloading
2. **Caching**: Implements result caching with MD5 hashing
3. **Chunking**: Breaks large documents into manageable pieces
4. **Exponential Backoff**: Smart retry logic for failed requests
5. **Keep-Alive**: Maintains connections for long-running operations

## Database Schema

The database uses a straightforward schema with two main tables connected by a foreign key relationship:

```
┌───────────────────┐       ┌───────────────────────────────┐
│ users             │       │ resume_analyses               │
├───────────────────┤       ├───────────────────────────────┤
│ id (PK)           │       │ id (PK)                       │
│ email             │◄──────┤ userId (FK)                   │
│ emailVerified     │       │ content                       │
│ lastLoginAt       │       │ jobDescription                │
│ createdAt         │       │ score                         │
│ updatedAt         │       │ scores                        │
└───────────────────┘       │ resumeSections                │
                            │ identifiedSkills              │
                            │ primaryKeywords               │
                            │ suggestedImprovements         │
                            │ generalFeedback               │
                            │ createdAt                     │
                            │ updatedAt                     │
                            └───────────────────────────────┘
```

## Authentication Flow

```
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│           │     │           │     │           │     │           │
│ User      │────►│ Supabase  │────►│ Magic     │────►│ User      │
│ Email     │     │ Auth      │     │ Link      │     │ Clicks    │
│ Input     │     │           │     │ Email     │     │ Link      │
└───────────┘     └───────────┘     └───────────┘     └─────┬─────┘
                                                           │
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌─────▼─────┐
│           │     │           │     │           │     │           │
│ User      │◄────│ Server    │◄────│ User      │◄────│ Validate  │
│ Logged In │     │ Session   │     │ Record    │     │ Token     │
│           │     │ Created   │     │ Created   │     │           │
└───────────┘     └───────────┘     └───────────┘     └───────────┘
```

## Performance Optimizations

1. **Text Chunking**: Large resumes are broken into manageable chunks
2. **Model Selection**: Uses GPT-3.5 for initial processing and GPT-4 for detailed analysis
3. **Response Caching**: Implements MD5-based caching for identical content
4. **Timeout Management**: Custom timeout handling for long-running operations
5. **Fallback Mechanisms**: Multiple fallback approaches for robust operation

## Security Considerations

1. **Authentication**: Passwordless email authentication via Supabase
2. **API Security**: Server-side OpenAI API key management
3. **Input Validation**: Zod schema validation for user inputs
4. **File Validation**: MIME type checking and size limits for uploads
5. **Sessions**: Secure cookie-based sessions with PostgreSQL store

## Scalability Considerations

1. **Database Connection Pooling**: Uses connection pooling for database efficiency
2. **Request Queue**: Prevents API request overload
3. **Timeout Handling**: Robust handling of long-running operations
4. **Caching Strategy**: Reduces duplicate processing
5. **Stateless Design**: Facilitates horizontal scaling