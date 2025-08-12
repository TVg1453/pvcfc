// controllers/revenueController.js
const path = require("path");
const xlsx = require("xlsx");

const filePath = path.join(__dirname, "../private", "doanh_thu.xlsx");

exports.saveRevenueDay = (req, res) => {
  const { oldNgay, ngay, soDonHang, doanhThu, chiPhi, loiNhuan, ghiChu } =
    req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo ngày"];
  let data = xlsx.utils.sheet_to_json(sheet);

  const newRow = {
    Ngày: new Date(ngay).toISOString().split("T")[0],
    "Số đơn hàng": parseInt(soDonHang),
    "Doanh thu (VNĐ)": parseFloat(doanhThu),
    "Chi phí (VNĐ)": parseFloat(chiPhi),
    "Lợi nhuận (VNĐ)": parseFloat(loiNhuan),
    "Ghi chú": ghiChu || "",
  };

  if (oldNgay) {
    data = data.map((row) => (row["Ngày"] === oldNgay ? newRow : row));
  } else {
    data.push(newRow);
  }

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo ngày"] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue");
};

exports.saveRevenueProduct = (req, res) => {
  const {
    oldMaSanPham,
    maSanPham,
    tenSanPham,
    soLuongBan,
    donGia,
    doanhThu,
    ghiChu,
  } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo sản phẩm"];
  let data = xlsx.utils.sheet_to_json(sheet);

  const newRow = {
    "Mã sản phẩm": maSanPham,
    "Tên sản phẩm": tenSanPham,
    "Số lượng bán": parseInt(soLuongBan),
    "Đơn giá (VNĐ)": parseFloat(donGia),
    "Doanh thu (VNĐ)": parseFloat(doanhThu),
    "Ghi chú": ghiChu || "",
  };

  if (oldMaSanPham) {
    data = data.map((row) =>
      row["Mã sản phẩm"] === oldMaSanPham ? newRow : row
    );
  } else {
    data.push(newRow);
  }

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo sản phẩm"] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue-product");
};

exports.saveRevenueCustomer = (req, res) => {
  const {
    oldMaKhachHang,
    maKhachHang,
    tenKhachHang,
    khuVuc,
    soDonHang,
    tongTien,
    ghiChu,
  } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo khách hàng"];
  let data = xlsx.utils.sheet_to_json(sheet);

  const newRow = {
    "Mã khách hàng": maKhachHang,
    "Tên khách hàng": tenKhachHang,
    "Khu vực": khuVuc,
    "Số đơn hàng": parseInt(soDonHang),
    "Tổng tiền (VNĐ)": parseFloat(tongTien),
    "Ghi chú": ghiChu || "",
  };

  if (oldMaKhachHang) {
    data = data.map((row) =>
      row["Mã khách hàng"] === oldMaKhachHang ? newRow : row
    );
  } else {
    data.push(newRow);
  }

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo khách hàng"] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue-customer");
};

exports.deleteRevenueDay = (req, res) => {
  const { ngay } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo ngày"];
  let data = xlsx.utils.sheet_to_json(sheet);

  // Normalize input ngay (convert dd-mm-yyyy or dd/mm/yyyy → yyyy-mm-dd)
  let normalizedNgay = ngay;
  if (ngay.includes("-")) {
    const parts = ngay.split("-");
    if (parts[0].length === 2) {
      normalizedNgay = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  } else if (ngay.includes("/")) {
    const parts = ngay.split("/");
    if (parts[0].length === 2) {
      normalizedNgay = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  data = data.filter((row) => {
    const cell = row["Ngày"];
    // So sánh trực tiếp chuỗi đã chuẩn hóa
    return String(cell).split("T")[0] !== normalizedNgay;
  });

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo ngày"] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue");
};

exports.deleteRevenueProduct = (req, res) => {
  const { maSanPham } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo sản phẩm"];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data.filter((row) => row["Mã sản phẩm"] !== maSanPham);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo sản phẩm"] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue-product");
};

exports.deleteRevenueCustomer = (req, res) => {
  const { maKhachHang } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo khách hàng"];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data.filter((row) => row["Mã khách hàng"] !== maKhachHang);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo khách hàng"] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue-customer");
};
