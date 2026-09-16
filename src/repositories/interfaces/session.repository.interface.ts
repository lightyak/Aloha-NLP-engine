export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationSession {
  id: string;
  artisanId?: string;
  currentIntent?: string;
  language?: string;
  productDraft: Record<string, unknown>;
  missingFields: string[];
  history: ConversationMessage[];
  status: 'active' | 'completed' | 'abandoned';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionDTO {
  artisanId?: string;
  language?: string;
  initialIntent?: string;
}

export interface UpdateSessionDTO {
  currentIntent?: string;
  language?: string;
  productDraft?: Record<string, unknown>;
  missingFields?: string[];
  status?: 'active' | 'completed' | 'abandoned';
}

export interface ISessionRepository {
  create(data: CreateSessionDTO): Promise<ConversationSession>;
  findById(id: string): Promise<ConversationSession | null>;
  update(id: string, data: UpdateSessionDTO): Promise<ConversationSession>;
  appendMessage(id: string, message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<ConversationSession>;
  delete(id: string): Promise<boolean>;
}
