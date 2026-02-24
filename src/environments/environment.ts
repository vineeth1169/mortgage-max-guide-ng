export const environment = {
  production: false,

  // ── AI Provider Configuration ────────────────────────────────────
  // Supports multiple AI providers: Groq or Claude
  ai: {
    // Default provider: 'groq' or 'claude'
    defaultProvider: 'groq' as const,

    // Groq Configuration (recommended for development - fast inference)
    groq: {
      apiKey: '', // Set your Groq API key here - get one at https://console.groq.com
      model: 'llama-3.3-70b-versatile',
      maxTokens: 1024,
    },

    // Claude / Anthropic Configuration (PAID)
    claude: {
      apiKey: '', // Paid API key
      proxyUrl: '/api/claude',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024,
    },
  },

  // ── Rules API Configuration ──────────────────────────────────────
  rulesApiUrl: 'http://localhost:3001/api',
};

