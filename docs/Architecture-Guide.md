# MortgageMax Application Architecture

## Overview

MortgageMax is an Angular 19 application that provides mortgage loan validation and pool construction assistance. It features a **Loan Pool Advisor** - an AI-powered chat interface that helps users validate loans against MortgageMax guidelines and build compliant pools.

## Folder Structure

```
src/app/
├── app.component.ts          # Root component with header + router outlet
├── app.config.ts             # Application providers (routing, HTTP)
├── app.routes.ts             # Route definitions
│
├── core/                     # Shared/core components used across features
│   └── components/
│       └── header/           # Global navigation header
│
├── features/                 # Feature modules (standalone components)
│   ├── admin/                # Rules administration module
│   │   ├── models/
│   │   │   └── rule.model.ts       # Rule interface & constants
│   │   ├── pages/
│   │   │   └── rules-manager/      # CRUD UI for eligibility rules
│   │   └── services/
│   │       └── rules-api.service.ts # API client for rules CRUD
│   │
│   ├── byol/                 # Bring Your Own Loans feature
│   │   ├── components/
│   │   │   ├── byol-tab/           # Main BYOL tab container
│   │   │   ├── eligibility-results/ # Result display component
│   │   │   ├── file-upload/        # File upload widget
│   │   │   └── preview-table/      # Parsed data preview table
│   │   ├── models/
│   │   │   └── byol.model.ts       # BYOL loan/result types
│   │   └── services/
│   │       ├── csv-exporter.service.ts   # CSV export for ineligible loans
│   │       ├── eligibility.service.ts    # Eligibility evaluation client
│   │       ├── file-parser.service.ts    # CSV/XLSX/TSV file parser
│   │       ├── loan-validator.service.ts # Schema validation
│   │       └── notification.service.ts   # Toast notification system
│   │
│   ├── guide/                # Documentation guide feature
│   │   ├── components/       # Guide UI components
│   │   ├── models/           # Navigation models
│   │   ├── pages/            # Guide page container
│   │   └── services/         # Guide data service
│   │
│   └── pool-assistant/       # AI Loan Pool Advisor feature
│       ├── components/
│       │   └── pool-chat/          # Chat interface component
│       ├── models/
│       │   └── pool-logic.model.ts # Loan, session, message types
│       ├── pages/
│       │   └── pool-assistant-page/ # Page container
│       ├── pool-builder-agent.module.ts # Plugin module for library export
│       └── services/
│           ├── backend-chat.service.ts        # Backend API client (thin)
│           ├── claude-ai.service.ts           # Multi-provider AI integration
│           ├── dynamic-validation-engine.service.ts # API-based validation
│           ├── eligibility-api.service.ts     # Backend eligibility API
│           ├── export.service.ts              # Multi-format export
│           ├── llm-adapter.service.ts         # NLG/NLU adapter
│           ├── loan-validation.service.ts     # Local validation rules
│           ├── pool-logic-chat.service.ts     # Main chat orchestrator
│           └── pooling-api.service.ts         # Backend pooling API
│
└── environments/             # Environment configs
    ├── environment.ts        # Development settings
    └── environment.prod.ts   # Production settings

backend/                      # Express.js API server (ALL business logic)
├── data/
│   ├── rules.json            # Eligibility rules with provenance
│   └── audit-logs.json       # Audit trail
├── services/
│   └── ai-service.js         # AI + rule evaluation engine
├── package.json              # Node dependencies
├── server.js                 # REST API implementation
├── Dockerfile                # Container image definition
└── docker-compose.yml        # Container orchestration
```

---

## AI Integration Architecture

### High-Level Flow

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Pool Chat     │────▶│  PoolLogicChat      │────▶│   ClaudeAI      │
│   Component     │     │  Service            │     │   Service       │
│   (UI Layer)    │     │  (Orchestrator)     │     │   (NLU)         │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
                                │                           │
                                ▼                           │
                        ┌───────────────────┐               │
                        │  LoanValidation   │◀──────────────┘
                        │  Service          │   (Intent routing)
                        │  (Rule Engine)    │
                        └───────────────────┘
```

### Components Explained

#### 1. PoolChatComponent (`pool-chat.component.ts`)
- **Purpose**: Chat UI with message history, file upload, and input controls
- **Responsibilities**:
  - Render chat messages with markdown support
  - Handle file uploads (CSV/JSON)
  - Display validation results and pool summaries
  - Show agent status and progress indicators

#### 2. PoolLogicChatService (`pool-logic-chat.service.ts`)
- **Purpose**: Central orchestrator for the Loan Pool Advisor
- **Responsibilities**:
  - Manage chat sessions (create, switch, delete, persist to localStorage)
  - Route user messages to appropriate handlers
  - Coordinate between AI service and validation service
  - Handle file parsing and loan data management
  - Execute intents (validate, build-pool, filter, etc.)

#### 3. ClaudeAIService (`claude-ai.service.ts`)
- **Purpose**: Natural Language Understanding (NLU) for intent classification
- **Two Operating Modes**:

  **Demo Mode (Default)** - No API calls, no cost:
  ```typescript
  // Uses regex pattern matching + hardcoded response templates
  if (/validate|check.*eligib|verify.*loan/.test(input)) {
    return { action: 'validate', confidence: 0.90 };
  }
  ```
  - Pattern-based intent classification
  - Context-aware response generation
  - 150-350ms simulated delay for realistic UX

  **Live Mode** - Requires Claude API key:
  ```typescript
  // Calls Anthropic API with structured system prompt
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    headers: { 'x-api-key': apiKey },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      system: LOAN_ADVISOR_SYSTEM_PROMPT,
      messages: conversationHistory
    })
  });
  ```
  - True AI intent classification with reasoning
  - Conversational context maintained
  - JSON-formatted responses with confidence scores

#### 4. LoanValidationService (`loan-validation.service.ts`)
- **Purpose**: Rule-based eligibility validation engine
- **Contains**:
  - 11 hardcoded MortgageMax eligibility rules
  - CSV/JSON parsing logic
  - Loan validation against all rules
  - Pool summary calculation (weighted averages, UPB totals)
  - Sample loan generation for demos

#### 5. DynamicValidationEngine (`dynamic-validation-engine.service.ts`)
- **Purpose**: API-driven validation using rules from the admin portal
- **Features**:
  - Fetches rules from Rules API at runtime
  - Evaluates loans against dynamic rule set
  - Supports all operators: gt, gte, lt, lte, eq, neq, in, notin, range, etc.
  - Falls back gracefully if API unavailable

---

## Intent Classification

The AI classifies user input into these intents:

| Intent | Example Inputs | Action |
|--------|---------------|--------|
| `validate` | "validate", "check eligibility", "verify loans" | Run eligibility validation |
| `build-pool` | "build pool", "create pool", "construct pool" | Build compliant pool |
| `filter` | "filter by rate > 5", "find condos", "show SF loans" | Filter loan list |
| `show-rules` | "show rules", "what are the rules" | Display all eligibility rules |
| `explain-rule` | "explain RATE-001", "what is BAL-003" | Explain specific rule |
| `summary` | "summary", "metrics", "how many loans" | Show portfolio summary |
| `show-ineligible` | "show ineligible", "which failed" | Display failed loans |
| `help` | "help", "commands", "what can you do" | Show available commands |
| `load-sample` | "load sample", "demo data" | Load sample loan dataset |
| `general` | Any other input | Generic response |

---

## Validation Rules

The application enforces 11 MortgageMax eligibility rules:

| Rule ID | Category | Requirement |
|---------|----------|-------------|
| RATE-001 | Rate | 0% < interestRate ≤ 12% |
| RATE-002 | Rate | couponRate ≤ interestRate |
| RATE-003 | Rate | 0 ≤ netYield ≤ couponRate |
| BAL-001 | Balance | UPB > 0 |
| BAL-002 | Balance | investorBalance ≤ UPB |
| BAL-003 | Balance | UPB ≤ $766,550 (conforming limit) |
| PROP-001 | Property | propertyType in [SF, CO, CP, PU, MH, 2-4] |
| STATUS-001 | Status | loanStatusCode in [A, C] |
| AGE-001 | Age | loanAgeMonths ≥ 4 |
| POOL-001 | Pool | poolNumber is required |
| PREFIX-001 | Pool | mbsPoolPrefix in [MX, MA, MF] |

---

## Data Flow Example

**User Input**: "validate my loans"

```
1. PoolChatComponent
   └─▶ sendMessage("validate my loans")
       
2. PoolLogicChatService.sendMessage()
   ├─▶ Creates user message, adds to chat
   └─▶ processUserInput()
   
3. ClaudeAIService.classifyIntent()
   ├─▶ [Demo Mode] Pattern match → "validate"
   │   Returns: { action: 'validate', confidence: 0.90 }
   └─▶ [Live Mode] API call → JSON response
   
4. PoolLogicChatService.handleValidation()
   ├─▶ First tries: EligibilityApiService.evaluate()
   │   (Returns error if backend unavailable)
   └─▶ Falls back: LoanValidationService.validateLoans()
       ├─▶ Applies all 11 rules to each loan
       ├─▶ Builds validation results
       └─▶ Generates pool summary
   
5. PoolLogicChatService
   ├─▶ Stores results in session
   ├─▶ Formats markdown response
   └─▶ Appends assistant message to chat
   
6. PoolChatComponent
   └─▶ Renders validation table + summary
```

---

## API Architecture

### Rules API (Express.js Backend)

```
GET    /api/rules         → List all rules
GET    /api/rules/:id     → Get single rule
POST   /api/rules         → Create rule
PUT    /api/rules/:id     → Update rule
DELETE /api/rules/:id     → Delete rule
PATCH  /api/rules/:id/toggle → Enable/disable rule
GET    /api/categories    → List categories
GET    /api/rules/export  → Export all rules
POST   /api/rules/import  → Import rules
GET    /api/health        → Health check
```

### Eligibility API

```
POST /api/eligibility/evaluate
Body: { loans: LoanRecord[] }
Returns: { eligibleLoans, ineligibleLoans, summary }
```

### Pooling API

```
POST /api/pooling/build
Body: { requestId, targetCoupon }
Returns: { poolType, notionalAmount, status, invalidLoans }
```

### Filter API

```
POST /api/loans/filter
Body: { loans: LoanRecord[], filters: FilterCriteria }
Returns: { filteredLoans, appliedFilters }
```

---

## Configuration

### Environment Variables

```typescript
// environment.ts (development)
export const environment = {
  production: false,
  ai: {
    defaultProvider: 'groq',
    groq: {
      apiKey: '',             // Get one at https://console.groq.com
      model: 'llama-3.3-70b-versatile',
      maxTokens: 1024,
    },
    claude: {
      apiKey: '',             // Paid API key
      proxyUrl: '/api/claude',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024,
    },
  },
  rulesApiUrl: 'http://localhost:3001/api',
};
```

### Running the Application

```bash
# Start Rules API backend
cd backend && npm install && node server.js

# Start Angular development server
ng serve

# Access:
# - Main app: http://localhost:4200
# - Pool Advisor: http://localhost:4200/pool-assistant
# - Rules Admin: http://localhost:4200/admin/rules
# - Rules API: http://localhost:3001/api
```

---

## Test Coverage

Spec files are provided for all major services and components:

| File | Tests |
|------|-------|
| `claude-ai.service.spec.ts` | Demo mode classification, mode switching, AI toggle |
| `loan-validation.service.spec.ts` | CSV/JSON parsing, all 11 validation rules |
| `rules-api.service.spec.ts` | CRUD operations, computed properties |
| `dynamic-validation-engine.service.spec.ts` | Rule loading, validation |
| `pool-chat.component.spec.ts` | UI interactions, state management |
| `rules-manager.component.spec.ts` | Modal operations, filtering |

Run tests with:
```bash
ng test
```

---

## Future Enhancements

1. **User authentication** for admin portal and role-based access
2. **Database migration** from file-based JSON to PostgreSQL or MongoDB
3. **Bulk operations** in rules manager (import/export, batch enable/disable)
4. **Lazy loading** routes with `loadComponent()` for production optimization
5. **Shared services** between BYOL and Pool Assistant for parsing/validation
