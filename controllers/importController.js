// controllers/importController.js
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const PRIVATE_DIR = path.join(__dirname, "../private");

exports.importExcel = (req, res) => {
  if (!req.file) {
    return res.status(400).send("Không có file được tải lên.");
  }

  const file = req.file;
  const originalName = file.originalname.toLowerCase();

  let destinationFile = "";

  if (originalName.includes("product")) {
    destinationFile = "products.xlsx";
  } else if (originalName.includes("don_hang")) {
    destinationFile = "don_hang.xlsx";
  } else if (originalName.includes("doanh_thu")) {
    destinationFile = "doanh_thu.xlsx";
  } else {
    // Xoá file tạm nếu không hợp lệ
    fs.unlinkSync(file.path);
    return res.status(400).send("Tên file không hợp lệ.");
  }

  const destinationPath = path.join(PRIVATE_DIR, destinationFile);
  fs.copyFileSync(file.path, destinationPath);
  fs.unlinkSync(file.path); // Xoá file tạm

  res.redirect("/dashboard");
};
