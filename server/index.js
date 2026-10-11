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

app.post('/generate',async (req, res) => {
    const { query, video_id, thread_id } = req.body;
    console.log("QUERY:",query)
    console.log("VIDEOID:",video_id)
    const results = await agent.invoke(
  {
    messages: [{ role: "user", content: query }],
  },
  {
    configurable: { thread_id , video_id },
  },
);
const responseText = results.messages.at(-1)?.content;
    res.json(results.messages.at(-1))
})


app.listen(port, () => {
    console.log(`Server is successfully listening at ${port}`)
})



