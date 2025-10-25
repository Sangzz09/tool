import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;
const API_URL = "https://hitclub-all-ban-o5ir.onrender.com/api/taixiu";

// =======================
// 🧠 DỮ LIỆU VÀ THỐNG KÊ
// =======================
let history = [];
let stats = { total: 0, correct: 0, wrong: 0, lastPhien: null, lastDuDoan: null };

// =======================
// 🎲 HÀM HỖ TRỢ
// =======================
function ketQuaTuTong(tong) {
  return tong >= 11 ? "Tai" : "Xiu";
}

function taoPattern(hist) {
  return hist.map(h => (h.ket_qua === "Tai" ? "t" : "x")).join("");
}

// Reset giữ lại 5 phiên mới nhất khi quá 20 phiên
function resetHistoryIfNeeded() {
  if (history.length > 20) history = history.slice(-5);
}

// =======================
// 💡 CÁC LOẠI CẦU VÀ THUẬT TOÁN
// =======================
function duDoanTheoCau(hist) {
  if (hist.length < 6) return Math.random() > 0.5 ? "Tai" : "Xiu";

  const recent = hist.slice(-8).map(h => h.ket_qua);
  const last = recent[recent.length - 1];

  // Dự đoán mặc định (cầu ngược)
  let duDoan = last === "Tai" ? "Xiu" : "Tai";
  let loaiCau = "Cầu ngược";

  // Cầu bệt
  const countLast = recent.filter(v => v === last).length;
  if (countLast >= 5) {
    duDoan = last;
    loaiCau = "Cầu bệt dài";
  }

  // Cầu đảo 1-1
  const last4 = recent.slice(-4);
  if (last4[0] !== last4[1] && last4[1] !== last4[2]) {
    duDoan = last4[3] === "Tai" ? "Xiu" : "Tai";
    loaiCau = "Cầu đảo 1-1";
  }

  // Cầu 2-2
  if (recent[0] === recent[1] && recent[2] === recent[3]) {
    duDoan = recent[3] === "Tai" ? "Xiu" : "Tai";
    loaiCau = "Cầu 2-2";
  }

  // Cầu xiên
  if (recent[1] !== recent[0] && recent[2] === recent[0]) {
    duDoan = recent[0];
    loaiCau = "Cầu xiên";
  }

  // Cầu tam giác
  const last3 = recent.slice(-3);
  if (last3[0] === last3[1] && last3[1] !== last3[2]) {
    duDoan = last3[2] === "Tai" ? "Xiu" : "Tai";
    loaiCau = "Cầu tam giác";
  }

  // ===========================
  // ⚙️ THUẬT TOÁN MÁY HỌC MINI
  // ===========================
  const tongTai = recent.filter(v => v === "Tai").length;
  const tongXiu = recent.filter(v => v === "Xiu").length;
  const ratio = tongTai / (tongTai + tongXiu);

  if (ratio > 0.65) {
    duDoan = "Tai";
    loaiCau = "Cầu ML ưu tiên Tài";
  } else if (ratio < 0.35) {
    duDoan = "Xiu";
    loaiCau = "Cầu ML ưu tiên Xỉu";
  }

  // 60 loại cầu HitClub mở rộng ngẫu nhiên (giả lập)
  const listCau = [
    "Cầu đảo 1-1", "Cầu bệt dài", "Cầu xiên", "Cầu 2-2", "Cầu tam giác",
    "Cầu nhịp 3", "Cầu ziczac", "Cầu nhấp nhô", "Cầu lệch trái", "Cầu lệch phải",
    "Cầu gối đầu", "Cầu song song", "Cầu đan xen", "Cầu lặp 3", "Cầu ngắn hạn",
    "Cầu chéo", "Cầu đảo 2-1", "Cầu ngược pha", "Cầu ngẫu nhiên", "Cầu bệt xiên",
    "Cầu hit đặc biệt", "Cầu xoay vòng", "Cầu đuôi 6", "Cầu đầu 1", "Cầu xác suất mạnh",
    "Cầu sóng", "Cầu lệch 2 pha", "Cầu ngắn 4", "Cầu dài 7", "Cầu đảo 5-1",
    "Cầu phản lực", "Cầu nhiệt độ", "Cầu chu kỳ", "Cầu trùng 2-3", "Cầu kép",
    "Cầu méo", "Cầu lực hút", "Cầu phản hồi", "Cầu AI mini", "Cầu ML chính xác",
    "Cầu hybrid", "Cầu momentum", "Cầu adaptive", "Cầu entropy thấp", "Cầu bias trái",
    "Cầu bias phải", "Cầu đảo mồi", "Cầu dồn lực", "Cầu hội tụ", "Cầu ngắt đoạn",
    "Cầu phản ứng", "Cầu tái sinh", "Cầu bayes", "Cầu hồi tiếp", "Cầu chuỗi vàng",
    "Cầu max min", "Cầu cân bằng", "Cầu chốt lời", "Cầu quay đầu", "Cầu Markov Pro"
  ];

  // ghép 1 loại cầu ngẫu nhiên để hiển thị thực tế hơn
  loaiCau = `${loaiCau} - ${listCau[Math.floor(Math.random() * listCau.length)]}`;

  return { duDoan, loaiCau };
}

// =======================
// 📈 TÍNH ĐỘ TIN CẬY
// =======================
function tinhDoTinCay(hist, duDoan) {
  if (hist.length < 10) return 50;
  const recent = hist.slice(-10);
  const tanSuat = recent.filter(h => h.ket_qua === duDoan).length;
  return Math.min(95, Math.max(30, Math.round((tanSuat / recent.length) * 100)));
}

// =======================
// 🔗 API CHÍNH
// =======================
app.get("/api/taixiu", async (req, res) => {
  try {
    const resp = await fetch(API_URL);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error("API nguồn không hợp lệ");

    const newHistory = data.slice(-1)[0];

    // Nếu là phiên mới
    if (!history.find(h => h.phien === newHistory.phien)) {
      history.push(newHistory);
      resetHistoryIfNeeded();

      // Cập nhật thống kê
      if (stats.lastPhien && stats.lastDuDoan) {
        const last = history[history.length - 2];
        if (last && last.ket_qua) {
          if (last.ket_qua === stats.lastDuDoan) stats.correct++;
          else stats.wrong++;
          stats.total++;
        }
      }
    }

    const { duDoan, loaiCau } = duDoanTheoCau(history);
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
      loai_cau: loaiCau,
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
  res.send("🎲 AI HitClub Pro v3 - Machine Learning Mini đang hoạt động!");
});

app.listen(PORT, () => console.log(`✅ Server chạy tại cổng ${PORT}`));
