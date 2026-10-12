import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import { vectorStore, addYTVideoToVectorStore } from "./embeddings.js";

const loadedVideos = new Set();

const retrieveTool = tool(
  async ({ query }, { configurable: { video_id } }) => {
    if (!video_id) return "No video ID provided.";

    let cleanVideoId = video_id.trim();
    const match = cleanVideoId.match(/(?:v=|\/|^)([0-9A-Za-z_-]{11})/);
    if (match && match[1]) {
      cleanVideoId = match[1];
    }

    console.log("Searching vector store for cleanVideoId:", cleanVideoId);
    console.log("User query passed to tool:", query);

    if (!loadedVideos.has(cleanVideoId)) {
      try {
        const url = `https://youtube-transcript3.p.rapidapi.com/api/transcript?videoId=${cleanVideoId}&flat_text=true`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "x-rapidapi-key": process.env.RAPIDAPI_KEY,
            "x-rapidapi-host": "youtube-transcript3.p.rapidapi.com",
          },
        });

        const data = await response.json();
        console.log("RapidAPI Data Received for:", cleanVideoId);

        let fullText = "";
        if (data) {
          if (typeof data.transcript === "string") fullText = data.transcript;
          else if (typeof data.body === "string") fullText = data.body;
          else if (data.text) fullText = data.text;
          else if (Array.isArray(data)) {
            fullText = data.map((item) => item.text || item.snippet).join(" ");
          }
        }

        console.log("Extracted fullText length:", fullText ? fullText.length : 0);

        if (fullText && fullText.trim().length > 0) {
          console.log("Starting vector store insertion...");
          await addYTVideoToVectorStore({
            video_id: cleanVideoId,
            text: fullText,
          });
          loadedVideos.add(cleanVideoId);
          console.log("Waiting for DB commit...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          return `No transcript available or empty response for video ID "${cleanVideoId}".`;
        }
      } catch (err) {
        console.error("Fetch or Ingestion error:", err.message);
        return `Unable to fetch transcript for video ID "${cleanVideoId}".`;
      }
    }

    let retrievedDocs = [];
    try {
      retrievedDocs = await vectorStore.similaritySearch(query, 5, {
        video_id: cleanVideoId,
      });
    } catch (e) {
      console.error("Filter search error:", e.message);
    }

    if (!retrievedDocs || retrievedDocs.length === 0) {
      console.log("Filter returned 0 docs. Running manual fallback search...");
      const allDocs = await vectorStore.similaritySearch(query, 15);
      retrievedDocs = allDocs.filter(
        (doc) => doc.metadata && String(doc.metadata.video_id) === String(cleanVideoId)
      );
    }

    const contextText = retrievedDocs.map((doc) => doc.pageContent).join("\n\n");
    console.log(`Retrieved ${retrievedDocs.length} chunks for video (${cleanVideoId})`);

    return (
      contextText ||
      `No transcript chunks found in database matching video ID "${cleanVideoId}".`
    );
  },
  {
    name: "retrieve",
    description: "Retrieve relevant text from a YouTube video transcript",
    schema: z.object({ query: z.string() }),
  }
);

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash-lite",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

const checkpointer = new MemorySaver();


export const agent = createReactAgent({
  llm,
  tools: [retrieveTool],
  checkpointer,
  prompt: `You are an AI assistant that answers questions about a YouTube video using its transcript.
1. If the user greets you, greet them back politely.
2. If the user asks a question about the video, use the retrieve tool.
3. Base your answer strictly on the retrieved transcript content.`,
});
