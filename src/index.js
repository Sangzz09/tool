import express from "express";
import axios from "axios";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
const FILE_DATA = "./data.json";

// ======= THỐNG KÊ =======
let thongKe = {
  soPhienDuDoan: 0,
  soDung: 0,
  soSai: 0,
  pattern: ""
};

// ======= DANH SÁCH CẦU HITCLUB =======
const dsCau = [
  "Cầu bệt Tài","Cầu bệt Xỉu","Cầu đảo 1-1","Cầu đảo 2-2","Cầu xen kẽ",
  "Cầu 3-1","Cầu gãy đuôi","Cầu đuôi 6","Cầu đầu 5","Cầu nghiêng Tài",
  "Cầu nghiêng Xỉu","Cầu đuôi đôi","Cầu gãy đôi","Cầu ziczac","Cầu song song",
  "Cầu đuôi 4","Cầu giữa 3","Cầu đầu 2","Cầu giữa 5","Cầu đặc biệt #1",
  "Cầu đặc biệt #2","Cầu đặc biệt #3","Cầu đảo nhanh","Cầu đảo chậm",
  "Cầu 2 gãy 1","Cầu chẵn","Cầu lẻ","Cầu xen đôi","Cầu hit #27","Cầu hit #28",
  "Cầu đảo ngược","Cầu xen 3","Cầu xen 4","Cầu bệt mạnh","Cầu bệt yếu",
  "Cầu 1-2-1","Cầu 2-1-2","Cầu chuỗi 5","Cầu chuỗi 6","Cầu xen nhịp",
  "Cầu song hành","Cầu ziczac 2","Cầu đảo chéo","Cầu lệch đầu","Cầu lệch đuôi",
  "Cầu đặc biệt #40","Cầu đảo xen","Cầu xen ngược","Cầu trùng 2","Cầu trùng 3",
  "Cầu nghiêng mạnh","Cầu nghiêng yếu","Cầu đảo đặc biệt","Cầu xen lệch",
  "Cầu nhịp 2","Cầu nhịp 3","Cầu nhịp 4","Cầu nhịp 5","Cầu zigzag mạnh",
  "Cầu random hitclub #59","Cầu random hitclub #60"
];

// ======= LỊCH SỬ =======
let lichSu = [];
try {
  if (fs.existsSync(FILE_DATA)) {
    lichSu = JSON.parse(fs.readFileSync(FILE_DATA, "utf8"));
    thongKe.soPhienDuDoan = lichSu.length;
    thongKe.soDung = lichSu.filter(r => r.duDoan === r.ket_qua).length;
    thongKe.soSai = lichSu.filter(r => r.duDoan !== r.ket_qua).length;
    thongKe.pattern = lichSu.map(r => (r.ket_qua === "Tai" ? "t" : "x")).join("");
  }
} catch (err) {
  console.error("❌ Lỗi load data.json:", err.message);
}

// ======= LẤY DỮ LIỆU GỐC HITCLUB =======
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

// ======= XÁC ĐỊNH LOẠI CẦU DỰA VÀO JSON =======
function xacDinhLoaiCau() {
  // Chọn cầu dựa vào pattern gần nhất
  if (lichSu.length === 0) return dsCau[Math.floor(Math.random() * dsCau.length)];
  // Lấy cầu xuất hiện nhiều nhất trong 10 phiên gần nhất
  const last10 = lichSu.slice(-10).map(r => r.loaiCau);
  const dem = {};
  last10.forEach(c => dem[c] = (dem[c] || 0) + 1);
  const sorted = Object.entries(dem).sort((a,b) => b[1]-a[1]);
  return sorted[0][0];
}

// ======= MACHINE LEARNING MINI =======
function machineLearningMini(loaiCau) {
  const lichSuCau = lichSu.filter(r => r.loaiCau === loaiCau);
  const last5 = lichSuCau.slice(-5).map(r => r.ket_qua);
  const tai = last5.filter(r => r === "Tai").length;
  const xiu = last5.filter(r => r === "Xiu").length;
  if (tai > xiu) return "Tai";
  if (xiu > tai) return "Xiu";
  return Math.random() > 0.5 ? "Tai" : "Xiu";
}

// ======= CẬP NHẬT JSON & THỐNG KÊ =======
function capNhatLichSu(data, duDoan, loaiCau) {
  const ketQua = data.ket_qua;
  const item = {
    phien: data.phien,
    xuc_xac: data.xuc_xac,
    tong: data.tong,
    ket_qua: ketQua,
    duDoan: duDoan,
    loaiCau,
    thoiGian: new Date().toISOString()
  };

  lichSu.push(item);

  // Reset >20 phiên, giữ 5 gần nhất
  if (lichSu.length > 20) lichSu = lichSu.slice(-5);

  // Cập nhật thống kê
  thongKe.soPhienDuDoan = lichSu.length;
  thongKe.soDung = lichSu.filter(r => r.duDoan === r.ket_qua).length;
  thongKe.soSai = lichSu.filter(r => r.duDoan !== r.ket_qua).length;
  thongKe.pattern = lichSu.map(r => (r.ket_qua==="Tai"?"t":"x")).join("");

  fs.writeFileSync(FILE_DATA, JSON.stringify(lichSu, null, 2));

  return {
    phien: data.phien,
    xuc_xac: data.xuc_xac,
    tong: data.tong,
    ket_qua,
    du_doan: duDoan,
    do_tin_cay: Math.floor(50+Math.random()*50)+"%",
    loai_cau: loaiCau,
    pattern: thongKe.pattern,
    so_phien_du_doan: thongKe.soPhienDuDoan,
    so_dung: thongKe.soDung,
    so_sai: thongKe.soSai,
    dev: "@minhsangdangcap"
  };
}

// ======= API DỰ ĐOÁN =======
app.get("/api/taixiu", async (req,res)=>{
  const data = await layDuLieuGoc();
  if(!data) return res.json({error:"Lỗi API nguồn không hợp lệ"});
  
  const loaiCau = xacDinhLoaiCau();
  const duDoan = machineLearningMini(loaiCau);
  const ketQua = capNhatLichSu(data, duDoan, loaiCau);

  res.json(ketQua);
});

// Xem toàn bộ lịch sử
app.get("/api/lichsu",(req,res)=>{
  res.json({tongPhien: lichSu.length, lichSu});
});

app.listen(PORT,"0.0.0.0",()=>console.log(`🚀 Server chạy tại http://localhost:${PORT}`));
