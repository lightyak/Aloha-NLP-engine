import { Router } from 'express';
import { SessionsController } from '../controllers/sessions.controller.js';
import { AudioController, audioUploadMiddleware } from '../controllers/audio.controller.js';

export const sessionsRouter = Router();

sessionsRouter.post('/', SessionsController.create);
sessionsRouter.get('/:id', SessionsController.getById);
sessionsRouter.post('/:id/message', SessionsController.sendMessage);
sessionsRouter.post('/:id/audio', audioUploadMiddleware, AudioController.processAudio);
