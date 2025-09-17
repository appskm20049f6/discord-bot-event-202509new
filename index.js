// Discord Bot + Express 後台主程式
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import open from 'open';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const app = express();
app.use(cors());
app.use(express.json());
app.use('/dashboard', express.static('dashboard'));

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);

// API: 取得所有 guilds
app.get('/api/guilds', (req, res) => {
  const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name }));
  res.json(guilds);
});

// API: 取得指定 guild 的所有 text channels
app.get('/api/guilds/:guildId/channels', (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const channels = guild.channels.cache
    .filter(ch => ch.type === 0)
    .map(ch => ({ id: ch.id, name: ch.name }));
  res.json(channels);
});

// API: 範例訊息發送
app.post('/api/send', async (req, res) => {
  const { guildId, channelId, content } = req.body;
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Guild not found');
    const channel = guild.channels.cache.get(channelId);
    if (!channel) throw new Error('Channel not found');
    await channel.send(content);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ====== 抽獎活動 API ======
let currentLottery = null;
app.post('/api/start-lottery-event', async (req, res) => {
  const { question, options, answer, countdown, winners, channelId } = req.body;
  try {
    if (currentLottery) throw new Error('已有抽獎活動進行中');
    const channel = client.channels.cache.get(channelId);
    if (!channel) throw new Error('Channel not found');
    const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const optionList = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
    const msg = `🗡️【冒險任務啟動】\n勇者啊！前方有一道試煉等你通過。\n題目：${question}\n\n選項：\n${optionList}\n\n⏳你有 ${countdown} 秒的時間作答，請輸入答案編號（A、B、C、D${options.length > 4 ? ' 或 ' + optionLabels[options.length-1] : ''}）來完成挑戰！\n成功答對者，將獲得神秘寶藏🎁！`;
    await channel.send(msg);
    const startTime = Date.now();
    const endTime = startTime + countdown * 1000;
    currentLottery = { answer, winners, channelId, startTime, endTime };
    setTimeout(async () => {
      try {
        let fetched = [];
        let lastId;
        while (true) {
          const fetchOptions = { limit: 100 };
          if (lastId) fetchOptions.before = lastId;
          const messages = await channel.messages.fetch(fetchOptions);
          const msgs = Array.from(messages.values()).filter(msg =>
            msg.createdTimestamp >= startTime && msg.createdTimestamp <= endTime && !msg.author.bot
          );
          fetched = fetched.concat(msgs);
          if (messages.size < 100) break;
          lastId = messages.last().id;
        }
        // 收集有效回答（只保留每人最早一次）
        const validLabels = optionLabels.slice(0, options.length);
        // 依訊息時間排序，先出現者優先
        const sortedMsgs = fetched
          .filter(msg => validLabels.includes(msg.content.trim().toUpperCase()))
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        const userAnswers = {};
        sortedMsgs.forEach(msg => {
          if (!userAnswers[msg.author.id]) {
            userAnswers[msg.author.id] = {
              name: msg.author.username,
              id: msg.author.id,
              answer: msg.content.trim().toUpperCase(),
              time: new Date(msg.createdTimestamp).toISOString()
            };
          }
        });
        // 統計答對者
        const correctUsers = Object.values(userAnswers).filter(u => u.answer === answer.toUpperCase()).map(u => u.id);
        let resultMsg = '';
        if (correctUsers.length === 0) {
          resultMsg = '可惜啦～這次沒有勇者解開謎題。\n寶藏依然沉睡，等待下一位冒險者來挑戰……';
        } else {
          const shuffled = correctUsers.sort(() => Math.random() - 0.5);
          const winnersList = shuffled.slice(0, winners);
          resultMsg = `恭喜勇者成功解開謎題，獲得神秘寶藏🎁：\n` + winnersList.map(u => `<@${u}>`).join('\n');
        }
        await channel.send(`⌛【任務結束】\n${resultMsg}`);

        // ====== 寫入 CSV 檔案 ======
        const dt = new Date(startTime);
        const dateStr = dt.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        const timeStr = dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/:/g, '-');
        const shortQ = question.replace(/\s+/g, '').slice(0, 10);
        const fileName = `【${dateStr}】${shortQ}_${timeStr}.csv`;
        const filePath = path.join('data', fileName);
        let csv = '';
        csv += `題目,${question}\n`;
        csv += `選項,${options.join(' | ')}\n`;
        csv += `正確答案,${answer}\n`;
        csv += `抽獎人數,${winners}\n`;
        csv += `\n`;
        csv += `DC名稱,ID,回答內容,回答時間\n`;
        Object.values(userAnswers).forEach(u => {
          csv += `${u.name},${u.id},${u.answer},${u.time}\n`;
        });
        fs.writeFileSync(filePath, csv, 'utf8');
      } catch (err) {
        console.error('抽獎活動回溯錯誤:', err);
        await channel.send('抽獎活動結束，但回溯訊息時發生錯誤。');
      }
      currentLottery = null;
    }, countdown * 1000);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3030, () => {
// API: 取得所有抽獎 Excel 檔案列表
app.get('/api/lottery', (req, res) => {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.csv'))
    .map(f => ({
      name: f,
      url: `/data/${f}`
    }));
  res.json(files);
});
// 提供 Excel 檔案下載
app.use('/data', express.static(path.join(__dirname, 'data')));
  console.log('Bot API server running at http://localhost:3030');
  open('http://localhost:3030/dashboard/index.html');
});