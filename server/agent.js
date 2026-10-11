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
  prompt: `You answer questions about a Youtube video,
  Use the retrieved tool to find relevant transcript chunks.
  Answer using the retrieved transcript.
  If the transcript does not the answer , say you cannot determine it.
  `,
});




