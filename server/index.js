import express from "express";
import cors from "cors";
import { agent } from "./agent.js";

const port = process.env.PORT || 3000;

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://rag-ai-chat-with-yt.vercel.app" 
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1 && !origin.endsWith('.vercel.app')) {
        return callback(new Error('Blocked by CORS'), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/generate", async (req, res) => {
  try {
    const { query, video_id, thread_id } = req.body;

    let cleanVideoId = video_id || "";
    const match = cleanVideoId.match(/(?:v=|\/|^)([0-9A-Za-z_-]{11})/);
    if (match && match[1]) {
      cleanVideoId = match[1];
    }

    const activeThreadId = thread_id || "default_thread";

    const results = await agent.invoke(
      {
        messages: [{ role: "user", content: query }],
      },
      {
        configurable: {
          thread_id: activeThreadId,
          video_id: cleanVideoId,
        },
      },
    );

    const messages = results.messages || [];
    let aiMessage = messages
      .reverse()
      .find(
        (m) =>
          (m._getType?.() === "ai" ||
            m.role === "assistant" ||
            m.constructor?.name === "AIMessage") &&
          m.content,
      );

    res.json({
      role: "assistant",
      content:
        typeof aiMessage?.content === "string"
          ? aiMessage.content
          : JSON.stringify(aiMessage?.content || "No response generated."),
    });
  } catch (error) {
    console.error("Agent execution error:", error);
    res.status(500).json({
      role: "assistant",
      content: `Server Error: ${error.message}`,
    });
  }
});

app.listen(port, () => {
  console.log(`Server is successfully listening at ${port}`);
});