// Output test options interface
export interface OutputTestOptions {
  tableName: string;
  systemMessage: string;
  dataSourceName: string;
  logPrefix: string;
  fallbackSource: string;
}

// RAG response interface
export interface RagResponse {
  question: string;
  answer: string;
  sources: string[];
  conversationLog: Array<{ role: string; content: string }>;
  retrievedContext: number;
  parsedSuccessfully: boolean;
  dataSource: string;
}

// Chat request/response interfaces
export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  question: string;
  answer: string;
}

// Error response interface
export interface ErrorResponse {
  error: string;
  details?: string;
  message?: string;
  availableTables?: string[];
}

// Health check response
export interface HealthResponse {
  status: string;
  timestamp: string;
}

// API endpoints info
export interface ApiInfo {
  message: string;
  endpoints: Record<string, string>;
  workflow: Record<string, Record<string, string> | string>;
}

// YouTube input request
export interface YoutubeInputRequest {
  videoUrls?: string[];
}

// YouTube playlist request
export interface YoutubePlaylistRequest {
  playlistUrl?: string;
}

// Document processing result
export interface DocumentProcessResult {
  message: string;
  totalChunks: number;
  totalRowsInTable?: number;
}
