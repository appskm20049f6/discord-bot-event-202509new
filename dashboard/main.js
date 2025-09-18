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
  // 自動選第一個並更新 localStorage.channelId
  if (filtered.length) {
    chSel.value = filtered[0].id;
    localStorage.channelId = filtered[0].id;
  } else {
    localStorage.channelId = '';
  }
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
      if (page === 'analysis') initAnalysisPage();
    });
}

// ====== 抽獎分頁 ======
function initLottery() {
  window.submitLottery = function() {
    const title = document.getElementById('lotteryTitle').value;
    const answer = document.getElementById('lotteryAnswer').value;
    const time = document.getElementById('lotteryTime').value;
    const winnerCount = document.getElementById('lotteryWinnerCount').value;
    const options = ['optionA','optionB','optionC','optionD']
      .map(n => document.getElementsByName(n)[0].value.trim())
      .filter(Boolean);
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

// ====== 投票分頁 ======
function initVote() {
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

// ====== 抽獎紀錄分頁 ======
window.initLotteryRecord = function() {
  const fileList = document.getElementById('file-list');
  const analysisArea = document.getElementById('analysis-area');
  if (!fileList) return;
  fetch('/api/lottery')
    .then(res => res.json())
    .then(list => {
      const searchBarHtml = `<input id='record-search' type='text' placeholder='搜尋檔案...' style='padding:8px 16px;font-size:16px;border-radius:8px;border:1px solid #ccc;width:220px;'>`;
      const sortBarHtml = `<select id='record-sort' style='padding:8px 12px;font-size:16px;border-radius:8px;border:1px solid #ccc;'>
        <option value='new'>最新優先</option>
        <option value='old'>最舊優先</option>
        <option value='name'>檔名排序</option>
      </select>`;
      fileList.parentElement.insertAdjacentHTML(
        'afterbegin',
        `<div style='display:flex;justify-content:center;align-items:center;gap:18px;margin-bottom:18px;'>${searchBarHtml}${sortBarHtml}</div>`
      );

      let allFiles = list.slice();
      function renderFileList() {
        let keyword = document.getElementById('record-search').value.trim();
        let sortType = document.getElementById('record-sort').value;
        let filtered = allFiles.filter(item => item.name.includes(keyword));
        if (sortType === 'new') filtered.sort((a,b) => b.name.localeCompare(a.name));
        if (sortType === 'old') filtered.sort((a,b) => a.name.localeCompare(b.name));
        if (sortType === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name));
        fileList.innerHTML = filtered.map(item => {
          const match = item.name.match(/^【([^】]+)】([^_]+)_(.+?)\.csv$/);
          const date = match ? match[1] : '';
          const title = match ? match[2] : item.name;
          const time = match ? match[3].replace(/-/g, ':') : '';
          const btnText = match ? `${date}｜${title}｜${time}` : item.name;
          return `<div style='display:flex;align-items:center;gap:12px;margin-bottom:12px;'>
            <button class="file-btn" data-url="${item.url}" data-name="${item.name}">${btnText}</button>
            <button class="file-btn" style='background:#6c757d;' data-action='download' data-url="${item.url}" data-name="${item.name}">輸出</button>
            <button class="file-btn" style='background:#dc3545;' data-action='delete' data-name="${item.name}">刪除</button>
          </div>`;
        }).join('');
        document.querySelectorAll('.file-btn[data-action="download"]').forEach(btn => {
          btn.onclick = () => window.open(btn.dataset.url, '_blank');
        });
        document.querySelectorAll('.file-btn[data-action="delete"]').forEach(btn => {
          btn.onclick = () => deleteFile(btn.dataset.name);
        });
        document.querySelectorAll('.file-btn:not([data-action])').forEach(btn => {
          btn.onclick = () => showAnalysis(btn.dataset.url, btn.dataset.name);
        });
      }
      document.getElementById('record-search').oninput = renderFileList;
      document.getElementById('record-sort').onchange = renderFileList;
      renderFileList();

      async function deleteFile(fileName) {
        if (!confirm(`確定要刪除檔案？\n${fileName}`)) return;
        const res = await fetch(`/api/delete-csv?name=${encodeURIComponent(fileName)}`, { method: 'DELETE' });
        if (res.ok) {
          allFiles = allFiles.filter(f => f.name !== fileName);
          renderFileList();
          alert('檔案已刪除');
        } else {
          alert('刪除失敗');
        }
      }

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

          let optionMap = {};
          options.forEach((opt, idx) => {
            const label = String.fromCharCode(65 + idx);
            optionMap[label] = opt;
          });

          let counts = {};
          Object.keys(optionMap).forEach(label => { counts[label] = 0; });
          answerRows.forEach(row => {
            let cols = row.split(',');
            let ans = cols[2];
            if (counts.hasOwnProperty(ans)) counts[ans]++;
          });

          const labels = Object.keys(optionMap).map(label => `${label}：${optionMap[label]}`);
          const data = Object.keys(optionMap).map(label => counts[label]);

          const totalParticipants = answerRows.length;
          let winnerLine = lines.find(l => l.startsWith('抽獎人數,'));
          let winnerCount = winnerLine ? winnerLine.split(',')[1] : '';
          let answerLine = lines.find(l => l.startsWith('正確答案,'));
          let correctAnswer = answerLine ? answerLine.split(',')[1].toUpperCase() : '';
          let winners = [];
          answerRows.forEach(row => {
            let cols = row.split(',');
            if (cols[2] === correctAnswer) winners.push({ name: cols[0], id: cols[1] });
          });
          let picked = winners.slice(0, Number(winnerCount));

          const fileNameMatch = fileName.match(/^【([^】]+)】([^_]+)_(.+?)\.csv$/);
          let displayTitle = fileName;
          if (fileNameMatch) {
            const date = fileNameMatch[1];
            const title = fileNameMatch[2];
            const time = fileNameMatch[3].replace(/-/g, ':');
            displayTitle = `【${date}】${title} ${time}`;
          }

          let headerHtml = `<div style='margin-bottom:10px;font-size:18px;font-weight:bold;'>${displayTitle}</div>
            <div style='margin-bottom:14px;font-size:16px;'>預計抽出 <b>${winnerCount}</b> 位幸運兒獲得寶藏</div>`;

          let statHtml = `<div style='margin-bottom:18px;font-size:17px;'>
            參加人數：<b>${totalParticipants}</b><br>
            答對人數：<b>${winners.length}</b><br>
            實際抽出：<b>${picked.length}</b><br>
            <div style='margin:8px 0;'>每個答案選擇人數：</div>
            <ul style='margin-bottom:8px;'>${labels.map((l,i) => `<li>${l}：${data[i]}人</li>`).join('')}</ul>
            <div style='margin:8px 0;'>中獎者：</div>
            <ul>${picked.length ? picked.map(u => `<li>${u.name} (${u.id})</li>`).join('') : '<li>無</li>'}</ul>
          </div>`;

          analysisArea.innerHTML = `<button class='back-btn' onclick='backToList()'>← 返回紀錄列表</button>
            ${headerHtml}
            ${statHtml}
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
            options: { responsive: true, plugins: { legend: { display: false } } }
          });
        } catch (err) {
          analysisArea.innerHTML = `<button class='back-btn' onclick='backToList()'>← 返回紀錄列表</button><div style='color:red;'>載入失敗：${err.message}</div>`;
        }
      }

      window.backToList = function() {
        fileList.style.display = '';
        analysisArea.style.display = 'none';
      }
    });
}

// ====== 分析分頁 ======
window.initAnalysisPage = function() {
  const btn = document.getElementById('analyze-btn');
  const resultArea = document.getElementById('result-area');
  if (!btn) return;

  btn.onclick = async function() {
    resultArea.innerHTML = '⏳ 分析中...';
    const channelId = localStorage.channelId;
    const startDate = document.getElementById('date-start').value;
    const endDate = document.getElementById('date-end').value;
    if (!channelId) {
      resultArea.innerHTML = '<span style="color:red;">請先在主頁選擇頻道</span>';
      return;
    }
    if (!startDate || !endDate) {
      resultArea.innerHTML = '<span style="color:red;">請選擇起訖日期</span>';
      return;
    }
    try {
      const res = await fetch(`/api/analyze-channel-messages?channelId=${channelId}&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (data.error) {
        resultArea.innerHTML = `<span style='color:red;'>${data.error}</span>`;
        return;
      }
      let html = `<div style='font-size:18px;font-weight:bold;margin-bottom:12px;'>分析結果</div>`;
      html += `<div>訊息總數：<b>${data.totalMessages}</b></div>`;
      html += `<div>活躍用戶數：<b>${data.users.length}</b></div>`;
      if (data.dailyStats && data.dailyStats.length) {
        html += `<div class='chart-container'><canvas id='dailyChart'></canvas></div>`;
      }
      if (data.hourlyStats && data.hourlyStats.length) {
        html += `<div class='chart-container'><canvas id='hourlyChart'></canvas></div>`;
      }
      resultArea.innerHTML = html;
      if (data.dailyStats && data.dailyStats.length && window.Chart) {
        new Chart(document.getElementById('dailyChart'), {
          type: 'bar',
          data: {
            labels: data.dailyStats.map(d => d.date),
            datasets: [{ label: '訊息數', data: data.dailyStats.map(d => d.count), backgroundColor:'#007bff' }]
          },
          options: { responsive:true, plugins:{legend:{display:false}} }
        });
      }
      if (data.hourlyStats && data.hourlyStats.length && window.Chart) {
        new Chart(document.getElementById('hourlyChart'), {
          type: 'bar',
          data: {
            labels: data.hourlyStats.map(d => d.hour),
            datasets: [{ label: '訊息數', data: data.hourlyStats.map(d => d.count), backgroundColor:'#ffc107' }]
          },
          options: { responsive:true, plugins:{legend:{display:false}} }
        });
      }
    } catch (err) {
      resultArea.innerHTML = `<span style='color:red;'>分析失敗：${err.message}</span>`;
    }
  };
};

// analysis.html 載入時自動初始化
if (location.pathname.endsWith('analysis.html')) initAnalysisPage();

// 預設載入抽獎分頁
loadPage('lottery');

document.getElementById('channels').addEventListener('change', function(e) {
  localStorage.channelId = e.target.value;
});


