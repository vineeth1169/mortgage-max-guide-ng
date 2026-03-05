# 🏦 MortgageMax Loan Pool Advisor

> AI-powered loan validation and pool construction assistant for mortgage servicers

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-19.1-red.svg)](https://angular.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Safety & Ethics](#safety--ethics)
- [Enterprise Integration](#enterprise-integration)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Loan Pool Advisor** is an intelligent assistant for mortgage servicers delivering loans to MortgageMax. It automates eligibility validation against the Seller/Servicer Guide and helps construct compliant MBS (Mortgage-Backed Securities) pools.

### What Makes This Different?

Unlike traditional microservices architectures with database-stored rules, this system:

| Traditional Approach | This Approach |
|---------------------|---------------|
| Rules hardcoded in multiple services | Rules in single JSON file, API-editable |
| Requires DB migrations for rule changes | Hot-reload rules without deployment |
| Complex service mesh coordination | Single Angular + Express stack |
| Intent classification via keyword matching | AI-powered natural language understanding |
| Static, pre-defined responses | Dynamic, context-aware AI responses |
| Heavy infrastructure requirements | Lightweight, containerizable, plugin-ready |

See [docs/Agentic-Architecture-Guide.md](docs/Agentic-Architecture-Guide.md) for detailed comparison.

---

## Key Features

### 🤖 AI-Powered Chat Interface
- Natural language loan analysis questions
- Intent classification via Groq (LLaMA 3.3 70B) or Claude
- Context-aware responses using actual loan data
- No hardcoded responses — fully agentic

### ✅ Automated Eligibility Validation
- 12 MortgageMax eligibility rules
- Detailed violation explanations with fix suggestions
- Per-loan eligibility scoring (0-100)
- Guide section references

### 🏗️ Pool Construction
- Automatic pool building with eligible loans only
- Weighted average calculations (rate, coupon, age)
- Pool-level metrics and summaries

### 📊 Advanced Filtering
- Natural language filter queries
- Property type, rates, UPB, age, status filters
- AI-generated filter parameters

### 📥 Multi-Format Export
- CSV, Excel, PDF, JSON exports
- Ineligible loan reports with remediation guidance
- Similar eligible loan suggestions

### � Bring Your Own Loans (BYOL)
- Upload CSV, XLSX, or TSV files for instant eligibility evaluation
- Flexible field-name aliases for easy import
- Preview table with parsed data
- Download ineligible loans report as CSV
- Toast notifications for workflow feedback

### �🔒 Enterprise Safety Features
- API keys managed via environment configuration (never committed)
- Audit logging for all actions
- Rule provenance tracking (author, version, approvals)
- No loan data modification — analysis only

---

## Architecture

> **Security-First Design:** All business logic, rule evaluation, validation, and AI processing runs exclusively on the backend. The frontend is a thin display layer with no access to rule thresholds, validation logic, or decision-making code.

```
┌────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Angular 19 - Display Only)             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Pool Chat Component                             │   │
│  │  • Message rendering  • File upload  • Status indicators    │   │
│  │  • NO business logic  • NO rule data  • NO validation       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Backend Chat Service (HTTP Client)              │   │
│  │  • Thin API client  • No logic  • Passes data to backend    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTPS
┌────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js - All Logic)                 │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   AI Service (Groq LLaMA 3.3 70B)           │    │
│  │  • Intent classification  • Rule evaluation                 │    │
│  │  • Validation logic       • Pool construction               │    │
│  │  • Welcome message generation  • Data analysis              │    │
│  └────────────────────────────────────────────────────────────┘    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐    │
│  │ Chat API       │  │ Eligibility API│  │ Pooling API        │    │
│  │ /chat/welcome  │  │ /eligibility/* │  │ /pooling/build     │    │
│  │ /chat/message  │  │ Batch evaluate │  │ Pool construction  │    │
│  └────────────────┘  └────────────────┘  └────────────────────┘    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐    │
│  │ Rules API      │  │ Audit API      │  │ Filter API         │    │
│  │ CRUD + version │  │ Action logging │  │ /loans/filter      │    │
│  └────────────────┘  └────────────────┘  └────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                            DATA PERSISTENCE                         │
│            rules.json          audit-logs.json                      │
│       (File-based, version-controlled, human-readable)              │
└────────────────────────────────────────────────────────────────────┘
```

### Security Features

| Aspect | Implementation |
|--------|----------------|
| **Rule Thresholds** | Never sent to frontend |
| **Validation Logic** | Backend only |
| **AI System Prompts** | Backend only (contain full rule details) |
| **Welcome Messages** | AI-generated, not hardcoded |
| **Error Handling** | Generic errors, no logic exposure |
| **Bundle Inspection** | No business logic visible |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/vineeth1169/mortgage-max-guide-ng.git
cd mortgage-max-guide-ng

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..
```

### Configuration

Configure your API key in `src/environments/environment.ts`:

```typescript
ai: {
  defaultProvider: 'groq',
  groq: {
    apiKey: 'your-groq-api-key',  // Get one at https://console.groq.com
    model: 'llama-3.3-70b-versatile',
  },
},
```

> **Note:** Never commit API keys. The `environment.ts` file ships with empty keys by default.
> For Docker deployments, pass `GROQ_API_KEY` as an environment variable.

### Running the Application

```bash
# Terminal 1: Start backend server
cd backend && npm start

# Terminal 2: Start Angular dev server
npm start

# Open http://localhost:4200
```

### Docker Deployment

```bash
cd backend
docker-compose up -d
```

---

## Project Structure

```
mortgage-max-guide-ng/
├── src/
│   ├── app/
│   │   ├── core/                     # Shared components
│   │   │   └── components/header/    # Global navigation
│   │   │
│   │   └── features/
│   │       ├── admin/                # Rules admin module
│   │       │   ├── models/rule.model.ts
│   │       │   ├── pages/rules-manager/
│   │       │   └── services/rules-api.service.ts
│   │       │
│   │       ├── guide/                # Documentation guide
│   │       │   ├── components/       # Navigation tree, content
│   │       │   ├── pages/guide-page/
│   │       │   └── services/guide-data.service.ts
│   │       │
│   │       └── pool-assistant/       # AI Loan Advisor (main feature)
│   │           ├── components/pool-chat/
│   │           ├── models/pool-logic.model.ts
│   │           ├── pages/pool-assistant-page/
│   │           ├── pool-builder-agent.module.ts   # Plugin module
│   │           └── services/
│   │               ├── backend-chat.service.ts    # Backend API client (thin)
│   │               ├── claude-ai.service.ts       # AI integration (legacy)
│   │               ├── eligibility-api.service.ts
│   │               ├── export.service.ts
│   │               ├── llm-adapter.service.ts
│   │               ├── pool-logic-chat.service.ts # Main orchestrator
│   │               └── pooling-api.service.ts
│   │
│   └── environments/                 # Environment configs
│
├── backend/                          # Express.js API (ALL business logic)
│   ├── data/
│   │   ├── rules.json               # Eligibility rules (with thresholds)
│   │   └── audit-logs.json          # Audit trail
│   ├── services/
│   │   └── ai-service.js            # AI + rule evaluation (backend-only)
│   ├── server.js                    # API server
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── docs/                            # Documentation
│   ├── Architecture-Guide.md
│   ├── Agentic-Architecture-Guide.md
│   ├── benchmarks.md
│   └── Loan-Pool-Advisor-Overview.md
│
└── scripts/
    └── pool_optimizer.py             # ILP optimizer demo
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ai.groq.apiKey` | Groq API key | `''` (set via env var or config) |
| `ai.claude.apiKey` | Claude API key | `''` |
| `ai.defaultProvider` | `'groq'` or `'claude'` | `'groq'` |
| `rulesApiUrl` | Backend API URL | `'http://localhost:3001/api'` |

### Rule Configuration

Rules are stored in `backend/data/rules.json` with provenance tracking:

```json
{
  "id": "RATE-001",
  "ruleId": "RATE-001",
  "ruleName": "Interest Rate Range",
  "category": "rate",
  "validationType": "range",
  "field": "interestRate",
  "minValue": 0.01,
  "maxValue": 12,
  "enabled": true,
  "provenance": {
    "author": "System Admin",
    "version": 1,
    "effectiveDate": "2025-01-01T00:00:00Z"
  }
}
```

---

## API Reference

### Chat API (AI-Powered)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/welcome` | Get AI-generated welcome message |
| POST | `/api/chat/message` | Send message, get AI response with intent |

### Rules API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | List all rules |
| GET | `/api/rules/summary` | Get rules without thresholds (safe for frontend) |
| POST | `/api/rules` | Create new rule |
| PUT | `/api/rules/:id` | Update rule (increments version) |
| DELETE | `/api/rules/:id` | Delete rule |

### Audit API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/logs` | Get audit logs |
| POST | `/api/agent/logs` | Record audit entry |

### Eligibility API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/eligibility/evaluate` | Validate loans against all rules |
| POST | `/api/pooling/build` | Build pool with eligible loans |
| POST | `/api/loans/filter` | Filter loans by criteria |

---

## Safety & Ethics

### Data Privacy
- **No loan data persistence**: Loans are processed in-memory only
- **No PII extraction**: System doesn't parse or store personal identifiers
- **Backend-only processing**: No business logic in browser bundles

### AI Safety
- **No training on user data**: Uses pre-trained models only
- **No local fallbacks**: Backend required for all operations
- **Audit logging**: All AI interactions are logged
- **Transparent reasoning**: AI provides confidence scores

### Security
- **Rule thresholds never sent to frontend**
- **Validation logic runs only on server**
- **AI system prompts secured on backend**
- **API keys configured via environment**, never committed to source control
- **CORS-protected backend**
- **No shell execution** from user input
- **Input validation** on all endpoints

See [docs/Agentic-Architecture-Guide.md](docs/Agentic-Architecture-Guide.md) for detailed safety analysis.

---

## Enterprise Integration

### Plugin-Ready Architecture

The `PoolBuilderAgentModule` can be imported into any Angular application:

```typescript
import { PoolBuilderAgentModule } from '@pool-advisor/agent';

@NgModule({
  imports: [
    PoolBuilderAgentModule.forRoot({
      rulesApiUrl: 'https://your-rules-api.com',
      aiProvider: 'groq',
      enableAuditLogging: true
    })
  ]
})
export class AppModule {}
```

### Docker Deployment

```bash
docker build -t loan-pool-advisor ./backend
docker run -p 3001:3001 -e GROQ_API_KEY=xxx loan-pool-advisor
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run validation
  run: |
    curl -X POST http://localhost:3001/api/eligibility/evaluate \
      -H "Content-Type: application/json" \
      -d '{"loans": [...]}'
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built with [Angular 19](https://angular.dev)
- AI powered by [Groq](https://groq.com) and [Anthropic Claude](https://anthropic.com)
- Styling with [Tailwind CSS](https://tailwindcss.com)
