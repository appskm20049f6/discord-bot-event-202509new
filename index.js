import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.content === '!ping') {
    message.reply('Pong!');
  }

  // 新增 !history 指令：讀取頻道歷史訊息並分析
  if (message.content.startsWith('!history')) {
    // 取得頻道最近 100 則訊息
    const messages = await message.channel.messages.fetch({ limit: 100 });
    // 分析訊息內容
    const contents = Array.from(messages.values()).map(msg => msg.content).filter(Boolean);
    // 這裡僅做簡單統計：出現最多的字詞
    const wordCount = {};
    contents.forEach(text => {
      text.split(/\s+/).forEach(word => {
        if (!word) return;
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
    });
    // 取出出現最多的 5 個字詞
    const topWords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => `${word}: ${count}`)
      .join('\n');
    message.reply(`最近 100 則訊息最常出現的字詞：\n${topWords}`);
  }
});

client.login(process.env.DISCORD_TOKEN);

// ===== 提供 Dashboard 取得 guilds & channels 的 API =====
import express from 'express';
import cors from 'cors';
const dashboardApi = express();
dashboardApi.use(cors());
dashboardApi.use(express.json());

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
