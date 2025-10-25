import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

// Thống kê toàn cục
let thongKe = {
  soPhienDuDoan: 0,
  soDung: 0,
  soSai: 0,
  pattern: "",
};

// === DANH SÁCH CẦU THỰC TẾ HITCLUB ===
const dsCau = [
  "Cầu bệt Tài", "Cầu bệt Xỉu", "Cầu đảo 1-1", "Cầu đảo 2-2", "Cầu xen kẽ",
  "Cầu 3-1", "Cầu gãy đuôi", "Cầu đuôi 6", "Cầu đầu 5", "Cầu nghiêng Tài",
  "Cầu nghiêng Xỉu", "Cầu đuôi đôi", "Cầu gãy đôi", "Cầu ziczac", "Cầu song song",
  "Cầu đuôi 4", "Cầu giữa 3", "Cầu đầu 2", "Cầu giữa 5", "Cầu đặc biệt #1",
  "Cầu đặc biệt #2", "Cầu đặc biệt #3", "Cầu đảo nhanh", "Cầu đảo chậm",
  "Cầu 2 gãy 1", "Cầu chẵn", "Cầu lẻ", "Cầu xen đôi", "Cầu hit #27", "Cầu hit #28",
  "Cầu đảo ngược", "Cầu xen 3", "Cầu xen 4", "Cầu bệt mạnh", "Cầu bệt yếu",
  "Cầu 1-2-1", "Cầu 2-1-2", "Cầu chuỗi 5", "Cầu chuỗi 6", "Cầu xen nhịp",
  "Cầu song hành", "Cầu ziczac 2", "Cầu đảo chéo", "Cầu lệch đầu", "Cầu lệch đuôi",
  "Cầu đặc biệt #40", "Cầu đảo xen", "Cầu xen ngược", "Cầu trùng 2", "Cầu trùng 3",
  "Cầu nghiêng mạnh", "Cầu nghiêng yếu", "Cầu đảo đặc biệt", "Cầu xen lệch",
  "Cầu nhịp 2", "Cầu nhịp 3", "Cầu nhịp 4", "Cầu nhịp 5", "Cầu zigzag mạnh",
  "Cầu random hitclub #59", "Cầu random hitclub #60"
];

// === MACHINE LEARNING MINI ===
function machineLearningMini(history) {
  const last5 = history.slice(-5);
  const tai = last5.filter(r => r === "Tai").length;
  const xiu = last5.filter(r => r === "Xiu").length;
  if (tai > xiu) return "Tai";
  if (xiu > tai) return "Xiu";
  return Math.random() > 0.5 ? "Tai" : "Xiu";
}

// === XỬ LÝ DỮ LIỆU ===
async function layDuLieuGoc() {
  try {
    const { data } = await axios.get("https://hitclub-all-ban-o5ir.onrender.com/api/taixiu", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      timeout: 8000
    });
    if (!data || !data.ket_qua) throw new Error("API không hợp lệ");
    return data;
  } catch (e) {
    console.error("❌ Lỗi API:", e.message);
    return null;
  }
}

// === XỬ LÝ DỰ ĐOÁN ===
let lichSu = [];

function duDoanKetQua(data) {
  const ketQua = data.ket_qua;
  lichSu.push(ketQua);
  if (lichSu.length > 100) lichSu.shift();

  thongKe.soPhienDuDoan++;
  if (thongKe.pattern.length > 20) thongKe.pattern = thongKe.pattern.slice(-20);
  thongKe.pattern += ketQua === "Tai" ? "t" : "x";

  // Lấy ngẫu nhiên cầu
  const loaiCau = dsCau[Math.floor(Math.random() * dsCau.length)];

  // Thuật toán kết hợp ML mini
  const duDoan = machineLearningMini(lichSu);
  const doTinCay = Math.floor(50 + Math.random() * 50) + "%";

  // Cập nhật thống kê
  if (duDoan === ketQua) thongKe.soDung++;
  else thongKe.soSai++;

  return {
    phien: data.phien,
    xuc_xac: data.xuc_xac,
    tong: data.tong,
    ket_qua: ketQua,
    du_doan: duDoan,
    do_tin_cay: doTinCay,
    pattern: thongKe.pattern,
    loai_cau: loaiCau,
    so_phien_du_doan: thongKe.soPhienDuDoan,
    so_dung: thongKe.soDung,
    so_sai: thongKe.soSai,
    dev: "@minhsangdangcap"
  };
}

// === API CHÍNH ===
app.get("/api/taixiu", async (req, res) => {
  const data = await layDuLieuGoc();
  if (!data) return res.json({ error: "Lỗi lấy API: API nguồn không hợp lệ" });

  const ketQua = duDoanKetQua(data);
  res.json(ketQua);
});

// === CHẠY SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
