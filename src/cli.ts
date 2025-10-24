import dotenv from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🤖 LangChain チュートリアル CLI');
  console.log('================================\n');

  // Initialize Google GenAI model
  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-pro',
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.7,
  });

  // Example 1: Simple question answering
  console.log('例1: シンプルな質問応答');
  console.log('------------------------');

  const prompt1 = PromptTemplate.fromTemplate(
    'あなたは親切なアシスタントです。以下の質問に日本語で答えてください: {question}'
  );

  const chain1 = prompt1.pipe(model).pipe(new StringOutputParser());

  const question1 = 'LangChainとは何ですか？簡潔に説明してください。';
  console.log(`質問: ${question1}`);

  const answer1 = await chain1.invoke({ question: question1 });
  console.log(`回答: ${answer1}\n`);

  // Example 2: Translation
  console.log('例2: 翻訳');
  console.log('--------');

  const prompt2 = PromptTemplate.fromTemplate(
    'Translate the following text to {targetLang}: {text}'
  );

  const chain2 = prompt2.pipe(model).pipe(new StringOutputParser());

  const textToTranslate = 'Hello, how are you today?';
  console.log(`原文 (English): ${textToTranslate}`);

  const translation = await chain2.invoke({
    text: textToTranslate,
    targetLang: 'Japanese',
  });
  console.log(`翻訳 (日本語): ${translation}\n`);

  // Example 3: Chain multiple operations
  console.log('例3: チェーン処理');
  console.log('----------------');

  const prompt3 = PromptTemplate.fromTemplate(
    '以下のトピックについて3つの重要なポイントを箇条書きで教えてください: {topic}'
  );

  const chain3 = prompt3.pipe(model).pipe(new StringOutputParser());

  const topic = 'TypeScript';
  console.log(`トピック: ${topic}`);

  const points = await chain3.invoke({ topic });
  console.log(`回答:\n${points}\n`);

  console.log('✅ すべてのサンプルが完了しました！');
}

// Run the main function
main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});
