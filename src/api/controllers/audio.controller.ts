import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { repositories } from '../../repositories/repository.factory.js';
import { defaultSTTProvider } from '../../providers/stt/sttProvider.factory.js';
import { defaultNLUEngine } from '../../core/nlu/nluEngine.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav', 'audio/wave', 'audio/mpeg', 'audio/mp4',
  'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-m4a',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

export const audioUploadMiddleware = upload.single('audio');

export class AudioController {
  public static async processAudio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const languageHint = (req.body as Record<string, string>)['languageHint'];

      if (!req.file) throw new ValidationError('Audio file is required. Send as multipart/form-data field "audio".');

      const session = await repositories.sessions.findById(id);
      if (!session) throw new NotFoundError('Session');

      // Enforce ownership isolation
      if (req.user?.id && req.user.id !== 'anonymous-artisan' && session.artisanId && session.artisanId !== req.user.id) {
        throw new ForbiddenError('Access denied: You do not have permission to upload audio to this session');
      }

      logger.info({ sessionId: id, size: req.file.size, mime: req.file.mimetype }, 'Processing audio upload');

      // 1. STT Transcription
      const transcription = await defaultSTTProvider.transcribe(
        req.file.buffer,
        req.file.mimetype,
        languageHint || session.language
      );

      if (!transcription.text?.trim()) {
        throw new ValidationError('Audio transcription produced no text. Please speak clearly and try again.');
      }

      logger.info({ sessionId: id, text: transcription.text }, 'STT transcription complete');

      // 2. Store transcription as user message
      await repositories.sessions.appendMessage(id, {
        role: 'user',
        content: transcription.text,
        metadata: {
          source: 'audio',
          // confidence only present when genuinely returned by provider
          ...(transcription.confidence !== undefined ? { confidence: transcription.confidence } : {}),
          // detectedLanguage: reported by STT; languageHint: caller-supplied
          ...(transcription.detectedLanguage ? { detectedLanguage: transcription.detectedLanguage } : {}),
          ...(transcription.languageHint ? { languageHint: transcription.languageHint } : {}),
        },
      });

      // 3. Run NLU on transcribed text — prefer STT-detected language, fall back to hint
      const nluLanguageHint = transcription.detectedLanguage ?? transcription.languageHint;
      const nluResult = await defaultNLUEngine.process(transcription.text, {
        sessionId: id,
        currentDraft: session.productDraft,
        languageHint: nluLanguageHint,
      });

      const updatedDraft = { ...session.productDraft, ...nluResult.entities };

      const updatedSession = await repositories.sessions.update(id, {
        currentIntent: nluResult.intent.name,
        // Prefer NLU-detected language, then STT-detected, then hint
        language: nluResult.detectedLanguage ?? transcription.detectedLanguage ?? transcription.languageHint,
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
          transcription: {
            text: transcription.text,
            // detectedLanguage: only set when provider genuinely detected it
            ...(transcription.detectedLanguage ? { detectedLanguage: transcription.detectedLanguage } : {}),
            // languageHint: echoed from caller
            ...(transcription.languageHint ? { languageHint: transcription.languageHint } : {}),
            // confidence: only set when provider genuinely returned it
            ...(transcription.confidence !== undefined ? { confidence: transcription.confidence } : {}),
          },
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
    } catch (error) {
      next(error);
    } finally {
      // Ephemeral audio privacy: zero out audio buffer immediately
      if (req.file?.buffer) {
        req.file.buffer.fill(0);
      }
    }
  }
}
