import { env } from './env.js';

export const config = {
  app: {
    name: 'Multilingual Conversational NLU Engine',
    version: '0.1.0',
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
  },
  logging: {
    level: env.LOG_LEVEL,
  },
  database: {
    type: env.DATABASE_TYPE,
    url: env.DATABASE_URL,
  },
  providers: {
    llm: {
      provider: env.LLM_PROVIDER,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
    },
    stt: {
      provider: env.STT_PROVIDER,
      apiKey: env.STT_API_KEY,
    },
  },
  api: {
    prefix: '/api/v1',
  },
} as const;

export type AppConfig = typeof config;
