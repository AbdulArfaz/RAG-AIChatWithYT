import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";


//Embedding chunks
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: 'gemini-embedding-001',
    apiKey: process.env.GEMINI_API_KEY,
})
export const vectorStore = new MemoryVectorStore(embeddings)

export const addYTVideoToVectorStore = async (videoData) => {

   const { transcript, video_id } = videoData;

const docs = [
  new Document({
     pageContent: transcript,
      metadata: { video_id } 
    })];


//splitting into chunks
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const chunks = await splitter.splitDocuments(docs);


await vectorStore.addDocuments(chunks)

}