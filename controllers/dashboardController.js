// controllers/dashboardController.js
const path = require("path");
const db = require("../db");
const xlsx = require("xlsx");

function convertExcelDate(serial) {
  if (!serial || isNaN(serial)) return "";
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().split("T")[0];
}

exports.renderDashboard = (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).render("error", {
      message: "Bạn không có quyền truy cập",
    });
  }

  const allUsersSql = `
    SELECT u.id, u.username, u.full_name, u.email, u.phone, u.user_type,
      u.company_name, u.department, u.position, u.status, u.safety_level,
      r.role_name, r.description
    FROM user_accounts u
    LEFT JOIN roledefine r ON u.user_type = r.user_type
    ORDER BY u.id ASC
  `;

  // Đọc Excel: product
  const productPath = path.join(__dirname, "../private", "product.xlsx");
  const workbook = xlsx.readFile(productPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const products = xlsx.utils.sheet_to_json(worksheet);

  // Đọc Excel: đơn hàng
  const orderWorkbook = xlsx.readFile(
    path.join(__dirname, "../private", "don_hang.xlsx")
  );
  const orderSheet = orderWorkbook.Sheets[orderWorkbook.SheetNames[0]];
  const rawOrders = xlsx.utils.sheet_to_json(orderSheet);
  const orders = rawOrders.map((order) => ({
    maDonHang: order["Mã đơn hàng"],
    tenKhachHang: order["Tên khách hàng"],
    soDienThoai: order["Số điện thoại"],
    email: order["Email"],
    ngayMua: convertExcelDate(order["Ngày mua"]),
    diaChi: order["Địa chỉ giao hàng"],
    thanhToan: order["Phương thức thanh toán"],
    tongTienHang: order["Tổng tiền hàng"] || 0,
    phiVanChuyen: order["Phí vận chuyển"] || 0,
    giamGia: order["Giảm giá"] || 0,
    tongTien: order["Tổng tiền"] || 0,
    nguoiXuLy: order["Người xử lý"],
    trangThai: order["Trạng thái"],
    ngayHoanThanh: order["Ngày hoàn thành"]
      ? convertExcelDate(order["Ngày hoàn thành"])
      : "",
    ghiChu: order["Ghi chú"] || "",
  }));

  // Đọc Excel: doanh thu
  const revenueWorkbook = xlsx.readFile(
    path.join(__dirname, "../private", "doanh_thu.xlsx")
  );

  const sheetNgay = revenueWorkbook.Sheets["Doanh thu theo ngày"];
  const doanhThuTheoNgay = xlsx.utils.sheet_to_json(sheetNgay).map((r) => ({
    ngay: r["Ngày"],
    soDonHang: r["Số đơn hàng"] || 0,
    doanhThu: r["Doanh thu (VNĐ)"] || 0,
    chiPhi: r["Chi phí (VNĐ)"] || 0,
    loiNhuan: r["Lợi nhuận (VNĐ)"] || 0,
    ghiChu: r["Ghi chú"] || "",
  }));

  const totalRevenue = doanhThuTheoNgay.reduce(
    (sum, row) => sum + (row.doanhThu || 0),
    0
  );

  const doanhThuTheoSanPham = xlsx.utils
    .sheet_to_json(revenueWorkbook.Sheets["Doanh thu theo sản phẩm"])
    .map((r) => ({
      maSanPham: r["Mã sản phẩm"],
      tenSanPham: r["Tên sản phẩm"],
      soLuongBan: r["Số lượng bán"] || 0,
      donGia: r["Đơn giá (VNĐ)"] || 0,
      doanhThu: r["Doanh thu (VNĐ)"] || 0,
      ghiChu: r["Ghi chú"] || "",
    }));

  const doanhThuTheoKhachHang = xlsx.utils
    .sheet_to_json(revenueWorkbook.Sheets["Doanh thu theo khách hàng"])
    .map((r) => ({
      maKhachHang: r["Mã khách hàng"],
      tenKhachHang: r["Tên khách hàng"],
      khuVuc: r["Khu vực"],
      soDonHang: r["Số đơn hàng"] || 0,
      tongTien: r["Tổng tiền (VNĐ)"] || 0,
      ghiChu: r["Ghi chú"] || "",
    }));

  const currentUserSql = "SELECT * FROM user_accounts WHERE id = ?";
  db.query(currentUserSql, [req.session.user.id], (err, currentUser) => {
    if (err || currentUser.length === 0) return res.redirect("/auth/login");

    db.query(allUsersSql, (err2, users) => {
      if (err2) return res.redirect("/auth/login");

      const user = currentUser[0];
      res.render("dashboard/layout", {
        name: user.full_name,
        email: user.email,
        avatar: user.avatar || null,
        role: user.Role || "User",
        users: users,
        products: products,
        orders: orders,
        revenuesByDay: doanhThuTheoNgay,
        revenuesByProduct: doanhThuTheoSanPham,
        revenuesByCustomer: doanhThuTheoKhachHang,
        totalRevenue: totalRevenue,
      });
    });
  });
};

exports.viewOrderDetail = (req, res) => {
  const orderId = req.params.id;
  const filePath = path.join(__dirname, "../private", "don_hang.xlsx");
  const sheet =
    xlsx.readFile(filePath).Sheets["Orders"] ||
    xlsx.readFile(filePath).Sheets[0];
  const orders = xlsx.utils.sheet_to_json(sheet);

  const order = orders.find((o) => String(o["Mã đơn hàng"]) === orderId);
  if (!order) return res.send("Không tìm thấy đơn hàng");

  res.render("order_detail", { order });
};
