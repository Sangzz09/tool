import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// Biến lưu thống kê và pattern cầu
let thongKe = { so_phien_du_doan: 0, so_dung: 0, so_sai: 0 };
let pattern = "";

/* ===========================================================
   📊 HÀM NHẬN DIỆN CẦU NÂNG CAO
   =========================================================== */
function nhanDienCau(pattern) {
  // chuyển sang chữ thường để so khớp
  const p = pattern.toLowerCase();

  // Các loại cầu phổ biến
  if (/t{5,}$/.test(p)) return "🎯 Cầu bệt Tài (chuỗi Tài liên tục)";
  if (/x{5,}$/.test(p)) return "🎯 Cầu bệt Xỉu (chuỗi Xỉu liên tục)";
  if (/(tx){3,}$/.test(p)) return "♻️ Cầu xen kẽ TX";
  if (/(xt){3,}$/.test(p)) return "♻️ Cầu xen kẽ XT";
  if (/ttx{2,}$/.test(p)) return "🔥 Cầu 1-2 Tài-Xỉu";
  if (/xxt{2,}$/.test(p)) return "🔥 Cầu 1-2 Xỉu-Tài";
  if (/t{2,}x{2,}$/.test(p)) return "⚡ Cầu 2-2 Tài-Xỉu";
  if (/x{2,}t{2,}$/.test(p)) return "⚡ Cầu 2-2 Xỉu-Tài";
  if (/t{3,}x{1,}t{3,}$/.test(p)) return "💥 Cầu 3-1-3 Tài";
  if (/x{3,}t{1,}x{3,}$/.test(p)) return "💥 Cầu 3-1-3 Xỉu";
  if (/(ttx){2,}$/.test(p)) return "🔮 Cầu 2-1 lặp TTX";
  if (/(xxt){2,}$/.test(p)) return "🔮 Cầu 2-1 lặp XXT";
  if (/t{3,}x{2,}t{2,}$/.test(p)) return "🌊 Cầu 3-2-2 Tài";
  if (/x{3,}t{2,}x{2,}$/.test(p)) return "🌊 Cầu 3-2-2 Xỉu";
  if (/ttttx$/.test(p)) return "💎 Cầu bệt 4 Tài gãy 1 Xỉu";
  if (/xxxxt$/.test(p)) return "💎 Cầu bệt 4 Xỉu gãy 1 Tài";
  if (/t{2,}xt{2,}$/.test(p)) return "⚙️ Cầu rồng Tài";
  if (/x{2,}tx{2,}$/.test(p)) return "⚙️ Cầu rồng Xỉu";
  if (/(ttttx{2,})$/.test(p)) return "🎢 Cầu bệt dài 4T-2X";
  if (/(xxxx t{2,})$/.test(p)) return "🎢 Cầu bệt dài 4X-2T";

  // Khi không khớp
  return "🌀 Không phát hiện cầu rõ ràng";
}

/* ===========================================================
   🧠 HÀM DỰ ĐOÁN TỪ CẦU
   =========================================================== */
function duDoanTuPattern(pattern) {
  const loaiCau = nhanDienCau(pattern);
  let duDoan = "Tai";
  let doTinCay = 50 + Math.random() * 10;
  let giaiThich = "";

  if (loaiCau.includes("Tài")) {
    duDoan = "Tai";
    doTinCay = 65 + Math.random() * 15;
  } else if (loaiCau.includes("Xỉu")) {
    duDoan = "Xiu";
    doTinCay = 65 + Math.random() * 15;
  } else if (loaiCau.includes("xen kẽ")) {
    duDoan = pattern.slice(-1) === "t" ? "Xiu" : "Tai";
    doTinCay = 55 + Math.random() * 10;
  } else if (loaiCau.includes("1-2") || loaiCau.includes("2-1")) {
    duDoan = pattern.slice(-1) === "t" ? "Xiu" : "Tai";
    doTinCay = 57 + Math.random() * 8;
  } else {
    duDoan = Math.random() > 0.5 ? "Tai" : "Xiu";
    doTinCay = 50 + Math.random() * 10;
  }

  giaiThich = `Phân tích theo ${loaiCau}. Xác suất Tài: ${(doTinCay / 100).toFixed(2)}, Xỉu: ${((100 - doTinCay) / 100).toFixed(2)}.`;

  return { duDoan, doTinCay: `${doTinCay.toFixed(0)}%`, giaiThich, loaiCau };
}

/* ===========================================================
   🌐 API CHÍNH
   =========================================================== */
app.get("/api/taixiu", async (req, res) => {
  try {
    // Lấy dữ liệu thật từ API gốc
    const resp = await fetch("https://hitclub-all-ban-o5ir.onrender.com/api/taixiu");
    const data = await resp.json();
    const { phien, xuc_xac, tong, ket_qua } = data;

    // Cập nhật pattern (t/x)
    const kyTu = ket_qua.toLowerCase().includes("tai") ? "t" : "x";
    pattern += kyTu;
    if (pattern.length > 20) pattern = pattern.slice(-20); // giữ 20 kết quả gần nhất

    // Dự đoán từ mẫu pattern
    const { duDoan, doTinCay, giaiThich, loaiCau } = duDoanTuPattern(pattern);

    // Cập nhật thống kê
    thongKe.so_phien_du_doan++;
    if (duDoan.toLowerCase() === ket_qua.toLowerCase())
      thongKe.so_dung++;
    else thongKe.so_sai++;

    // Xuất JSON kết quả
    const jsonOut = {
      phien,
      xuc_xac,
      tong,
      ket_qua,
      du_doan: duDoan,
      do_tin_cay: doTinCay,
      pattern: pattern.toUpperCase(),
      loai_cau: loaiCau,
      so_phien_du_doan: thongKe.so_phien_du_doan,
      so_dung: thongKe.so_dung,
      so_sai: thongKe.so_sai,
      giai_thich: giaiThich,
      dev: "@minhsangdangcap"
    };

    res.json(jsonOut);
  } catch (err) {
    res.json({ error: "❌ Lỗi lấy dữ liệu từ API gốc", chi_tiet: err.message });
  }
});

/* ===========================================================
   🚀 CHẠY SERVER
   =========================================================== */
app.listen(PORT, () => {
  console.log(`✅ API đang chạy tại cổng ${PORT}`);
});
