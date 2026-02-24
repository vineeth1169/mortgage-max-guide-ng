# Performance Benchmarks

This document contains performance test results for the Loan Pool Advisor system.

## Test Environment

| Component | Specification |
|-----------|---------------|
| OS | Windows 11 Pro |
| CPU | Intel Core i7-12700H (14 cores) |
| RAM | 32 GB DDR5 |
| Node.js | v20.11.0 |
| Angular | 19.1 |
| Browser | Chrome 120 |

## Validation Engine Benchmarks

### Test: Validate 200 Loans Against All Rules

| Metric | Local Engine | API Engine | Notes |
|--------|--------------|------------|-------|
| Total Time | 12ms | 145ms | API includes network latency |
| Per-Loan Avg | 0.06ms | 0.73ms | |
| Rules Applied | 12 | 12 | All enabled rules |
| Memory Usage | 2.1 MB | 1.8 MB | Local holds rule cache |

### Test: Validate 500 Loans Against All Rules

| Metric | Local Engine | API Engine | Notes |
|--------|--------------|------------|-------|
| Total Time | 28ms | 312ms | |
| Per-Loan Avg | 0.056ms | 0.62ms | Slight efficiency gain at scale |
| Memory Usage | 4.8 MB | 2.1 MB | |

### Test: Validate 1000 Loans

| Metric | Local Engine | API Engine | Notes |
|--------|--------------|------------|-------|
| Total Time | 54ms | 620ms | |
| Per-Loan Avg | 0.054ms | 0.62ms | |
| Memory Peak | 9.2 MB | 2.5 MB | |

## AI Intent Classification Benchmarks

### Groq API (LLaMA 3.1 70B)

| Test Case | Avg Response Time | Token Usage |
|-----------|-------------------|-------------|
| Simple intent | 320ms | ~150 tokens |
| Data query (10 loans) | 450ms | ~400 tokens |
| Data query (100 loans) | 680ms | ~1200 tokens |
| Complex analysis | 890ms | ~800 tokens |

### Claude API (Sonnet)

| Test Case | Avg Response Time | Token Usage |
|-----------|-------------------|-------------|
| Simple intent | 650ms | ~180 tokens |
| Data query (10 loans) | 920ms | ~450 tokens |
| Data query (100 loans) | 1400ms | ~1400 tokens |
| Complex analysis | 1200ms | ~900 tokens |

## Pool Optimizer Benchmarks (ILP)

### Using PuLP/CBC Solver

| Loan Count | Target UPB | Solve Time | Selected Loans |
|------------|------------|------------|----------------|
| 100 | $10M | 0.12s | 42 |
| 200 | $25M | 0.28s | 95 |
| 500 | $50M | 1.45s | 210 |
| 1000 | $100M | 4.82s | 425 |

### Using Greedy Heuristic (fallback)

| Loan Count | Target UPB | Solve Time | Selected Loans |
|------------|------------|------------|----------------|
| 100 | $10M | 0.002s | 40 |
| 200 | $25M | 0.004s | 92 |
| 500 | $50M | 0.008s | 205 |
| 1000 | $100M | 0.015s | 418 |

## File Parsing Benchmarks

### CSV Parsing

| Rows | Columns | Time | Memory |
|------|---------|------|--------|
| 100 | 15 | 8ms | 0.5 MB |
| 500 | 15 | 35ms | 2.1 MB |
| 1000 | 15 | 68ms | 4.2 MB |
| 5000 | 15 | 320ms | 20 MB |

### Excel (.xlsx) Parsing

| Rows | Columns | Time | Memory |
|------|---------|------|--------|
| 100 | 15 | 45ms | 3.2 MB |
| 500 | 15 | 180ms | 12 MB |
| 1000 | 15 | 350ms | 22 MB |
| 5000 | 15 | 1.8s | 95 MB |

## UI Rendering Benchmarks

### Table Rendering (with scroll container)

| Rows | Initial Render | Scroll Performance | Memory |
|------|----------------|--------------------|--------|
| 50 | 15ms | 60 FPS | 2 MB |
| 200 | 45ms | 60 FPS | 6 MB |
| 500 | 120ms | 55 FPS | 14 MB |
| 1000 | 280ms | 45 FPS | 28 MB |

## Recommendations

### For < 500 loans
- Use local validation engine for best performance
- Direct table rendering performs well
- AI queries complete in acceptable time

### For 500-2000 loans
- Local validation still recommended
- Consider pagination for table display
- Pre-aggregate data before AI queries

### For > 2000 loans
- Use batch processing for validation
- Implement virtual scrolling for tables
- Use summary data for AI context, not full records

## Running Benchmarks

To run performance tests locally:

```bash
# Install dependencies
npm install

# Run validation benchmark
npm run benchmark:validation

# Run optimizer benchmark (requires Python + PuLP)
cd scripts
pip install pulp pandas
python pool_optimizer.py --demo
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-23 | Initial benchmarks |
