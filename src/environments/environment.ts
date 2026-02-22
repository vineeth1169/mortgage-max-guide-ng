export const environment = {
  production: false,

  // ── AI Provider Configuration ────────────────────────────────────
  // Supports multiple AI providers: Groq (free), Claude (paid), or Demo (offline)
  ai: {
    // Default provider: 'groq' (free), 'claude', or 'demo'
    defaultProvider: 'groq' as const,

    // Groq Configuration (FREE - recommended for development)
    groq: {
      apiKey: '', // Get free key at https://console.groq.com and set here
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

