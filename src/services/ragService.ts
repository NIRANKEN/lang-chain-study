import * as z from "zod";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";
import { getDatabase } from "../config/database.js";
import { model, embeddings } from "../config/models.js";
import { RETRIEVAL_CONFIG } from "../config/constants.js";
import { OutputTestOptions, RagResponse } from "../types/index.js";

const retrieveSchema = z.object({ query: z.string() });

export class RagService {
  /**
   * RAG検索と回答生成の共通処理
   */
  async processOutputTest(
    question: string,
    options: OutputTestOptions
  ): Promise<RagResponse> {
    const { tableName, systemMessage, dataSourceName, fallbackSource } = options;

    const db = getDatabase();

    // テーブルが存在するかチェック
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      console.error(`Table '${tableName}' does not exist. Available tables:`, tableNames);
      throw new Error(`${tableName}テーブルが存在しません`);
    }

    const retrieve = tool(
      async ({ query }) => {
        const dbTable = await db.openTable(tableName);
        const vectorStore = new LanceDB(embeddings, {
          table: dbTable,
        });

        const multiQueryRetriever = MultiQueryRetriever.fromLLM({
          llm: model,
          retriever: vectorStore.asRetriever({ k: 3 }),
          queryCount: 3,
          verbose: true,
        });

        const multiQueryRetrievedDocs =
          await multiQueryRetriever.getRelevantDocuments(query);

        // 後続処理のために `retrievedResults` の型と合わせる
        const retrievedResults = multiQueryRetrievedDocs.map(
          (doc) => [doc, 0] as [any, number]
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

    const agent = createAgent({
      model,
      tools: [retrieve],
      systemPrompt: systemMessage,
    });

    const agentInputs = { messages: [{ role: "user", content: question }] };
    const stream = await agent.stream(agentInputs, {
      streamMode: "values",
    });

    // ストリーミング結果を収集
    let finalAnswer = "";
    let retrievedSources: string[] = [];
    const conversationLog: Array<{ role: string; content: string }> = [];

    for await (const chunk of stream) {
      const lastMessage = chunk.messages[chunk.messages.length - 1];

      // 会話ログに追加
      conversationLog.push({
        role: lastMessage.role || "unknown",
        content: lastMessage.content,
      });



      // 最終的なアシスタントの回答を保存
      if (lastMessage.role === "assistant" && 
          lastMessage.content && 
          typeof lastMessage.content === "string" &&
          lastMessage.content.trim()) {
        
        // ツール呼び出しでない場合は直接設定
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
          finalAnswer = lastMessage.content;
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
          }
        }
      }

      // ツール呼び出しの結果からソース情報を抽出
      for (const message of chunk.messages) {
        if (message.role === "tool" && message.content) {
          // ソース情報を抽出
          const sourceMatches = message.content.match(/Source: ([^\n]+)/g);
          if (sourceMatches) {
            sourceMatches.forEach((match: string) => {
              const source = match.replace("Source: ", "").trim();
              if (!retrievedSources.includes(source)) {
                retrievedSources.push(source);
              }
            });
          }
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
              }
            });
          } catch (error) {
            console.warn("Failed to parse sources from answer:", error);
          }
        }
      }
    }



    // 最終回答が空の場合の追加チェック
    if (!finalAnswer || finalAnswer.trim() === "") {
      console.warn("Final answer is empty, checking conversation log for assistant responses");
      
      // 全てのconversationLogから最後のassistant回答を探す
      for (let i = conversationLog.length - 1; i >= 0; i--) {
        const log = conversationLog[i];
        if (log.role === "assistant" && log.content && typeof log.content === "string" && log.content.trim()) {
          finalAnswer = log.content;
          break;
        }
      }
    }

    // それでも空の場合、conversationLogの最後のメッセージをチェック
    if (!finalAnswer || finalAnswer.trim() === "") {
      console.warn("Still no final answer found, using last conversation log entry");
      const lastLog = conversationLog[conversationLog.length - 1];
      if (lastLog && lastLog.content && typeof lastLog.content === "string") {
        finalAnswer = lastLog.content;
      }
    }

    // 最終的にも回答が見つからない場合
    if (!finalAnswer || finalAnswer.trim() === "") {
      console.error("No final answer could be extracted from the conversation");
    }

    // 回答をJSONフォーマットでパースしようと試みる
    const { structuredAnswer, parsedSuccessfully } = this.parseJsonResponse(
      finalAnswer,
      question,
      retrievedSources,
      fallbackSource
    );



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

    
    let structuredAnswer;
    let parsedSuccessfully = false;

    try {
      let jsonText = finalAnswer.trim();
      
      // バッククォートで囲まれたJSONをチェック
      if (jsonText.startsWith("```json") && jsonText.endsWith("```")) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      } else if (jsonText.startsWith("```") && jsonText.endsWith("```")) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
      }
      
      // まず、完全なJSONかチェック
      if (jsonText.startsWith("{") && jsonText.endsWith("}")) {
        structuredAnswer = JSON.parse(jsonText);
        parsedSuccessfully = true;
      } else {
        // JSONが他のテキストに埋め込まれている場合を処理
        const jsonMatch = finalAnswer.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          structuredAnswer = JSON.parse(jsonMatch[0]);
          parsedSuccessfully = true;
        }
      }

      // パースしたJSONの構造を検証
      if (structuredAnswer && (!structuredAnswer.answer || !structuredAnswer.sources)) {
        console.warn("JSON parsing succeeded but required fields are missing:", {
          hasAnswer: !!structuredAnswer.answer,
          hasSources: !!structuredAnswer.sources
        });
        parsedSuccessfully = false;
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Failed to parse final answer:", finalAnswer);
      parsedSuccessfully = false;
    }

    // パースに失敗した場合やフィールドが不足している場合のフォールバック
    if (!parsedSuccessfully) {
      console.warn("Using fallback response structure due to parsing failure");
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