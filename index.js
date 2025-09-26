// index.js - Discord Bot + Express 後台主程式
// index.js - Discord Bot + Express 後台主程式
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import open from 'open';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ====== Discord Bot 初始化 ======
let client;
let botStatus = { connected: false, error: null };
function startBot(token) {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once('clientReady', () => {
    botStatus.connected = true;
    botStatus.error = null;
    console.log(`✅ Bot 已登入：${client.user.tag}`);
  });

  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content === '!ping') {
      await message.reply('Pong!');
    }
  });

  client.login(token).catch(err => {
    botStatus.connected = false;
    botStatus.error = (err.code === 'TokenInvalid' || err.message.includes('Token')) ? 'TokenInvalid' : err.message;
    console.error('Discord Bot 啟動失敗:', err);
  });
}
startBot(process.env.DISCORD_TOKEN);

// ====== Express 後台初始化 ======
const app = express();
app.use(cors());
app.use(express.json());
app.use('/dashboard', express.static('dashboard'));
app.use('/data', express.static(path.join(__dirname, 'data')));

// ====== 抽獎題目列表 API ======
app.get('/api/lottery-topics', (req, res) => {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));
  const topics = [];
  files.forEach(f => {
    const filePath = path.join(dir, f);
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const questionLine = lines.find(l => l.startsWith('題目,'));
    if (questionLine) {
      const question = questionLine.replace('題目,', '').trim();
      topics.push({ id: f, question });
    }
  });
  res.json(topics);
});
// ...existing code...
app.use(cors());
app.use(express.json());
app.use('/dashboard', express.static('dashboard'));
app.use('/data', express.static(path.join(__dirname, 'data')));

// ====== BOT 狀態 API ======
app.get('/api/bot-status', (req, res) => {
  res.json({ connected: botStatus.connected, error: botStatus.error });
});

// ====== 設定 Discord Token API ======
app.post('/api/set-token', express.json(), (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string' || token.length < 10) {
    return res.json({ success: false, error: 'Token 格式錯誤' });
  }
  try {
    // 寫入 .env 檔案
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      // 移除舊的 DISCORD_TOKEN
      envContent = envContent.replace(/DISCORD_TOKEN=.*/g, '');
      envContent = envContent.trim();
      if (envContent.length > 0) envContent += '\n';
    }
    envContent += `DISCORD_TOKEN=${token}\n`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    // 重新啟動 BOT
    if (client) {
      try { client.destroy(); } catch(e) {}
    }
    botStatus.connected = false;
    botStatus.error = null;
    startBot(token);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: '寫入失敗: ' + err.message });
  }
});
// ...existing code...

// ====== Guild & Channel API ======
app.get('/api/guilds', (req, res) => {
  const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name }));
  res.json(guilds);
});

app.get('/api/guilds/:guildId/channels', (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  // 取得所有主文字頻道
  const botMember = guild.members.me;
  const textChannels = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText);
  // 取得所有分類
  const categories = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildCategory);
  // 取得分類順序
  const categoryOrder = {};
  categories.forEach(cat => { categoryOrder[cat.id] = cat.rawPosition ?? cat.position ?? 0; });
  // 取得所有 thread（公開/私密/active）
  let threads = [];
  textChannels.forEach(ch => {
    if (ch.threads && ch.threads.cache.size) {
      ch.threads.cache.forEach(thread => {
        let permissions = 0n;
        if (botMember) permissions = thread.permissionsFor(botMember)?.bitfield ?? 0n;
        threads.push({
          id: thread.id.toString(),
          name: `#${ch.name} / ${thread.name}`,
          permissions: permissions.toString(),
          categoryId: ch.parentId ? ch.parentId.toString() : '',
          categoryName: ch.parentId ? (categories.get(ch.parentId)?.name || '') : '',
          categoryPosition: ch.parentId ? (categoryOrder[ch.parentId] ?? 0) : 0,
          channelPosition: thread.rawPosition ?? thread.position ?? 0
        });
      });
    }
  });
  // 合併主頻道與 thread
  const channels = [
    ...textChannels.map(ch => {
      let permissions = 0n;
      if (botMember) permissions = ch.permissionsFor(botMember)?.bitfield ?? 0n;
      return {
        id: ch.id.toString(),
        name: ch.name,
        permissions: permissions.toString(),
        categoryId: ch.parentId ? ch.parentId.toString() : '',
        categoryName: ch.parentId ? (categories.get(ch.parentId)?.name || '') : '',
        categoryPosition: ch.parentId ? (categoryOrder[ch.parentId] ?? 0) : 0,
        channelPosition: ch.rawPosition ?? ch.position ?? 0
      };
    }),
    ...threads
  ];
  res.json(channels);
});

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
// ====== 手動抽獎 API ======
app.post('/api/manual-lottery', async (req, res) => {
  const { topicId, endTime } = req.body;
  try {
    // 1. 讀取 CSV，取得題目、選項、答案、抽獎人數、發布時間、頻道
    const filePath = path.join(__dirname, 'data', topicId);
    if (!fs.existsSync(filePath)) throw new Error('題目檔案不存在');
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const questionLine = lines.find(l => l.startsWith('題目,'));
    const optionsLine = lines.find(l => l.startsWith('選項,'));
    const answerLine = lines.find(l => l.startsWith('正確答案,'));
    const winnerLine = lines.find(l => l.startsWith('抽獎人數,'));
    if (!questionLine || !optionsLine || !answerLine || !winnerLine) throw new Error('題目檔案格式錯誤');
    const question = questionLine.replace('題目,','').trim();
    const options = optionsLine.replace('選項,','').split(' | ');
    const answer = answerLine.replace('正確答案,','').trim().toUpperCase();
    const winners = Number(winnerLine.replace('抽獎人數,','').trim());

    // 2. 解析檔名取得發布時間
    // 檔名格式：【YYYY-MM-DD】題目_時分秒.csv
    const match = topicId.match(/^【(\d{4}-\d{2}-\d{2})】(.+?)_(\d{2}-\d{2}-\d{2})\.csv$/);
    if (!match) throw new Error('檔名格式錯誤');
    const dateStr = match[1];
    const timeStr = match[3].replace(/-/g, ':');
    const startTime = new Date(`${dateStr}T${timeStr}`).getTime();

    // 3. 取得頻道ID（目前設計：從 CSV 取得，若無則由前端傳遞）
    // 這裡假設頻道ID由前端 localStorage.channelId 傳遞
    const channelId = req.body.channelId || (req.body.channelId === '' ? null : null);
    // 若頻道ID未傳遞，則回傳錯誤
    if (!channelId) throw new Error('請選擇頻道');
    const channel = client.channels.cache.get(channelId);
    if (!channel) throw new Error('頻道不存在');

    // 4. 解析結束時間
    const endTs = new Date(endTime).getTime();
    if (isNaN(endTs)) throw new Error('結束時間格式錯誤');

    // 5. 回溯訊息
    let fetched = [];
    let lastId;
    let loops = 0;
    const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, options.length);
    while (true) {
      loops++;
      if (loops > 150) break;
      const fetchOptions = { limit: 100 };
      if (lastId) fetchOptions.before = lastId;
      const messages = await channel.messages.fetch(fetchOptions);
      if (!messages || messages.size === 0) break;
      const msgs = Array.from(messages.values()).filter(
        msg => msg.createdTimestamp >= startTime &&
               msg.createdTimestamp <= endTs &&
               !msg.author.bot &&
               optionLabels.includes(msg.content.trim().toUpperCase())
      );
      fetched = fetched.concat(msgs);
      if (messages.size < 100) break;
      const lastMsg = messages.last();
      if (!lastMsg) break;
      lastId = lastMsg.id;
      if (lastMsg.createdTimestamp < startTime) break;
      await new Promise(r => setTimeout(r, 300));
    }

    // 6. 整理回答記錄
    const userAnswers = {};
    fetched.sort((a, b) => a.createdTimestamp - b.createdTimestamp).forEach(msg => {
      if (!userAnswers[msg.author.id]) {
        userAnswers[msg.author.id] = {
          name: msg.author.username,
          id: msg.author.id,
          answer: msg.content.trim().toUpperCase(),
          time: new Date(msg.createdTimestamp).toISOString()
        };
      }
    });

    // 7. 抽獎
    const correctUsers = Object.values(userAnswers).filter(u => u.answer === answer).map(u => u.id);
    let resultMsg;
    let winnersList = [];
    if (correctUsers.length === 0) {
      resultMsg = '可惜啦～這次沒有勇者解開謎題。';
    } else {
      const shuffled = correctUsers.sort(() => Math.random() - 0.5);
      winnersList = shuffled.slice(0, winners);
      resultMsg = `恭喜勇者成功解開謎題！\n` + winnersList.map(u => `<@${u}>`).join('\n');
    }

    // 8. 寫回 CSV
    let csv = `題目,${question}\n選項,${options.join(' | ')}\n正確答案,${answer}\n抽獎人數,${winners}\n\nDC名稱,ID,回答內容,回答時間\n`;
    Object.values(userAnswers).forEach(u => {
      csv += `${u.name},${u.id},${u.answer},${u.time}\n`;
    });
    // 加入中獎者名單
    if (winnersList.length) {
      csv += `\n中獎者`;
      winnersList.forEach(uid => {
        const winner = userAnswers[uid];
        if (winner) csv += `,${winner.name},${winner.id}`;
      });
      csv += `\n`;
    }
    fs.writeFileSync(filePath, csv, 'utf8');

    // 9. 公布得獎者名單至頻道（公告形式）
    if (channel && winnersList.length) {
      let announceMsg = `📢【問答抽獎結果公告】\n題目：${question}\n`;
      announceMsg += `抽獎人數：${winners}\n`;
      announceMsg += `中獎者：\n`;
      winnersList.forEach(uid => {
        const winner = userAnswers[uid];
        if (winner) announceMsg += `- ${winner.name} (<@${winner.id}>)\n`;
      });
      await channel.send({ content: announceMsg, allowedMentions: { users: winnersList }, flags: 4096 }); // 4096 = Suppress embeds, mimic announcement
    }
    res.json({ success: true, winners: winnersList });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
let currentLottery = null;

app.post('/api/start-lottery-event', async (req, res) => {
  const { question, options, answer, winners, channelId } = req.body;
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) throw new Error('Channel not found');

    const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const optionList = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');

    const msg = `🗡️【冒險任務啟動】\n勇者啊！前方有一道試煉等你通過。\n題目：${question}\n\n選項：\n${optionList}\n\n將抽出 ${winners} 位勇者獲得寶藏！`;
    await channel.send(msg);

    // 立即建立 CSV
    const dt = new Date();
    const dateStr = dt.toISOString().slice(0, 10);
    const timeStr = dt.toTimeString().slice(0, 8).replace(/:/g, '-');
    const safeQ = question.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 10);

    const dir = path.join(__dirname, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const fileName = `【${dateStr}】${safeQ}_${timeStr}.csv`;
    const filePath = path.join(dir, fileName);

    let csv = `題目,${question}\n選項,${options.join(' | ')}\n正確答案,${answer}\n抽獎人數,${winners}\n`;
    fs.writeFileSync(filePath, csv, 'utf8');

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ====== 檔案管理 API ======
app.delete('/api/delete-csv', (req, res) => {
  const fileName = req.query.name;
  if (!fileName) return res.status(400).json({ error: '缺少檔名' });

  const filePath = path.join(__dirname, 'data', fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '刪除失敗' });
  }
});

app.get('/api/lottery', (req, res) => {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) return res.json([]);

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.csv'))
    .map(f => ({ name: f, url: `/data/${f}` }));

  res.json(files);
});

// ====== 訊息匯出 API ======
app.post('/api/export-messages', async (req, res) => {
  const { channelId, startDate, endDate } = req.body;
  if (!channelId || !startDate || !endDate) {
    return res.status(400).json({ error: '缺少參數' });
  }

  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: '頻道不存在' });
    if (!channel.isTextBased()) return res.status(400).json({ error: '不是文字頻道' });

    const startTs = new Date(startDate + 'T00:00:00').getTime();
    const endTs = new Date(endDate + 'T23:59:59').getTime();

    let fetched = [];
    let lastId;
    let loops = 0;
    const MAX_FETCH = 5000;

    while (true) {
      loops++;
      if (loops > 50) break;

      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      const msgs = Array.from(messages.values()).filter(msg =>
        msg.createdTimestamp >= startTs &&
        msg.createdTimestamp <= endTs &&
        !msg.author.bot
      );

      fetched = fetched.concat(msgs);
      if (fetched.length >= MAX_FETCH) break;
      if (messages.size < 100) break;
      lastId = messages.last().id;
      if (messages.last().createdTimestamp < startTs) break;

      await new Promise(r => setTimeout(r, 300));
    }

    const dir = path.join(__dirname, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const dt = new Date();
    const dateStr = dt.toISOString().slice(0, 10);
    const timeStr = dt.toTimeString().slice(0, 8).replace(/:/g, '-');
    const fileName = `Messages_${channelId}_${dateStr}_${timeStr}.csv`;
    const filePath = path.join(dir, fileName);

    let csv = `DC名稱,ID,訊息內容,時間\n`;
    fetched.forEach(msg => {
      const safeContent = msg.content.replace(/\n/g, ' ').replace(/,/g, '，');
      csv += `${msg.author.username},${msg.author.id},${safeContent},${new Date(msg.createdTimestamp).toISOString()}\n`;
    });

    fs.writeFileSync(filePath, csv, 'utf8');
    res.json({ success: true, file: fileName, count: fetched.length });
  } catch (err) {
    console.error('export-messages 錯誤:', err);
    res.status(500).json({ error: '匯出失敗: ' + err.message });
  }
});

// ====== 分析 CSV API ======
app.get('/api/analyze-csv', (req, res) => {
  const fileName = req.query.file;
  if (!fileName) return res.status(400).json({ error: '缺少檔名' });

  const filePath = path.join(__dirname, 'data', fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '檔案不存在' });

  const dailyStatsMap = {};
  const hourlyStatsMap = {};
  const userMsgCount = {};
  const userFirstMsg = {};
  let totalMessages = 0;

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on('data', row => {
      totalMessages++;
      const ts = new Date(row['時間']).getTime();
      const date = new Date(ts).toISOString().slice(0, 10);
      const hour = new Date(ts).getHours().toString().padStart(2, '0') + ':00';

      dailyStatsMap[date] = (dailyStatsMap[date] || 0) + 1;
      hourlyStatsMap[hour] = (hourlyStatsMap[hour] || 0) + 1;

      const uid = row['ID'];
      if (!userFirstMsg[uid]) userFirstMsg[uid] = ts;
      userMsgCount[uid] = (userMsgCount[uid] || 0) + 1;
    })
    .on('end', () => {
      const users = Object.keys(userMsgCount).map(uid => ({
        id: uid,
        firstMessageTime: new Date(userFirstMsg[uid]).toISOString(),
        messageCount: userMsgCount[uid]
      }));

      res.json({
        totalMessages,
        dailyStats: Object.entries(dailyStatsMap).map(([date, count]) => ({ date, count })),
        hourlyStats: Object.entries(hourlyStatsMap).map(([hour, count]) => ({ hour, count })),
        users
      });
    })
    .on('error', err => {
      console.error('analyze-csv 錯誤:', err);
      res.status(500).json({ error: '分析 CSV 失敗: ' + err.message });
    });
});

// ====== 文字頻道訊息即時分析 API ======
app.get('/api/analyze-channel-messages', async (req, res) => {
  const { channelId, startDate, endDate } = req.query;
  if (!channelId || !startDate || !endDate) {
    return res.status(400).json({ error: '缺少參數' });
  }

  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: '頻道不存在' });
    if (!channel.isTextBased()) return res.status(400).json({ error: '不是文字頻道' });

    const startTs = new Date(startDate + 'T00:00:00').getTime();
    const endTs = new Date(endDate + 'T23:59:59').getTime();

    let fetched = [];
    let lastId;
    let loops = 0;
  const MAX_FETCH = 15000;

      while (true) {
        loops++;
        if (loops > 150) break; // 提高迴圈上限，避免大頻道提前中斷

        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (!messages || messages.size === 0) break; // 沒有更多訊息

        const msgs = Array.from(messages.values()).filter(msg =>
          msg.createdTimestamp >= startTs &&
          msg.createdTimestamp <= endTs &&
          !msg.author.bot
        );

        fetched = fetched.concat(msgs);

        if (fetched.length >= MAX_FETCH) break;

        // 若 messages.size < 100，代表已到最舊一批
        if (messages.size < 100) break;

        // messages.last() 可能為 undefined，需判斷
        const lastMsg = messages.last();
        if (!lastMsg) break;
        lastId = lastMsg.id;

        // 若最舊訊息已早於 startTs，代表已抓完
        if (lastMsg.createdTimestamp < startTs) break;

        await new Promise(r => setTimeout(r, 300));
      }

    // 統計分析
    const dailyStatsMap = {};
    const hourlyStatsMap = {};
    const weeklyStatsMap = {};
    const userMsgCount = {};
    const userFirstMsg = {};
    let totalMessages = 0;
    let totalMsgLength = 0;

    fetched.forEach(msg => {
      totalMessages++;
      const ts = msg.createdTimestamp;
      const dateObj = new Date(ts);
      const date = dateObj.toISOString().slice(0, 10);
      const hour = dateObj.getHours().toString().padStart(2, '0') + ':00';
      // 週期統計（以週一為一週起始）
      const weekYear = dateObj.getFullYear();
      const weekNum = Math.floor((dateObj - new Date(dateObj.getFullYear(),0,1)) / 604800000) + 1;
      const weekKey = `${weekYear}-W${weekNum}`;

      dailyStatsMap[date] = (dailyStatsMap[date] || 0) + 1;
      hourlyStatsMap[hour] = (hourlyStatsMap[hour] || 0) + 1;
      weeklyStatsMap[weekKey] = (weeklyStatsMap[weekKey] || 0) + 1;

      totalMsgLength += msg.content.length;

      const uid = msg.author.id;
      if (!userFirstMsg[uid]) userFirstMsg[uid] = ts;
      userMsgCount[uid] = (userMsgCount[uid] || 0) + 1;
    });

    const users = Object.keys(userMsgCount).map(uid => {
      // 取第一則訊息的 username
      const firstMsg = fetched.find(m => m.author.id === uid);
      return {
        id: uid,
        username: firstMsg ? firstMsg.author.username : '',
        firstMessageTime: new Date(userFirstMsg[uid]).toISOString(),
        messageCount: userMsgCount[uid]
      };
    });

    const averageMsgLength = totalMessages ? Math.round(totalMsgLength / totalMessages) : 0;

    res.json({
      totalMessages,
      dailyStats: Object.entries(dailyStatsMap).map(([date, count]) => ({ date, count })),
      weeklyStats: Object.entries(weeklyStatsMap).map(([week, count]) => ({ week, count })),
      hourlyStats: Object.entries(hourlyStatsMap).map(([hour, count]) => ({ hour, count })),
      users,
      averageMsgLength
    });

  } catch (err) {
    console.error('analyze-channel-messages 錯誤:', err);
    res.status(500).json({ error: '分析失敗: ' + err.message });
  }
});

// ====== 啟動伺服器 ======
app.listen(3030, () => {
  console.log('🚀 Bot API server running at http://localhost:3030');
  if (process.env.NODE_ENV !== 'production') {
    open('http://localhost:3030/dashboard/index.html');
  }
});
