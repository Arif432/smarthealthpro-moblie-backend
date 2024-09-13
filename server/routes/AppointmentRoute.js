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
  scheduleAppointments,
  getAvailableDoctors,
} = require("../controllers/AppointmentController");

// router.use(verifyUser);
router.get("/getAllAppointments", getAppointments);
router.get("/getSingleAppointment/:id", getAppointmentById);
router.get(
  "/getAppointmentsByPatientId/:patientId",
  getAppointmentsByPatientId
);
router.get("/getAppointmentsByDoctorId/:doctorId", getAppointmentsByDoctorId);
router.get("/getAvailableDoctors", getAvailableDoctors);
router.post("/postAppointment", createAppointment);
router.post("/scheduleAppointments", scheduleAppointments);
router.put("/updateAppointment/:id", updateAppointment);
router.delete("/deleteAppointment/:id", deleteAppointment);

module.exports = router;
