const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const revenueRoutes = require("./routes/revenues");
const userRoutes = require("./routes/users");
const infoRoutes = require("./routes/info");
const forgotRoutes = require("./routes/forgotPassword");
const importRoutes = require("./routes/import");
const contractorRoutes = require("./routes/contractor");
const hseStaffRoutes = require("./routes/hse_staff");

// --- Cấu hình
const EMAIL_USER = "tvuong1453@gmail.com";
const EMAIL_PASS = "jqbt izcp nkaz hsdi";
const BASE_URL = "http://localhost:3000";

const multer = require("multer");
const upload = multer({ dest: "uploads/temp" });
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("./db");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const ejs = require("ejs");
const fs = require("fs");
const { error } = require("console");
const xlsx = require("xlsx");
const archiver = require("archiver");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: "10mb" }));

// Middleware
app.use(
  session({
    secret: "secretkey123",
    resave: false,
    saveUninitialized: false,
  })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

app.use("/auth", authRoutes);
app.get("/login", (req, res) => res.redirect("/auth/login"));
app.use("/dashboard", dashboardRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/revenues", revenueRoutes);
app.use("/users", userRoutes);
app.use("/information", infoRoutes);
app.use("/forgot-password", forgotRoutes);
app.use("/import", importRoutes);
app.get("/verify", require("./controllers/authController").verify);
app.use("/", contractorRoutes);
app.use("/", hseStaffRoutes);

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

// Trang chủ → chuyển đến login
app.get("/", (req, res) => res.redirect("/login"));

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
