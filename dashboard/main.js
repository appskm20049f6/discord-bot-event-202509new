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
      // 前端過濾掉沒有歷史訊息讀取與發送權限的頻道
      allChannels = channels.filter(ch => {
        // 權限位元運算：READ_MESSAGE_HISTORY=0x00000040, SEND_MESSAGES=0x00000800
        // API 可回傳 ch.permissions (如有)
        if (typeof ch.permissions === 'number') {
          const canRead = (ch.permissions & 0x00000040) !== 0;
          const canSend = (ch.permissions & 0x00000800) !== 0;
          return canRead && canSend;
        }
        // 若沒權限資訊，預設顯示
        return true;
      });
      renderChannelOptions('');
    });
}

function renderChannelOptions(keyword) {
  const chSel = document.getElementById('channels');
  chSel.innerHTML = '';
  const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(keyword.toLowerCase()));
  // 依 categoryName 分組，並依 position 排序
  // 先取得所有分類與未分類的順序
  const allSorted = allChannels.slice().sort((a, b) => {
    // 先比 category position，再比 channel position
    if (a.categoryId !== b.categoryId) {
      // 未分類排最前
      if (!a.categoryId) return -1;
      if (!b.categoryId) return 1;
      // 依 categoryPosition
      return (a.categoryPosition ?? 0) - (b.categoryPosition ?? 0);
    }
    // 同分類下依 channelPosition
    return (a.channelPosition ?? 0) - (b.channelPosition ?? 0);
  });
  // 依排序後的順序分組
  const groupMap = {};
  allSorted.forEach(ch => {
    if (!ch.name.toLowerCase().includes(keyword.toLowerCase())) return;
    const cat = ch.categoryName || '未分類';
    if (!groupMap[cat]) groupMap[cat] = [];
    groupMap[cat].push(ch);
  });
  Object.keys(groupMap).forEach(cat => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = cat;
    groupMap[cat].forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.name;
      optgroup.appendChild(opt);
    });
    chSel.appendChild(optgroup);
  });
  // 自動選第一個並更新 localStorage.channelId
  const first = filtered[0];
  if (first) {
    chSel.value = first.id;
    localStorage.channelId = first.id;
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
    // 顯示進度條
    resultArea.innerHTML = `<div id='progress-bar' style='width:100%;background:#eee;border-radius:8px;height:18px;overflow:hidden;margin-bottom:16px;'><div id='progress-inner' style='height:100%;width:0%;background:#007bff;transition:width 0.3s;'></div></div>分析中...`;
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
    // 模擬進度條
    let progress = 0;
    const progressInner = document.getElementById('progress-inner');
    const timer = setInterval(() => {
      progress = Math.min(progress+10, 90);
      if (progressInner) progressInner.style.width = progress+'%';
    }, 200);
    try {
      const res = await fetch(`/api/analyze-channel-messages?channelId=${channelId}&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      clearInterval(timer);
      if (progressInner) progressInner.style.width = '100%';
      if (data.error) {
        resultArea.innerHTML = `<span style='color:red;'>${data.error}</span>`;
        return;
      }
      let html = `<div style='font-size:18px;font-weight:bold;margin-bottom:12px;'>分析結果</div>`;
      html += `<div>訊息總數：<b>${data.totalMessages}</b></div>`;
      html += `<div>活躍用戶數：<b>${data.users.length}</b></div>`;
      html += `<div>平均訊息長度：<b>${data.averageMsgLength}</b> 字</div>`;
      // 匯出 JSON 按鈕
      html += `<button id='export-json-btn' style='margin:12px 0 18px 0;padding:8px 18px;background:#28a745;color:#fff;border:none;border-radius:6px;cursor:pointer;'>匯出分析結果</button>`;
      // 每週趨勢
      if (data.weeklyStats && data.weeklyStats.length) {
        html += `<div style='margin-top:18px;'>每週訊息趨勢</div><div class='chart-container'><canvas id='weeklyChart'></canvas></div>`;
      }
      // 每日趨勢
      if (data.dailyStats && data.dailyStats.length) {
        html += `<div style='margin-top:18px;'>每日訊息趨勢</div><div class='chart-container'><canvas id='dailyChart'></canvas></div>`;
      }
      // 每小時分布
      if (data.hourlyStats && data.hourlyStats.length) {
        html += `<div style='margin-top:18px;'>活躍時段分布</div><div class='chart-container'><canvas id='hourlyChart'></canvas></div>`;
      }
      // 活躍時段建議
      if (data.hourlyStats && data.hourlyStats.length) {
        const maxHour = data.hourlyStats.reduce((a,b) => b.count > a.count ? b : a, data.hourlyStats[0]);
        html += `<div style='margin-top:12px;'>建議公告/活動發布時段：<b>${maxHour.hour}</b>（此時段訊息最多）</div>`;
      }
      // 活躍成員分布
      if (data.users && data.users.length) {
        html += `<div style='margin-top:18px;'>活躍成員列表（前20）</div><ul style='max-height:180px;overflow:auto;background:#f3f3f3;padding:10px;border-radius:8px;'>`;
        const sortedUsers = data.users.slice().sort((a,b) => b.messageCount - a.messageCount).slice(0,20);
        sortedUsers.forEach(u => {
          html += `<li>名稱: <b>${u.username || u.id}</b>，訊息數：<b>${u.messageCount}</b></li>`;
        });
        html += `</ul>`;
        // 判斷是否集中少數人
        const top5 = sortedUsers.slice(0,5).reduce((sum,u) => sum+u.messageCount,0);
        const percent = data.totalMessages ? Math.round(top5/data.totalMessages*100) : 0;
        html += `<div style='margin-top:8px;'>前5名成員佔全部訊息 <b>${percent}%</b></div>`;
      }
      resultArea.innerHTML = html;
      // 匯出 JSON 功能
      const exportBtn = document.getElementById('export-json-btn');
      if (exportBtn) {
        exportBtn.onclick = function() {
          const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `analysis_${channelId}_${startDate}_${endDate}.json`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
        };
      }
      // 每週趨勢圖（週順推）
      if (data.weeklyStats && data.weeklyStats.length && window.Chart) {
        const sortedWeekly = data.weeklyStats.slice().sort((a,b)=>a.week.localeCompare(b.week));
        new Chart(document.getElementById('weeklyChart'), {
          type: 'line',
          data: {
            labels: sortedWeekly.map(d => d.week),
            datasets: [{ label: '每週訊息數', data: sortedWeekly.map(d => d.count), backgroundColor:'#17a2b8', borderColor:'#17a2b8', fill:false }]
          },
          options: { responsive:true, plugins:{legend:{display:true}} }
        });
      }
      // 每日趨勢圖（日期順推）
      if (data.dailyStats && data.dailyStats.length && window.Chart) {
        const sortedDaily = data.dailyStats.slice().sort((a,b)=>a.date.localeCompare(b.date));
        new Chart(document.getElementById('dailyChart'), {
          type: 'bar',
          data: {
            labels: sortedDaily.map(d => d.date),
            datasets: [{ label: '每日訊息數', data: sortedDaily.map(d => d.count), backgroundColor:'#007bff' }]
          },
          options: { responsive:true, plugins:{legend:{display:false}} }
        });
      }
      // 每小時分布圖（固定 00:00~23:00 順序）
      if (data.hourlyStats && data.hourlyStats.length && window.Chart) {
        const hourLabels = Array.from({length:24},(_,i)=>i.toString().padStart(2,'0')+':00');
        const hourDataMap = {};
        data.hourlyStats.forEach(d => { hourDataMap[d.hour]=d.count; });
        const hourData = hourLabels.map(h => hourDataMap[h]||0);
        new Chart(document.getElementById('hourlyChart'), {
          type: 'bar',
          data: {
            labels: hourLabels,
            datasets: [{ label: '每小時訊息數', data: hourData, backgroundColor:'#ffc107' }]
          },
          options: { responsive:true, plugins:{legend:{display:false}} }
        });
      }
    } catch (err) {
      clearInterval(timer);
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


