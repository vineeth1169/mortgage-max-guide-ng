# Loan Pool Advisor
## Intelligent Mortgage Loan Validation & Pool Construction Assistant

---

## What Is Loan Pool Advisor?

**Loan Pool Advisor** is an intelligent assistant designed for mortgage servicers who deliver loans to MortgageMax. It automates the process of validating loan data against MortgageMax's Seller/Servicer Guide requirements and helps construct compliant loan pools for MBS (Mortgage-Backed Securities) delivery.

Think of it as having an expert analyst who instantly reviews your loan files, identifies problems, explains why they're problems, and tells you exactly how to fix them—available 24/7 through a simple chat interface.

---

## Who Is This For?

| Role | How They Benefit |
|------|------------------|
| **Operations Analysts** | Upload loan files and get instant eligibility feedback before submission |
| **Pool Administrators** | Quickly filter and analyze loans by various criteria |
| **Quality Control Teams** | Identify and understand rule violations with clear explanations |
| **Servicer Managers** | Monitor pool composition and weighted average metrics |
| **Training & Onboarding** | Learn MortgageMax rules through interactive explanations |

---

## Key Capabilities

### 1. **Loan File Upload & Parsing**

Upload your loan data in CSV or JSON format. The system automatically:
- Parses and validates the file structure
- Identifies all loan records
- Shows a preview table of the data
- Flags any missing required fields

**Required Fields:**
- `loanNumber` — Unique loan identifier
- `interestRate` — Current note rate
- `currentInvestorBalance` — Current investor balance
- `propertyType` — Property classification (SF, CO, CP, PU, MH, 2-4)
- `upb` — Unpaid Principal Balance

**Additional Fields Recognized:**
- `poolNumber`, `mbsPoolPrefix`, `couponRate`, `netYield`, `loanAgeMonths`, `loanStatusCode`, `rateTypeCode`, `specialCategory`

---

### 2. **Automated Eligibility Validation**

Run a complete eligibility check against **11 MortgageMax rules** based on the Seller/Servicer Guide:

| Rule ID | Rule Name | What It Checks |
|---------|-----------|----------------|
| RATE-001 | Positive Interest Rate | Rate must be >0% and ≤12% |
| RATE-002 | Coupon Rate Consistency | Coupon ≤ Interest Rate |
| RATE-003 | Net Yield Consistency | Net Yield ≥ 0 and ≤ Coupon |
| BAL-001 | Positive UPB | UPB must be > $0 |
| BAL-002 | Investor Balance vs UPB | Investor Balance ≤ UPB |
| BAL-003 | Conforming Loan Limit | UPB ≤ $766,550 (2025 limit) |
| PROP-001 | Eligible Property Types | SF, CO, CP, PU, MH, or 2-4 |
| AGE-001 | Maximum Loan Age | ≤ 360 months (30 years) |
| STATUS-001 | Active Loan Status | Status code A or C |
| RTYPE-001 | Eligible Rate Type | FRM or ARM only |
| POOL-001 | Pool Number Required | Must have pool assigned |

**For every failed rule, you receive:**
- ❌ **What failed** — The actual value vs. expected value
- 📖 **Guide Reference** — Section of the Seller/Servicer Guide
- 💡 **Explanation** — Plain-English description of the issue
- ✅ **Recommended Action** — Exactly what to do to fix it

---

### 3. **Pool Construction**

Automatically construct a pool using only eligible loans:
- Excludes all loans with rule violations
- Calculates pool-level metrics:
  - Total UPB
  - Weighted Average Interest Rate
  - Weighted Average Coupon Rate
  - Weighted Average Loan Age
- Provides a summary ready for delivery consideration

---

### 4. **Advanced Loan Filtering**

Search and filter loans using natural language queries:

| Filter Type | Example Queries |
|-------------|-----------------|
| **Coupon Rate** | "filter coupon above 4.5" or "show loans with coupon between 3 and 5" |
| **Interest Rate** | "filter rate below 6%" |
| **UPB Range** | "filter upb above $500,000" or "show loans with balance between $200,000 and $400,000" |
| **Loan Age** | "filter age below 24 months" or "loans older than 60 months" |
| **Property Type** | "filter property type SF" or "show all condo loans" |
| **Loan Status** | "filter status A" or "show active loans" |
| **MBS Prefix** | "filter prefix MX" |
| **Special Category** | "filter special category HFA" |

**Combine multiple criteria:**
> "filter coupon above 4, property type SF, status A"

---

### 5. **Rule Explanations**

Get detailed explanations of any eligibility rule:
- Type `explain rule RATE-001` to understand the Positive Interest Rate rule
- Learn the business rationale and Guide references
- Perfect for training new team members

---

### 6. **Intelligent Q&A**

Ask natural language questions:
- "How many loans are loaded?"
- "What are the property type requirements?"
- "What causes a loan to be ineligible?"
- "Tell me about UPB limits"

---

### 7. **Multi-Session Management**

Work on multiple loan files simultaneously:
- Create new sessions with the **+** button
- Switch between sessions using tabs
- Rename sessions by double-clicking
- Delete sessions with the **×** button
- Each session maintains its own:
  - Chat history
  - Uploaded loan data
  - Validation results
  - Pool summary

Sessions persist even if you refresh the page.

---

## Sample Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. UPLOAD                                                       │
│     Drag & drop your loan CSV/JSON file                         │
│     → System parses and previews the data                       │
├─────────────────────────────────────────────────────────────────┤
│  2. VALIDATE                                                     │
│     Type "validate" or click the suggestion                     │
│     → System checks all loans against 11 eligibility rules      │
│     → See which loans passed/failed and why                     │
├─────────────────────────────────────────────────────────────────┤
│  3. REVIEW FAILURES                                              │
│     Type "show ineligible" for detailed failure report          │
│     → Each failure shows explanation + recommended fix          │
├─────────────────────────────────────────────────────────────────┤
│  4. FILTER (Optional)                                            │
│     "filter coupon above 4" to narrow down loans                │
│     → Work with subsets of your data                            │
├─────────────────────────────────────────────────────────────────┤
│  5. BUILD POOL                                                   │
│     Type "build pool" to construct with eligible loans only     │
│     → Get pool metrics: UPB, WA Rate, WA Coupon, WA Age         │
│     → Ready for delivery consideration                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Available Commands Reference

| Command | Description |
|---------|-------------|
| **Upload a file** | Drag & drop or click to upload CSV/JSON |
| **"load sample"** | Load demo data to try the system |
| **"validate"** | Run eligibility checks on all loaded loans |
| **"build pool"** | Construct a pool with eligible loans |
| **"show ineligible"** | View detailed failure reasons |
| **"show rules"** | Display all 11 eligibility rules |
| **"explain rule [ID]"** | Get detailed explanation of a rule |
| **"summary"** | Show current pool summary metrics |
| **"show sample"** | Preview loaded loan data |
| **"filter"** + criteria | Filter loans by various criteria |
| **"help"** | Show command reference |

---

## Data Security & Privacy

- ✅ **No data modification** — The system only analyzes; it never changes your loan data
- ✅ **Backend-only processing** — All validation and AI logic executes on the server
- ✅ **In-memory only** — Loan data is processed in-memory and never persisted to disk
- ✅ **No PII extraction** — System doesn’t parse or store personal identifiers
- ✅ **Audit logging** — All operations are logged for compliance

---

## Technical Architecture (For IT Teams)

| Component | Technology |
|-----------|------------|
| **Frontend Framework** | Angular 19.1 (Standalone Components, Signals) |
| **UI Styling** | Tailwind CSS 3.4 with MortgageMax brand colors |
| **State Management** | Angular Signals (reactive, fine-grained updates) |
| **Backend** | Express.js (Node.js 20+) — all business logic |
| **AI Provider** | Groq LLaMA 3.3 70B (primary) / Claude (secondary) |
| **File Parsing** | CSV/XLSX/TSV parsers (papaparse + xlsx) |
| **Session Storage** | Browser sessionStorage for chat persistence |
| **Containerization** | Docker with health checks |

**API Endpoints (Fully Implemented):**
- `POST /api/chat/message` — AI-powered chat with intent classification
- `POST /api/eligibility/evaluate` — Server-side loan validation
- `POST /api/pooling/build` — Pool construction with eligible loans
- `POST /api/loans/filter` — AI-powered loan filtering
- `GET/POST/PUT/DELETE /api/rules` — Full CRUD for eligibility rules
- `GET /api/agent/logs` — Audit trail

---

## Business Value

| Metric | Impact |
|--------|--------|
| **Time Savings** | Validate thousands of loans in seconds vs. manual review |
| **Error Reduction** | Automated rule checking eliminates human oversight |
| **Training Efficiency** | Interactive rule explanations accelerate onboarding |
| **Audit Trail** | Clear documentation of what was checked and why |
| **Pre-Submission Quality** | Catch issues before MortgageMax rejects the pool |

---

## Getting Started

1. **Navigate** to the Loan Pool Advisor tab in the application
2. **Upload** your loan file (CSV or JSON) or type `load sample` for demo data
3. **Type** `validate` to run eligibility checks
4. **Review** the results and address any failures
5. **Type** `build pool` when ready to construct your pool

---

## Support

For questions about:
- **Eligibility rules** → Type `show rules` or `explain rule [ID]`
- **Available commands** → Type `help`
- **MortgageMax Guide** → Reference the Seller/Servicer Guide sections listed in rule explanations

---

*Loan Pool Advisor — Making MortgageMax pool delivery faster, easier, and more accurate.*
