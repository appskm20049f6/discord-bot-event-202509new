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
