import { randomUUID } from 'node:crypto';
import type {
  ISessionRepository,
  ConversationSession,
  CreateSessionDTO,
  UpdateSessionDTO,
  ConversationMessage,
} from '../interfaces/session.repository.interface.js';
import { NotFoundError } from '../../utils/errors.js';

export class InMemorySessionRepository implements ISessionRepository {
  private sessions: Map<string, ConversationSession> = new Map();

  async create(data: CreateSessionDTO): Promise<ConversationSession> {
    const now = new Date();
    const session: ConversationSession = {
      id: randomUUID(),
      artisanId: data.artisanId,
      currentIntent: data.initialIntent,
      language: data.language,
      productDraft: {},
      missingFields: [],
      history: [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return { ...session };
  }

  async findById(id: string): Promise<ConversationSession | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    return { ...session, productDraft: { ...session.productDraft }, history: [...session.history] };
  }

  async update(id: string, data: UpdateSessionDTO): Promise<ConversationSession> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundError(`Session with id ${id}`);
    }

    const updated: ConversationSession = {
      ...session,
      currentIntent: data.currentIntent !== undefined ? data.currentIntent : session.currentIntent,
      language: data.language !== undefined ? data.language : session.language,
      productDraft: data.productDraft !== undefined ? { ...data.productDraft } : session.productDraft,
      missingFields: data.missingFields !== undefined ? [...data.missingFields] : session.missingFields,
      status: data.status !== undefined ? data.status : session.status,
      updatedAt: new Date(),
    };

    this.sessions.set(id, updated);
    return { ...updated };
  }

  async appendMessage(
    id: string,
    messageData: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): Promise<ConversationSession> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundError(`Session with id ${id}`);
    }

    const message: ConversationMessage = {
      id: randomUUID(),
      role: messageData.role,
      content: messageData.content,
      timestamp: new Date(),
      metadata: messageData.metadata,
    };

    session.history.push(message);
    session.updatedAt = new Date();

    this.sessions.set(id, session);
    return { ...session, history: [...session.history] };
  }

  async delete(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  // Helper for test cleanup
  clear(): void {
    this.sessions.clear();
  }
}
