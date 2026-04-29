export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  user_id?: string;
  thread_id?: string;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
  context?: Record<string, any>;
}

export interface ChatQuery {
  query: string;
  conversation_id?: string;
  user_id?: string;
  context?: Record<string, any>;
  search_filters?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  message_id: string;
  sources?: Array<Record<string, any>>;
  suggestions?: string[];
  metadata?: Record<string, any>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
