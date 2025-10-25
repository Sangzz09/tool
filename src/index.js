import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;
const SOURCE_API = "https://hitclub-all-ban-o5ir.onrender.com/api/taixiu";

let history = [];
let stats = { total: 0, correct: 0, wrong: 0 };
let predictedPhien = null;
let currentData = {};

// ===== DANH SÁCH CẦU THỰC TẾ (40 loại) =====
const patternList = {
  "TTTTTT": "Cầu bệt Tài",
  "XXXXXX": "Cầu bệt Xỉu",
  "TXTXTX": "Cầu xen kẽ 1-1",
  "TTXXTT": "Cầu 2-2 đều",
  "TTTXXX": "Cầu 3-3",
  "TTTX": "Cầu 3 Tài 1 Xỉu",
  "XXXT": "Cầu 3 Xỉu 1 Tài",
  "TTTXX": "Cầu gãy Tài",
  "XXXT": "Cầu gãy Xỉu",
  "TXTXX": "Cầu nhấp nhả",
  "TTTTX": "Cầu rồng Tài",
  "XXXXT": "Cầu rồng Xỉu",
  "TTTXTX": "Cầu đảo nhẹ Tài",
  "XXXTXX": "Cầu đảo nhẹ Xỉu",
  "TTXTT": "Cầu lò xo Tài",
  "XXTXX": "Cầu lò xo Xỉu",
  "TXTTX": "Cầu xen Tài",
  "XTXXT": "Cầu xen Xỉu",
  "TTTXTTTX": "Cầu đôi rồng Tài",
  "XXXTXXXT": "Cầu đôi rồng Xỉu",
  "TTXXTTXX": "Cầu xen 2-2",
  "TTTXTTTX": "Cầu 3-1-3",
  "TTTXTXTX": "Cầu giật 8 bước Tài",
  "XXXTXTXX": "Cầu giật 8 bước Xỉu",
  "TXTXXTXT": "Cầu ziczac 8 bước",
  "TTTTXT": "Cầu 5-1 Tài",
  "XXXXTX": "Cầu 5-1 Xỉu",
  "TTTXXT": "Cầu đứt đoạn",
  "XXTTTX": "Cầu ngược pha",
  "TXTTTX": "Cầu lặp 1-3-1",
  "TXTXXX": "Cầu 1-3-2",
  "TTXXTX": "Cầu bẻ giữa",
  "TTTXXXT": "Cầu hỗn hợp Tài",
  "XXXTXXT": "Cầu hỗn hợp Xỉu",
  "TXTXTT": "Cầu đảo cuối Tài",
  "XTXXTT": "Cầu đảo cuối Xỉu",
  "TTTTT": "Cầu kéo 5 Tài",
  "XXXXX": "Cầu kéo 5 Xỉu",
  "TTTXTT": "Cầu hồi Tài",
  "XXTXTXX": "Cầu hồi Xỉu"
};

// ===== 10 THUẬT TOÁN NÂNG CAO =====
function markovPredict(hist) {
  if (hist.length < 10) return 0.5;
  let transitions = { TT: 0, TX: 0, XX: 0, XT: 0 };
  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1] === "Tai" ? "T" : "X";
    const curr = hist[i] === "Tai" ? "T" : "X";
    transitions[prev + curr]++;
  }
  const pTai = transitions.TT / (transitions.TT + transitions.TX || 1);
  return isNaN(pTai) ? 0.5 : pTai;
}

function entropyPredict(hist) {
  if (hist.length < 6) return 0.5;
  const unique = new Set(hist.slice(-6));
  return unique.size === 1 ? 0.2 : 0.8; // càng hỗn loạn → khả năng đảo cao
}

function momentumPredict(hist) {
  const last10 = hist.slice(-10);
  const t = last10.filter(x => x === "Tai").length;
  const x = last10.length - t;
  if (t > x + 2) return "Tai";
  if (x > t + 2) return "Xiu";
  return null;
}

// ===== PHÁT HIỆN LOẠI CẦU =====
function detectPattern(history) {
  const seq = history.slice(-8).map(v => (v === "Tai" ? "T" : "X")).join("");
  for (const [pattern, name] of Object.entries(patternList)) {
    if (seq.endsWith(pattern)) return name;
  }
  return "Không rõ cầu";
}

// ===== DỰ ĐOÁN CUỐI =====
function predictNext(pattern, history) {
  const last = history.at(-1);
  const counts = { Tai: 0, Xiu: 0 };
  history.forEach(r => counts[r]++);

  // Base theo pattern
  let duDoan = pattern.includes("Xỉu") ? "Xiu" : "Tai";

  // Markov xác suất
  const pMarkov = markovPredict(history);

  // Entropy & Momentum
  const e = entropyPredict(history);
  const m = momentumPredict(history);

  // Nếu cầu hỗn loạn hoặc xen → dùng entropy để đảo chiều
  if (pattern.includes("đảo") || pattern.includes("xen") || e > 0.7)
    duDoan = last === "Tai" ? "Xiu" : "Tai";

  // Momentum override
  if (m) duDoan = m;

  // Markov override
  if (pMarkov > 0.6) duDoan = "Tai";
  if (pMarkov < 0.4) duDoan = "Xiu";

  // Độ tin cậy tổng hợp
  const diff = Math.abs(counts.Tai - counts.Xiu);
  const doTinCay = `${Math.min(60 + diff * 3 + Math.abs(pMarkov - 0.5) * 80, 96).toFixed(0)}%`;

  return { duDoan, doTinCay };
}

// ===== CẬP NHẬT API =====
async function updateData() {
  try {
    const res = await fetch(SOURCE_API);
    const data = await res.json();
    if (!data || !data.ket_qua) return;

    const { phien, xuc_xac, tong, ket_qua } = data;
    if (phien === predictedPhien) return; // chỉ dự đoán 1 lần/phiên

    predictedPhien = phien;
    history.push(ket_qua);
    if (history.length > 120) history.shift();

    const pattern = detectPattern(history);
    const { duDoan, doTinCay } = predictNext(pattern, history);

    stats.total++;
    if (duDoan === ket_qua) stats.correct++;
    else stats.wrong++;

    currentData = {
      phien,
      xuc_xac,
      tong,
      ket_qua,
      du_doan: duDoan,
      do_tin_cay: doTinCay,
      pattern,
      so_phien_du_doan: stats.total,
      so_dung: stats.correct,
      so_sai: stats.wrong,
      dev: "@minhsangdangcap"
    };

    console.log(`✅ Phiên ${phien}: ${ket_qua} → Dự đoán: ${duDoan} (${doTinCay})`);
  } catch (err) {
    console.log("⚠️ Lỗi dữ liệu:", err.message);
  }
}

// ===== TỰ ĐỘNG CẬP NHẬT MỖI 6 GIÂY =====
setInterval(updateData, 6000);

// ===== ROUTE API =====
app.get("/api/taixiu", (req, res) => res.json(currentData));

app.listen(PORT, () => console.log(`🚀 Server HitClub AI đang chạy tại cổng ${PORT}`));
