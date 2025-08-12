// controllers/productController.js
const path = require("path");
const xlsx = require("xlsx");

const filePath = path.join(__dirname, "../private", "product.xlsx");

exports.saveProduct = (req, res) => {
  const { oldMaSP, MaSP, TenSanPham, Gia, SoLuong, DonVi } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  if (oldMaSP) {
    // Chỉnh sửa sản phẩm
    data = data.map((item) =>
      item.MaSP === oldMaSP
        ? {
            MaSP,
            TenSanPham,
            Gia: parseInt(Gia),
            SoLuong: parseInt(SoLuong),
            DonVi,
          }
        : item
    );
  } else {
    // Thêm mới
    data.push({
      MaSP,
      TenSanPham,
      Gia: parseInt(Gia),
      SoLuong: parseInt(SoLuong),
      DonVi,
    });
  }

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets[workbook.SheetNames[0]] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#products");
};

exports.deleteProduct = (req, res) => {
  const { MaSP } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data.filter((item) => item.MaSP !== MaSP);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets[workbook.SheetNames[0]] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#products");
};
