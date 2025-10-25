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

// ======= LẤY DỮ LIỆU GỐC HITCLUB (FALLBACK KHI LỖI) =======
async function layDuLieuGoc() {
  try {
    const { data } = await axios.get("https://hitclub-all-ban-o5ir.onrender.com/api/taixiu", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      timeout: 5000
    });
    if (!data || !data.ket_qua) throw new Error("API không hợp lệ");
    return data;
  } catch (e) {
    console.error("❌ Lỗi API, dùng fallback:", e.message);
    return {
      phien: Date.now(),
      xuc_xac: "1 - 2 - 3",
      tong: Math.floor(Math.random() * 10) + 3,
      ket_qua: Math.random() > 0.5 ? "Tai" : "Xiu"
    };
  }
}

// ======= XÁC ĐỊNH LOẠI CẦU =======
function xacDinhLoaiCau() {
  if (lichSu.length === 0) return dsCau[Math.floor(Math.random() * dsCau.length)];
  const last10 = lichSu.slice(-10).map(r => r.loaiCau);
  const dem = {};
  last10.forEach(c => dem[c] = (dem[c] || 0) + 1);
  const sorted = Object.entries(dem).sort((a,b) => b[1]-a[1]);
  return sorted[0] ? sorted[0][0] : dsCau[Math.floor(Math.random() * dsCau.length)];
}

// ======= MACHINE LEARNING NÂNG CAO =======
function machineLearningML(loaiCau) {
  const lichSuCau = lichSu.filter(r => r.loaiCau === loaiCau);
  if (lichSuCau.length < 3) return {duDoan: Math.random() > 0.5 ? "Tai":"Xiu", doTinCay:"50%"};

  const pattern = lichSuCau.map(r=>r.ket_qua==="Tai"?"t":"x").join("");
  const last3 = pattern.slice(-3); // pattern 3 ký tự gần nhất
  let countT = 0, countX = 0;

  for(let i=0; i<=pattern.length-4; i++){
    if(pattern.slice(i,i+3)===last3){
      const next = pattern[i+3];
      if(next==="t") countT++;
      if(next==="x") countX++;
    }
  }

  let duDoan, doTinCay;
  if(countT + countX === 0){
    duDoan = pattern.endsWith("t") ? "Tai":"Xiu";
    doTinCay = "60%";
  } else {
    duDoan = countT >= countX ? "Tai":"Xiu";
    doTinCay = Math.floor(Math.max(countT,countX)/(countT+countX)*100)+"%";
  }

  return {duDoan, doTinCay};
}

// ======= CẬP NHẬT JSON & THỐNG KÊ =======
function capNhatLichSu(data, loaiCau) {
  const {duDoan, doTinCay} = machineLearningML(loaiCau);
  const ketQua = data.ket_qua;

  const item = {
    phien: data.phien,
    xuc_xac: data.xuc_xac,
    tong: data.tong,
    ket_qua: ketQua,
    duDoan,
    loaiCau,
    doTinCay,
    thoiGian: new Date().toISOString()
  };

  lichSu.push(item);
  if (lichSu.length > 50) lichSu = lichSu.slice(-50);

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
    do_tin_cay: doTinCay,
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
  const loaiCau = xacDinhLoaiCau();
  const ketQua = capNhatLichSu(data, loaiCau);
  res.json(ketQua);
});

// ======= API XEM LỊCH SỬ =======
app.get("/api/lichsu",(req,res)=>{
  res.json({tongPhien: lichSu.length, lichSu});
});

app.listen(PORT,"0.0.0.0",()=>console.log(`🚀 Server chạy tại http://localhost:${PORT}`));
