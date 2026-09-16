import type { Request, Response, NextFunction } from 'express';
import { repositories } from '../../repositories/repository.factory.js';
import { defaultCatalogGenerator } from '../../core/catalog/catalogGenerator.js';
import { defaultSchemaRegistry } from '../../schemas/dynamicSchema.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';

export class ProductsController {
  /** Validate a product draft from a session */
  public static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attributes } = req.body as { attributes: Record<string, unknown> };
      if (!attributes || typeof attributes !== 'object') {
        throw new ValidationError('attributes object is required');
      }

      const normalized = defaultSchemaRegistry.normalizeDraft(attributes);
      const validation = defaultSchemaRegistry.validateDraft(normalized);
      const missing = defaultSchemaRegistry.getMissingFields(normalized);

      res.json({
        success: true,
        data: { isValid: validation.isValid, errors: validation.errors, missingFields: missing, normalized },
      });
    } catch (error) { next(error); }
  }

  /** Generate catalog content for a validated session draft */
  public static async generateCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, attributes, language } = req.body as {
        sessionId?: string;
        attributes?: Record<string, unknown>;
        language?: string;
      };

      let productAttrs: Record<string, unknown>;

      if (sessionId) {
        const session = await repositories.sessions.findById(sessionId);
        if (!session) throw new NotFoundError('Session');
        productAttrs = session.productDraft;
      } else if (attributes && typeof attributes === 'object') {
        productAttrs = attributes;
      } else {
        throw new ValidationError('Either sessionId or attributes is required');
      }

      const normalized = defaultSchemaRegistry.normalizeDraft(productAttrs);
      const catalog = await defaultCatalogGenerator.generate(normalized, language || 'en');

      res.json({ success: true, data: { catalog, attributes: normalized } });
    } catch (error) { next(error); }
  }

  /** Save product from session to repository with generated catalog */
  public static async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.body as { sessionId: string };
      if (!sessionId) throw new ValidationError('sessionId is required');

      const session = await repositories.sessions.findById(sessionId);
      if (!session) throw new NotFoundError('Session');

      // Enforce ownership isolation
      if (req.user?.id && req.user.id !== 'anonymous-artisan' && session.artisanId && session.artisanId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not have permission to publish products for this session');
      }

      const normalized = defaultSchemaRegistry.normalizeDraft(session.productDraft);
      const validation = defaultSchemaRegistry.validateDraft(normalized);

      if (!validation.isValid) {
        throw new ValidationError('Product has validation errors and cannot be published', validation.errors);
      }

      const catalog = await defaultCatalogGenerator.generate(normalized, session.language || 'en');

      const product = await repositories.products.create({
        sessionId,
        artisanId: session.artisanId,
        craftType: String(normalized['craft_type'] || ''),
        category: String(normalized['category'] || ''),
        attributes: normalized,
        catalog,
        status: 'published',
      });

      await repositories.sessions.update(sessionId, { status: 'completed' });

      res.status(201).json({ success: true, data: { product } });
    } catch (error) { next(error); }
  }
}
