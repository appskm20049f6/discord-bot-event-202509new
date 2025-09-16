// ====== 抽獎活動 API ======
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const dashboardApi = express();
dashboardApi.use(cors());
dashboardApi.use(express.json());
// Discord Bot 事件監聽
client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.content === '!ping') {
    message.reply('Pong!');
  }

  // !history 指令：讀取頻道歷史訊息並分析
  if (message.content.startsWith('!history')) {
    const messages = await message.channel.messages.fetch({ limit: 100 });
    const contents = Array.from(messages.values()).map(msg => msg.content).filter(Boolean);
    const wordCount = {};
    contents.forEach(text => {
      text.split(/\s+/).forEach(word => {
        if (!word) return;
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
    });
    const topWords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => `${word}: ${count}`)
      .join('\n');
    message.reply(`最近 100 則訊息最常出現的字詞：\n${topWords}`);
  }
});

client.login(process.env.DISCORD_TOKEN);

// 取得所有 guilds
dashboardApi.get('/api/guilds', (req, res) => {
  const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name }));
  res.json(guilds);
});

// 取得指定 guild 的所有 text channels
dashboardApi.get('/api/guilds/:guildId/channels', (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const channels = guild.channels.cache
    .filter(ch => ch.type === 0) // 0 = text channel
    .map(ch => ({ id: ch.id, name: ch.name }));
  res.json(channels);
});

// 範例：在指定頻道發送訊息
dashboardApi.post('/api/send', async (req, res) => {
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

dashboardApi.listen(3030, () => {
  console.log('Bot API server running at http://localhost:3030');
});

// ====== 抽獎活動 API ======
let currentLottery = null;

// 啟動抽獎活動
dashboardApi.post('/api/start-lottery-event', async (req, res) => {
  const { question, options, answer, countdown, winners, channelId } = req.body;
  try {
    if (currentLottery) throw new Error('已有抽獎活動進行中');
    const channel = client.channels.cache.get(channelId);
    if (!channel) throw new Error('Channel not found');

  // 冒險任務風格訊息
  const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const optionList = options.map((opt, idx) => `${optionLabels[idx]}. ${opt}`).join('\n');
  const msg = `🗡️【冒險任務啟動】\n勇者啊！前方有一道試煉等你通過。\n題目：${question}\n\n選項：\n${optionList}\n\n⏳你有 ${countdown} 秒的時間作答，請輸入答案編號（A、B、C、D${options.length > 4 ? ' 或 ' + optionLabels[options.length-1] : ''}）來完成挑戰！\n成功答對者，將獲得神秘寶藏🎁！`;
  await channel.send(msg);

    // 記錄活動狀態
    const startTime = Date.now();
    const endTime = startTime + countdown * 1000;
    currentLottery = {
      answer,
      winners,
      channelId,
      startTime,
      endTime
    };

    // 設定倒數結束後回溯訊息抽獎
    setTimeout(async () => {
      try {
        // 取得活動期間的所有訊息
        let fetched = [];
        let lastId;
        while (true) {
          const options = { limit: 100 };
          if (lastId) options.before = lastId;
          const messages = await channel.messages.fetch(options);
          const msgs = Array.from(messages.values()).filter(msg =>
            msg.createdTimestamp >= startTime && msg.createdTimestamp <= endTime && !msg.author.bot
          );
          fetched = fetched.concat(msgs);
          if (messages.size < 100) break;
          lastId = messages.last().id;
        }
        // 統計分析
        const userSet = new Set();
        const answerStats = {};
        const optionLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        optionLabels.slice(0, options.length).forEach(label => {
          answerStats[label] = 0;
        });
        fetched.forEach(msg => {
          const ans = msg.content.trim().toUpperCase();
          if (answerStats.hasOwnProperty(ans)) {
            answerStats[ans]++;
          }
          userSet.add(msg.author.id);
        });
        // 篩選答對者
        const correctUsers = Array.from(new Set(
          fetched.filter(msg => msg.content.trim().toUpperCase() === answer.toUpperCase()).map(msg => msg.author.id)
        ));
        let resultMsg = '';
        if (correctUsers.length === 0) {
          resultMsg = '可惜啦～這次沒有勇者解開謎題。\n寶藏依然沉睡，等待下一位冒險者來挑戰……';
        } else {
          // 隨機抽出指定人數
          const shuffled = correctUsers.sort(() => Math.random() - 0.5);
          const winnersList = shuffled.slice(0, winners);
          resultMsg = `恭喜勇者成功解開謎題，獲得神秘寶藏🎁：\n` + winnersList.map(u => `<@${u}>`).join('\n');
        }
        await channel.send(`⌛【任務結束】\n${resultMsg}`);

        // 回傳分析資料給前端
        dashboardApi.emit('lotteryResult', {
          totalParticipants: userSet.size,
          answerStats,
          correctCount: correctUsers.length,
          winners: correctUsers
        });
      } catch (err) {
        await channel.send('抽獎活動結束，但回溯訊息時發生錯誤。');
      }
      currentLottery = null;
    }, countdown * 1000);

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 不再即時監聽訊息，改為回溯
