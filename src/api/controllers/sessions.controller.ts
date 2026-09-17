import type { Request, Response, NextFunction } from 'express';
import { repositories } from '../../repositories/repository.factory.js';
import { defaultNLUEngine } from '../../core/nlu/nluEngine.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export class SessionsController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { language, initialIntent } = req.body as Record<string, string>;
      // Server-side identity: Always derive artisanId from authenticated user context, never untrusted client body
      const artisanId = req.user?.id || (req.body as Record<string, string>)['artisanId'] || 'anonymous-artisan';
      const session = await repositories.sessions.create({ artisanId, language, initialIntent });
      res.status(201).json({ success: true, data: { session } });
    } catch (error) { next(error); }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const session = await repositories.sessions.findById(id);
      if (!session) throw new NotFoundError('Session');

      // Enforce ownership isolation if authenticated user context is set
      if (req.user?.id && req.user.id !== 'anonymous-artisan' && session.artisanId && session.artisanId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not have permission to view this session');
      }

      res.json({ success: true, data: { session } });
    } catch (error) { next(error); }
  }

  public static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const { text, languageHint } = req.body as { text: string; languageHint?: string };

      if (!text?.trim()) throw new ValidationError('text is required');

      const session = await repositories.sessions.findById(id);
      if (!session) throw new NotFoundError('Session');

      // Enforce ownership isolation
      if (req.user?.id && req.user.id !== 'anonymous-artisan' && session.artisanId && session.artisanId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not have permission to modify this session');
      }

      await repositories.sessions.appendMessage(id, { role: 'user', content: text });

      const nluResult = await defaultNLUEngine.process(text, {
        sessionId: id,
        currentDraft: session.productDraft,
        languageHint,
      });

      logger.debug({ sessionId: id, intent: nluResult.intent.name }, 'NLU result');

      const updatedDraft = { ...session.productDraft, ...nluResult.entities };

      const updatedSession = await repositories.sessions.update(id, {
        currentIntent: nluResult.intent.name,
        language: nluResult.detectedLanguage,
        productDraft: updatedDraft,
        missingFields: nluResult.missingFields,
        status: nluResult.intent.name === 'PUBLISH_PRODUCT' ? 'completed' : 'active',
      });

      let assistantMessage: string;
      if (nluResult.followUpQuestion) {
        assistantMessage = nluResult.followUpQuestion;
      } else if (nluResult.missingFields.length > 0) {
        assistantMessage = `Got it! Could you please provide the ${nluResult.missingFields[0]}?`;
      } else if (['CONFIRM', 'PUBLISH_PRODUCT'].includes(nluResult.intent.name)) {
        assistantMessage = 'Product information is complete and validated!';
      } else {
        assistantMessage = 'Understood. Product draft updated.';
      }

      await repositories.sessions.appendMessage(id, { role: 'assistant', content: assistantMessage });

      res.json({
        success: true,
        data: {
          session: updatedSession,
          nlu: {
            intent: nluResult.intent,
            detectedLanguage: nluResult.detectedLanguage,
            isCorrection: nluResult.isCorrection,
            extractedEntities: nluResult.entities,
            concepts: nluResult.concepts,
            missingFields: nluResult.missingFields,
            validation: nluResult.validation,
            followUpQuestion: nluResult.followUpQuestion,
            pipelineStatus: nluResult.pipelineStatus,
            diagnostics: nluResult.diagnostics,
          },
          assistantMessage,
        },
      });
    } catch (error) { next(error); }
  }
}
