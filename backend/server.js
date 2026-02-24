/**
 * Loan Pool Advisor - Rules API Server
 * 
 * Simple Express.js backend for managing eligibility rules.
 * Uses file-based JSON storage for easy demo setup.
 * Includes audit logging and rule provenance tracking.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'rules.json');
const AUDIT_LOG_FILE = path.join(__dirname, 'data', 'audit-logs.json');

// ── Middleware ────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// ── Data Access ───────────────────────────────────────────────────

function readRulesData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading rules file:', error);
    return { rules: [], metadata: { version: '1.0.0', lastUpdated: new Date().toISOString(), totalRules: 0 } };
  }
}

function writeRulesData(data) {
  try {
    data.metadata.lastUpdated = new Date().toISOString();
    data.metadata.totalRules = data.rules.length;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing rules file:', error);
    return false;
  }
}

// ── Audit Log Functions ───────────────────────────────────────────

function readAuditLogs() {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      return { logs: [], metadata: { totalEntries: 0, lastUpdated: new Date().toISOString() } };
    }
    const data = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading audit logs:', error);
    return { logs: [], metadata: { totalEntries: 0, lastUpdated: new Date().toISOString() } };
  }
}

function writeAuditLog(logEntry) {
  try {
    const data = readAuditLogs();
    data.logs.push({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...logEntry
    });
    // Keep only last 10000 entries
    if (data.logs.length > 10000) {
      data.logs = data.logs.slice(-10000);
    }
    data.metadata.totalEntries = data.logs.length;
    data.metadata.lastUpdated = new Date().toISOString();
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing audit log:', error);
    return false;
  }
}

// ── API Routes ────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/rules - List all rules
app.get('/api/rules', (req, res) => {
  const data = readRulesData();
  const { category, enabled } = req.query;
  
  let rules = data.rules;
  
  // Filter by category if provided
  if (category) {
    rules = rules.filter(r => r.category === category);
  }
  
  // Filter by enabled status if provided
  if (enabled !== undefined) {
    const isEnabled = enabled === 'true';
    rules = rules.filter(r => r.enabled === isEnabled);
  }
  
  res.json({
    success: true,
    data: rules,
    metadata: data.metadata
  });
});

// GET /api/rules/:id - Get single rule
app.get('/api/rules/:id', (req, res) => {
  const data = readRulesData();
  const rule = data.rules.find(r => r.id === req.params.id);
  
  if (!rule) {
    return res.status(404).json({
      success: false,
      error: `Rule ${req.params.id} not found`
    });
  }
  
  res.json({
    success: true,
    data: rule
  });
});

// POST /api/rules - Create new rule
app.post('/api/rules', (req, res) => {
  const data = readRulesData();
  
  const newRule = {
    id: req.body.id || `CUSTOM-${uuidv4().substring(0, 8).toUpperCase()}`,
    name: req.body.name,
    category: req.body.category || 'custom',
    description: req.body.description,
    requirement: req.body.requirement,
    field: req.body.field,
    operator: req.body.operator,
    value: req.body.value,
    values: req.body.values,
    minValue: req.body.minValue,
    maxValue: req.body.maxValue,
    compareField: req.body.compareField,
    minInclusive: req.body.minInclusive,
    maxInclusive: req.body.maxInclusive,
    severity: req.body.severity || 'error',
    guideReference: req.body.guideReference || '',
    explanation: req.body.explanation || '',
    remediation: req.body.remediation || '',
    enabled: req.body.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Provenance tracking
    provenance: {
      author: req.body.provenance?.author || req.headers['x-user-id'] || 'system',
      authorEmail: req.body.provenance?.authorEmail || req.headers['x-user-email'] || '',
      version: '1.0.0',
      effectiveDate: req.body.provenance?.effectiveDate || new Date().toISOString(),
      expirationDate: req.body.provenance?.expirationDate || null,
      approvedBy: req.body.provenance?.approvedBy || null,
      approvalDate: req.body.provenance?.approvalDate || null,
      changeReason: req.body.provenance?.changeReason || 'Initial creation'
    }
  };
  
  // Check for duplicate ID
  if (data.rules.find(r => r.id === newRule.id)) {
    return res.status(400).json({
      success: false,
      error: `Rule with ID ${newRule.id} already exists`
    });
  }
  
  // Validate required fields
  if (!newRule.name || !newRule.field || !newRule.operator) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, field, operator'
    });
  }
  
  data.rules.push(newRule);
  
  if (writeRulesData(data)) {
    res.status(201).json({
      success: true,
      data: newRule,
      message: 'Rule created successfully'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to save rule'
    });
  }
});

// PUT /api/rules/:id - Update existing rule
app.put('/api/rules/:id', (req, res) => {
  const data = readRulesData();
  const index = data.rules.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: `Rule ${req.params.id} not found`
    });
  }
  
  const existingRule = data.rules[index];
  
  // Increment version
  const currentVersion = existingRule.provenance?.version || '1.0.0';
  const versionParts = currentVersion.split('.').map(Number);
  versionParts[2] = (versionParts[2] || 0) + 1; // Increment patch version
  const newVersion = versionParts.join('.');
  
  const updatedRule = {
    ...existingRule,
    ...req.body,
    id: existingRule.id, // ID cannot be changed
    createdAt: existingRule.createdAt, // Preserve creation date
    updatedAt: new Date().toISOString(),
    provenance: {
      ...existingRule.provenance,
      ...req.body.provenance,
      author: req.body.provenance?.author || req.headers['x-user-id'] || existingRule.provenance?.author || 'system',
      version: newVersion,
      changeReason: req.body.provenance?.changeReason || 'Rule updated'
    }
  };
  
  // Log the change
  writeAuditLog({
    action: 'rule.updated',
    ruleId: existingRule.id,
    ruleName: existingRule.name,
    userId: req.headers['x-user-id'] || 'system',
    previousVersion: currentVersion,
    newVersion: newVersion,
    changes: {
      before: existingRule,
      after: updatedRule
    }
  });
  
  data.rules[index] = updatedRule;
  
  if (writeRulesData(data)) {
    res.json({
      success: true,
      data: updatedRule,
      message: 'Rule updated successfully'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to update rule'
    });
  }
});

// PATCH /api/rules/:id/toggle - Toggle rule enabled status
app.patch('/api/rules/:id/toggle', (req, res) => {
  const data = readRulesData();
  const rule = data.rules.find(r => r.id === req.params.id);
  
  if (!rule) {
    return res.status(404).json({
      success: false,
      error: `Rule ${req.params.id} not found`
    });
  }
  
  rule.enabled = !rule.enabled;
  rule.updatedAt = new Date().toISOString();
  
  if (writeRulesData(data)) {
    res.json({
      success: true,
      data: rule,
      message: `Rule ${rule.enabled ? 'enabled' : 'disabled'}`
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to toggle rule'
    });
  }
});

// DELETE /api/rules/:id - Delete rule
app.delete('/api/rules/:id', (req, res) => {
  const data = readRulesData();
  const index = data.rules.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: `Rule ${req.params.id} not found`
    });
  }
  
  const deletedRule = data.rules.splice(index, 1)[0];
  
  if (writeRulesData(data)) {
    res.json({
      success: true,
      data: deletedRule,
      message: 'Rule deleted successfully'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to delete rule'
    });
  }
});

// GET /api/rules/categories/list - Get all categories
app.get('/api/categories', (req, res) => {
  const data = readRulesData();
  const categories = [...new Set(data.rules.map(r => r.category))];
  
  res.json({
    success: true,
    data: categories.map(cat => ({
      name: cat,
      count: data.rules.filter(r => r.category === cat).length
    }))
  });
});

// GET /api/rules/export - Export all rules (for backup)
app.get('/api/rules/export', (req, res) => {
  const data = readRulesData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=rules-export.json');
  res.json(data);
});

// POST /api/rules/import - Import rules (from backup)
app.post('/api/rules/import', (req, res) => {
  const { rules, replace } = req.body;
  
  if (!Array.isArray(rules)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid import data: rules must be an array'
    });
  }
  
  const data = replace ? { rules: [], metadata: {} } : readRulesData();
  
  let imported = 0;
  let skipped = 0;
  
  for (const rule of rules) {
    if (!data.rules.find(r => r.id === rule.id)) {
      data.rules.push({
        ...rule,
        createdAt: rule.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      imported++;
    } else {
      skipped++;
    }
  }
  
  if (writeRulesData(data)) {
    res.json({
      success: true,
      message: `Imported ${imported} rules, skipped ${skipped} duplicates`,
      data: { imported, skipped, total: data.rules.length }
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to import rules'
    });
  }
});

// ── Audit Logs API ────────────────────────────────────────────────

// POST /api/agent/logs - Create audit log entry
app.post('/api/agent/logs', (req, res) => {
  const logEntry = {
    requestId: req.body.requestId || uuidv4(),
    userId: req.body.userId || req.headers['x-user-id'] || 'anonymous',
    sessionId: req.body.sessionId || req.headers['x-session-id'],
    action: req.body.action,
    ruleVersion: req.body.ruleVersion,
    modelVersion: req.body.modelVersion,
    payload: req.body.payload,
    result: req.body.result,
    metrics: req.body.metrics,
    source: req.body.source || 'pool-advisor-ui'
  };
  
  if (!logEntry.action) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: action'
    });
  }
  
  if (writeAuditLog(logEntry)) {
    res.status(201).json({
      success: true,
      data: { requestId: logEntry.requestId },
      message: 'Audit log created'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to write audit log'
    });
  }
});

// GET /api/agent/logs - Query audit logs
app.get('/api/agent/logs', (req, res) => {
  const data = readAuditLogs();
  const { action, userId, startDate, endDate, limit } = req.query;
  
  let logs = data.logs;
  
  // Filter by action
  if (action) {
    logs = logs.filter(l => l.action === action || l.action?.startsWith(action));
  }
  
  // Filter by userId
  if (userId) {
    logs = logs.filter(l => l.userId === userId);
  }
  
  // Filter by date range
  if (startDate) {
    logs = logs.filter(l => new Date(l.timestamp) >= new Date(startDate));
  }
  if (endDate) {
    logs = logs.filter(l => new Date(l.timestamp) <= new Date(endDate));
  }
  
  // Apply limit (default 100, max 1000)
  const maxLimit = Math.min(parseInt(limit) || 100, 1000);
  logs = logs.slice(-maxLimit).reverse();
  
  res.json({
    success: true,
    data: logs,
    metadata: {
      total: data.logs.length,
      returned: logs.length,
      lastUpdated: data.metadata.lastUpdated
    }
  });
});

// GET /api/agent/logs/:requestId - Get specific log entry
app.get('/api/agent/logs/:requestId', (req, res) => {
  const data = readAuditLogs();
  const log = data.logs.find(l => l.requestId === req.params.requestId || l.id === req.params.requestId);
  
  if (!log) {
    return res.status(404).json({
      success: false,
      error: `Log entry ${req.params.requestId} not found`
    });
  }
  
  res.json({
    success: true,
    data: log
  });
});

// ── Error Handling ────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ── Start Server ──────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       Loan Pool Advisor - Rules API Server               ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🚀 Server running on http://localhost:${PORT}              ║`);
  console.log('║                                                          ║');
  console.log('║  Rules API:                                              ║');
  console.log('║    GET    /api/rules         - List all rules            ║');
  console.log('║    GET    /api/rules/:id     - Get single rule           ║');
  console.log('║    POST   /api/rules         - Create new rule           ║');
  console.log('║    PUT    /api/rules/:id     - Update rule               ║');
  console.log('║    DELETE /api/rules/:id     - Delete rule               ║');
  console.log('║    PATCH  /api/rules/:id/toggle - Toggle enabled         ║');
  console.log('║    GET    /api/categories    - List categories           ║');
  console.log('║    GET    /api/rules/export  - Export rules              ║');
  console.log('║    POST   /api/rules/import  - Import rules              ║');
  console.log('║                                                          ║');
  console.log('║  Audit Logs API:                                         ║');
  console.log('║    POST   /api/agent/logs    - Create audit log          ║');
  console.log('║    GET    /api/agent/logs    - Query audit logs          ║');
  console.log('║    GET    /api/agent/logs/:id - Get specific log         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
});
