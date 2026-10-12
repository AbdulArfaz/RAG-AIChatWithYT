import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import { vectorStore, addYTVideoToVectorStore } from "./embeddings.js";

const loadedVideos = new Set();

// retrieval tool
const retrieveTool = tool(
  async ({ query }, { configurable: { video_id } }) => {
    if (!video_id) {
      return "No video ID provided.";
    }

    const cleanVideoId = video_id.replace(
      /.*(?:v=|\/)([0-9A-Za-z_-]{11}).*/,
      "$1",
    );

    if (!loadedVideos.has(cleanVideoId)) {
      console.log(
        `Fetching and embedding video transcript for ID: ${cleanVideoId}`,
      );
      try {
        // Fetching via RapidAPI to bypass cloud server IP blocks
        const url = `https://youtube-transcript3.p.rapidapi.com/api/transcript?videoId=${cleanVideoId}&flat_text=true`;
        
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "x-rapidapi-key": process.env.RAPIDAPI_KEY,
            "x-rapidapi-host": "youtube-transcript3.p.rapidapi.com",
          },
        });

        const data = await response.json();

        if (data && data.success && data.transcript) {
          const fullText = data.transcript;

          await addYTVideoToVectorStore({
            video_id: cleanVideoId,
            text: fullText,
          });
          loadedVideos.add(cleanVideoId);
        } else {
          return `No transcript available for video ID "${cleanVideoId}".`;
        }
      } catch (err) {
        console.error("Error fetching live transcript via RapidAPI:", err.message);
        return `Unable to fetch transcript for video ID "${cleanVideoId}". It may not have closed captions enabled.`;
      }
    }

    const retrievedDocs = await vectorStore.similaritySearch(query, 3, {
      video_id: cleanVideoId,
    });

    const serializedDocs = retrievedDocs
      .map((doc) => doc.pageContent)
      .join("\n");

    return (
      serializedDocs ||
      "No relevant information found in the transcript for this question."
    );
  },
  {
    name: "retrieve",
    description:
      "Retrieve the most relevant chunks of text from the transcript of a youtube video",
    schema: z.object({
      query: z.string(),
    }),
  },
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

1. If the user greets you (e.g., "hi", "hello", "hey"), greet them back politely and ask how you can help them with the YouTube video.
2. If the user asks a question about the video, use the retrieve tool to search for relevant transcript chunks.
3. Base your answer strictly on the retrieved transcript content.
4. If the retrieved transcript does not contain enough information to answer a specific question, clearly explain that the transcript does not mention it.`,
});