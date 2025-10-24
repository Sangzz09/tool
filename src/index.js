import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;
const API_URL = "https://hitclub-all-ban-o5ir.onrender.com/api/taixiu";

let history = []; // lưu lịch sử 20 phiên gần nhất
let stats = { total: 0, correct: 0, wrong: 0, lastPhien: null, lastDuDoan: null };

// --- Xác định kết quả từ tổng ---
function ketQuaTuTong(tong) {
  return tong >= 11 ? "Tài" : "Xỉu";
}

// --- Sinh pattern (chuỗi cầu) từ lịch sử ---
function taoPattern(hist) {
  return hist.map(h => h.ket_qua).join("-");
}

// --- Nhiều loại cầu ---
function duDoanTheoCau(hist) {
  if (hist.length < 5) return Math.random() > 0.5 ? "Tài" : "Xỉu";

  const recent = hist.slice(-6).map(h => h.ket_qua);
  const last = recent[recent.length - 1];
  const before = recent[recent.length - 2];
  const pattern = taoPattern(hist.slice(-6));

  // 🔹 Cầu 1 màu (Tài hoặc Xỉu kéo dài)
  if (recent.every(v => v === "Tài")) return "Xỉu";
  if (recent.every(v => v === "Xỉu")) return "Tài";

  // 🔹 Cầu 1-1 đảo liên tục
  if (recent[5] !== recent[4] && recent[4] !== recent[3]) return last;

  // 🔹 Cầu bệt 2-2
  if (recent[0] === recent[1] && recent[2] === recent[3]) return recent[4] === "Tài" ? "Xỉu" : "Tài";

  // 🔹 Cầu xiên 2 (Tài Xỉu Xỉu Tài ...)
  if (recent[1] !== recent[0] && recent[2] === recent[0]) return recent[0];

  // 🔹 Cầu tam giác (Tài Tài Xỉu, Xỉu Xỉu Tài)
  const last3 = recent.slice(-3);
  if (last3[0] === last3[1] && last3[1] !== last3[2]) return last3[2] === "Tài" ? "Xỉu" : "Tài";

  // 🔹 Cầu ngược
  return last === "Tài" ? "Xỉu" : "Tài";
}

// --- Tính độ tin cậy ---
function tinhDoTinCay(hist, duDoan) {
  if (hist.length < 10) return 50;
  const recent = hist.slice(-10);
  const tanSuat = recent.filter(h => h.ket_qua === duDoan).length;
  return Math.round((tanSuat / recent.length) * 100);
}

// --- Reset dữ liệu cầu khi đạt 20 phiên (giữ lại 5 phiên mới nhất) ---
function resetHistoryIfNeeded() {
  if (history.length > 20) {
    history = history.slice(-5);
  }
}

app.get("/api/taixiu", async (req, res) => {
  try {
    const resp = await fetch(API_URL);
    const data = await resp.json();

    if (!Array.isArray(data)) throw new Error("API nguồn không hợp lệ");
    const newHistory = data.slice(-1)[0]; // phiên mới nhất

    // nếu là phiên mới
    if (!history.find(h => h.phien === newHistory.phien)) {
      history.push(newHistory);
      resetHistoryIfNeeded();

      // nếu có kết quả cũ và dự đoán trước đó
      if (stats.lastPhien && stats.lastDuDoan) {
        const last = history[history.length - 2];
        if (last && last.ket_qua) {
          if (last.ket_qua === stats.lastDuDoan) stats.correct++;
          else stats.wrong++;
          stats.total++;
        }
      }
    }

    const duDoan = duDoanTheoCau(history);
    const doTinCay = tinhDoTinCay(history, duDoan);
    const pattern = taoPattern(history);

    stats.lastPhien = newHistory.phien;
    stats.lastDuDoan = duDoan;

    const result = {
      phien: newHistory.phien,
      xuc_xac: newHistory.xuc_xac,
      tong: newHistory.tong,
      ket_qua: newHistory.ket_qua,
      du_doan: duDoan,
      do_tin_cay: doTinCay + "%",
      pattern,
      so_phien_du_doan: stats.total,
      so_dung: stats.correct,
      so_sai: stats.wrong,
      dev: "@minhsangdangcap"
    };

    res.json(result);
  } catch (err) {
    res.json({ error: "Lỗi lấy API: " + err.message });
  }
});

app.get("/", (req, res) => {
  res.send("🎲 Tool AI Dự Đoán Tài Xỉu nâng cấp by @minhsangdangcap đang chạy!");
});

app.listen(PORT, () => console.log(`✅ Server chạy tại cổng ${PORT}`));
