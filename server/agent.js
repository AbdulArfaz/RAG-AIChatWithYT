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

    const cleanVideoId = video_id.replace(
      /.*(?:v=|\/)([0-9A-Za-z_-]{11}).*/,
      "$1",
    );

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
        console.log("Rapid Api Raw Response:", JSON.stringify(data))
        let fullText = "";
        if (data) {
          if (typeof data.transcript === "string") fullText = data.transcript;
          else if (data.body) fullText = data.body;
          else if (Array.isArray(data)) {
            fullText = data.map((item) => item.text || item.snippet).join(" ");
          }
        }

        if (fullText) {
          await addYTVideoToVectorStore({
            video_id: cleanVideoId,
            text: fullText,
          });
          loadedVideos.add(cleanVideoId);
        } else {
          return `No transcript available for video ID "${cleanVideoId}".`;
        }
      } catch (err) {
        return `Unable to fetch transcript for video ID "${cleanVideoId}".`;
      }
    }

    const retrievedDocs = await vectorStore.similaritySearch(query, 3, {
      video_id: cleanVideoId,
    });

    return (
      retrievedDocs.map((doc) => doc.pageContent).join("\n") ||
      "No relevant information found in the transcript."
    );
  },
  {
    name: "retrieve",
    description: "Retrieve relevant text from a YouTube video transcript",
    schema: z.object({ query: z.string() }),
  },
);

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash-lite",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

const checkpointer = new MemorySaver();

// THIS EXPORT IS REQUIRED
export const agent = createReactAgent({
  llm,
  tools: [retrieveTool],
  checkpointer,
  prompt: `You are an AI assistant that answers questions about a YouTube video using its transcript.
1. If the user greets you, greet them back politely.
2. If the user asks a question about the video, use the retrieve tool.
3. Base your answer strictly on the retrieved transcript content.`,
});