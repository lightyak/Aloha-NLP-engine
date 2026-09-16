import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { healthRouter } from './health.routes.js';
import { sessionsRouter } from './sessions.routes.js';
import { productsRouter } from './products.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openApiPath = path.resolve(process.cwd(), 'src/openapi.yaml');

let openApiSpec = {};

try {
  const fileContent = fs.readFileSync(openApiPath, 'utf8');
  openApiSpec = YAML.parse(fileContent);
} catch (error) {
  console.error('Failed to load OpenAPI specification:', error);
}

import { authMiddleware } from '../../middleware/auth.middleware.js';

export const apiRouter = Router();

apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
apiRouter.use(healthRouter);
apiRouter.use(authMiddleware);
apiRouter.use('/sessions', sessionsRouter);
apiRouter.use('/products', productsRouter);

