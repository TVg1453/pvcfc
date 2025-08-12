// controllers/infoController.js
const path = require("path");
const fs = require("fs");
const db = require("../db");

exports.getInformation = (req, res) => {
  console.log("SESSION hiện tại:", req.session.user);

  if (!req.session.user) return res.redirect("/auth/login");

  const currentUser = req.session.user;
  const userId = currentUser.id;

  const sql = "SELECT * FROM user_accounts WHERE id = ?";
  db.query(sql, [userId], (err, result) => {
    if (err || result.length === 0)
      return res.send("Không tìm thấy người dùng");

    const user = result[0];
    const createdById = user.created_by;

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
  });
};

exports.updateInformation = (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");

  const userId = req.session.user.id;
  const role = req.session.user.user_type;

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
    email,
    username,
  } = req.body;

  const fieldsToUpdate = {};

  // Helper: Chỉ thêm field nếu có dữ liệu thực sự
  const addField = (key, value) => {
    if (value !== undefined && value !== null && value !== "") {
      fieldsToUpdate[key] = value;
    }
  };

  if (role === "admin") {
    addField("full_name", full_name);
    addField("phone", phone);
    addField("email", email);
    addField("company_name", company_name);
    addField("company_id", company_id);
    addField("department", department);
    addField("position", position);
    addField("id_number", id_number);
    addField("dateOfBirth", dateOfBirth);
    addField("notes", notes);
    addField("user_type", user_type);
    addField("status", status);
    addField("safety_level", safety_level);
    addField("last_safety_training_date", last_safety_training_date);
    addField("safety_certificate_expiry", safety_certificate_expiry);
    addField("access_areas", access_areas);
    addField("valid_from", valid_from);
    addField("valid_until", valid_until);
    addField("username", username);
  } else if (role === "hse_staff") {
    addField("full_name", full_name);
    addField("phone", phone);
    addField("email", email);
    addField("safety_level", safety_level);
    addField("notes", notes);
  } else if (role === "contractor") {
    addField("full_name", full_name);
    addField("phone", phone);
    addField("email", email);
    addField("notes", notes);
  }

  // Xử lý avatar nếu có
  if (req.file) {
    const newFilename = `avatar_${userId}_${Date.now()}.jpg`;
    const oldPath = req.file.path;
    const newPath = path.join(__dirname, "../uploads", newFilename);
    fs.renameSync(oldPath, newPath);
    fieldsToUpdate.avatar = newFilename;

    req.session.user.avatar = newFilename;
  }

  const columns = Object.keys(fieldsToUpdate);
  const values = Object.values(fieldsToUpdate);

  // Không có gì để update
  if (columns.length === 0) {
    return res.redirect("/information");
  }

  const setClause = columns.map((col) => `${col} = ?`).join(", ");
  const sql = `UPDATE user_accounts SET ${setClause} WHERE id = ?`;

  db.query(sql, [...values, userId], (err) => {
    console.error("Lỗi SQL khi cập nhật:", err.message || err);
    if (err) return res.send("Lỗi khi cập nhật thông tin.");
    res.redirect("/information");
  });
};
