import { pipeline } from "@xenova/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { PGVectorStore } from "@langchain/pgvector";
import pg from "pg";


class XenovaEmbeddings {
  constructor() {
    this.pipe = null;
  }

  async init() {
    if (!this.pipe) {
      console.log("Loading local embedding model (Xenova/all-MiniLM-L6-v2)...");
      this.pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      console.log("Local embedding model loaded successfully!");
    }
  }

  async embedDocuments(texts) {
    await this.init();
    const results = [];
    for (const text of texts) {
      const output = await this.pipe(text, { pooling: "mean", normalize: true });
      results.push(Array.from(output.data));
    }
    return results;
  }

  async embedQuery(text) {
    await this.init();
    const output = await this.pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}


const embeddings = new XenovaEmbeddings();

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
  console.log("Vector store initialized successfully");
} catch (err) {
  console.log("Failed to initialize vector store:", err.message);
}

export const addYTVideoToVectorStore = async (videoData) => {
  try {
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

    const rawChunks = await splitter.splitDocuments(docs);

   
    const chunks = rawChunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.pageContent,
          metadata: {
            ...chunk.metadata,
            video_id,
          },
        })
    );

    console.log(`Prepared ${chunks.length} chunks. Inserting into PGVector in batches...`);

    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await vectorStore.addDocuments(batch);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}`);
    }

    console.log(`Successfully added video (${video_id}) with ${chunks.length} chunks to vector store!`);
  } catch (error) {
    console.error("Error inside addYTVideoToVectorStore:", error);
    throw error;
  }
};