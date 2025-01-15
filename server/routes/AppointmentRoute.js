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
  addPrescriptionToAppointment,
  getPrescriptionByPatientId,
  updatePrescription,
  cancelAppointment,
} = require("../controllers/AppointmentController");

// router.use(verifyUser);
router.get("/getAllAppointments", getAppointments);
router.get("/getSingleAppointment/:id", getAppointmentById);
router.get(
  "/getAppointmentsByPatientId/:patientId",
  getAppointmentsByPatientId
);
router.get("/getAppointmentsByDoctorId/:doctorId", getAppointmentsByDoctorId);
router.get("/:id/prescription", getPrescriptionByPatientId);
router.post("/postAppointment", createAppointment);
router.post("/scheduleAppointments", scheduleAppointments);
router.post("/:id/prescription", addPrescriptionToAppointment);
router.put("/updateAppointment/:id", updateAppointment);
router.put("/:appointmentId/prescriptions/:prescriptionId", updatePrescription);
router.delete("/deleteAppointment/:id", deleteAppointment);

// Add the new cancel appointment route
router.patch("/:id/cancel", cancelAppointment);

module.exports = router;
