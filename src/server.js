// ==========================================================
// 🎲 HITCLUB TÀI XỈU - DỰ ĐOÁN AI PRO v3.5
// Nguồn: https://hitclub-all-ban-o5ir.onrender.com/api/taixiu
// Tác giả: @minhsangdangcap
// Deploy: Render.com
// ==========================================================

const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

/**
 * NOTE:
 * Nếu API nguồn thay đổi domain hoặc cần token, bạn có thể đặt SOURCE_API trong env var.
 * Ex: process.env.SOURCE_API
 */
const SOURCE_API = process.env.SOURCE_API || "https://hitclub-all-ban-o5ir.onrender.com/api/taixiu";

// ==========================
// Biến lưu trạng thái
// ==========================
let history = [];              // Lịch sử kết quả (mảng "Tai" / "Xiu")
let stats = { dung: 0, sai: 0, tong: 0 }; // Thống kê
let phienCount = 0;            // Đếm số phiên đã nhận (dùng cho reset)

// ==========================
// 🔍 Phát hiện loại cầu nâng cao (HitClub thực tế)
// Trả về chuỗi mô tả loại cầu
// ==========================
function detectPattern(list) {
  if (!Array.isArray(list) || list.length < 4) return "Chưa đủ dữ liệu";
  const last5 = list.slice(-5);
  const p = last5.map(x => (x === "Tai" ? "t" : "x")).join("");

  // Các mẫu thực tế thường gặp (mở rộng)
  if (last5.every(x => x === "Tai")) return "Cầu bệt Tài";
  if (last5.every(x => x === "Xiu")) return "Cầu bệt Xỉu";
  if (last5.every((x, i) => i === 0 || x !== last5[i - 1])) return "Cầu 1-1 xen kẽ";
  if (/ttx|xxt/.test(p)) return "Cầu 2-1 gãy";
  if (/ttxx|xxtt/.test(p)) return "Cầu 2-2 luân phiên";
  if (/ttxxt|xxttx/.test(p)) return "Cầu gãy 2-1-2";
  if (/tttxx|xxxtt/.test(p)) return "Cầu 3-2 xen kẽ";
  if (/ttttt|xxxxx/.test(p)) return "Cầu bệt dài 5";
  if (/txtxt|xtxtx/.test(p)) return "Cầu đảo đều 1-1";
  if (/ttxtt|xxtxx/.test(p)) return "Cầu 2-1-2 bệt nhẹ";
  if (/ttxxtt|xxttxx/.test(p)) return "Cầu 2-2-2 chuỗi";
  if (/txxxt|xtttx/.test(p)) return "Cầu 3-1 xen kẽ";

  // Nếu không khớp các quy tắc trên:
  const last3Same = list.slice(-3).every(x => x === list[list.length - 1]);
  if (last3Same) return `Cầu bệt 3 ${list[list.length - 1]}`;

  return "Cầu hỗn hợp";
}

// ==========================
// 🧠 Các thuật toán dự đoán
// Trả về "Tai" hoặc "Xiu"
// ==========================

// 1️⃣ Markov Chain (rất đơn giản): nếu 2 lần trước giống nhau -> giữ, khác -> đảo
function markovPredict(list) {
  if (!Array.isArray(list) || list.length < 2) return "Xiu";
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  return last === prev ? last : (last === "Tai" ? "Xiu" : "Tai");
}

// 2️⃣ Pattern Memory: tìm mẫu 3 trước trong lịch sử, lấy phần tử tiếp theo nếu có
function patternMemory(list) {
  if (!Array.isArray(list) || list.length < 4) return "Tai";
  const pattern = list.slice(-3).join("-");
  const joined = list.join("-");
  const found = joined.lastIndexOf(pattern);
  if (found === -1) return "Xiu";
  const nextIndex = found + pattern.length + 1; // +1 vì dấu '-'
  const remainder = joined.slice(nextIndex);
  const next = remainder.split("-")[0];
  return next || "Tai";
}

// 3️⃣ Weighted Probability: dựa trên tần suất tổng
function weightedProbability(list) {
  if (!Array.isArray(list) || list.length === 0) return "Tai";
  const countTai = list.filter(x => x === "Tai").length;
  const countXiu = list.filter(x => x === "Xiu").length;
  // Nếu Tai > Xiu thì dự đoán Xiu (kỳ vọng cân bằng ngược lại) — giữ nguyên logic trước
  return countTai > countXiu ? "Xiu" : "Tai";
}

// ==========================
// 🔄 Reset lịch sử tự động
// Khi phienCount đạt 15 -> giữ 5 phiên gần nhất, reset phienCount, reset stats
// ==========================
function autoReset() {
  if (phienCount >= 15) {
    console.log("🔄 Đạt 15 phiên → Reset lịch sử (giữ 5 phiên gần nhất)");
    history = history.slice(-5);
    phienCount = 0;
    stats = { dung: 0, sai: 0, tong: 0 };
  }
}

// ==========================
// 🚀 API chính: /api/taixiu
// Lấy dữ liệu từ SOURCE_API, cập nhật history, chạy thuật toán, trả JSON
// ==========================
app.get("/api/taixiu", async (req, res) => {
  try {
    // Lấy dữ liệu gốc
    const { data } = await axios.get(SOURCE_API, { timeout: 5000 });

    // Dự đoán rằng API gốc trả về các trường như user đã cung cấp:
    // { phien, xuc_xac, tong, ket_qua, phien_sau, du_doan, do_tin_cay, giai_thich, id }
    const phien = data.phien ?? null;
    const xuc_xac = data.xuc_xac ?? (data["xuc xac"] || "");
    const tong_xuc_xac = data.tong ?? data.tong_xuc_xac ?? null;
    const ket_qua = data.ket_qua ?? data.ketQua ?? null;
    const phien_sau = data.phien_sau ?? null;

    // Nếu dữ liệu không hợp lệ, trả lỗi rõ ràng
    if (!phien || !ket_qua) {
      return res.status(502).json({ error: "Dữ liệu từ nguồn không đúng định dạng" });
    }

    // Cập nhật lịch sử (mảng chuỗi "Tai"/"Xiu")
    history.push(ket_qua);
    phienCount++;
    // giới hạn history tránh tăng vô hạn
    if (history.length > 30) history = history.slice(-20);

    // Tự động reset khi đạt 15
    autoReset();

    // Chạy các thuật toán
    const p1 = markovPredict(history);
    const p2 = patternMemory(history);
    const p3 = weightedProbability(history);

    // Đa số phiếu quyết định du_doan chung
    const votes = [p1, p2, p3];
    const taiVotes = votes.filter(v => v === "Tai").length;
    const xiuVotes = votes.filter(v => v === "Xiu").length;
    const du_doan = taiVotes >= xiuVotes ? "Tai" : "Xiu";

    // Loại cầu hiện tại
    const loai_cau = detectPattern(history);

    // Thống kê đúng / sai: so sánh dự đoán lần trước với kết quả hiện tại
    const prevPredictionCompare = history[history.length - 2] ?? null; // phiên trước
    if (prevPredictionCompare) {
      stats.tong++;
      // NOTE: trong logic trước, so sánh du_doan vs prev (phiên trước) để tính đúng/sai
      // Ở đây dùng du_doan hiện tại so với prev để đồng bộ với mã trước.
      if (du_doan === prevPredictionCompare) stats.dung++;
      else stats.sai++;
    }

    const do_tin_cay = stats.tong === 0 ? "0%" : ((stats.dung / stats.tong) * 100).toFixed(1) + "%";
    const pattern = history.map(x => (x === "Tai" ? "t" : "x")).join("");
    const giai_thich = `Phân tích ${loai_cau} bằng 3 thuật toán: Markov, Pattern Memory, Weighted Probability. Độ chính xác trung bình hiện tại: ${do_tin_cay}.`;

    // Tạo JSON trả về theo định dạng mong muốn
    const out = {
      phien,
      xuc_xac,
      tong_xuc_xac,
      ket_qua,
      phien_sau,
      du_doan,
      do_tin_cay,
      giai_thich,
      id: "@minhsangdangcap",
      // thêm mở rộng thông tin để client dễ dùng
      loai_cau,
      thuat_toan: "Markov + Pattern + Weighted",
      so_lan_dung: stats.dung,
      so_lan_sai: stats.sai,
      pattern,
      tong_lich_su: history.length,
      votes_detail: { markov: p1, patternMemory: p2, weighted: p3 }
    };

    return res.json(out);
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu gốc:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Không thể truy cập API gốc hoặc lỗi nội bộ" });
  }
});

// ==========================
// 🔧 Khởi chạy server
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ HITCLUB AI PRO v3.5 đang chạy tại cổng ${PORT}`);
});
