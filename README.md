# Discord Bot 後台管理功能說明

## 主要功能

- 投票
- 訊息讀取
- 資料分析
- 用戶資料收集

## Discord Bot 權限建議

請在 Discord Developer Portal 設定 SCOPES 與 BOT PERMISSIONS 時，勾選以下項目：

### SCOPES

- bot
- guilds.members.read

### BOT PERMISSIONS

- View Channels（查看頻道）
- Send Messages（發送訊息）
- Read Message History（讀取訊息歷史）
- Manage Messages（如需刪除或管理訊息）
- Embed Links（如需嵌入投票或分析結果）
- Add Reactions（如投票用 emoji）
- Use Slash Commands（如要 slash 指令互動）
- View Audit Log（如需分析用戶行為）
- Manage Events（如要建立活動）
- Manage Members（如需查詢成員資料）

> 建議只勾選必要權限，避免過度授權。

如需更多功能或特殊權限，請依需求調整。

# DC-longtimeBot

這是一個使用最新 discord.js v14 的 Node.js Discord Bot 範例。

## 快速開始

1. 安裝依賴：
   ```powershell
   npm install
   ```
2. 編輯 `index.js`，將 `YOUR_BOT_TOKEN_HERE` 替換為你的 Discord Bot Token。
3. 啟動 Bot：
   ```powershell
   npm start
   ```

## 功能

- 登入事件
- 監聽訊息並回覆 `!ping` 指令

## 參考

- [discord.js 官方文件](https://discord.js.org/#/docs/discord.js/main/general/welcome)
