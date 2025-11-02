import * as z from "zod";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { getDatabase } from "../config/database";
import { model, embeddings } from "../config/models";
import { RETRIEVAL_CONFIG } from "../config/constants";
import { OutputTestOptions, RagResponse } from "../types";

const retrieveSchema = z.object({ query: z.string() });

export class RagService {
  /**
   * RAG検索と回答生成の共通処理
   */
  async processOutputTest(
    question: string,
    options: OutputTestOptions
  ): Promise<RagResponse> {
    const { tableName, systemMessage, dataSourceName, logPrefix, fallbackSource } = options;

    const db = getDatabase();

    // テーブルが存在するかチェック
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      throw new Error(`${tableName}テーブルが存在しません`);
    }

    const retrieve = tool(
      async ({ query }) => {
        const dbTable = await db.openTable(tableName);
        const vectorStore = new LanceDB(embeddings, {
          table: dbTable,
        });
        const retrievedResults = await vectorStore.similaritySearchWithScore(
          query,
          RETRIEVAL_CONFIG.resultCount
        );
        const serialized = retrievedResults
          .map(
            (result) =>
              `Source: ${result[0].metadata.source}\nContent: ${result[0].pageContent}\nScore: ${result[1]}`
          )
          .join("\n");
        return [serialized, retrievedResults];
      },
      {
        name: "retrieve",
        description: `Retrieve information related to a query from ${dataSourceName}.`,
        schema: retrieveSchema,
        responseFormat: "content_and_artifact",
      }
    );

    console.log(`[${logPrefix}] Creating agent with system message:`, systemMessage.substring(0, 100) + "...");
    
    const agent = createAgent({
      model,
      tools: [retrieve],
      systemPrompt: systemMessage,
    });

    console.log(`[${logPrefix}] Agent created successfully`);

    const agentInputs = { messages: [{ role: "user", content: question }] };
    const stream = await agent.stream(agentInputs, {
      streamMode: "values",
    });

    // ストリーミング結果を収集
    let finalAnswer = "";
    let retrievedSources: string[] = [];
    let hasToolCall = false;
    const conversationLog: Array<{ role: string; content: string }> = [];

    for await (const chunk of stream) {
      const lastMessage = chunk.messages[chunk.messages.length - 1];
      console.log(`[${logPrefix}][${lastMessage.role}]: ${lastMessage.content}`);
      console.log(`[${logPrefix}] Chunk messages count:`, chunk.messages.length);
      console.log(`[${logPrefix}] Last message structure:`, JSON.stringify(lastMessage, null, 2));

      // 会話ログに追加
      conversationLog.push({
        role: lastMessage.role || "unknown",
        content: lastMessage.content,
      });

      // 詳細ログを追加
      console.log(`[${logPrefix}] Added to conversation log - Role: ${lastMessage.role}, Content type: ${typeof lastMessage.content}, Content length: ${typeof lastMessage.content === 'string' ? lastMessage.content.length : 'N/A'}`);

      // ツール呼び出しがあったかチェック
      if (lastMessage.role === "assistant" && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        hasToolCall = true;
        console.log(`[${logPrefix}] Tool call detected`);
      }

      // 最終的なアシスタントの回答を保存
      if (lastMessage.role === "assistant" && 
          lastMessage.content && 
          typeof lastMessage.content === "string" &&
          lastMessage.content.trim()) {
        
        // ツール呼び出しでない場合は直接設定
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
          finalAnswer = lastMessage.content;
          console.log(`[${logPrefix}] Updated finalAnswer from last message:`, finalAnswer.substring(0, 100) + "...");
        }
      }

      // 全てのメッセージをチェックしてassistantの最終回答を確実に取得
      for (const message of chunk.messages) {
        if (message.role === "assistant" && 
            message.content && 
            typeof message.content === "string" &&
            message.content.trim()) {
          
          // ツール呼び出しでない場合
          if (!message.tool_calls || message.tool_calls.length === 0) {
            finalAnswer = message.content;
            console.log(`[${logPrefix}] Found assistant message in chunk:`, message.content.substring(0, 100) + "...");
          }
        }
      }

      // ツール呼び出しの結果からソース情報を抽出
      for (const message of chunk.messages) {
        if (message.role === "tool" && message.content) {
          // ソース情報を抽出
          const sourceMatches = message.content.match(/Source: ([^\n]+)/g);
          if (sourceMatches) {
            console.log(`[${logPrefix}] Found source matches:`, sourceMatches);
            sourceMatches.forEach((match: string) => {
              const source = match.replace("Source: ", "").trim();
              if (!retrievedSources.includes(source)) {
                retrievedSources.push(source);
                console.log(`[${logPrefix}] Added source:`, source);
              }
            });
          }

          // Content情報も保持（デバッグ用）
          console.log(
            `[${logPrefix}] Retrieved ${dataSourceName} tool content:`,
            message.content.substring(0, 200) + "..."
          );
        }
      }

      // 最終回答にソース情報が含まれている場合も抽出
      if (lastMessage.role === "assistant" && lastMessage.content && typeof lastMessage.content === "string") {
        const sourcesInAnswer = lastMessage.content.match(/"sources":\s*\[(.*?)\]/);
        if (sourcesInAnswer) {
          try {
            const sourcesArray = JSON.parse(`[${sourcesInAnswer[1]}]`);
            sourcesArray.forEach((source: string) => {
              const cleanSource = source.replace(/"/g, '').trim();
              if (!retrievedSources.includes(cleanSource)) {
                retrievedSources.push(cleanSource);
                console.log(`[${logPrefix}] Added source from answer:`, cleanSource);
              }
            });
          } catch (e) {
            console.log(`[${logPrefix}] Could not parse sources from answer:`, e);
          }
        }
      }
    }

    // デバッグ情報を出力
    console.log(`[${logPrefix}] Final answer before parsing:`, finalAnswer);
    console.log(`[${logPrefix}] Final answer length:`, finalAnswer.length);
    console.log(`[${logPrefix}] Retrieved sources:`, retrievedSources);
    console.log(`[${logPrefix}] Has tool call:`, hasToolCall);

    // 最終回答が空の場合の追加チェック
    if (!finalAnswer || finalAnswer.trim() === "") {
      console.log(`[${logPrefix}] Warning: Final answer is empty, checking all messages for assistant responses`);
      
      // 全てのconversationLogから最後のassistant回答を探す
      for (let i = conversationLog.length - 1; i >= 0; i--) {
        const log = conversationLog[i];
        if (log.role === "assistant" && log.content && typeof log.content === "string" && log.content.trim()) {
          finalAnswer = log.content;
          console.log(`[${logPrefix}] Found assistant answer in conversation log:`, finalAnswer.substring(0, 100) + "...");
          break;
        }
      }
    }

    // それでも空の場合、conversationLogの最後のメッセージをチェック
    if (!finalAnswer || finalAnswer.trim() === "") {
      console.log(`[${logPrefix}] Still empty, checking last conversation log entry`);
      const lastLog = conversationLog[conversationLog.length - 1];
      if (lastLog && lastLog.content && typeof lastLog.content === "string") {
        finalAnswer = lastLog.content;
        console.log(`[${logPrefix}] Using last conversation log as final answer:`, finalAnswer.substring(0, 100) + "...");
      }
    }

    // 回答をJSONフォーマットでパースしようと試みる
    const { structuredAnswer, parsedSuccessfully } = this.parseJsonResponse(
      finalAnswer,
      question,
      retrievedSources,
      fallbackSource
    );

    console.log(`[${logPrefix}] Parsed successfully:`, parsedSuccessfully);
    console.log(`[${logPrefix}] Structured answer:`, JSON.stringify(structuredAnswer, null, 2));

    return {
      question: question,
      answer: structuredAnswer.answer,
      sources: structuredAnswer.sources,
      conversationLog: conversationLog,
      retrievedContext: retrievedSources.length,
      parsedSuccessfully: parsedSuccessfully,
      dataSource: tableName,
    };
  }

  /**
   * JSON レスポンスをパースして構造化する
   */
  private parseJsonResponse(
    finalAnswer: string,
    question: string,
    retrievedSources: string[],
    fallbackSource: string
  ): {
    structuredAnswer: { question: string; answer: string; sources: string[] };
    parsedSuccessfully: boolean;
  } {
    console.log("parseJsonResponse - Input finalAnswer:", finalAnswer);
    console.log("parseJsonResponse - Final answer length:", finalAnswer ? finalAnswer.length : 0);
    console.log("parseJsonResponse - Input retrievedSources:", retrievedSources);
    console.log("parseJsonResponse - Final answer first 200 chars:", finalAnswer ? finalAnswer.substring(0, 200) : "N/A");
    
    let structuredAnswer;
    let parsedSuccessfully = false;

    try {
      let jsonText = finalAnswer.trim();
      
      // バッククォートで囲まれたJSONをチェック
      if (jsonText.startsWith("```json") && jsonText.endsWith("```")) {
        console.log("Found JSON wrapped in code blocks");
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      } else if (jsonText.startsWith("```") && jsonText.endsWith("```")) {
        console.log("Found content wrapped in code blocks");
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
      }
      
      // まず、完全なJSONかチェック
      if (jsonText.startsWith("{") && jsonText.endsWith("}")) {
        console.log("Attempting to parse complete JSON");
        structuredAnswer = JSON.parse(jsonText);
        parsedSuccessfully = true;
        console.log("Successfully parsed complete JSON:", structuredAnswer);
      } else {
        // JSONが他のテキストに埋め込まれている場合を処理
        console.log("Attempting to extract JSON from text");
        const jsonMatch = finalAnswer.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          console.log("Found JSON match:", jsonMatch[0]);
          structuredAnswer = JSON.parse(jsonMatch[0]);
          parsedSuccessfully = true;
          console.log("Successfully parsed extracted JSON:", structuredAnswer);
        } else {
          console.log("No JSON found in text");
        }
      }

      // パースしたJSONの構造を検証
      if (structuredAnswer) {
        console.log("Parsed JSON structure:", {
          hasQuestion: !!structuredAnswer.question,
          hasAnswer: !!structuredAnswer.answer,
          hasSources: !!structuredAnswer.sources,
          sourcesLength: Array.isArray(structuredAnswer.sources) ? structuredAnswer.sources.length : 0
        });
        
        if (!structuredAnswer.answer || !structuredAnswer.sources) {
          console.log(
            "JSONパースは成功したが、必要なフィールドが不足:",
            structuredAnswer
          );
          parsedSuccessfully = false;
        }
      }
    } catch (parseError) {
      console.log("JSON parse error:", parseError);
      console.log("Original answer:", finalAnswer);
      parsedSuccessfully = false;
    }

    // パースに失敗した場合やフィールドが不足している場合のフォールバック
    if (!parsedSuccessfully) {
      structuredAnswer = {
        question: question,
        answer: finalAnswer || "回答を生成できませんでした。",
        sources:
          retrievedSources.length > 0
            ? retrievedSources
            : [fallbackSource],
      };
    }

    return { structuredAnswer, parsedSuccessfully };
  }
}