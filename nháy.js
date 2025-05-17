const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const puppeteer = require('puppeteer');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000;

const portals = {
  sunwin: {
    name: 'SunWin',
    url: 'https://play.sun.win/?affId=Sunwin',
    sessionSelector: '.round-number',
    resultSelector: '.result-latest'
  },
  sumclub: {
    name: 'SumClub',
    url: 'https://play.sum34.club/?domain=sum34.club&packname=home',
    sessionSelector: '.tx-round',
    resultSelector: '.tx-result'
  },
  hitclub: {
    name: 'HitClub',
    url: 'https://i.hit.club/?a=5515bd8c5762faf8a623750ca43860ec',
    sessionSelector: '.hit-round',
    resultSelector: '.hit-result'
  },
  gb68: {
    name: '68GB',
    url: 'https://68gbvn25.art?code=20534718',
    sessionSelector: '.gb-round',
    resultSelector: '.gb-result'
  }
};

let currentPortal = portals.sunwin;
let lastSession = null;
let lastResult = null;
let browser, page;

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>🎯 Tool Nháy Tài Xỉu Realtime</title>
  <style>
    body {
      background-color: #000;
      color: #0f0;
      font-family: monospace;
      text-align: center;
      padding-top: 40px;
    }
    h1 { color: cyan; font-size: 24px; }
    button {
      margin: 5px;
      padding: 10px 15px;
      background: #111;
      color: #0f0;
      border: 1px solid #0f0;
      cursor: pointer;
    }
    #session { font-size: 22px; margin-top: 20px; color: yellow; }
    #result { font-size: 36px; margin-top: 10px; color: orange; }
  </style>
</head>
<body>
  <h1>🎲 Tool Nháy Tài Xỉu Realtime</h1>
  <p>Chọn cổng chơi:</p>
  <button onclick="choose('sunwin')">SunWin</button>
  <button onclick="choose('sumclub')">SumClub</button>
  <button onclick="choose('hitclub')">HitClub</button>
  <button onclick="choose('gb68')">68GB</button>

  <div id="session">Phiên: ---</div>
  <div id="result">Chưa có dữ liệu</div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    function choose(key) {
      socket.emit('choosePortal', key);
      document.getElementById('session').innerText = 'Phiên: ---';
      document.getElementById('result').innerText = 'Đang tải...';
    }

    socket.on('newResult', data => {
      document.getElementById('session').innerText = 'Phiên: ' + data.session;
      document.getElementById('result').innerText = data.result;
    });
  </script>
</body>
</html>
  `);
});

io.on('connection', socket => {
  console.log('🧩 Client connected');

  socket.on('choosePortal', async key => {
    if (portals[key]) {
      currentPortal = portals[key];
      lastSession = null;
      lastResult = null;
      console.log('🟢 Đã chọn cổng:', currentPortal.name);

      try {
        if (page) await page.close();
        if (browser) await browser.close();

        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        page = await browser.newPage();
        await page.goto(currentPortal.url, { waitUntil: 'networkidle2', timeout: 30000 });

        socket.emit('newResult', { session: '---', result: 'Đang tải...' });
      } catch (e) {
        console.error('❌ Lỗi khi mở trang:', e.message);
        socket.emit('newResult', { session: '---', result: 'Lỗi tải trang' });
      }
    }
  });

  socket.emit('newResult', { session: '---', result: 'Vui lòng chọn cổng' });
});

async function fetchData() {
  if (!page) return;

  try {
    await page.waitForSelector(currentPortal.sessionSelector, { timeout: 10000 });
    await page.waitForSelector(currentPortal.resultSelector, { timeout: 10000 });

    const sessionText = await page.$eval(currentPortal.sessionSelector, el => el.innerText.trim());
    const resultText = await page.$eval(currentPortal.resultSelector, el => el.innerText.trim());

    const sessionNum = sessionText.match(/\d+/)?.[0] || sessionText;
    let result = '???';
    if (/tài/i.test(resultText)) result = 'TÀI';
    else if (/xỉu/i.test(resultText)) result = 'XỈU';
    else result = resultText.toUpperCase();

    if (sessionNum !== lastSession || result !== lastResult) {
      lastSession = sessionNum;
      lastResult = result;
      io.emit('newResult', { session: sessionNum, result });
      console.log(`✅ Phiên ${sessionNum}: ${result}`);
    }
  } catch (e) {
    console.log('⚠️ Lỗi lấy dữ liệu:', e.message);
  }
}

setInterval(fetchData, 15000);

server.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
