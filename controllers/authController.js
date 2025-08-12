// controllers/authController.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("../db");
const { sendVerificationEmail, sendOtpEmail } = require("../utils/mailer");

exports.renderLogin = (req, res) => {
  res.render("login", { message: null, error: null });
};

exports.login = async (req, res) => {
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
    if (!match || !user.is_verified || user.status !== "active") {
      return res.render("login", {
        error: "Sai tài khoản hoặc mật khẩu hoặc chưa xác thực",
        message: null,
      });
    }

    const now = new Date();
    if (new Date(user.valid_until) < now) {
      return res.render("login", {
        error: "Tài khoản đã hết hạn. Vui lòng liên hệ HSE.",
        message: null,
      });
    }

    // Lưu session
    req.session.user = {
      id: user.id,
      name: user.full_name,
      role: user.user_type,
    };

    // Cập nhật last_login
    db.query(
      "UPDATE user_accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );

    // Điều hướng theo role
    return res.redirect("/auth/after_login");
  });
};

exports.register = async (req, res) => {
  try {
    const {
      full_name = "",
      username = "",
      email = "",
      password = "",
    } = req.body || {};

    if (
      !full_name.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      return res.render("login", {
        error: "Vui lòng nhập đầy đủ thông tin.",
        message: null,
      });
    }

    const checkSql =
      "SELECT * FROM user_accounts WHERE username = ? OR email = ?";
    const [checkErr, existing] = await new Promise((resolve) => {
      db.query(checkSql, [username, email], (err, results) =>
        resolve([err, results])
      );
    });

    if (checkErr) {
      console.error(checkErr);
      return res.render("login", {
        error: "Lỗi kiểm tra tài khoản.",
        message: null,
      });
    }
    if (existing.length > 0) {
      return res.render("login", {
        error: "Tên đăng nhập hoặc email đã tồn tại.",
        message: null,
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpire = new Date(Date.now() + 15 * 60 * 1000);

    const sql = `
      INSERT INTO user_accounts 
      (full_name, username, email, password_hash, user_type, status, is_verified, verification_token, verification_token_expire)
      VALUES (?, ?, ?, ?, 'visitor', 'pending_approval', 0, ?, ?)
    `;

    const [insertErr] = await new Promise((resolve) => {
      db.query(
        sql,
        [full_name, username, email, hash, token, tokenExpire],
        (err) => resolve([err])
      );
    });

    if (insertErr) {
      console.error(insertErr);
      return res.render("login", {
        error: "Không thể tạo tài khoản. Vui lòng thử lại.",
        message: null,
      });
    }

    try {
      await sendVerificationEmail(email, full_name, token);
      return res.render("login", {
        error: null,
        message: "Đã gửi email xác thực. Vui lòng kiểm tra hộp thư đến.",
      });
    } catch (mailErr) {
      console.error(mailErr);
      return res.render("login", {
        error: "Không thể gửi email xác thực.",
        message: null,
      });
    }
  } catch (error) {
    console.error(error);
    return res.render("login", {
      error: "Đã xảy ra lỗi khi đăng ký.",
      message: null,
    });
  }
};

exports.verify = (req, res) => {
  const token = req.query.token;
  const sql = "SELECT * FROM user_accounts WHERE verification_token = ?";

  db.query(sql, [token], (err, results) => {
    if (err || results.length === 0) {
      return res.send(
        `<script>alert("Liên kết không hợp lệ."); window.location.href = "/login";</script>`
      );
    }

    const user = results[0];
    if (new Date() > user.verification_token_expire) {
      return res.send(
        `<script>alert("Mã xác thực đã hết hạn."); window.location.href = "/auth/resend-verification";</script>`
      );
    }

    const update = `UPDATE user_accounts SET is_verified = 1, verification_token = NULL, verification_token_expire = NULL WHERE id = ?`;
    db.query(update, [user.id], () => {
      res.render("verify_success");
    });
  });
};

exports.renderResendPage = (req, res) => {
  res.send(`
    <form action="/auth/resend-verification" method="POST" style="text-align:center;margin-top:50px;">
      <h3>Gửi lại mã xác nhận</h3>
      <input type="email" name="email" placeholder="Nhập email đã đăng ký" required style="padding:8px;margin:10px;width:250px"/>
      <br />
      <button type="submit" style="padding:8px 16px;">Gửi lại mã</button>
    </form>
  `);
};

exports.resendVerification = (req, res) => {
  const { email } = req.body;
  const findUser = `SELECT * FROM user_accounts WHERE email = ?`;

  db.query(findUser, [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.send(
        `<script>alert("Email không tồn tại."); window.location.href = "/auth/resend-verification";</script>`
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
        )} giây để gửi lại mã."); window.location.href = "/auth/resend-verification";</script>`
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
        res.send(
          `<script>alert("Không thể gửi email. Vui lòng thử lại."); window.location.href = "/login";</script>`
        );
      }
    });
  });
};

exports.afterLogin = (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("after_login", {
    name: req.session.user.name,
    role: req.session.user.role,
  });
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect("/auth/login"));
};
