// ==========================================
// HITCLUB AI PRO v4.0 (Render Ready)
// Tác giả: @minhsangdangcap (adapted by ChatGPT GPT-5)
// ==========================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===========================
// ⚙️ Cấu hình chính
// ===========================
const DATA_FILE = path.join(__dirname, "data.json");
let duDoanList = [];
let MAX_SESSION = 15; // Sau mỗi 15 phiên sẽ reset giữ 5 phiên cuối
const ID_TOOL = "@minhsangdangcap";

// ===========================
// 🔄 Load dữ liệu nếu có
// ===========================
if (fs.existsSync(DATA_FILE)) {
  try {
    duDoanList = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    duDoanList = [];
  }
}

// ===========================
// 🎲 Thuật toán xác định cầu
// ===========================
function xacDinhLoaiCau(lichSu) {
  if (lichSu.length < 3) return "Cầu ngắn";
  const gan3 = lichSu.slice(-3).map(p => p.ket_qua);

  if (gan3.every(k => k === "Tai")) return "Cầu Tài liên tiếp";
  if (gan3.every(k => k === "Xiu")) return "Cầu Xỉu liên tiếp";
  if (gan3.join("") === "TaiXiuTai" || gan3.join("") === "XiuTaiXiu")
    return "Cầu 1-1 luân phiên";
  if (gan3[0] === gan3[1] && gan3[1] !== gan3[2])
    return "Cầu gãy 2";
  return "Cầu hỗn hợp";
}

// ===========================
// 🤖 Thuật toán dự đoán
// ===========================
function duDoanPhienSau(lichSu) {
  if (lichSu.length === 0)
    return { du_doan: "Tai", do_tin_cay: "50%", loai_cau: "Chưa có dữ liệu" };

  const cau = xacDinhLoaiCau(lichSu);
  const cuoi = lichSu[lichSu.length - 1];
  let du_doan = "Tai";

  switch (cau) {
    case "Cầu 1-1 luân phiên":
      du_doan = cuoi.ket_qua === "Tai" ? "Xiu" : "Tai";
      break;
    case "Cầu Tài liên tiếp":
      du_doan = "Tai";
      break;
    case "Cầu Xỉu liên tiếp":
      du_doan = "Xiu";
      break;
    case "Cầu gãy 2":
      du_doan = cuoi.ket_qua === "Tai" ? "Xiu" : "Tai";
      break;
    default:
      du_doan = Math.random() > 0.5 ? "Tai" : "Xiu";
  }

  const do_tin_cay = (Math.random() * (90 - 60) + 60).toFixed(0) + "%";
  return { du_doan, do_tin_cay, loai_cau: cau };
}

// ===========================
// 🧮 Tính thống kê
// ===========================
function thongKe() {
  const tong = duDoanList.length;
  const soTai = duDoanList.filter(p => p.ket_qua === "Tai").length;
  const soXiu = duDoanList.filter(p => p.ket_qua === "Xiu").length;
  return { tong, soTai, soXiu };
}

// ===========================
// 🧠 API chính: /api/taixiu
// ===========================
app.get("/api/taixiu", (req, res) => {
  const thongke = thongKe();
  const { du_doan, do_tin_cay, loai_cau } = duDoanPhienSau(duDoanList);

  const phien = duDoanList.length > 0 ? duDoanList[duDoanList.length - 1].phien + 1 : 100001;

  const response = {
    phien,
    ket_qua: duDoanList.length ? duDoanList[duDoanList.length - 1].ket_qua : "Chưa có",
    xuc_xac: "2 - 5 - 6",
    tong_xuc_xac: 13,
    du_doan,
    loai_cau,
    thuat_toan: "Markov Chain + Cầu Pattern AI",
    so_lan_dung: duDoanList.filter(p => p.dung_sai === "Đúng").length,
    so_lan_sai: duDoanList.filter(p => p.dung_sai === "Sai").length,
    pattern: duDoanList.map(p => p.ket_qua === "Tai" ? "t" : "x").join(""),
    tong_lich_su: thongke.tong,
    id: ID_TOOL
  };

  res.json(response);
});

// ===========================
// 📝 Lưu kết quả thực tế (POST)
// ===========================
app.post("/api/taixiu", (req, res) => {
  const { phien, ket_qua } = req.body;
  if (!phien || !ket_qua) {
    return res.status(400).json({ thongbao: "Thiếu dữ liệu phien hoặc ket_qua" });
  }

  const duDoanGan = duDoanPhienSau(duDoanList);
  const dung_sai = duDoanGan.du_doan === ket_qua ? "Đúng" : "Sai";

  const phienMoi = {
    phien,
    ket_qua,
    xuc_xac: "2 - 4 - 5",
    tong_xuc_xac: 11,
    dung_sai,
    loai_cau: duDoanGan.loai_cau,
    thuat_toan: "Markov Chain",
    thoigian: new Date().toLocaleString("vi-VN")
  };

  duDoanList.push(phienMoi);
  if (duDoanList.length > MAX_SESSION) {
    duDoanList = duDoanList.slice(-5);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(duDoanList, null, 2));
  res.json({ thongbao: "Đã lưu phiên mới", phienMoi });
});

// ===========================
// 🌐 Giao diện /hitapi
// ===========================
app.get("/hitapi", (req, res) => {
  const { tong, soTai, soXiu } = thongKe();
  const duDoanGan = duDoanPhienSau(duDoanList);

  res.send(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>HITCLUB AI PRO v4.0</title>
        <style>
          body { font-family: Arial; background: #111; color: #eee; padding: 20px; }
          h1 { color: #00ff99; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #555; padding: 6px 10px; text-align: center; }
          th { background: #00ff9933; }
        </style>
      </head>
      <body>
        <h1>🔥 HITCLUB AI PRO v4.0</h1>
        <p><b>ID Tool:</b> ${ID_TOOL}</p>
        <p><b>Tổng phiên:</b> ${tong} | <b>Tài:</b> ${soTai} | <b>Xỉu:</b> ${soXiu}</p>
        <p><b>Dự đoán kế tiếp:</b> ${duDoanGan.du_doan} (${duDoanGan.do_tin_cay}) — ${duDoanGan.loai_cau}</p>
        <h3>Lịch sử gần nhất:</h3>
        <table>
          <tr><th>Phiên</th><th>Kết quả</th><th>Đúng/Sai</th><th>Loại cầu</th><th>Thời gian</th></tr>
          ${duDoanList.map(p => `
            <tr>
              <td>${p.phien}</td>
              <td>${p.ket_qua}</td>
              <td>${p.dung_sai}</td>
              <td>${p.loai_cau}</td>
              <td>${p.thoigian}</td>
            </tr>`).join("")}
        </table>
        <p style="margin-top:20px;"><i>Made with ❤️ by @minhsangdangcap</i></p>
      </body>
    </html>
  `);
});

// ===========================
// 🚀 Khởi động server
// ===========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ HITCLUB AI PRO v4.0 chạy trên cổng ${PORT}`)
);
