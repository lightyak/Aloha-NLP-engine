import { config } from '../config/index.js';
import type { ISessionRepository } from './interfaces/session.repository.interface.js';
import type { IProductRepository } from './interfaces/product.repository.interface.js';
import { InMemorySessionRepository } from './in-memory/inMemorySession.repository.js';
import { InMemoryProductRepository } from './in-memory/inMemoryProduct.repository.js';
import { ConfigurationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface RepositoryRegistry {
  sessions: ISessionRepository;
  products: IProductRepository;
  databaseType: string;
  isHealthy(): Promise<boolean>;
}

class RepositoryFactory {
  private static instance: RepositoryRegistry | null = null;

  public static getRepositories(): RepositoryRegistry {
    if (this.instance) {
      return this.instance;
    }

    const dbType = config.database.type;

    if (dbType === 'memory') {
      logger.info('Initializing in-memory repositories (Development Mode)');
      const sessions = new InMemorySessionRepository();
      const products = new InMemoryProductRepository();

      this.instance = {
        sessions,
        products,
        databaseType: 'in-memory',
        async isHealthy() {
          return true;
        },
      };

      return this.instance;
    }

    if (dbType === 'postgres' || dbType === 'mongodb') {
      if (!config.database.url) {
        throw new ConfigurationError(
          `Database driver configured for '${dbType}' but DATABASE_URL is missing in environment.`
        );
      }
      throw new ConfigurationError(
        `Database adapter for '${dbType}' will be mounted once provider drivers are installed.`
      );
    }

    throw new ConfigurationError(`Unsupported database type: ${dbType}`);
  }

  // Testing reset
  public static reset(): void {
    this.instance = null;
  }
}

export const repositories = RepositoryFactory.getRepositories();
