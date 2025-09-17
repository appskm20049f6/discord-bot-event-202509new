// main.js - Dashboard 前端主 JS

// 載入伺服器選單
fetch('/api/guilds')
  .then(res => res.json())
  .then(guilds => {
    const guildSel = document.getElementById('guilds');
    guildSel.innerHTML = '';
    guilds.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      guildSel.appendChild(opt);
    });
    if (guilds.length) loadChannels(guilds[0].id);
  });
document.getElementById('guilds').onchange = e => {
  loadChannels(e.target.value);
};
let allChannels = [];
function loadChannels(guildId) {
  fetch(`/api/guilds/${guildId}/channels`)
    .then(res => res.json())
    .then(channels => {
      allChannels = channels;
      renderChannelOptions('');
    });
}
function renderChannelOptions(keyword) {
  const chSel = document.getElementById('channels');
  chSel.innerHTML = '';
  const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(keyword.toLowerCase()));
  filtered.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = ch.name;
    chSel.appendChild(opt);
  });
}
document.getElementById('channelSearch').addEventListener('input', e => {
  renderChannelOptions(e.target.value);
});
// 單頁式分頁切換
function loadPage(page) {
  document.querySelectorAll('.menu li').forEach(li => li.classList.remove('active'));
  if (document.getElementById('menu-' + page)) {
    document.getElementById('menu-' + page).classList.add('active');
  }
  let pageFile = page;
  if (page === 'record') pageFile = 'lottery-record';
  fetch('/dashboard/' + pageFile + '.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('main-content').innerHTML = html;
      if (page === 'lottery') initLottery();
      if (page === 'vote') initVote();
      if (page === 'record') initLotteryRecord();
      // 活動紀錄頁載入 lottery-record.html 到主內容區，不跳轉整個頁面
    });
}
// 分頁 JS 集中於主頁
function initLottery() {
  // 初始化抽獎分頁互動
  window.submitLottery = function() {
    const title = document.getElementById('lotteryTitle').value;
    const answer = document.getElementById('lotteryAnswer').value;
    const time = document.getElementById('lotteryTime').value;
    const winnerCount = document.getElementById('lotteryWinnerCount').value;
    const options = ['optionA','optionB','optionC','optionD'].map(n => document.getElementsByName(n)[0].value.trim()).filter(Boolean);
    const channelId = document.getElementById('channels')?.value;
    if (!channelId) {
      document.getElementById('lotteryCreateResult').textContent = '⚠️ 請先選擇發布頻道';
      return;
    }
    fetch('/api/start-lottery-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: title,
        options,
        answer,
        countdown: Number(time),
        winners: Number(winnerCount),
        channelId
      })
    })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        document.getElementById('lotteryCreateResult').textContent = '✅ 抽獎活動已發布！';
        document.getElementById('lotteryForm').reset();
        loadLotteryList();
      } else {
        document.getElementById('lotteryCreateResult').textContent = '❌ 發布失敗：' + (result.error || '未知錯誤');
      }
    });
  };
  window.loadLotteryList = function() {
    fetch('/api/lottery')
      .then(res => res.json())
      .then(list => {
        const fileList = document.getElementById('file-list');
        if (fileList) {
          fileList.innerHTML = list.map(item => `<div>活動：${item.name}</div>`).join('');
        }
      })
      .catch(err => {
        const fileList = document.getElementById('file-list');
        if (fileList) {
          fileList.innerHTML = `⚠️ 載入失敗：${err.message}`;
        }
      });
  };
}
function initVote() {
  // 初始化投票分頁互動
  window.createVote = function() {
    alert('這裡可以彈出新建投票的表單');
  };
  fetch('/api/vote')
    .then(res => res.json())
    .then(list => {
      document.getElementById('voteList').innerHTML =
        list.map(item => `<div>投票：${item.name}</div>`).join('');
    });
}
window.initLotteryRecord = function() {
  const fileList = document.getElementById('file-list');
  const analysisArea = document.getElementById('analysis-area');
  if (!fileList) return;
  fetch('/api/lottery')
    .then(res => res.json())
    .then(list => {
      if (!list.length) {
        fileList.innerHTML = '<div>目前尚無抽獎活動紀錄。</div>';
        return;
      }
      fileList.innerHTML = list.map(item => {
        const match = item.name.match(/^【([^】]+)】([^_]+)_(.+?)\.csv$/);
        const date = match ? match[1] : '';
        const title = match ? match[2] : item.name;
        const time = match ? match[3].replace(/-/g, ':') : '';
        const btnText = match ? `${date}｜${title}｜${time}` : item.name;
        return `<button class="file-btn" data-url="${item.url}" data-name="${item.name}">${btnText}</button>`;
      }).join('');
      document.querySelectorAll('.file-btn').forEach(btn => {
        btn.onclick = () => showAnalysis(btn.dataset.url, btn.dataset.name);
      });
    });
  async function showAnalysis(fileUrl, fileName) {
    fileList.style.display = 'none';
    analysisArea.style.display = '';
    analysisArea.innerHTML = `<button class='back-btn' onclick='backToList()'>← 返回紀錄列表</button><div>載入中...</div>`;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error('檔案載入失敗');
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      let optionLine = lines.find(l => l.startsWith('選項,'));
      let options = optionLine ? optionLine.replace('選項,','').split(' | ') : [];
      let answerStart = lines.findIndex(l => l.startsWith('DC名稱,'));
      let answerRows = answerStart >= 0 ? lines.slice(answerStart+1) : [];
      let counts = {};
      options.forEach(opt => {
        let label = opt.match(/^([A-Z])\./) ? opt.match(/^([A-Z])\./)[1] : opt;
        counts[label] = 0;
      });
      answerRows.forEach(row => {
        let cols = row.split(',');
        let ans = cols[2];
        if (counts.hasOwnProperty(ans)) counts[ans]++;
      });
      const labels = Object.keys(counts);
      const data = labels.map(l => counts[l]);
      analysisArea.innerHTML = `<button class='back-btn' onclick='backToList()'>← 返回紀錄列表</button>
        <div style='margin-bottom:18px;font-size:20px;font-weight:bold;'>${fileName}</div>
        <div class='chart-container'><canvas id='answerChart'></canvas></div>`;
      new Chart(document.getElementById('answerChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: '回答人數',
            data,
            backgroundColor: ['#007bff','#00c6ff','#ffc107','#dc3545','#28a745','#6f42c1','#fd7e14']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    } catch (err) {
      analysisArea.innerHTML = `<button class='back-btn' onclick='backToList()'>← 返回紀錄列表</button><div style='color:red;'>載入失敗：${err.message}</div>`;
    }
  }
  window.backToList = function() {
    fileList.style.display = '';
    analysisArea.style.display = 'none';
  }
}
// 預設載入抽獎分頁
loadPage('lottery');
