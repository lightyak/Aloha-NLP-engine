import { config } from 'dotenv';
import { z } from 'zod';

// Load .env file
config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_TYPE: z.enum(['memory', 'postgres', 'mongodb']).default('memory'),
    DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    LLM_PROVIDER: z.string().optional(),
    LLM_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().optional(),
    STT_PROVIDER: z.string().optional(),
    STT_API_KEY: z.string().optional(),
    STT_MODEL: z.string().optional(),
  })
  .refine(
    (data) => {
      if ((data.DATABASE_TYPE === 'postgres' || data.DATABASE_TYPE === 'mongodb') && !data.DATABASE_URL) {
        return false;
      }
      return true;
    },
    {
      message: 'Missing required environment variable: DATABASE_URL is required when DATABASE_TYPE is set to postgres or mongodb',
      path: ['DATABASE_URL'],
    }
  );

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error(`\n[FATAL] Environment configuration error:\n${formattedErrors}\n`);
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type EnvConfig = z.infer<typeof envSchema>;
