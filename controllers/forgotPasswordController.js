// controllers/forgotPasswordController.js
const db = require("../db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Cấu hình mail
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "tvuong1453@gmail.com",
    pass: "jqbtizcpnkazhsdi",
  },
});

// Hiển thị trang quên mật khẩu
exports.getForgotPassword = (req, res) => {
  res.render("forgot-password");
};

// Gửi OTP (email hoặc điện thoại)
exports.sendOTP = (req, res) => {
  const { email, phone } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  req.session.otp = otp;
  req.session.otp_email = email;
  req.session.otp_phone = phone;

  console.log("Fake OTP:", otp); // Debug

  if (email) {
    const mailOptions = {
      from: "tvuong1453@gmail.com",
      to: email,
      subject: "Mã OTP khôi phục mật khẩu",
      text: `Mã OTP của bạn là: ${otp}`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        return res.render("forgot-password", {
          message: "Gửi email thất bại!",
        });
      }
      res.render("verify-otp", {
        message: "Đã gửi OTP qua email!",
        method: "email",
      });
    });
  } else if (phone) {
    // Fake SMS
    res.render("verify-otp", {
      message: "OTP đã gửi qua số điện thoại (giả lập)",
      method: "phone",
    });
  } else {
    res.render("forgot-password", {
      message: "Vui lòng nhập email hoặc số điện thoại",
    });
  }
};

// Xác thực OTP
exports.verifyOTP = (req, res) => {
  const { otp } = req.body;

  if (otp === req.session.otp) {
    res.render("reset-password");
  } else {
    res.render("verify-otp", {
      message: "OTP không đúng!",
      method: req.session.otp_email ? "email" : "phone",
    });
  }
};

// Đặt lại mật khẩu mới
exports.resetPassword = async (req, res) => {
  const { password } = req.body;
  const email = req.session.otp_email;
  const phone = req.session.otp_phone;

  const hash = await bcrypt.hash(password, 10);

  const sql = email
    ? "UPDATE user_accounts SET password_hash = ? WHERE email = ?"
    : "UPDATE user_accounts SET password_hash = ? WHERE phone = ?";

  db.query(sql, [hash, email || phone], (err) => {
    if (err) return res.send("Lỗi cập nhật mật khẩu");

    // Xoá session OTP
    req.session.otp = null;
    req.session.otp_email = null;
    req.session.otp_phone = null;

    res.render("reset-success");
  });
};
