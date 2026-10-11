import express from 'express';
import cors from 'cors';
import {agent} from './agent.js';

const port = process.env.PORT || 3000;

const app = express()

app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World')
})

app.post('/generate', async (req, res) => {
  try {
    const { query, video_id, thread_id } = req.body;
    const activeThreadId = thread_id || 'default_thread';

    const results = await agent.invoke(
      {
        messages: [{ role: "user", content: query }],
      },
      {
        configurable: { 
          thread_id: activeThreadId, 
          video_id: video_id || "" 
        },
      }
    );

    // Find the last assistant/ai message that has content
    const messages = results.messages || [];
    let aiMessage = messages.reverse().find(m => 
      (m._getType?.() === 'ai' || m.role === 'assistant' || m.constructor?.name === 'AIMessage') && m.content
    );

    // Fallback to the last message if no specific AI message is isolated
    if (!aiMessage) {
      aiMessage = messages[0] || { role: 'assistant', content: 'No response generated.' };
    }

    // Return the proper message object to the client
    res.json({
      role: 'assistant',
      content: typeof aiMessage.content === 'string' ? aiMessage.content : JSON.stringify(aiMessage.content)
    });

  } catch (error) {
    console.error("Agent execution error:", error);
    res.status(500).json({ 
      role: 'assistant', 
      content: `Server Error: ${error.message}` 
    });
  }
});

app.listen(port, () => {
    console.log(`Server is successfully listening at ${port}`)
})



