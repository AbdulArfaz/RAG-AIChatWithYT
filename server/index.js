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
      // Allow requests with no origin (like Postman or mobile apps)
      if (!origin) return callback(null, true);

      // Check if origin is explicitly allowed or comes from a Vercel preview URL
      if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Enable preflight for all routes
app.options("/*splat", cors());

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