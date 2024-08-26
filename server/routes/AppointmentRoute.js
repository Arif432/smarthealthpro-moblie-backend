const express = require("express");
const { verifyUser } = require("../controllers/RegisterController");
const router = express.Router();
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByPatientId,
  getAppointmentsByDoctorId,
} = require("../controllers/AppointmentController");

// router.use(verifyUser);
router.get("/getAllAppointments", getAppointments);
router.get("/getSingleAppointment/:id", getAppointmentById);
router.post("/postAppointment", createAppointment);
router.put("/updateAppointment/:id", updateAppointment);
router.delete("/deleteAppointment/:id", deleteAppointment);
router.get(
  "/getAppointmentsByPatientId/:patientId",
  getAppointmentsByPatientId
);
router.get("/getAppointmentsByDoctorId/:doctorId", getAppointmentsByDoctorId);

module.exports = router;
