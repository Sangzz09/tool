import fs from "fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const FILE_JSON = "./data.json";
const FILE_DB = "./data/data.sqlite";

async function migrate() {
  if (!fs.existsSync(FILE_JSON)) {
    console.log("❌ File data.json không tồn tại, không có gì để migrate");
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(FILE_JSON, "utf8"));
  if (!jsonData.length) {
    console.log("❌ File data.json rỗng");
    return;
  }

  // Mở DB
  const db = await open({
    filename: FILE_DB,
    driver: sqlite3.Database
  });

  // Tạo bảng nếu chưa có
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

  // Chèn dữ liệu từ JSON
  for (const item of jsonData) {
    await db.run(
      `INSERT INTO lichSu (phien,xuc_xac,tong,ket_qua,duDoan,loaiCau,doTinCay,thoiGian)
       VALUES (?,?,?,?,?,?,?,?)`,
      [item.phien, item.xuc_xac, item.tong, item.ket_qua, item.duDoan, item.loaiCau, item.doTinCay, item.thoiGian]
    );
  }

  console.log(`✅ Đã migrate ${jsonData.length} phiên từ data.json sang SQLite`);
  await db.close();
}

migrate();
