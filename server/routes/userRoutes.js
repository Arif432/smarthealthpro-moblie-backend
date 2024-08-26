const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  verifyUser,
  updateUser,
  deleteUser,
  forgotPassword,
  resetPassword,
  getUserInfo,
  getDoctorsBySatisfaction,
  getAllDoctors,
  getDoctorById,
  createDoctor,
  createPatient,
  updateDoctorInfo,
  updatePassword,
} = require("../controllers/RegisterController");
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.status(200).json({ message: "Logout successful" });
});

// router.use(verifyUser);
router.get("/admin", (req, res) => {
  res.status(200).json("Success");
});
router.get("/getUserInfo/:id", getUserInfo);
router.put("/updateUser/:id", updateUser);
router.delete("/deleteUser/:id", deleteUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:userId/:token", resetPassword);
router.get("/getDoctorsBySatisfaction", getDoctorsBySatisfaction);
router.get("/getAllDoctors", getAllDoctors);
router.get("/getDoctorById/:id", getDoctorById);
router.post("/createDoctor", createDoctor);
router.post("/createPatient", createPatient);
router.post("/updateDoctorInfo/:id", updateDoctorInfo);
router.post("/updatePassword", updatePassword);

module.exports = router;
