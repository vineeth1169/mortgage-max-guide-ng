export const environment = {
  production: true,

  // ── AI Provider Configuration ────────────────────────────────────
  ai: {
    defaultProvider: 'groq' as const,

    groq: {
      apiKey: '', // Set via backend proxy in production
      model: 'llama-3.3-70b-versatile',
      maxTokens: 1024,
    },

    claude: {
      apiKey: '',
      proxyUrl: '/api/claude',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024,
    },
  },

  // ── Rules API Configuration ──────────────────────────────────────
  rulesApiUrl: '/api',
};

