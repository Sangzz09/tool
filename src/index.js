// index.js
import express from "express";
import axios from "axios";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
const FILE_DATA = "./data.json";

// ====== THỐNG KÊ ======
let thongKe = {
  soPhienDuDoan: 0,
  soDung: 0,
  soSai: 0,
  pattern: ""
};

// ====== DANH SÁCH 60 LOẠI CẦU HITCLUB ======
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

// ====== LỊCH SỬ ======
let lichSu = [];

// Load data từ file JSON nếu có
try {
  if (fs.existsSync(FILE_DATA)) {
    lichSu = JSON.parse(fs.readFileSync(FILE_DATA, "utf8"));
    thongKe.soPhienDuDoan = lichSu.length;
    thongKe.soDung = lichSu.filter(r => r.duDoan === r.ketQua).length;
    thongKe.soSai = lichSu.filter(r => r.duDoan !== r.ketQua).length;
    thongKe.pattern = lichSu.map(r => (r.ketQua === "Tai" ? "t" : "x")).join("");
  }
} catch (err) {
  console.error("❌ Lỗi load data.json:", err.message);
}

// ====== MACHINE LEARNING MINI ======
function machineLearningMini(history) {
  const last5 = history.slice(-5).map(r => r.ketQua);
  const tai = last5.filter(r => r === "Tai").length;
  const xiu = last5.filter(r => r === "Xiu").length;
  if (tai > xiu) return "Tai";
  if (xiu > tai) return "Xiu";
  return Math.random() > 0.5 ? "Tai" : "Xiu";
}

// ====== LẤY DỮ LIỆU GỐC TỪ API ======
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

// ====== CẬP NHẬT LỊCH SỬ & FILE JSON ======
function capNhatLichSu(ketQua, duDoan, data) {
  const item = {
    phien: data.phien,
    xuc_xac: data.xuc_xac,
    tong: data.tong,
    ket_qua: ketQua,
    duDoan: duDoan,
    loaiCau: dsCau[Math.floor(Math.random() * dsCau.length)],
    thoiGian: new Date().toISOString()
  };

  lichSu.push(item);

  // Reset tự động khi >20 phiên, giữ 5 phiên gần nhất
  if (lichSu.length > 20) lichSu = lichSu.slice(-5);

  // Cập nhật thống kê
  thongKe.soPhienDuDoan = lichSu.length;
  thongKe.soDung = lichSu.filter(r => r.duDoan === r.ket_qua).length;
  thongKe.soSai = lichSu.filter(r => r.duDoan !== r.ket_qua).length;
  thongKe.pattern = lichSu.map(r => (r.ket_qua === "Tai" ? "t" : "x")).join("");

  // Ghi file JSON
  fs.writeFileSync(FILE_DATA, JSON.stringify(lichSu, null, 2));
}

// ====== XỬ LÝ DỰ ĐOÁN ======
function duDoanKetQua(data) {
  const ketQua = data.ket_qua;
  const duDoan = machineLearningMini(lichSu);

  capNhatLichSu(ketQua, duDoan, data);

  const doTinCay = Math.floor(50 + Math.random() * 50) + "%";
  const loaiCau = dsCau[Math.floor(Math.random() * dsCau.length)];

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

// ====== API ======
app.get("/api/taixiu", async (req, res) => {
  const data = await layDuLieuGoc();
  if (!data) return res.json({ error: "Lỗi lấy API nguồn không hợp lệ" });

  const ketQua = duDoanKetQua(data);
  res.json(ketQua);
});

// Xem toàn bộ lịch sử
app.get("/api/lichsu", (req, res) => {
  res.json({ tongPhien: lichSu.length, lichSu });
});

// ====== XỬ LÝ LỖI ======
process.on("unhandledRejection", err => console.error("Unhandled Rejection:", err));
process.on("uncaughtException", err => console.error("Uncaught Exception:", err));

// ====== CHẠY SERVER ======
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
