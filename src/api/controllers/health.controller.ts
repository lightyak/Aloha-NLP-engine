import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { repositories } from '../../repositories/repository.factory.js';

export class HealthController {
  public static async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbHealthy = await repositories.isHealthy();

      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          app: {
            name: config.app.name,
            version: config.app.version,
            environment: config.app.env,
          },
          database: {
            type: repositories.databaseType,
            connected: dbHealthy,
          },
          providers: {
            llm: config.providers.llm.provider,
            stt: config.providers.stt.provider,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
