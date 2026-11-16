// Runtime configuration (env). Owned by the lead.
export const config = {
  port: Number(process.env.PORT || 4100),
  dbPath: process.env.DB_PATH || '.data/tingyu.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  isProd: process.env.NODE_ENV === 'production',
  devSmsCode: '123456',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  payTimeoutMinutes: 15,
};
