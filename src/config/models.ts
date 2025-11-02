import dotenv from "dotenv";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { TEXT_SPLITTER_CONFIG } from "./constants";

// Load environment variables first
dotenv.config();

// Validate required environment variables
if (!process.env.GOOGLE_API_KEY) {
  throw new Error(
    "GOOGLE_API_KEY environment variable is required. Please set it in your .env file."
  );
}

// Initialize Google GenAI model
export const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.7,
});

// Initialize embeddings
export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GOOGLE_API_KEY,
});

// Initialize text splitter
export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: TEXT_SPLITTER_CONFIG.chunkSize,
  chunkOverlap: TEXT_SPLITTER_CONFIG.chunkOverlap,
});

// Create a prompt template for basic chat
export const promptTemplate = PromptTemplate.fromTemplate(
  "あなたは親切なアシスタントです。以下の質問に日本語で答えてください: {question}"
);

// Create chain with LCEL (LangChain Expression Language)
export const chatChain = promptTemplate.pipe(model).pipe(new StringOutputParser());

console.log("AIモデルと埋め込みが初期化されました。");