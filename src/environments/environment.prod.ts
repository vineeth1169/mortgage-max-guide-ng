export const environment = {
  production: true,

  // ── AI Provider Configuration ────────────────────────────────────
  // API keys are managed ONLY on the backend (.env file).
  // The frontend NEVER stores or transmits API keys.
  ai: {
    defaultProvider: 'groq' as const,

    groq: {
      model: 'llama-3.3-70b-versatile',
      maxTokens: 1024,
    },

    claude: {
      proxyUrl: '/api/claude',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024,
    },
  },

  // ── Rules API Configuration ──────────────────────────────────────
  rulesApiUrl: '/api',
};

