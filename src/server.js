// ==============================
// HITCLUB - AUTO TÀI XỈU API
// Dev: @minhsangdangcap
// ==============================

const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Đọc cấu hình từ tt.json
const CONFIG_FILE = "./tt.json";
const DATA_FILE = "./data.json";
let CONFIG = {};

try {
  CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
} catch (err) {
  console.error("⚠️ Không đọc được tt.json, dùng mặc định:", err.message);
  CONFIG = {
    id: "@minhsangdangcap",
    source_api: "https://hitclub-all-ban-o5ir.onrender.com/api/taixiu",
    update_interval: 5000,
    max_sessions: 15,
    retain_sessions: 5,
    algorithm: "Markov Chain + Pattern AI"
  };
}

// Đọc dữ liệu cũ nếu có
let history = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    history = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    history = [];
  }
}

// ==============================
// 🎯 Phát hiện loại cầu Hitclub
// ==============================
function detectPattern(list) {
  if (list.length < 4) return "Chưa đủ dữ liệu";
  const reversed = [...list].reverse();
  const last = reversed[0];

  if (reversed[0] === reversed[1] && reversed[1] === reversed[2])
    return "Cầu bệt";

  if (reversed[0] !== reversed[1] && reversed[1] !== reversed[2] && reversed[0] === reversed[2])
    return "Cầu 1-1 luân phiên";

  if (reversed[0] !== reversed[1] && reversed[1] === reversed[2])
    return "Cầu 2-1 đảo chiều";

  if (reversed[0] === reversed[1] && reversed[2] === reversed[3] && reversed[0] !== reversed[2])
    return "Cầu lặp đôi";

  if (reversed[0] !== reversed[1] && reversed[1] !== reversed[2] && reversed[2] !== reversed[3])
    return "Cầu gãy";

  if (reversed.slice(0, 3).every(k => k === "Tài"))
    return "Cầu chuỗi Tài";

  if (reversed.slice(0, 3).every(k => k === "Xỉu"))
    return "Cầu chuỗi Xỉu";

  return "Không rõ (đang hình thành)";
}

// ==============================
// 📈 Thống kê đúng / sai
// ==============================
function calcAccuracy() {
  let correct = 0, wrong = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1].du_doan && history[i].ket_qua) {
      if (history[i - 1].du_doan === history[i].ket_qua) correct++;
      else wrong++;
    }
  }
  return { correct, wrong };
}

// ==============================
// 🔮 Thuật toán dự đoán
// ==============================
function predictNext() {
  if (history.length < 2) return "Chưa đủ dữ liệu";
  const last = history[history.length - 1].ket_qua;
  const pattern = detectPattern(history.map(h => h.ket_qua));

  if (pattern.includes("bệt")) return last;
  if (pattern.includes("luân phiên")) return last === "Tài" ? "Xỉu" : "Tài";
  if (pattern.includes("2-1")) return last === "Tài" ? "Xỉu" : "Tài";
  if (pattern.includes("lặp")) return last;
  if (pattern.includes("chuỗi")) return last;
  return last === "Tài" ? "Xỉu" : "Tài";
}

// ==============================
// 🔁 Gọi API gốc liên tục
// ==============================
async function fetchData() {
  try {
    const res = await axios.get(CONFIG.source_api, { timeout: 10000 });
    const data = res.data;

    if (!data || !data.phien) throw new Error("Không có dữ liệu hợp lệ từ API gốc.");

    const record = {
      phien: data.phien,
      ket_qua: data.ket_qua,
      xuc_xac: data.xuc_xac,
      tong: data.tong,
      du_doan: predictNext(),
      thoi_gian: new Date().toLocaleString("vi-VN")
    };

    // Nếu là phiên mới → thêm
    if (!history.find(h => h.phien === record.phien)) {
      history.push(record);

      // Reset khi vượt giới hạn
      if (history.length > CONFIG.max_sessions)
        history = history.slice(-CONFIG.retain_sessions);

      fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
      console.log(`✅ Cập nhật phiên ${record.phien}: ${record.ket_qua}`);
    }
  } catch (err) {
    console.error("⚠️ Lỗi API:", err.message);
  } finally {
    // Lặp lại
    setTimeout(fetchData, CONFIG.update_interval);
  }
}
fetchData();

// ==============================
// 🌐 Endpoint chính /hitapi
// ==============================
app.get("/hitapi", (req, res) => {
  if (history.length === 0)
    return res.json({ error: "Chưa có dữ liệu, vui lòng đợi vài giây..." });

  const last = history[history.length - 1];
  const next = predictNext();
  const pattern = detectPattern(history.map(h => h.ket_qua));
  const { correct, wrong } = calcAccuracy();

  res.json({
    phien: last.phien,
    xuc_xac: last.xuc_xac,
    tong: last.tong,
    ket_qua: last.ket_qua,
    du_doan: next,
    loai_cau: pattern,
    thuat_toan: CONFIG.algorithm,
    so_lan_dung: correct,
    so_lan_sai: wrong,
    tong_lich_su: history.length,
    id: CONFIG.id
  });
});

// ==============================
// 🚀 Khởi chạy server
// ==============================
app.listen(PORT, () => {
  console.log(`🚀 HITCLUB API running at http://localhost:${PORT}/hitapi`);
});
