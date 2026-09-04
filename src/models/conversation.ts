import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IConversation extends Document {
  userId: string;
  kind?: 'report-chat' | 'records-chat' | 'appointment';
  sessionId?: string;
  context?: {
    summary?: string;
    ocr?: string;
  };
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: { 
    type: String, 
    required: true, 
    enum: ['user', 'assistant', 'system'] 
  },
  content: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

const ConversationSchema = new Schema<IConversation>({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  kind: {
    type: String,
    enum: ['report-chat', 'records-chat', 'appointment'],
  },
  sessionId: {
    type: String,
  },
  context: {
    summary: { type: String },
    ocr: { type: String },
  },
  messages: [MessageSchema],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for efficient querying by userId and createdAt
ConversationSchema.index({ userId: 1, createdAt: -1 });
ConversationSchema.index(
  { userId: 1, kind: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $type: 'string' } },
  }
);

// Update the updatedAt timestamp before saving
ConversationSchema.pre<IConversation>('save', function (next) {
  this.updatedAt = new Date(Date.now());
  next();
});

export default mongoose.models.Conversation || 
  mongoose.model<IConversation>('Conversation', ConversationSchema);
