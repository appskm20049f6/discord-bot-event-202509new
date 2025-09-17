// lottery.js
// 抽獎工具 JS

function createLottery() {
  alert('這裡可以彈出新建抽獎活動的表單');
}

function loadLotteryList() {
  fetch('/api/lottery')
    .then(res => res.json())
    .then(list => {
      document.getElementById('lotteryList').innerHTML =
        list.map(item => `<div>活動：${item.name}</div>`).join('');
    });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('lotteryBtn').onclick = createLottery;
  loadLotteryList();
});
