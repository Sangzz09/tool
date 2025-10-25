import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

let lichsu = [];
let thongke = { dung: 0, sai: 0, tong: 0 };
let pattern = "";
let phienDaDoan = new Set(); // đảm bảo 1 phiên chỉ dự đoán 1 lần

// ======= 40 LOẠI CẦU HITCLUB ======= //
function phanTichCau(lichsu) {
  const kq = lichsu.map(l => (l.ket_qua === "Tai" ? "T" : "X")).join("");

  const mau = [
    { name: "Cầu bệt Tài", regex: /TTTTT$/ },
    { name: "Cầu bệt Xỉu", regex: /XXXXX$/ },
    { name: "Cầu xen kẽ", regex: /(TX){3,}$/ },
    { name: "Cầu gãy 1", regex: /TTX$|XXT$/ },
    { name: "Cầu gãy 2", regex: /TTTX$|XXXT$/ },
    { name: "Cầu 1-1", regex: /(TX){2,}$/ },
    { name: "Cầu 1-2", regex: /TXX$|XTT$/ },
    { name: "Cầu 2-1", regex: /TTX$|XXT$/ },
    { name: "Cầu 2-2", regex: /(TTXX){1,}$/ },
    { name: "Cầu 3-1", regex: /TTTX$|XXXT$/ },
    { name: "Cầu 3-2", regex: /TTTXX$|XXXTT$/ },
    { name: "Cầu đảo chiều", regex: /TXT$|XTX$/ },
    { name: "Cầu tam hoa Tài", regex: /TTT$/ },
    { name: "Cầu tam hoa Xỉu", regex: /XXX$/ },
    { name: "Cầu lặp lại 2 lần", regex: /(TTXX){2,}$/ },
    { name: "Cầu đối xứng", regex: /TTXXTT$|XXTTXX$/ },
    { name: "Cầu ngắt đôi", regex: /TTXTT$|XXTXX$/ },
    { name: "Cầu ảo giác", regex: /TXTXTX$/ },
    { name: "Cầu tăng dần Tài", regex: /TTT$/ },
    { name: "Cầu tăng dần Xỉu", regex: /XXX$/ },
    { name: "Cầu ngược", regex: /(XT){3,}$/ },
    { name: "Cầu 1-3", regex: /TXXX$|XTTT$/ },
    { name: "Cầu 2-3", regex: /TTXXX$|XXTTT$/ },
    { name: "Cầu 3-3", regex: /(TTTXXX){1,}$/ },
    { name: "Cầu chéo", regex: /TXXTXX$/ },
    { name: "Cầu lặp 3", regex: /(TTX){3,}$/ },
    { name: "Cầu 1-1 đảo", regex: /(XT){2,}$/ },
    { name: "Cầu đan xen 2 tầng", regex: /(TTXXTTXX)$/ },
    { name: "Cầu rít ngắn", regex: /TXXT$/ },
    { name: "Cầu gãy đầu", regex: /^XT|^TX/ },
    { name: "Cầu 5-1", regex: /TTTTTX$|XXXXXT$/ },
    { name: "Cầu 6 chuỗi", regex: /(TTTTTT|XXXXXX)$/ },
    { name: "Cầu lệch", regex: /TTTXX$/ },
    { name: "Cầu 2 đầu", regex: /TXT$/ },
    { name: "Cầu song hành", regex: /(TTXXTT|XXTTXX)$/ },
    { name: "Cầu lặp 4", regex: /(TTXX){2,}$/ },
    { name: "Cầu giữa Tài", regex: /XTTX$/ },
    { name: "Cầu giữa Xỉu", regex: /TXXT$/ },
    { name: "Cầu lộn", regex: /TXXTXXT$/ },
  ];

  for (let m of mau) {
    if (m.regex.test(kq)) return m.name;
  }
  return "Không có cầu rõ ràng";
}

// ======= THUẬT TOÁN DỰ ĐOÁN ======= //
function duDoan(lichsu) {
  if (lichsu.length < 6) return { du_doan: "Tai", do_tin_cay: "50%" };

  const kqGanNhat = lichsu.map(l => (l.ket_qua === "Tai" ? "T" : "X")).join("");
  let cau = phanTichCau(lichsu);

  // Phân tích Markov Chain
  const counts = { TT: 0, TX: 0, XT: 0, XX: 0 };
  for (let i = 0; i < kqGanNhat.length - 1; i++) {
    const c = kqGanNhat[i] + kqGanNhat[i + 1];
    if (counts[c] !== undefined) counts[c]++;
  }
  const pTai = (counts.TT + counts.XT) / (kqGanNhat.length - 1);
  const pXiu = (counts.XX + counts.TX) / (kqGanNhat.length - 1);

  let du_doan = pTai > pXiu ? "Tai" : "Xiu";
  let do_tin_cay = Math.round(Math.abs(pTai - pXiu) * 100) + 50;

  // Tăng/giảm độ tin cậy theo loại cầu
  if (cau.includes("Tài")) {
    du_doan = "Tai";
    do_tin_cay += 15;
  } else if (cau.includes("Xỉu")) {
    du_doan = "Xiu";
    do_tin_cay += 15;
  }

  if (do_tin_cay > 95) do_tin_cay = 95;
  if (do_tin_cay < 50) do_tin_cay = 50;

  return { du_doan, do_tin_cay: do_tin_cay + "%" };
}

// ======= LẤY DỮ LIỆU GỐC ======= //
async function layDuLieuMoi() {
  try {
    const res = await fetch("https://hitclub-all-ban-o5ir.onrender.com/api/taixiu");
    const data = await res.json();
    if (!data?.phien) return;

    // Không xử lý trùng phiên
    if (phienDaDoan.has(data.phien)) return;
    phienDaDoan.add(data.phien);

    lichsu.push({
      phien: data.phien,
      ket_qua: data.ket_qua,
      xuc_xac: data.xuc_xac,
      tong: data.tong,
    });
    if (lichsu.length > 30) lichsu.shift();

    // cập nhật pattern
    pattern = lichsu.map(l => (l.ket_qua === "Tai" ? "t" : "x")).join("");

    // dự đoán phiên sau
    const { du_doan, do_tin_cay } = duDoan(lichsu);

    // thống kê kết quả đúng/sai
    if (lichsu.length > 1) {
      const truoc = lichsu[lichsu.length - 2];
      if (truoc.du_doan) {
        thongke.tong++;
        if (truoc.du_doan === data.ket_qua) thongke.dung++;
        else thongke.sai++;
      }
    }

    const jsonTraVe = {
      phien: data.phien,
      xuc_xac: data.xuc_xac,
      tong: data.tong,
      ket_qua: data.ket_qua,
      du_doan,
      do_tin_cay,
      pattern,
      so_phien_du_doan: thongke.tong,
      so_dung: thongke.dung,
      so_sai: thongke.sai,
      dev: "@minhsangdangcap",
    };

    // Gán dự đoán vào lịch sử để so sánh ở phiên sau
    lichsu[lichsu.length - 1].du_doan = du_doan;

    return jsonTraVe;
  } catch (e) {
    console.error("Lỗi API:", e);
  }
}

// ======= ROUTE API ======= //
app.get("/api/taixiu", async (req, res) => {
  const kq = await layDuLieuMoi();
  if (!kq) return res.json({ error: "Không có dữ liệu mới hoặc API lỗi" });
  res.json(kq);
});

app.listen(PORT, () => console.log(`✅ API đang chạy tại cổng ${PORT}`));
