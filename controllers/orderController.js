// controllers/orderController.js
const path = require("path");
const xlsx = require("xlsx");

const filePath = path.join(__dirname, "../private", "don_hang.xlsx");

exports.saveOrder = (req, res) => {
  const {
    oldMaDonHang,
    maDonHang,
    tenKhachHang,
    soDienThoai,
    email,
    ngayMua,
    diaChi,
    thanhToan,
    tongTienHang,
    phiVanChuyen,
    giamGia,
    tongTien,
    nguoiXuLy,
    trangThai,
    ngayHoanThanh,
    ghiChu,
  } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  const newOrder = {
    "Mã đơn hàng": maDonHang,
    "Tên khách hàng": tenKhachHang,
    "Số điện thoại": soDienThoai,
    Email: email,
    "Ngày mua": new Date(ngayMua),
    "Địa chỉ giao hàng": diaChi,
    "Phương thức thanh toán": thanhToan,
    "Tổng tiền hàng": parseFloat(tongTienHang) || 0,
    "Phí vận chuyển": parseFloat(phiVanChuyen) || 0,
    "Giảm giá": parseFloat(giamGia) || 0,
    "Tổng tiền": parseFloat(tongTien) || 0,
    "Người xử lý": nguoiXuLy,
    "Trạng thái": trangThai,
    "Ngày hoàn thành": ngayHoanThanh ? new Date(ngayHoanThanh) : "",
    "Ghi chú": ghiChu,
  };

  if (oldMaDonHang) {
    data = data.map((order) =>
      order["Mã đơn hàng"] === oldMaDonHang ? newOrder : order
    );
  } else {
    data.push(newOrder);
  }

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets[workbook.SheetNames[0]] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#orders");
};

exports.deleteOrder = (req, res) => {
  const { maDonHang } = req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data.filter((order) => order["Mã đơn hàng"] !== maDonHang);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets[workbook.SheetNames[0]] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#orders");
};
