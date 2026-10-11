import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { PGVectorStore } from '@langchain/pgvector';

// Use a free, local embedding model that doesn't use Gemini API quotas
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

export const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: {
    connectionString: process.env.DB_URL,
  },
  tableName: 'transcripts',
  columns: {
    idColumnName: 'id',
    vectorColumnName: 'vector',
    contentColumnName: 'content',
    metadataColumnName: 'metadata',
  },
  distanceStrategy: 'cosine',
});

export const addYTVideoToVectorStore = async (videoData) => {
  const { transcript, video_id } = videoData;

  // Safety check to ensure transcript is valid text
  if (!transcript || transcript.trim().length === 0) {
    console.error("Transcript is empty or failed to load!");
    return;
  }

  const docs = [
    new Document({
      pageContent: transcript,
      metadata: { video_id }
    })
  ];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(docs);

  await vectorStore.addDocuments(chunks);
  console.log("Successfully added video to vector store!");
};