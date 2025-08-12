// utils/mailer.js
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");

const EMAIL_USER = "tvuong1453@gmail.com";
const EMAIL_PASS = "jqbt izcp nkaz hsdi";
const BASE_URL = "http://localhost:3000";

exports.sendVerificationEmail = (email, name, token) => {
  const verifyUrl = `${BASE_URL}/verify?token=${token}`;
  const templatePath = path.join(__dirname, "../views", "verify_email.ejs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const htmlContent = ejs.render(template, { name, verifyLink: verifyUrl });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  return transporter.sendMail({
    from: `PVCFC <${EMAIL_USER}>`,
    to: email,
    subject: "Xác thực tài khoản PVCFC",
    html: htmlContent,
  });
};
