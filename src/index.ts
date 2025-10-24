import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Initialize Google GenAI model
const model = new ChatGoogleGenerativeAI({
  modelName: 'gemini-pro',
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.7,
});

// Create a prompt template
const promptTemplate = PromptTemplate.fromTemplate(
  'あなたは親切なアシスタントです。以下の質問に日本語で答えてください: {question}'
);

// Create chain with LCEL (LangChain Expression Language)
const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'LangChain Tutorial API へようこそ！',
    endpoints: {
      '/': 'このヘルプメッセージ',
      '/health': 'ヘルスチェック',
      'POST /chat': '質問を送信 (body: { question: "your question" })',
      'POST /translate': 'テキストを翻訳 (body: { text: "text", targetLang: "ja" })',
    },
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/chat', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: '質問が必要です' });
    }

    console.log(`質問を受信: ${question}`);

    const response = await chain.invoke({ question });

    res.json({
      question,
      answer: response,
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: 'チャット処理中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Translation endpoint
app.post('/translate', async (req: Request, res: Response) => {
  try {
    const { text, targetLang = 'ja' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'テキストが必要です' });
    }

    const translatePrompt = PromptTemplate.fromTemplate(
      'Translate the following text to {targetLang}: {text}'
    );

    const translateChain = translatePrompt
      .pipe(model)
      .pipe(new StringOutputParser());

    const translation = await translateChain.invoke({ text, targetLang });

    res.json({
      originalText: text,
      translatedText: translation,
      targetLanguage: targetLang,
    });
  } catch (error) {
    console.error('Error in translate endpoint:', error);
    res.status(500).json({
      error: '翻訳処理中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 サーバーが起動しました: http://localhost:${port}`);
  console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Google API Key設定済み: ${!!process.env.GOOGLE_API_KEY}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
