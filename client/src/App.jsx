import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Video, RefreshCw, Sparkles } from "lucide-react";

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am your AI video assistant. Enter a YouTube Video ID and ask me anything about its transcript!",
    },
  ]);
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ");
  const [threadId, setThreadId] = useState(
    () => "thread_" + Math.random().toString(36).substring(2, 9),
  );
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleVideoIdChange = (e) => {
    const value = e.target.value;

    const match = value.match(/(?:v=|\/|^)([0-9A-Za-z_-]{11})/);
    setVideoId(match ? match[1] : value);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    let activeVideoId = videoId.trim();
    const urlOrIdMatch = input
      .trim()
      .match(/(?:v=|\/|^)([0-9A-Za-z_-]{11})(?:[&?]|$)/);

    if (urlOrIdMatch && urlOrIdMatch[1]) {
      activeVideoId = urlOrIdMatch[1];
      setVideoId(activeVideoId);
    }

    if (!activeVideoId) {
      alert("Please enter a valid YouTube Video ID first!");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMessage,
          video_id: activeVideoId,
          thread_id: threadId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get a response from the server.");
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: data.role || "assistant",
          content: data.content || "No response generated.",
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "⚠️ Error: Could not connect to the backend server. Make sure your Express server is running on port 3000.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setThreadId("thread_" + Math.random().toString(36).substring(2, 9));
    setMessages([
      {
        role: "assistant",
        content: "Session reset! A new memory thread has been initialized.",
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header / Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-30 px-4 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-linear-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              YouTube RAG Agent
            </h1>
            <p className="text-xs text-slate-400">
              Powered by LangGraph, Postgres & Gemini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl shadow-inner text-xs">
            <Video className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-slate-400 font-medium">Video ID:</span>
            <input
              type="text"
              value={videoId}
              onChange={handleVideoIdChange}
              placeholder="e.g. dQw4w9WgXcQ"
              className="bg-transparent text-slate-100 focus:outline-none w-28 sm:w-36 font-mono text-xs"
            />
          </div>

          <button
            onClick={resetSession}
            title="Reset Chat Session"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 active:scale-95 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">New Session</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 lg:p-6 flex flex-col justify-between gap-4 overflow-hidden">
        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={index}
                className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                    isUser
                      ? "bg-linear-to-tr from-indigo-600 to-violet-600 text-white ring-1 ring-white/10"
                      : "bg-slate-900 border border-slate-800 text-indigo-400"
                  }`}
                >
                  {isUser ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                <div
                  className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-lg backdrop-blur-md ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/10"
                      : "bg-slate-900/90 border border-slate-800/80 text-slate-200 rounded-tl-none shadow-black/20"
                  }`}
                >
                  <p className="whitespace-pre-wrap wrap-break-word">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-2xl bg-slate-900 border border-slate-800 text-indigo-400 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3.5 flex items-center gap-2 shadow-lg">
                <div
                  className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
                <span className="text-xs text-slate-400 ml-2">
                  Searching transcript & generating answer...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSendMessage}
          className="relative mt-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-2 backdrop-blur-xl shadow-2xl focus-within:border-indigo-500/50 transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about video ID "${videoId || "..."}"...`}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shadow-md shadow-indigo-600/30 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
