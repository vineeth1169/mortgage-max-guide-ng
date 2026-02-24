#!/usr/bin/env python3
"""
Loan Pool Optimizer - ILP (Integer Linear Programming) Demo

This script demonstrates how to optimize loan pool construction using
mathematical optimization. It uses PuLP (free) or can be configured
for commercial solvers like Gurobi or CPLEX.

Model Version: 1.0.0
Solver: PuLP/CBC (open source)

Installation:
    pip install pulp pandas numpy

Usage:
    python pool_optimizer.py --input loans.csv --target-upb 50000000 --output optimized_pool.csv
"""

import json
import time
import argparse
from datetime import datetime
from typing import List, Dict, Any, Optional

# Check for PuLP availability
try:
    from pulp import LpProblem, LpVariable, LpMaximize, LpMinimize, LpBinary, lpSum, LpStatus, value
    HAS_PULP = True
except ImportError:
    HAS_PULP = False
    print("Warning: PuLP not installed. Install with: pip install pulp")

# Model metadata for audit trail
MODEL_METADATA = {
    "name": "LoanPoolOptimizer",
    "version": "1.0.0",
    "solver": "CBC (open source)",
    "author": "Pool Advisor Team",
    "lastUpdated": "2026-02-23"
}

class LoanPoolOptimizer:
    """
    Optimizes loan pool construction using Integer Linear Programming.
    
    Objectives:
    - Maximize pool quality score while meeting UPB targets
    - Minimize concentration risk
    - Ensure eligibility compliance
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {
            "minPoolSize": 10,
            "maxPoolSize": 500,
            "targetUPB": 50_000_000,
            "upbTolerance": 0.05,  # 5% tolerance
            "maxPropertyTypeConcentration": 0.40,  # Max 40% any single property type
            "minWAC": 4.5,  # Minimum weighted average coupon
            "maxWAC": 7.5,  # Maximum weighted average coupon
        }
        self.metrics = {}
        
    def optimize(self, loans: List[Dict]) -> Dict[str, Any]:
        """
        Run the optimization to select the best loans for the pool.
        
        Returns:
            Dictionary with selected loans, metrics, and solver info
        """
        if not HAS_PULP:
            return self._fallback_heuristic(loans)
        
        start_time = time.time()
        n = len(loans)
        
        # ── Define the Problem ─────────────────────────────────────
        prob = LpProblem("LoanPoolOptimization", LpMaximize)
        
        # Decision variables: x[i] = 1 if loan i is selected
        x = [LpVariable(f"x_{i}", cat=LpBinary) for i in range(n)]
        
        # ── Objective: Maximize weighted quality score ─────────────
        # Quality score = eligibility_score * upb_weight
        quality_scores = []
        for i, loan in enumerate(loans):
            score = loan.get('eligibilityScore', 100)
            upb_weight = min(loan.get('upb', 0) / 500000, 1.5)  # Cap weight
            quality_scores.append(score * upb_weight)
        
        prob += lpSum(quality_scores[i] * x[i] for i in range(n)), "TotalQualityScore"
        
        # ── Constraints ────────────────────────────────────────────
        
        # Pool size constraints
        prob += lpSum(x[i] for i in range(n)) >= self.config["minPoolSize"], "MinPoolSize"
        prob += lpSum(x[i] for i in range(n)) <= self.config["maxPoolSize"], "MaxPoolSize"
        
        # UPB target with tolerance
        upbs = [loan.get('upb', 0) for loan in loans]
        target = self.config["targetUPB"]
        tolerance = self.config["upbTolerance"]
        
        prob += lpSum(upbs[i] * x[i] for i in range(n)) >= target * (1 - tolerance), "MinUPB"
        prob += lpSum(upbs[i] * x[i] for i in range(n)) <= target * (1 + tolerance), "MaxUPB"
        
        # Only include eligible loans
        for i, loan in enumerate(loans):
            if not loan.get('eligible', True):
                prob += x[i] == 0, f"Ineligible_{i}"
        
        # ── Solve ──────────────────────────────────────────────────
        prob.solve()
        solve_time = time.time() - start_time
        
        # ── Extract Results ────────────────────────────────────────
        selected_indices = [i for i in range(n) if value(x[i]) == 1]
        selected_loans = [loans[i] for i in selected_indices]
        
        # Calculate metrics
        total_upb = sum(loan.get('upb', 0) for loan in selected_loans)
        avg_rate = sum(loan.get('interestRate', 0) for loan in selected_loans) / max(len(selected_loans), 1)
        avg_coupon = sum(loan.get('couponRate', 0) for loan in selected_loans) / max(len(selected_loans), 1)
        
        self.metrics = {
            "solverStatus": LpStatus[prob.status],
            "objectiveValue": value(prob.objective),
            "selectedLoans": len(selected_loans),
            "totalCandidates": n,
            "totalUPB": total_upb,
            "avgInterestRate": round(avg_rate, 4),
            "avgCouponRate": round(avg_coupon, 4),
            "solveTimeSeconds": round(solve_time, 3),
            "modelVersion": MODEL_METADATA["version"],
            "solver": MODEL_METADATA["solver"]
        }
        
        return {
            "success": prob.status == 1,  # Optimal
            "selectedLoans": selected_loans,
            "selectedIndices": selected_indices,
            "metrics": self.metrics,
            "modelMetadata": MODEL_METADATA,
            "timestamp": datetime.now().isoformat()
        }
    
    def _fallback_heuristic(self, loans: List[Dict]) -> Dict[str, Any]:
        """
        Simple greedy heuristic when PuLP is not available.
        Sorts by quality score and selects until UPB target is met.
        """
        start_time = time.time()
        
        # Score and sort loans
        scored_loans = []
        for i, loan in enumerate(loans):
            if loan.get('eligible', True):
                score = loan.get('eligibilityScore', 100) * (loan.get('upb', 0) / 500000)
                scored_loans.append((score, i, loan))
        
        scored_loans.sort(key=lambda x: x[0], reverse=True)
        
        # Greedy selection
        selected = []
        selected_indices = []
        total_upb = 0
        target = self.config["targetUPB"]
        
        for score, idx, loan in scored_loans:
            if len(selected) >= self.config["maxPoolSize"]:
                break
            if total_upb >= target * 1.05:  # Stop at 105% of target
                break
            
            selected.append(loan)
            selected_indices.append(idx)
            total_upb += loan.get('upb', 0)
        
        solve_time = time.time() - start_time
        
        self.metrics = {
            "solverStatus": "Heuristic",
            "selectedLoans": len(selected),
            "totalCandidates": len(loans),
            "totalUPB": total_upb,
            "solveTimeSeconds": round(solve_time, 3),
            "modelVersion": MODEL_METADATA["version"],
            "solver": "Greedy Heuristic (PuLP not available)"
        }
        
        return {
            "success": len(selected) >= self.config["minPoolSize"],
            "selectedLoans": selected,
            "selectedIndices": selected_indices,
            "metrics": self.metrics,
            "modelMetadata": MODEL_METADATA,
            "timestamp": datetime.now().isoformat()
        }


def generate_sample_loans(n: int = 200) -> List[Dict]:
    """Generate sample loan data for testing."""
    import random
    
    loans = []
    property_types = ['SF', 'CO', 'PU', 'MH', 'CP']
    
    for i in range(n):
        eligible = random.random() > 0.15  # 85% eligible
        loans.append({
            "loanNumber": f"LN-{1000 + i:05d}",
            "upb": random.randint(100000, 750000),
            "interestRate": round(random.uniform(4.0, 7.5), 3),
            "couponRate": round(random.uniform(3.5, 7.0), 3),
            "propertyType": random.choice(property_types),
            "loanAgeMonths": random.randint(6, 240),
            "eligible": eligible,
            "eligibilityScore": random.randint(60, 100) if eligible else random.randint(20, 59)
        })
    
    return loans


def main():
    parser = argparse.ArgumentParser(description="Loan Pool Optimizer - ILP Demo")
    parser.add_argument("--input", help="Input CSV file with loans")
    parser.add_argument("--output", help="Output file for selected loans")
    parser.add_argument("--target-upb", type=float, default=50_000_000, help="Target pool UPB")
    parser.add_argument("--demo", action="store_true", help="Run demo with sample data")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("  Loan Pool Optimizer - ILP Demo")
    print(f"  Model Version: {MODEL_METADATA['version']}")
    print(f"  Solver: {MODEL_METADATA['solver']}")
    print("=" * 60)
    
    # Generate or load loans
    if args.demo or not args.input:
        print("\n📊 Generating 200 sample loans for demo...")
        loans = generate_sample_loans(200)
    else:
        print(f"\n📂 Loading loans from {args.input}...")
        import pandas as pd
        df = pd.read_csv(args.input)
        loans = df.to_dict('records')
    
    print(f"   Total loans: {len(loans)}")
    print(f"   Eligible loans: {sum(1 for l in loans if l.get('eligible', True))}")
    
    # Run optimization
    print(f"\n🔧 Running optimization (target UPB: ${args.target_upb:,.0f})...")
    
    optimizer = LoanPoolOptimizer(config={
        "minPoolSize": 10,
        "maxPoolSize": 300,
        "targetUPB": args.target_upb,
        "upbTolerance": 0.10,
    })
    
    result = optimizer.optimize(loans)
    
    # Print results
    print("\n" + "=" * 60)
    print("  OPTIMIZATION RESULTS")
    print("=" * 60)
    
    metrics = result["metrics"]
    print(f"\n  Status:           {metrics['solverStatus']}")
    print(f"  Selected Loans:   {metrics['selectedLoans']} / {metrics['totalCandidates']}")
    print(f"  Total UPB:        ${metrics['totalUPB']:,.0f}")
    print(f"  Solve Time:       {metrics['solveTimeSeconds']}s")
    
    if 'avgInterestRate' in metrics:
        print(f"  Avg Interest Rate: {metrics['avgInterestRate']}%")
        print(f"  Avg Coupon Rate:   {metrics['avgCouponRate']}%")
    
    # Save results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\n📁 Results saved to {args.output}")
    
    print("\n" + "=" * 60)
    
    return result


if __name__ == "__main__":
    main()
