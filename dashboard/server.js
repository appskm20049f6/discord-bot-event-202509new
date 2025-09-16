import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(__dirname));

// 範例 API：取得功能分類
app.get('/api/categories', (req, res) => {
  res.json([
    { id: 'status', name: '機器人狀態' },
    { id: 'commands', name: '執行指令' },
    { id: 'logs', name: '訊息紀錄' }
  ]);
});

// 範例 API：執行指令
app.post('/api/execute', (req, res) => {
  const { command } = req.body;
  // TODO: 連接 Discord 機器人執行指令
  res.json({ success: true, command });
});

app.listen(port, () => {
  console.log(`Dashboard server running at http://localhost:${port}`);
});
