const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("../db");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const ejs = require("ejs");
const fs = require("fs");
const { error } = require("console");
const xlsx = require("xlsx");
const archiver = require("archiver");
const app = express();
const multer = require("multer");
const upload = multer({ dest: "uploads/temp" });

// --- Cấu hình
const EMAIL_USER = "tvuong1453@gmail.com";
const EMAIL_PASS = "jqbt izcp nkaz hsdi";
const BASE_URL = "http://localhost:3000";

// Middleware
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "secretkey123",
    resave: false,
    saveUninitialized: false,
  })
);

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Gửi email xác thực
function sendVerificationEmail(email, name, token) {
  const verifyUrl = `${BASE_URL}/verify?token=${token}`;
  const templatePath = path.join(__dirname, "views", "verify_email.ejs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const htmlContent = ejs.render(template, { name, verifyUrl });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `PVCFC <${EMAIL_USER}>`,
    to: email,
    subject: "Xác thực tài khoản PVCFC",
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
}
// Gửi email cảnh báo
function sendExpiryWarningEmail(email, name, expiryDate) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `PVCFC HSE <${EMAIL_USER}>`,
    to: email,
    subject: "⚠️ Cảnh báo hết hạn tài khoản",
    html: `
      <p>Xin chào <strong>${name}</strong>,</p>
      <p>Tài khoản của bạn sẽ hết hạn vào ngày <strong>${expiryDate}</strong>.</p>
      <p>Vui lòng liên hệ bộ phận HSE để được gia hạn quyền truy cập.</p>
      <p>Trân trọng,<br/>PVCFC</p>
    `,
  };

  return transporter.sendMail(mailOptions);
}

// === ROUTES ===

// Trang chủ → chuyển đến login
app.get("/", (req, res) => res.redirect("/login"));

// Giao diện login + đăng ký chung
app.get("/login", (req, res) => {
  res.render("login", { message: null, error: null });
});

// POST: Đăng nhập
app.post("/login", async (req, res) => {
  const { loginInput, password } = req.body;
  const sql = `SELECT * FROM user_accounts WHERE username = ? OR email = ? LIMIT 1`;
  db.query(sql, [loginInput, loginInput], async (err, results) => {
    if (err || results.length === 0) {
      return res.render("login", {
        error: "Sai tài khoản hoặc mật khẩu",
        message: null,
      });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.render("login", {
        error: "Sai tài khoản hoặc mật khẩu",
        message: null,
      });
    }

    if (!user.is_verified || user.status !== "active") {
      return res.render("login", {
        error: "Tài khoản chưa xác thực hoặc đang bị khóa",
        message: null,
      });
    }
    const now = new Date();
    const validUntil = new Date(user.valid_until); // sẽ là dạng YYYY-MM-DD

    if (validUntil < now) {
      return res.render("login", {
        error: "Tài khoản đã hết hạn. Vui lòng liên hệ HSE để gia hạn.",
        message: null,
      });
    }

    req.session.user = {
      id: user.id,
      name: user.full_name,
      role: user.user_type,
    };

    db.query(
      "UPDATE user_accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );
    res.redirect("/after_login");
  });
});

// Giao diện sau khi đăng nhập
app.get("/after_login", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  res.render("after_login", {
    name: req.session.user.name,
    role: req.session.user.role,
  });
});

// Dashboard cho admin
app.get("/dashboard", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).render("error", {
      message: "Bạn không có quyền truy cập",
    });
  }

  const allUsersSql = `
      SELECT u.id, u.username, u.full_name, u.email, u.phone, u.user_type,
        u.company_name, u.department, u.position, u.status, u.safety_level, r.role_name, r.description
      FROM user_accounts u
      LEFT JOIN roledefine r ON u.user_type = r.user_type
      ORDER BY u.id ASC
    `;

  db.query(allUsersSql, (err, results) => {
    if (err) return res.send("Lỗi lấy danh sách người dùng");
  });

  // Đọc dữ liệu Excel từ file (đường dẫn tương ứng IIS/public)
  // Đọc dữ liệu từ product.xlsx
  const workbook = xlsx.readFile(
    path.join(__dirname, "private", "product.xlsx")
  );
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const products = xlsx.utils.sheet_to_json(worksheet);
  // Đọc dữ liệu từ don_hang.xlsx
  const orderWorkbook = xlsx.readFile(
    path.join(__dirname, "private", "don_hang.xlsx")
  );
  const orderSheet = orderWorkbook.Sheets[orderWorkbook.SheetNames[0]];
  const rawOrders = xlsx.utils.sheet_to_json(orderSheet);
  const orders = rawOrders.map((order) => {
    function convertExcelDate(serial) {
      if (!serial || isNaN(serial)) return ""; // xử lý nếu dữ liệu không hợp lệ
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      return date_info.toISOString().split("T")[0]; // format: YYYY-MM-DD
    }
    return {
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
    };
  });
  // Đọc dữ liệu từ doanh_thu.xlsx
  const revenueWorkbook = xlsx.readFile(
    path.join(__dirname, "private", "doanh_thu.xlsx")
  );

  // Sheet 1: Doanh thu theo ngày
  const sheetNgay = revenueWorkbook.Sheets["Doanh thu theo ngày"];
  const doanhThuTheoNgay = xlsx.utils.sheet_to_json(sheetNgay).map((r) => ({
    ngay: r["Ngày"],
    soDonHang: r["Số đơn hàng"] || 0,
    doanhThu: r["Doanh thu (VNĐ)"] || 0,
    chiPhi: r["Chi phí (VNĐ)"] || 0,
    loiNhuan: r["Lợi nhuận (VNĐ)"] || 0,
    ghiChu: r["Ghi chú"] || "",
  }));
  // Tổng doanh thu từ bảng theo ngày
  const totalRevenue = doanhThuTheoNgay.reduce(
    (sum, row) => sum + (row.doanhThu || 0),
    0
  );

  // Sheet 2: Doanh thu theo sản phẩm
  const sheetSanPham = revenueWorkbook.Sheets["Doanh thu theo sản phẩm"];
  const doanhThuTheoSanPham = xlsx.utils
    .sheet_to_json(sheetSanPham)
    .map((r) => ({
      maSanPham: r["Mã sản phẩm"],
      tenSanPham: r["Tên sản phẩm"],
      soLuongBan: r["Số lượng bán"] || 0,
      donGia: r["Đơn giá (VNĐ)"] || 0,
      doanhThu: r["Doanh thu (VNĐ)"] || 0,
      ghiChu: r["Ghi chú"] || "",
    }));

  // Sheet 3: Doanh thu theo khách hàng
  const sheetKhachHang = revenueWorkbook.Sheets["Doanh thu theo khách hàng"];
  const doanhThuTheoKhachHang = xlsx.utils
    .sheet_to_json(sheetKhachHang)
    .map((r) => ({
      maKhachHang: r["Mã khách hàng"],
      tenKhachHang: r["Tên khách hàng"],
      khuVuc: r["Khu vực"],
      soDonHang: r["Số đơn hàng"] || 0,
      tongTien: r["Tổng tiền (VNĐ)"] || 0,
      ghiChu: r["Ghi chú"] || "",
    }));

  const userSql = `
    SELECT a.id, a.full_name, a.email, a.company_name, a.notes, rd.NameRole as Role
    FROM user_accounts a
      LEFT JOIN role r ON a.id = r.IdUser
      LEFT JOIN roledefine rd ON r.IdRole = rd.id
      WHERE a.id = ?
    `;

  const currentUserSql = "SELECT * FROM user_accounts WHERE id = ?";
  db.query(currentUserSql, [req.session.user.id], (err, currentUser) => {
    if (err || currentUser.length === 0) return res.redirect("/login");

    db.query(allUsersSql, (err2, users) => {
      if (err2) return res.redirect("/login");

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
});
app.get("/order/:id", (req, res) => {
  const orderId = req.params.id;
  const workbook = xlsx.readFile(
    path.join(__dirname, "private", "don_hang.xlsx")
  );
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const orders = xlsx.utils.sheet_to_json(sheet);

  const order = orders.find((o) => String(o.maDonHang) === orderId);
  if (!order) return res.send("Không tìm thấy đơn hàng");

  res.render("order_detail", { order });
});

app.post("/admin/delete-order", (req, res) => {
  const { maDonHang } = req.body;
  const filePath = path.join(__dirname, "private", "don_hang.xlsx");

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  // Dùng đúng tên cột: "Mã đơn hàng"
  data = data.filter((order) => order["Mã đơn hàng"] !== maDonHang);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets[workbook.SheetNames[0]] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#order");
});

//Lưu sản phẩm
app.post("/admin/save-product", (req, res) => {
  const { oldMaSP, MaSP, TenSanPham, Gia, SoLuong, DonVi } = req.body;
  const filePath = path.join(__dirname, "private", "product.xlsx");

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  // Nếu có mã cũ → sửa
  if (oldMaSP) {
    data = data.map((item) => {
      if (item.MaSP === oldMaSP) {
        return {
          MaSP,
          TenSanPham,
          Gia: parseInt(Gia),
          SoLuong: parseInt(SoLuong),
          DonVi,
        };
      }
      return item;
    });
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

  res.redirect("/dashboard#products"); // Để quay lại đúng tab sản phẩm
});
//Xóa sản phẩm
app.post("/admin/delete-product", (req, res) => {
  const { MaSP } = req.body;
  const filePath = path.join(__dirname, "private", "product.xlsx");

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let data = xlsx.utils.sheet_to_json(sheet);

  // Xoá theo MaSP
  data = data.filter((item) => item.MaSP !== MaSP);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets[workbook.SheetNames[0]] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#products");
});

// Lưu user (Thêm/Sửa)
app.post("/admin/save-user", async (req, res) => {
  const {
    id,
    full_name,
    username,
    email,
    phone,
    user_type,
    company_name,
    status,
    safety_level,
  } = req.body;
  // Xử lý access_areas thành mảng JSON
  let access_areas = req.body.access_areas;

  if (!access_areas) {
    access_areas = [];
  } else if (!Array.isArray(access_areas)) {
    access_areas = [access_areas]; // nếu chỉ chọn 1 checkbox
  }

  const accessAreasJson = JSON.stringify(access_areas);

  if (id) {
    const sql = `
        UPDATE user_accounts 
        SET full_name = ?, username = ?, email = ?, phone = ?, user_type = ?, company_name = ?, department = ?, position = ?, status = ?, safety_level = ?, access_areas = ? 
        WHERE id = ?
      `;
    db.query(
      sql,
      [
        full_name,
        username,
        email,
        phone,
        user_type,
        company_name,
        department,
        position,
        status,
        safety_level,
        accessAreasJson,
        id,
      ],
      (err) => {
        if (err) return res.send("Lỗi cập nhật user");
        res.redirect("/dashboard#users");
      }
    );
  } else {
    const password_hash = await bcrypt.hash("123456", 10);
    const sql = `
        INSERT INTO user_accounts 
        (full_name, username, email, phone, user_type, company_name, status, is_verified, safety_level, password_hash, access_areas)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `;
    db.query(
      sql,
      [
        full_name,
        username,
        email,
        phone,
        user_type,
        company_name,
        status || "pending_approval",
        safety_level,
        password_hash,
        accessAreasJson,
      ],
      (err) => {
        if (err) return res.send("Lỗi tạo user mới");
        res.redirect("/dashboard#users");
      }
    );
  }
});

// Xoá user
app.post("/admin/delete-user", (req, res) => {
  const { id } = req.body;
  db.query("DELETE FROM role WHERE IdUser = ?", [id], () => {
    db.query("DELETE FROM user_accounts WHERE id = ?", [id], () => {
      res.redirect("/dashboard#users");
    });
  });
});

// Lưu đơn hàng (Thêm/Sửa)
app.post("/admin/save-order", (req, res) => {
  const filePath = path.join(__dirname, "private", "don_hang.xlsx");
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
});

// POST: Đăng ký
app.post("/register", async (req, res) => {
  const { full_name, username, email, password } = req.body;

  // Kiểm tra đủ thông tin
  if (!full_name || !username || !email || !password) {
    return res.render("login", {
      error: "Vui lòng nhập đầy đủ thông tin",
      message: null,
    });
  }

  const hash = await bcrypt.hash(password, 10);
  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

  const sql = `
      INSERT INTO user_accounts 
      (full_name, username, email, password_hash, user_type, status, is_verified, verification_token, verification_token_expire)
      VALUES (?, ?, ?, ?, 'visitor', 'pending_approval', 0, ?, ?)
    `;

  db.query(
    sql,
    [full_name, username, email, hash, token, tokenExpire],
    async (err) => {
      if (err) {
        console.error("Đăng ký lỗi:", err.message);
        return res.render("login", {
          error: "Email hoặc tên đăng nhập đã tồn tại.",
          message: null,
        });
      }

      try {
        await sendVerificationEmail(email, full_name, token);
        return res.render("login", {
          message:
            "Đã gửi mã xác nhận tới Gmail. Vui lòng kiểm tra để xác thực!",
          error: null,
        });
      } catch (e) {
        console.error("Gửi mail thất bại:", e.message);
        return res.render("login", {
          error: "Không thể gửi mã xác thực. Vui lòng thử lại sau.",
          message: null,
        });
      }
    }
  );
});

// Xác thực tài khoản
app.get("/verify", (req, res) => {
  const token = req.query.token;

  const sql = "SELECT * FROM user_accounts WHERE verification_token = ?";
  db.query(sql, [token], (err, results) => {
    if (err || results.length === 0) {
      return res.send(
        `<script>alert("Liên kết không hợp lệ."); window.location.href = "/login";</script>`
      );
    }

    const user = results[0];
    const now = new Date();

    if (now > user.verification_token_expire) {
      return res.send(
        `<script>alert("Mã xác thực đã hết hạn."); window.location.href = "/resend-verification";</script>`
      );
    }

    const update = `
        UPDATE user_accounts
        SET is_verified = 1, verification_token = NULL, verification_token_expire = NULL
        WHERE id = ?
      `;
    db.query(update, [user.id], () => {
      res.render("verify_success");
    });
  });
});

// Giao diện gửi lại mã xác thực
app.get("/resend-verification", (req, res) => {
  res.send(`
      <form action="/resend-verification" method="POST" style="text-align:center;margin-top:50px;">
        <h3>Gửi lại mã xác nhận</h3>
        <input type="email" name="email" placeholder="Nhập email đã đăng ký" required style="padding:8px;margin:10px;width:250px"/>
        <br />
        <button type="submit" style="padding:8px 16px;">Gửi lại mã</button>
      </form>
    `);
});

// POST: Gửi lại mã xác thực
app.post("/resend-verification", (req, res) => {
  const { email } = req.body;

  const findUser = `SELECT * FROM user_accounts WHERE email = ?`;
  db.query(findUser, [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.send(
        `<script>alert("Email không tồn tại."); window.location.href = "/resend-verification";</script>`
      );
    }

    const user = results[0];
    if (user.is_verified) {
      return res.send(
        `<script>alert("Tài khoản đã xác thực. Vui lòng đăng nhập."); window.location.href = "/login";</script>`
      );
    }

    const now = new Date();
    const lastSent = new Date(user.verification_token_expire || 0);
    const diff = (now - lastSent) / 1000;

    if (diff < 60) {
      return res.send(
        `<script>alert("Vui lòng đợi ${Math.ceil(
          60 - diff
        )} giây để gửi lại mã."); window.location.href = "/resend-verification";</script>`
      );
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const newExpire = new Date(Date.now() + 15 * 60 * 1000);

    const update = `UPDATE user_accounts SET verification_token = ?, verification_token_expire = ? WHERE id = ?`;
    db.query(update, [newToken, newExpire, user.id], async (err2) => {
      if (err2) {
        return res.send(
          `<script>alert("Không thể gửi lại mã. Vui lòng thử lại sau."); window.location.href = "/login";</script>`
        );
      }

      try {
        await sendVerificationEmail(email, user.full_name, newToken);
        res.send(
          `<script>alert("Đã gửi lại mã xác nhận. Vui lòng kiểm tra email."); window.location.href = "/login";</script>`
        );
      } catch (e) {
        console.error("Lỗi gửi lại mã:", e);
        res.send(
          `<script>alert("Không thể gửi email. Vui lòng thử lại."); window.location.href = "/login";</script>`
        );
      }
    });
  });
});

//render từ forgot_password.ejs
app.get("/forgot_password", (req, res) => {
  res.render("forgot_password", {
    step: null,
    method: null,
    userId: null,
    popup: false,
    error: null,
  });
});

// Gửi OTP qua phone/email
app.post("/send-otp-phone", async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // mã OTP 6 chữ số

  // Tìm user theo số điện thoại
  const findUser = `SELECT id FROM user_accounts WHERE phone = ?`;
  db.query(findUser, [phone], (err, result) => {
    if (err || result.length === 0) {
      return res.send("Không tìm thấy tài khoản với số điện thoại này.");
    }

    const userId = result[0].ID;
    // Lưu OTP vào DB hoặc tạm thời gắn vào session
    req.session.otp = otp;
    req.session.otpUserId = userId;

    // In OTP ra terminal thay vì gửi thật
    console.log(`[OTP - PHONE] Mã OTP của ${phone} là: ${otp}`);

    res.render("forgot_password", {
      step: "otp",
      method: "phone",
      userId: userId,
      popup: false,
      error: null,
    });
  });
});

app.post("/send-otp-email", async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const findUser = `SELECT id, full_name FROM user_accounts WHERE email = ?`;
  db.query(findUser, [email], async (err, result) => {
    if (err || result.length === 0) {
      return res.send("Không tìm thấy tài khoản với email này.");
    }

    const userId = result[0].id;
    const name = result[0].full_name;

    req.session.otp = otp;
    req.session.otpUserId = userId;

    // Gửi email thật
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `PVCFC <${EMAIL_USER}>`,
      to: email,
      subject: "Mã OTP đặt lại mật khẩu",
      html: `<p>Chào ${name},</p><p>Mã OTP để đặt lại mật khẩu của bạn là: <b>${otp}</b>. Mã có hiệu lực trong 5 phút.</p>`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[OTP - EMAIL] Mã OTP gửi tới ${email}: ${otp}`);
      res.render("forgot_password", {
        step: "otp",
        method: "email",
        userId: userId,
        popup: false,
        error: null,
      });
    } catch (e) {
      console.error("Gửi email lỗi:", e.message);
      res.send("Không thể gửi email OTP. Vui lòng thử lại sau.");
    }
  });
});

// Xác nhận OTP
app.post("/verify-otp", (req, res) => {
  const { otp } = req.body;

  if (req.session.otp && otp === req.session.otp) {
    const userId = req.session.otpUserId;
    res.render("forgot_password", {
      step: "newPassword",
      method: null,
      userId: userId,
      popup: false,
      error: null,
    });
  } else {
    res.render("forgot_password", {
      step: "otp",
      method: req.body.method,
      userId: req.session.otpUserId,
      popup: false,
      error: "Mã OTP không đúng hoặc đã hết hạn.",
    });
  }
});

// Đổi mật khẩu
app.post("/change-password", async (req, res) => {
  const { newPassword, confirmPassword, userId } = req.body;
  if (newPassword !== confirmPassword) return res.send("Mật khẩu không khớp");

  const hashed = await bcrypt.hash(newPassword, 10);
  await db
    .promise()
    .query("UPDATE user_accounts SET password_hash = ? WHERE id = ?", [
      hashed,
      userId,
    ]);

  // Clear session OTP
  req.session.otp = null;
  req.session.otpUserId = null;

  res.render("forgot_password", {
    popup: true,
    step: null,
    method: null,
    userId: null,
    error: null,
  });

  // Sau 5s redirect về /login sẽ được xử lý trên frontend
});

//Routes information
// GET: Hiển thị form trang cá nhân
app.get("/information", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const currentUser = req.session.user;
  const userId = currentUser.id;

  const sql = "SELECT * FROM user_accounts WHERE id = ?";
  db.query(sql, [userId], (err, result) => {
    const user = result[0];
    const createdById = user.created_by;

    // Lấy tên người tạo nếu có
    db.query(
      "SELECT full_name FROM user_accounts WHERE id = ?",
      [createdById],
      (err2, res2) => {
        const createdByName = res2?.[0]?.full_name || null;

        res.render("information", {
          user,
          currentUser,
          createdByName,
        });
      }
    );
    const userId = req.session.user.id;
    const sql = `
      SELECT username, full_name, email, phone, user_type, company_name, department,
            position, id_number, visitor_badge_number, status, is_verified,
            safety_level, last_safety_training_date, safety_certificate_expiry,
            access_areas, valid_from, valid_until, last_login, notes
      FROM user_accounts
      WHERE id = ?
    `;

    db.query(sql, [userId], (err, results) => {
      if (err || results.length === 0)
        return res.send("Không tìm thấy người dùng");
    });
  });
});

// POST: Cập nhật thông tin
app.use(bodyParser.json({ limit: "10mb" }));
app.get("/information", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const currentUser = req.session.user;
  const userId = currentUser.id;

  const userSql = "SELECT * FROM user_accounts WHERE id = ?";
  db.query(userSql, [userId], (err, results) => {
    if (err || results.length === 0)
      return res.send("Không tìm thấy người dùng");

    const user = results[0];
    const createdById = user.created_by;

    // Lấy tên người tạo
    db.query(
      "SELECT full_name FROM user_accounts WHERE id = ?",
      [createdById],
      (err2, results2) => {
        const createdByName = results2?.[0]?.full_name || null;
        res.render("information", {
          user,
          currentUser,
          createdByName,
        });
      }
    );
  });
});

// POST cập nhật thông tin người dùng, avatar + phân quyền
app.use(bodyParser.json({ limit: "10mb" }));
app.post("/information", upload.single("avatar"), (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const userId = req.session.user.id;
  const isAdmin = req.session.user.role === "admin";

  const {
    full_name,
    phone,
    company_name,
    company_id,
    department,
    position,
    id_number,
    dateOfBirth,
    notes,
    user_type,
    status,
    safety_level,
    last_safety_training_date,
    safety_certificate_expiry,
    access_areas,
    valid_from,
    valid_until,
  } = req.body;

  const fieldsToUpdate = {
    full_name,
    phone,
    company_name,
    company_id,
    department,
    position,
    id_number,
    dateOfBirth,
    notes,
  };

  if (isAdmin) {
    Object.assign(fieldsToUpdate, {
      user_type,
      status,
      safety_level,
      last_safety_training_date,
      safety_certificate_expiry,
      access_areas,
      valid_from,
      valid_until,
    });
  }

  // ✅ Xử lý avatar nếu có upload
  if (req.file) {
    const newFilename = `avatar_${userId}_${Date.now()}.jpg`;
    const fs = require("fs");
    const path = require("path");
    const oldPath = req.file.path;
    const newPath = path.join(__dirname, "uploads", newFilename);
    fs.renameSync(oldPath, newPath);
    fieldsToUpdate.avatar = newFilename;
  }

  // ✅ Tạo câu truy vấn cập nhật động
  const columns = Object.keys(fieldsToUpdate);
  const values = Object.values(fieldsToUpdate);
  const setClause = columns.map((col) => `${col} = ?`).join(", ");

  const sql = `UPDATE user_accounts SET ${setClause} WHERE id = ?`;
  db.query(sql, [...values, userId], (err) => {
    if (err) return res.send("Lỗi khi cập nhật thông tin.");
    res.redirect("/information");
  });
});

//Routes tải dữ liệu
app.get("/download/all", (req, res) => {
  const archive = archiver("zip", { zlib: { level: 9 } });

  res.attachment("data_pvcfc.zip");
  archive.pipe(res);

  const files = ["product.xlsx", "don_hang.xlsx", "doanh_thu.xlsx"];
  files.forEach((file) => {
    const filePath = path.join(__dirname, "private", file);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: file });
    }
  });

  archive.finalize();
});

//Routes khôi phục dữ liệu
app.post("/admin/import-excel", upload.single("excelFile"), (req, res) => {
  const file = req.file;
  const type = req.body.type;

  if (!file || !type) {
    return res.send("Thiếu dữ liệu hoặc file Excel không hợp lệ.");
  }

  const workbook = xlsx.readFile(file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  // Xử lý theo từng loại
  switch (type) {
    case "users":
      data.forEach((user) => {
        const sql = `
            INSERT INTO user_accounts (full_name, email, password_hash, is_verified, company_name, notes)
            VALUES (?, ?, '', 1, ?, ?)
          `;
        db.query(sql, [
          user.full_name,
          user.email,
          user.company_name || "",
          user.notes || "",
        ]);
      });
      break;

    case "products":
      const productFile = path.join(__dirname, "private", "product.xlsx");
      const sheetNew = xlsx.utils.json_to_sheet(data);
      const newBook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(newBook, sheetNew, "Products");
      xlsx.writeFile(newBook, productFile);
      break;

    case "orders":
      const orderFile = path.join(__dirname, "private", "don_hang.xlsx");
      const orderSheet = xlsx.utils.json_to_sheet(data);
      const newOrderBook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(newOrderBook, orderSheet, "Orders");
      xlsx.writeFile(newOrderBook, orderFile);
      break;

    case "revenues":
      const revFile = path.join(__dirname, "private", "doanh_thu.xlsx");
      const newRevenueBook = xlsx.utils.book_new();
      data.forEach((item) => {
        if (item["Ngày"]) {
          const sheet1 = xlsx.utils.json_to_sheet(data);
          xlsx.utils.book_append_sheet(
            newRevenueBook,
            sheet1,
            "Doanh thu theo ngày"
          );
        } else if (item["Mã sản phẩm"]) {
          const sheet2 = xlsx.utils.json_to_sheet(data);
          xlsx.utils.book_append_sheet(
            newRevenueBook,
            sheet2,
            "Doanh thu theo sản phẩm"
          );
        } else if (item["Mã khách hàng"]) {
          const sheet3 = xlsx.utils.json_to_sheet(data);
          xlsx.utils.book_append_sheet(
            newRevenueBook,
            sheet3,
            "Doanh thu theo khách hàng"
          );
        }
      });
      xlsx.writeFile(newRevenueBook, revFile);
      break;
  }

  fs.unlinkSync(file.path); // Xoá file tạm
  res.redirect("/dashboard");
});

// POST: Lưu doanh thu theo ngày
app.post("/admin/save-revenue-day", (req, res) => {
  const filePath = path.join(__dirname, "private", "doanh_thu.xlsx");
  const { oldNgay, ngay, soDonHang, doanhThu, chiPhi, loiNhuan, ghiChu } =
    req.body;

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo ngày"];
  let data = xlsx.utils.sheet_to_json(sheet);

  const newRow = {
    Ngày: date(ngay),
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
});

// POST: Lưu doanh thu theo sản phẩm
app.post("/admin/save-revenue-product", (req, res) => {
  const filePath = path.join(__dirname, "private", "doanh_thu.xlsx");
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

  res.redirect("/dashboard#revenue");
});

// POST: Lưu doanh thu theo khách hàng
app.post("/admin/save-revenue-customer", (req, res) => {
  const filePath = path.join(__dirname, "private", "doanh_thu.xlsx");
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

  res.redirect("/dashboard#revenue");
});

// Xoá doanh thu theo ngày
app.post("/admin/delete-revenue-day", (req, res) => {
  const { ngay } = req.body;
  const filePath = path.join(__dirname, "private", "doanh_thu.xlsx");

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo ngày"];
  let data = xlsx.utils.sheet_to_json(sheet);

  // Chuyển giá trị cần xoá về chuẩn yyyy-mm-dd
  const deleteDate = new Date(ngay);
  if (isNaN(deleteDate.getTime())) {
    console.error("Ngày không hợp lệ từ form:", ngay);
    return res.redirect("/dashboard"); // tránh crash
  }
  const deleteDateStr = deleteDate.toISOString().split("T")[0];

  // Lọc dữ liệu: chỉ giữ lại những dòng khác ngày cần xoá
  data = data.filter((row) => {
    const cell = row["Ngày"];
    if (!cell) return true;

    const rowDate = new Date(cell);
    if (isNaN(rowDate.getTime())) return true;

    const rowDateStr = rowDate.toISOString().split("T")[0];
    return rowDateStr !== deleteDateStr;
  });

  // Ghi lại file Excel
  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo ngày"] = newSheet;
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard"); // không cần anchor nếu dùng localStorage giữ tab
});

// Xoá doanh thu theo sản phẩm
app.post("/admin/delete-revenue-product", (req, res) => {
  const { maSanPham } = req.body;
  const filePath = path.join(__dirname, "private", "doanh_thu.xlsx");

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo sản phẩm"];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data.filter((row) => row["Mã sản phẩm"] !== maSanPham);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo sản phẩm"] = newSheet;
  console.log("filePath:", filePath, typeof filePath);
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue-product");
});

// Xoá doanh thu theo khách hàng
app.post("/admin/delete-revenue-customer", (req, res) => {
  const { maKhachHang } = req.body;
  const filePath = path.join(__dirname, "private", "doanh_thu.xlsx");

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets["Doanh thu theo khách hàng"];
  let data = xlsx.utils.sheet_to_json(sheet);

  data = data.filter((row) => row["Mã khách hàng"] !== maKhachHang);

  const newSheet = xlsx.utils.json_to_sheet(data);
  workbook.Sheets["Doanh thu theo khách hàng"] = newSheet;
  console.log("filePath:", filePath, typeof filePath);
  xlsx.writeFile(workbook, filePath);

  res.redirect("/dashboard#revenue-customer");
});

// Đăng xuất
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Khai báo các module và middleware ở trên
function kiemTraHangNgay() {
  console.log("🕒 Kiểm tra dữ liệu hằng ngày...");
  // ... logic kiểm tra
}
// Gọi 1 lần khi khởi động
kiemTraHangNgay();
// Thiết lập gọi lại mỗi 24 giờ
setInterval(kiemTraHangNgay, 24 * 60 * 60 * 1000);

// Khởi chạy server
app.listen(3000, () => {
  console.log(" Server đang chạy tại http://localhost:3000");
});
