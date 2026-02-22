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
├── features/                 # Feature modules (lazy-loadable)
│   ├── admin/                # Rules administration module
│   │   ├── models/
│   │   │   └── rule.model.ts       # Rule interface & constants
│   │   ├── pages/
│   │   │   └── rules-manager/      # CRUD UI for eligibility rules
│   │   └── services/
│   │       └── rules-api.service.ts # API client for rules CRUD
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
│       └── services/
│           ├── claude-ai.service.ts           # Claude AI integration
│           ├── dynamic-validation-engine.service.ts # API-based validation
│           ├── eligibility-api.service.ts     # Backend eligibility API
│           ├── loan-validation.service.ts     # Local validation rules
│           ├── pool-logic-chat.service.ts     # Main chat orchestrator
│           └── pooling-api.service.ts         # Backend pooling API
│
└── environments/             # Environment configs
    ├── environment.ts        # Development settings
    └── environment.prod.ts   # Production settings

backend/                      # Express.js API server
├── data/
│   └── rules.json            # Rules storage file
├── package.json              # Node dependencies
└── server.js                 # REST API implementation
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
| PREFIX-001 | Pool | mbsPoolPrefix in [FG, FH, FN] |

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

### Eligibility API (Planned)

```
POST /api/eligibility/evaluate
Body: { loans: LoanRecord[] }
Returns: { eligibleLoans, ineligibleLoans, summary }
```

### Pooling API (Planned)

```
POST /api/pooling/build
Body: { requestId, targetCoupon }
Returns: { poolType, notionalAmount, status, invalidLoans }
```

---

## Configuration

### Environment Variables

```typescript
// environment.ts (development)
export const environment = {
  production: false,
  claude: {
    apiKey: '',                    // Set for live mode
    proxyUrl: '/api/claude',       // Backend proxy endpoint
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    enabled: false                 // Demo mode by default
  },
  rulesApiUrl: 'http://localhost:3001/api'
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

1. **Wire DynamicValidationEngine** into main chat service for runtime rule management
2. **Build backend APIs** for `/api/eligibility/evaluate` and `/api/pooling/build`
3. **Add rule versioning** and audit trail in admin portal
4. **Implement bulk operations** in rules manager
5. **Add user authentication** for admin portal
