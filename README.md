# Discord Bot + 後台管理系統

本專案結合 Discord Bot（discord.js v14）與 Express 後台 API，並提供分頁式 Dashboard 前端，方便管理與互動。

## 主要功能

- 投票抽獎（支援問答、抽獎、活動紀錄、分布分析）
- 訊息讀取
- 資料分析（CSV 檔案管理、分頁搜尋/排序/輸出/刪除、圖表統計）
- 用戶資料收集

## 專案目錄結構

```
DCBOT/
├─ index.js           # 主後端程式（Discord Bot + Express API）
├─ dashboard/
│  ├─ index.html      # Dashboard 主頁
│  ├─ lottery.html    # 抽獎管理分頁
│  ├─ vote.html       # 投票管理分頁
│  ├─ lottery-record.html # 抽獎紀錄分頁（檔案管理/分析/圖表）
│  ├─ main.js         # 前端 JS（分頁切換、互動、檔案管理、分析）
├─ data/              # 活動紀錄 CSV 檔案
├─ package.json       # 依賴管理
├─ .env               # Discord Bot Token
└─ README.md          # 說明文件
```

## 安裝與啟動

1. 安裝依賴：
   ```powershell
   npm install
   ```
2. 設定 `.env` 檔案，內容如下：
   ```env
   DISCORD_TOKEN=你的BotToken
   ```
3. 啟動 Bot 與後台 API：
   ```powershell
   npm start
   ```
4. 開啟瀏覽器進入 Dashboard：
   http://localhost:3030/dashboard/index.html

## Dashboard 功能

- DC 伺服器選擇
- 文字聊天室選擇
- 分頁式管理（抽獎、投票、活動紀錄）
- 檔案搜尋、排序、輸出、刪除
- 活動紀錄 CSV 解析與分布圖表
- 參加人數、答對人數、抽獎人數、得獎名單統計
- 互動式 UI（Chart.js 圖表、分頁切換、檔案管理）

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

## 參考

- [discord.js 官方文件](https://discord.js.org/#/docs/discord.js/main/general/welcome)

---

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
