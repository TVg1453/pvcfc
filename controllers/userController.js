// controllers/userController.js
const db = require("../db");
const bcrypt = require("bcrypt");

exports.saveUser = async (req, res) => {
  const {
    id,
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
  } = req.body;

  let access_areas = req.body.access_areas || [];
  if (!Array.isArray(access_areas)) access_areas = [access_areas];

  const accessAreasJson = JSON.stringify(access_areas);

  if (id) {
    const sql = `
      UPDATE user_accounts 
      SET full_name = ?, username = ?, email = ?, phone = ?, user_type = ?, 
          company_name = ?, department = ?, position = ?, status = ?, 
          safety_level = ?, access_areas = ? 
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
        if (err) {
          console.error("Lỗi khi tạo user mới:", err);
          return res.send("Lỗi tạo user mới");
        }
        res.redirect("/dashboard#users");
      }
    );
  }
};

exports.deleteUser = (req, res) => {
  const { id } = req.body;

  db.query("DELETE FROM role WHERE IdUser = ?", [id], () => {
    db.query("DELETE FROM user_accounts WHERE id = ?", [id], () => {
      res.redirect("/dashboard#users");
    });
  });
};
