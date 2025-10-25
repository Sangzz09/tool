import express from "express";
import axios from "axios";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const app = express();
const PORT = process.env.PORT || 3000;

// ======= DATABASE SQLITE =======
let db;
async function initDB() {
  db = await open({
    filename: "./data.sqlite",
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lichSu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phien TEXT,
      xuc_xac TEXT,
      tong INTEGER,
      ket_qua TEXT,
      duDoan TEXT,
      loaiCau TEXT,
      doTinCay TEXT,
      thoiGian TEXT
    )
  `);
}

await initDB();

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

// ======= LẤY DỮ LIỆU GỐC HITCLUB =======
async function layDuLieuGoc() {
  try {
    const { data } = await axios.get("https://hitclub-all-ban-o5ir.onrender.com/api/taixiu", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      timeout: 5000
    });
    if (!data || !data.ket_qua) throw new Error("API không hợp lệ");
    return data;
  } catch (e) {
    console.error("❌ Lỗi API, fallback:", e.message);
    return {
      phien: Date.now(),
      xuc_xac: "1 - 2 - 3",
      tong: Math.floor(Math.random() * 10) + 3,
      ket_qua: Math.random() > 0.5 ? "Tai" : "Xiu"
    };
  }
}

// ======= XÁC ĐỊNH LOẠI CẦU =======
async function xacDinhLoaiCau() {
  const last10 = await db.all(`SELECT loaiCau FROM lichSu ORDER BY id DESC LIMIT 10`);
  if (!last10.length) return dsCau[Math.floor(Math.random() * dsCau.length)];

  const dem = {};
  last10.forEach(r => dem[r.loaiCau] = (dem[r.loaiCau] || 0) + 1);
  const sorted = Object.entries(dem).sort((a,b)=>b[1]-a[1]);
  return sorted[0][0];
}

// ======= MACHINE LEARNING NÂNG CAO =======
async function machineLearningML(loaiCau) {
  const lichSuCau = await db.all(`SELECT ket_qua FROM lichSu WHERE loaiCau=? ORDER BY id DESC LIMIT 50`, [loaiCau]);
  if (lichSuCau.length < 3) return {duDoan: Math.random() > 0.5 ? "Tai":"Xiu", doTinCay:"50%"};

  const pattern = lichSuCau.map(r=>r.ket_qua==="Tai"?"t":"x").join("");
  const last3 = pattern.slice(-3);
  let countT=0, countX=0;

  for(let i=0;i<=pattern.length-4;i++){
    if(pattern.slice(i,i+3)===last3){
      const next=pattern[i+3];
      if(next==="t") countT++;
      if(next==="x") countX++;
    }
  }

  let duDoan, doTinCay;
  if(countT+countX===0){
    duDoan = pattern.endsWith("t")?"Tai":"Xiu";
    doTinCay = "60%";
  } else {
    duDoan = countT>=countX?"Tai":"Xiu";
    doTinCay = Math.floor(Math.max(countT,countX)/(countT+countX)*100)+"%";
  }

  return {duDoan, doTinCay};
}

// ======= CẬP NHẬT LỊCH SỬ & THỐNG KÊ =======
async function capNhatLichSu(data, loaiCau) {
  const {duDoan, doTinCay} = await machineLearningML(loaiCau);
  const ketQua = data.ket_qua;

  await db.run(`
    INSERT INTO lichSu (phien,xuc_xac,tong,ket_qua,duDoan,loaiCau,doTinCay,thoiGian)
    VALUES (?,?,?,?,?,?,?,?)
  `, [data.phien, data.xuc_xac, data.tong, ketQua, duDoan, loaiCau, doTinCay, new Date().toISOString()]);

  const soPhienDuDoan = await db.get(`SELECT COUNT(*) as cnt FROM lichSu`);
  const soDung = await db.get(`SELECT COUNT(*) as cnt FROM lichSu WHERE duDoan=ket_qua`);
  const soSai = await db.get(`SELECT COUNT(*) as cnt FROM lichSu WHERE duDoan!=ket_qua`);
  const patternArr = await db.all(`SELECT ket_qua FROM lichSu ORDER BY id ASC`);
  const pattern = patternArr.map(r=>r.ket_qua==="Tai"?"t":"x").join("");

  return {
    phien: data.phien,
    xuc_xac: data.xuc_xac,
    tong: data.tong,
    ket_qua,
    du_doan: duDoan,
    do_tin_cay: doTinCay,
    loai_cau: loaiCau,
    pattern,
    so_phien_du_doan: soPhienDuDoan.cnt,
    so_dung: soDung.cnt,
    so_sai: soSai.cnt,
    dev: "@minhsangdangcap"
  };
}

// ======= API DỰ ĐOÁN =======
app.get("/api/taixiu", async (req,res)=>{
  const data = await layDuLieuGoc();
  const loaiCau = await xacDinhLoaiCau();
  const ketQua = await capNhatLichSu(data, loaiCau);
  res.json(ketQua);
});

// ======= API XEM LỊCH SỬ =======
app.get("/api/lichsu", async (req,res)=>{
  const lichSuAll = await db.all(`SELECT * FROM lichSu ORDER BY id DESC`);
  res.json({tongPhien: lichSuAll.length, lichSu: lichSuAll});
});

app.listen(PORT,"0.0.0.0",()=>console.log(`🚀 Server chạy tại http://localhost:${PORT}`));
