import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import { vectorStore, addYTVideoToVectorStore } from "./embeddings.js";

import data from "./data.js";


// await addYTVideoToVectorStore(data[0]);
// await addYTVideoToVectorStore(data[1]);

//retrieval tool
const retrieveTool = tool(
  async ({ query }, { configurable: { video_id } }) => {
    const retrievedDocs = await vectorStore.similaritySearch(
      query,
      3,
      {video_id},
    );

    const serializedDocs = retrievedDocs
      .map((doc) => doc.pageContent)
      .join("\n");

    return serializedDocs;
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
4. If the retrieved transcript does not contain enough information to answer a specific question, clearly explain that the transcript does not mention it.`

});




