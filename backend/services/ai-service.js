/**
 * AI Service - Backend AI Integration
 * 
 * All AI interactions go through this service.
 * This ensures business logic, rule details, and decision-making
 * are NEVER exposed to the frontend.
 */

const fs = require('fs');
const path = require('path');

// Load rules from file for AI context
const DATA_FILE = path.join(__dirname, '..', 'data', 'rules.json');

function loadRules() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data).rules || [];
  } catch (error) {
    console.error('Error loading rules:', error);
    return [];
  }
}

// Build the system prompt with full rule details (ONLY visible to backend)
function buildSystemPrompt() {
  const rules = loadRules();
  
  const rulesTable = rules
    .filter(r => r.enabled)
    .map(r => `| ${r.id} | ${r.name} | ${r.requirement} | ${r.severity} |`)
    .join('\n');

  return `You are Loan Pool Advisor, an AI assistant specialized in MortgageMax mortgage loan validation and pool construction.

You have DIRECT ACCESS to the user's loan data. When the user asks questions about their loans, you MUST analyze the provided loan data and give specific, accurate answers with exact numbers and loan references.

## Your Capabilities
1. **Validate loans** against MortgageMax Single-Family Seller/Servicer Guide eligibility rules
2. **Build compliant pools** from eligible loans
3. **Filter loans** by criteria (rate, UPB, property type, age, status, etc.)
4. **Explain rules** and eligibility requirements
5. **Answer questions** about MortgageMax guidelines

## Current Active Eligibility Rules
| Rule ID | Name | Requirement | Severity |
|---------|------|-------------|----------|
${rulesTable}

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "intent": {
    "action": "<one of: validate, build-pool, filter, show-rules, explain-rule, summary, show-ineligible, download-ineligible, help, load-sample, general, data-query>",
    "parameters": { /* optional parameters like ruleId, filterCriteria */ },
    "confidence": <0.0 to 1.0>
  },
  "message": "<Your conversational response to the user in markdown format>",
  "reasoning": "<Brief explanation of why you chose this intent>"
}

## Intent Mapping
- User wants to check/validate/verify loans → action: "validate"
- User wants to build/construct/create a pool → action: "build-pool"  
- User wants to filter/find/search loans → action: "filter" (include filter object in parameters.filter)
- User asks about rules/eligibility requirements → action: "show-rules"
- User asks to explain a specific rule → action: "explain-rule" (include ruleId in parameters)
- User asks for summary/metrics → action: "summary"
- User asks about failed/ineligible loans → action: "show-ineligible"
- User wants to download/export ineligible loans → action: "download-ineligible"
- User asks for help/commands → action: "help"
- User wants sample/demo data → action: "load-sample"
- User asks a specific data question → action: "data-query" (provide COMPLETE answer in message)
- General questions about loans/guidelines → action: "general"

## Filter Parameter Schema
When action is "filter", include parameters.filter with applicable fields:
{
  "minCouponRate": number,
  "maxCouponRate": number,
  "minInterestRate": number,  
  "maxInterestRate": number,
  "minUPB": number,
  "maxUPB": number,
  "minLoanAge": number,
  "maxLoanAge": number,
  "loanStatusCode": "A" | "C" | "D",
  "propertyTypes": ["SF", "CO", "CP", "PU", "MH", "2-4"],
  "mbsPoolPrefix": "FG" | "FH" | "FN",
  "poolNumber": string,
  "specialCategories": string[]
}

## Response Formatting
- ALWAYS use markdown tables when displaying loan data, comparisons, or lists
- Tables should have clear headers and proper alignment
- For data queries with multiple loans, present results in a table
- Include relevant columns based on the query context

## Guidelines
- Be concise but thorough
- Reference specific rule IDs when discussing eligibility
- If unsure, ask clarifying questions
- When loan data is provided, ALWAYS analyze it to answer questions accurately
- For data queries, include specific loan numbers and values in your response
- ALWAYS format multi-row data as tables for readability`;
}

// Build welcome message prompt
function buildWelcomePrompt() {
  return `Generate a welcoming message for a new user session of Loan Pool Advisor. 

The message should:
1. Welcome them warmly
2. Briefly explain what the Loan Pool Advisor does (validates mortgage loans against MortgageMax guidelines, helps build compliant pools)
3. Guide them on how to get started (upload a loan file or type "load sample" for demo data)
4. Mention they can type "help" for available commands
5. Keep it friendly but professional
6. Use markdown formatting with headers and bullet points

Respond ONLY with the welcome message content (no JSON wrapper needed for this request).`;
}

/**
 * Call the Groq API (primary AI provider)
 */
async function callGroqAPI(messages, apiKey, model = 'llama-3.3-70b-versatile') {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 2048,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Parse AI response that should be JSON
 */
function parseAIResponse(text) {
  try {
    // Strip markdown code block markers
    let cleanedText = text
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '');
    
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: {
          action: parsed.intent?.action || 'general',
          parameters: parsed.intent?.parameters,
          confidence: parsed.intent?.confidence || 0.8,
        },
        message: parsed.message || text,
        reasoning: parsed.reasoning,
      };
    }
  } catch {
    // JSON parsing failed
  }

  return {
    intent: { action: 'general', confidence: 0.5 },
    message: text,
  };
}

/**
 * Process a chat message through AI
 */
async function processChat(userMessage, context, conversationHistory, apiKey) {
  const systemPrompt = buildSystemPrompt();
  
  // Build context message with loan data
  let contextMsg = '';
  if (context) {
    const parts = [];
    if (context.loanCount !== undefined) {
      parts.push(`${context.loanCount} loans loaded`);
    }
    if (context.hasValidationResults && context.eligibleCount !== undefined) {
      parts.push(`${context.eligibleCount} eligible, ${context.ineligibleCount} ineligible`);
    }
    if (context.stats) {
      parts.push(`Avg Rate: ${context.stats.avgInterestRate?.toFixed(2)}%`);
      parts.push(`Total UPB: $${context.stats.totalUPB?.toLocaleString()}`);
      if (context.stats.propertyTypes?.length) {
        parts.push(`Property Types: ${context.stats.propertyTypes.join(', ')}`);
      }
    }
    if (parts.length > 0) {
      contextMsg = `\n\n[Context: ${parts.join('; ')}]`;
    }
    if (context.allLoans && context.allLoans.length > 0) {
      contextMsg += `\n\n[LOAN DATA - Analyze this to answer questions accurately]\n`;
      contextMsg += JSON.stringify(context.allLoans, null, 0);
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage + contextMsg },
  ];

  const responseText = await callGroqAPI(messages, apiKey);
  return parseAIResponse(responseText);
}

/**
 * Generate AI welcome message
 */
async function generateWelcomeMessage(apiKey) {
  const messages = [
    { role: 'system', content: 'You are Loan Pool Advisor, a helpful AI assistant for mortgage loan validation.' },
    { role: 'user', content: buildWelcomePrompt() },
  ];

  const responseText = await callGroqAPI(messages, apiKey);
  return responseText;
}

/**
 * Validate loans against rules (all logic on backend)
 */
function validateLoans(loans) {
  const rules = loadRules().filter(r => r.enabled);
  const results = [];

  for (const loan of loans) {
    const violations = [];

    for (const rule of rules) {
      const violation = evaluateRule(loan, rule);
      if (violation) {
        violations.push(violation);
      }
    }

    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;
    const score = Math.max(0, 100 - (errorCount * 15) - (warningCount * 5));

    results.push({
      loanNumber: loan.loanNumber,
      poolNumber: loan.poolNumber,
      eligible: errorCount === 0,
      violations,
      score,
    });
  }

  return results;
}

/**
 * Evaluate a single rule against a loan
 */
function evaluateRule(loan, rule) {
  const fieldValue = getFieldValue(loan, rule.field);

  // Skip if field doesn't exist
  if (fieldValue === undefined || fieldValue === null) {
    if (rule.operator === 'required') {
      return createViolation(rule, loan, fieldValue, 'Missing required field');
    }
    return null;
  }

  let isValid = true;
  let actualValue = String(fieldValue);
  let expectedValue = '';

  switch (rule.operator) {
    case 'gt':
      isValid = Number(fieldValue) > Number(rule.value);
      expectedValue = `> ${rule.value}`;
      break;

    case 'gte':
      if (rule.compareField) {
        const compareValue = getFieldValue(loan, rule.compareField);
        isValid = Number(fieldValue) >= Number(compareValue);
        expectedValue = `≥ ${rule.compareField} (${compareValue})`;
      } else {
        isValid = Number(fieldValue) >= Number(rule.value);
        expectedValue = `≥ ${rule.value}`;
      }
      break;

    case 'lte':
      if (rule.compareField) {
        const compareValue = getFieldValue(loan, rule.compareField);
        isValid = Number(fieldValue) <= Number(compareValue);
        expectedValue = `≤ ${rule.compareField} (${compareValue})`;
      } else {
        isValid = Number(fieldValue) <= Number(rule.value);
        expectedValue = `≤ ${rule.value}`;
      }
      break;

    case 'lt':
      isValid = Number(fieldValue) < Number(rule.value);
      expectedValue = `< ${rule.value}`;
      break;

    case 'eq':
      isValid = String(fieldValue) === String(rule.value);
      expectedValue = `= ${rule.value}`;
      break;

    case 'neq':
      isValid = String(fieldValue) !== String(rule.value);
      expectedValue = `≠ ${rule.value}`;
      break;

    case 'in':
      isValid = rule.values?.includes(String(fieldValue)) ?? false;
      expectedValue = `one of [${rule.values?.join(', ')}]`;
      break;

    case 'not_in':
      isValid = !(rule.values?.includes(String(fieldValue)) ?? false);
      expectedValue = `not in [${rule.values?.join(', ')}]`;
      break;

    case 'range':
      const numVal = Number(fieldValue);
      const minOk = rule.minInclusive
        ? numVal >= Number(rule.minValue)
        : numVal > Number(rule.minValue);
      const maxOk = rule.maxInclusive
        ? numVal <= Number(rule.maxValue)
        : numVal < Number(rule.maxValue);
      isValid = minOk && maxOk;
      expectedValue = `${rule.minValue} – ${rule.maxValue}`;
      break;

    case 'range_field':
      const val = Number(fieldValue);
      const minFieldOk = val >= Number(rule.minValue ?? 0);
      if (rule.compareField) {
        const maxFieldVal = getFieldValue(loan, rule.compareField);
        isValid = minFieldOk && val <= Number(maxFieldVal);
        expectedValue = `${rule.minValue ?? 0} – ${rule.compareField} (${maxFieldVal})`;
      } else {
        isValid = minFieldOk;
        expectedValue = `≥ ${rule.minValue ?? 0}`;
      }
      break;

    case 'required':
      isValid = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      expectedValue = 'required';
      break;

    case 'not_empty':
      isValid = fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '';
      expectedValue = 'not empty';
      break;

    default:
      return null;
  }

  if (!isValid) {
    return createViolation(rule, loan, actualValue, expectedValue);
  }

  return null;
}

function getFieldValue(loan, fieldName) {
  const aliases = {
    'investorBalance': 'currentInvestorBalance',
    'balance': 'upb',
    'rate': 'interestRate',
    'coupon': 'couponRate',
    'age': 'loanAgeMonths',
    'status': 'loanStatusCode',
    'property': 'propertyType',
    'prefix': 'mbsPoolPrefix',
  };

  const normalizedField = aliases[fieldName] || fieldName;
  return loan[normalizedField];
}

function createViolation(rule, loan, actualValue, expectedValue) {
  return {
    rule: {
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      description: rule.description,
      guideReference: rule.guideReference,
    },
    actualValue: String(actualValue ?? 'N/A'),
    expectedValue: String(expectedValue),
    severity: rule.severity,
    explanation: rule.explanation || '',
    recommendedAction: rule.remediation || '',
  };
}

/**
 * Build pool summary from validation results
 */
function buildPoolSummary(results, loans) {
  const eligible = results.filter(r => r.eligible);
  const ineligible = results.filter(r => !r.eligible && r.violations.some(v => v.severity === 'error'));
  const warnings = results.filter(r => r.eligible && r.violations.some(v => v.severity === 'warning'));

  const loanMap = new Map(loans.map(l => [l.loanNumber, l]));
  const totalUPB = loans.reduce((sum, l) => sum + (l.upb || 0), 0);
  const eligibleLoans = eligible.map(r => loanMap.get(r.loanNumber)).filter(Boolean);
  const eligibleUPB = eligibleLoans.reduce((sum, l) => sum + (l.upb || 0), 0);

  const weightedAvgRate = eligibleUPB > 0
    ? eligibleLoans.reduce((sum, l) => sum + (l.interestRate || 0) * (l.upb || 0), 0) / eligibleUPB
    : 0;
  const weightedAvgCoupon = eligibleUPB > 0
    ? eligibleLoans.reduce((sum, l) => sum + (l.couponRate || 0) * (l.upb || 0), 0) / eligibleUPB
    : 0;
  const weightedAvgAge = eligibleUPB > 0
    ? eligibleLoans.reduce((sum, l) => sum + (l.loanAgeMonths || 0) * (l.upb || 0), 0) / eligibleUPB
    : 0;

  // Top violations
  const violationCounts = new Map();
  results.forEach(r => {
    r.violations.forEach(v => {
      const count = violationCounts.get(v.rule.ruleName) || 0;
      violationCounts.set(v.rule.ruleName, count + 1);
    });
  });
  const topViolations = Array.from(violationCounts.entries())
    .map(([ruleName, count]) => ({ ruleName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Rule failure summary
  const ruleFailures = Array.from(violationCounts.entries())
    .map(([ruleName, count]) => {
      const rule = results.flatMap(r => r.violations).find(v => v.rule.ruleName === ruleName);
      return {
        ruleId: rule?.rule.ruleId || '',
        ruleName,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    totalLoans: loans.length,
    eligibleLoans: eligible.length,
    ineligibleLoans: ineligible.length,
    warningLoans: warnings.length,
    totalUPB: Math.round(totalUPB * 100) / 100,
    eligibleUPB: Math.round(eligibleUPB * 100) / 100,
    weightedAvgRate: Math.round(weightedAvgRate * 1000) / 1000,
    weightedAvgCoupon: Math.round(weightedAvgCoupon * 1000) / 1000,
    weightedAvgAge: Math.round(weightedAvgAge * 10) / 10,
    topViolations,
    ruleFailures,
  };
}

/**
 * Filter loans based on criteria
 */
function filterLoans(loans, filter) {
  return loans.filter(loan => {
    if (filter.minCouponRate != null && loan.couponRate < filter.minCouponRate) return false;
    if (filter.maxCouponRate != null && loan.couponRate > filter.maxCouponRate) return false;
    if (filter.minInterestRate != null && loan.interestRate < filter.minInterestRate) return false;
    if (filter.maxInterestRate != null && loan.interestRate > filter.maxInterestRate) return false;
    if (filter.minUPB != null && loan.upb < filter.minUPB) return false;
    if (filter.maxUPB != null && loan.upb > filter.maxUPB) return false;
    if (filter.minLoanAge != null && loan.loanAgeMonths < filter.minLoanAge) return false;
    if (filter.maxLoanAge != null && loan.loanAgeMonths > filter.maxLoanAge) return false;
    if (filter.loanStatusCode && loan.loanStatusCode !== filter.loanStatusCode) return false;
    if (filter.propertyTypes?.length && !filter.propertyTypes.includes(loan.propertyType)) return false;
    if (filter.mbsPoolPrefix && loan.mbsPoolPrefix !== filter.mbsPoolPrefix) return false;
    if (filter.poolNumber && loan.poolNumber !== filter.poolNumber) return false;
    if (filter.specialCategories?.length && !filter.specialCategories.includes(loan.specialCategory)) return false;
    return true;
  });
}

/**
 * Generate AI response for validation results
 */
async function generateValidationResponse(results, summary, apiKey) {
  const eligible = results.filter(r => r.eligible);
  const ineligible = results.filter(r => !r.eligible);

  const prompt = `Generate a professional validation summary response for the following results:

Total Loans: ${summary.totalLoans}
Eligible: ${summary.eligibleLoans} (${Math.round(summary.eligibleLoans / summary.totalLoans * 100)}%)
Ineligible: ${summary.ineligibleLoans} (${Math.round(summary.ineligibleLoans / summary.totalLoans * 100)}%)
Total UPB: $${summary.totalUPB.toLocaleString()}
Eligible UPB: $${summary.eligibleUPB.toLocaleString()}
WA Interest Rate: ${summary.weightedAvgRate}%
WA Coupon Rate: ${summary.weightedAvgCoupon}%
WA Loan Age: ${summary.weightedAvgAge} months

Top Rule Violations:
${summary.topViolations.map(v => `- ${v.ruleName}: ${v.count} occurrences`).join('\n')}

Ineligible Loan Details:
${ineligible.slice(0, 10).map(r => `- Loan ${r.loanNumber}: ${r.violations.filter(v => v.severity === 'error').map(v => v.rule.ruleName).join(', ')}`).join('\n')}
${ineligible.length > 10 ? `... and ${ineligible.length - 10} more` : ''}

Format the response with:
1. A summary section with key metrics in a table
2. If there are ineligible loans, show them in a table with loan numbers and failed rules
3. Show top rule violations summary
4. Suggest next steps (build pool, show ineligible details)

Use markdown formatting. Be professional and concise.`;

  const messages = [
    { role: 'system', content: 'You are Loan Pool Advisor generating a validation report.' },
    { role: 'user', content: prompt },
  ];

  return await callGroqAPI(messages, apiKey);
}

/**
 * Generate AI response for pool building
 */
async function generatePoolBuildResponse(eligibleLoans, ineligibleLoans, summary, apiKey) {
  const prompt = `Generate a professional pool construction summary:

Pool Status: ${ineligibleLoans.length === 0 ? 'CREATED' : 'PARTIAL'}
Eligible Loans: ${eligibleLoans.length}
Excluded Loans: ${ineligibleLoans.length}
Pool Notional Amount: $${summary.eligibleUPB.toLocaleString()}
WA Coupon: ${summary.weightedAvgCoupon}%
WA Note Rate: ${summary.weightedAvgRate}%

Format with:
1. Pool creation status (success/partial with counts)
2. Key pool characteristics in a table
3. If there are excluded loans, list reasons
4. Next steps recommendations

Use markdown. Be professional.`;

  const messages = [
    { role: 'system', content: 'You are Loan Pool Advisor generating a pool construction report.' },
    { role: 'user', content: prompt },
  ];

  return await callGroqAPI(messages, apiKey);
}

module.exports = {
  processChat,
  generateWelcomeMessage,
  validateLoans,
  buildPoolSummary,
  filterLoans,
  generateValidationResponse,
  generatePoolBuildResponse,
  loadRules,
};
