import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { PGVectorStore } from "@langchain/pgvector";
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';
import pg from "pg";

// 1. Initialize HuggingFace local embeddings
const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HUGGINGFACEHUB_API_TOKEN,
  model: "sentence-transformers/all-MiniLM-L6-v2",
  provider: "hf-inference",
});

const pgPool = new pg.Pool({
  connectionString: process.env.DB_URL,
  ssl: {
     rejectUnauthorized: false, 
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pgPool.on("error", (err) => {
  console.error("PostgreSQL Pool error (caught safely):", err.message);
});

try {
  const result = await pgPool.query("SELECT NOW()");
  console.log("Neon database connected:", result.rows[0]);
} catch (err) {
  console.error("Neon connection test failed:", err.message);
}


export let vectorStore;

try {
  vectorStore = await PGVectorStore.initialize(embeddings, {
    // postgresConnectionOptions: {
    //   connectionString: process.env.DB_URL,
    //    ssl: { rejectUnauthorized: false },
    // },
    pool: pgPool,
    tableName: "transcripts",
    columns: {
      idColumnName: "id",
      vectorColumnName: "vector",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
    distanceStrategy: "cosine",
  });
  console.log("Vector store initialized successfully")
} catch (err) {
  console.log("Falied to initialized vector store:", err.message)
}

export const addYTVideoToVectorStore = async (videoData) => {
  const transcript = videoData.transcript || videoData.text;
  const video_id = videoData.video_id;

  if (!transcript || transcript.trim().length === 0) {
    console.error("Transcript is empty or failed to load!");
    return;
  }

  const docs = [
    new Document({
      pageContent: transcript,
      metadata: { video_id },
    }),
  ];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(docs);

  await vectorStore.addDocuments(chunks);
  console.log(`Successfully added video (${video_id}) to vector store!`);
};
