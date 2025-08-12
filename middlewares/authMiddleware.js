// middlewares/authMiddleware.js
exports.isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).render("error", {
      message: "Bạn không có quyền truy cập",
    });
  }
  next();
};
exports.isLoggedIn = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
};
exports.isContractor = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "contractor") {
    return res.status(403).render("error", {
      message: "Bạn không có quyền truy cập khu vực nhà thầu",
    });
  }
  next();
};
exports.isHSEStaff = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "hse_staff") {
    return res
      .status(403)
      .render("error", { message: "Bạn không có quyền truy cập" });
  }
  next();
};
