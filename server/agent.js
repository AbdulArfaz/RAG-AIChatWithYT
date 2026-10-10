import "dotenv/config";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { tool } from "@langchain/core/tools";
import { z } from 'zod';
import { MemorySaver } from "@langchain/langgraph";


import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import data from "./data.js";

const video1 = data[1];
const docs = [new Document({ pageContent: video1.transcript, metadata: { video_id: video1.video_id} })];


//splitting into chunks
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const chunks = await splitter.splitDocuments(docs);
// console.log(chunks);


//Embedding chunks
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: 'gemini-embedding-001',
    apiKey: process.env.GEMINI_API_KEY,
})
const vectorStore = new MemoryVectorStore(embeddings)
await vectorStore.addDocuments(chunks)



//retrieve the most relevant chunks
const retrievedDocs = await vectorStore.similaritySearch('What was the finish time of Norris?', 1)


//retrieval tool
const retrieveTool = tool(async ({query}) => {
// console.log('Retrieving docs from query: ---------------------')
// console.log(query)
const retrievedDocs = await vectorStore.similaritySearch(query, 3)

const serializedDocs = retrievedDocs
.map((doc) => doc.pageContent )
.join('\n')


return serializedDocs;
}, {
    name: 'retrieve',
    description: 'Retrieve the most relevant chunks of text from the transcript of a youtube video',
    schema: z.object({
        query: z.string(),
    }
    )
})



const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash-lite",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

const checkpointer = new MemorySaver()

const agent = createReactAgent({
  llm,
  tools: [retrieveTool],
  checkpointer,
  prompt: `You answer questions about a Youtube video,
  Use the retrieved tool to find relevant transcript chunks.
  Answer using the retrieved transcript.
  If the transcript does not the answer , say you cannot determine it.
  `
});


console.log("Q1: What was the finish time of Norris")
const results = await agent.invoke({
  messages: [{ role: "user", content: "What was the finish time of Norris" }],
},
{
    configurable: { thread_id: "1"}
});
console.log(results.messages.at(-1)?.content);


console.log("Q2: What about Vestapen?")
const results1 = await agent.invoke({
  messages: [{ role: "user", content: "What about Vestapen" }],
},
{
    configurable: { thread_id: "2"}
});
console.log(results1.messages.at(-1)?.content);
