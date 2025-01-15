const Appointment = require("../models/AppointmentModal");
const mongoose = require("mongoose");
const moment = require("moment");
const { Doctor, User } = require("../models/UserModal");
const cron = require("node-cron");
const { sendMail } = require("../../utils/nodemailerConfig");

// Helper functions remain unchanged
const findDoctorById = async (doctorId) => {
  try {
    const doctor = await Doctor.findById(doctorId).populate(
      "user",
      "-password"
    );
    if (!doctor) {
      throw new Error("Doctor not found.");
    }
    return doctor;
  } catch (error) {
    console.error("Error finding doctor:", error);
    throw new Error("An error occurred while fetching doctor info.");
  }
};

const getDoctorById = (doctorId) => {
  const doctors = {
    "66c0b2aa90040b7bc334b842": {
      office_hours: {
        tuesday: "10:00 AM - 10:30 AM",
        wednesday: "10:00 AM - 11:00 AM",
      },
    },
  };
  return doctors[doctorId];
};

// Other helper functions remain unchanged
const generateTimeSlots = (doctorId, day) => {
  const doctor = getDoctorById(doctorId);
  const office_hours = doctor.office_hours;
  const office_hour_range = office_hours[day.toLowerCase()];

  if (!office_hour_range || office_hour_range.toLowerCase() === "closed")
    return [];

  const [start, end] = office_hour_range.split(" - ");
  let start_time = moment(start, "hh:mm A");
  const end_time = moment(end, "hh:mm A");
  const slots = [];

  while (start_time.isBefore(end_time)) {
    const slot_start = start_time.format("hh:mm A");
    start_time.add(30, "minutes");
    const slot_end = start_time.format("hh:mm A");
    slots.push({ start: slot_start, end: slot_end });
  }

  return slots;
};

const sortPatients = (patients) => {
  return patients.sort((a, b) => {
    if (a.priority === "high" && b.priority === "low") return -1;
    if (a.priority === "low" && b.priority === "high") return 1;

    const dateA = new Date(a.bookedOn);
    const dateB = new Date(b.bookedOn);
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;

    const timeA = moment(a.bookedOn).format("hh:mm A");
    const timeB = moment(b.bookedOn).format("hh:mm A");
    return moment(timeA, "hh:mm A").diff(moment(timeB, "hh:mm A"));
  });
};

const assignTimeSlots = (time_slots, patients) => {
  const assigned_appointments = [];
  const waiting_list = [];
  const time_slot_queue = [...time_slots];

  patients.forEach((patient) => {
    if (time_slot_queue.length > 0) {
      const time_slot = time_slot_queue.shift();
      patient.assigned_slot = time_slot;
      assigned_appointments.push(patient);
    } else {
      waiting_list.push(patient);
    }
  });

  return { assigned_appointments, waiting_list };
};

// Updated Controller functions
const createAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.create(req.body);
    res.status(201).json({ appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAppointments = async (req, res) => {
  try {
    const { doctorId, patientId } = req.query;
    let query = {};

    if (doctorId) {
      query["doctor.id"] = new mongoose.Types.ObjectId(doctorId);
    }
    if (patientId) {
      query["patient.id"] = new mongoose.Types.ObjectId(patientId);
    }

    const appointments = await Appointment.find(query);
    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const appointmentId = new mongoose.Types.ObjectId(req.params.id);
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.status(200).json(appointment);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getAppointmentsByPatientId = async (req, res) => {
  try {
    const patientId = new mongoose.Types.ObjectId(req.params.patientId);
    const appointments = await Appointment.find({ "patient.id": patientId });
    return res.status(200).json(appointments);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

const getAppointmentsByDoctorId = async (req, res) => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.params.doctorId);
    const appointments = await Appointment.find({ "doctor.id": doctorId });
    return res.status(200).json(appointments);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const appointmentId = new mongoose.Types.ObjectId(req.params.id);
    const updateFields = req.body;

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.status(200).json({ appointment: updatedAppointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const appointmentId = new mongoose.Types.ObjectId(req.params.id);
    const appointment = await Appointment.findByIdAndDelete(appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    res.status(200).json({ message: "Appointment deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const scheduleAppointments = async (req, res) => {
  const { day } = req.body;

  try {
    const appointments = await Appointment.find({ appointmentStatus: "tbd" });
    const targetDate = moment().day(day).startOf("day");

    const patients = appointments.map((appointment) => ({
      id: appointment._id,
      priority: appointment.priority,
      booking_time: moment(appointment.bookedOn).format("hh:mm A"),
      booking_day: moment(appointment.bookedOn).format("dddd").toLowerCase(),
      doctorId: appointment.doctor.id,
      appointment,
    }));

    const firstPatient = patients[0];
    const time_slots = generateTimeSlots(firstPatient.doctorId.toString(), day);
    const sorted_patients = sortPatients(patients);
    const { assigned_appointments, waiting_list } = assignTimeSlots(
      time_slots,
      sorted_patients
    );

    const updatedAppointments = await Promise.all(
      assigned_appointments.map(async (a) => {
        const updateFields = {
          date: targetDate.format("YYYY-MM-DD"),
          time: a.assigned_slot.start,
          appointmentStatus: "pending",
        };

        const updatedAppointment = await Appointment.findByIdAndUpdate(
          a.appointment._id,
          { $set: updateFields },
          { new: true }
        );

        return {
          appointment: updatedAppointment,
          assigned_slot: {
            start: moment(
              `${targetDate.format("YYYY-MM-DD")} ${a.assigned_slot.start}`,
              "YYYY-MM-DD hh:mm A"
            ).toISOString(),
            end: moment(
              `${targetDate.format("YYYY-MM-DD")} ${a.assigned_slot.end}`,
              "YYYY-MM-DD hh:mm A"
            ).toISOString(),
          },
        };
      })
    );

    return res.status(200).json({
      message: `Appointments scheduled successfully for ${day}. ${updatedAppointments.length} appointments updated in database.`,
      nextDay: day,
      assigned_appointments: updatedAppointments,
      waiting_list: waiting_list.map((w) => ({ appointment: w.appointment })),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error scheduling appointments",
      error: error.message,
    });
  }
};

const scheduleAppointmentsBackground = async (day) => {
  try {
    const appointments = await Appointment.find({ appointmentStatus: "tbd" });
    const targetDate = moment().day(day).startOf("day");

    // If no appointments, just return early
    if (!appointments.length) {
      console.log("No appointments to schedule");
      return;
    }

    const patients = appointments.map((appointment) => ({
      id: appointment._id,
      priority: appointment.priority,
      booking_time: moment(appointment.bookedOn).format("hh:mm A"),
      booking_day: moment(appointment.bookedOn).format("dddd").toLowerCase(),
      doctorId: appointment.doctor.id,
      appointment,
    }));

    const firstPatient = patients[0];
    const time_slots = generateTimeSlots(firstPatient.doctorId.toString(), day);
    const sorted_patients = sortPatients(patients);
    const { assigned_appointments, waiting_list } = assignTimeSlots(
      time_slots,
      sorted_patients
    );

    const updatedAppointments = await Promise.all(
      assigned_appointments.map(async (a) => {
        const updateFields = {
          date: targetDate.format("YYYY-MM-DD"),
          time: a.assigned_slot.start,
          appointmentStatus: "pending",
        };

        const updatedAppointment = await Appointment.findByIdAndUpdate(
          a.appointment._id,
          { $set: updateFields },
          { new: true }
        );

        return {
          appointment: updatedAppointment,
          assigned_slot: {
            start: moment(
              `${targetDate.format("YYYY-MM-DD")} ${a.assigned_slot.start}`,
              "YYYY-MM-DD hh:mm A"
            ).toISOString(),
            end: moment(
              `${targetDate.format("YYYY-MM-DD")} ${a.assigned_slot.end}`,
              "YYYY-MM-DD hh:mm A"
            ).toISOString(),
          },
        };
      })
    );

    console.log(
      `Appointments scheduled successfully for ${day}. ${updatedAppointments.length} appointments updated in database.`
    );
    console.log(`Waiting list contains ${waiting_list.length} appointments`);

    return {
      assigned_appointments: updatedAppointments,
      waiting_list: waiting_list.map((w) => ({ appointment: w.appointment })),
    };
  } catch (error) {
    console.error("Error in scheduleAppointmentsBackground:", error);
    // You might want to add some error notification system here
  }
};

// Schedule the scheduleAppointments function to run every 24 hours
cron.schedule("0 0 * * *", () => {
  const day = moment().format("dddd").toLowerCase();
  scheduleAppointmentsBackground(day)
    .then(() => console.log(`Completed scheduling appointments for ${day}`))
    .catch((error) =>
      console.error(`Failed to schedule appointments: ${error}`)
    );
});

const addPrescriptionToAppointment = async (req, res) => {
  try {
    const appointmentId = new mongoose.Types.ObjectId(req.params.id);
    const { prescription } = req.body;

    const generatePrescriptionId = (index) => {
      const paddedNum = (index + 1).toString().padStart(3, "0");
      return `presc-${paddedNum}`;
    };

    const prescriptionWithIds = Array.isArray(prescription)
      ? prescription.map((med, index) => ({
          id: med.id || generatePrescriptionId(index),
          medication: med.medication,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions,
        }))
      : [
          {
            id: generatePrescriptionId(0),
            ...prescription,
          },
        ];

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: { prescription: prescriptionWithIds } },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Prescription added successfully",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Error adding prescription:", error);
    res.status(500).json({
      success: false,
      message: "Error adding prescription to appointment",
      error: error.message,
    });
  }
};

const getPrescriptionByPatientId = async (req, res) => {
  try {
    const patientId = new mongoose.Types.ObjectId(req.params.id);
    const appointments = await Appointment.find({ "patient.id": patientId });

    if (!appointments || appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No appointments found for this patient",
      });
    }

    const formattedPrescriptions = appointments
      .filter(
        (appointment) =>
          appointment.prescription && appointment.prescription.length > 0
      )
      .map((appointment) => ({
        appointmentId: appointment._id,
        date: appointment.date,
        time: appointment.time,
        doctorName: appointment.doctor?.name,
        patientName: appointment.patient?.name,
        prescriptions: appointment.prescription || [],
        appointmentStatus: appointment.appointmentStatus,
      }));

    if (formattedPrescriptions.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No prescriptions found for any appointments",
        data: [],
      });
    }

    formattedPrescriptions.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateB - dateA;
    });

    res.status(200).json({
      success: true,
      message: "Prescriptions fetched successfully",
      count: formattedPrescriptions.length,
      data: formattedPrescriptions,
    });
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching prescriptions",
      error: error.message,
    });
  }
};

const updatePrescription = async (req, res) => {
  try {
    const appointmentId = new mongoose.Types.ObjectId(req.params.appointmentId);
    const { prescriptionId } = req.params;
    const updatedData = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const updatedPrescriptions = appointment.prescription.map(
      (prescription) => {
        if (prescription.id === prescriptionId) {
          return { ...prescription.toObject(), ...updatedData };
        }
        return prescription;
      }
    );

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: { prescription: updatedPrescriptions } },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(400).json({
        success: false,
        message: "Failed to update prescription",
      });
    }

    res.status(200).json({
      success: true,
      message: "Prescription updated successfully",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Error updating prescription:", error);
    res.status(500).json({
      success: false,
      message: "Error updating prescription",
      error: error.message,
    });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const appointmentId = new mongoose.Types.ObjectId(req.params.id);
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Get patient and doctor user details to get their emails
    const patientUser = await User.findById(appointment.patient.id);
    const doctorUser = await User.findById(appointment.doctor.id);

    if (!patientUser || !doctorUser) {
      return res.status(404).json({ error: "Patient or Doctor not found" });
    }

    // Update appointment status to cancelled
    appointment.appointmentStatus = "cancelled";
    await appointment.save();

    // Send email to patient
    await sendMail(
      patientUser.email,
      "Appointment Cancelled",
      `Dear ${patientUser.fullName},\n\nYour appointment scheduled with Dr. ${doctorUser.fullName} for ${appointment.date} has been cancelled.\n\nBest regards,\nSmart Health Pro Team`
    );

    // Send email to doctor
    await sendMail(
      doctorUser.email,
      "Appointment Cancelled",
      `Dear Dr. ${doctorUser.fullName},\n\nThe appointment scheduled with patient ${patientUser.fullName} for ${appointment.date} has been cancelled.\n\nBest regards,\nSmart Health Pro Team`
    );

    res.status(200).json({
      message: "Appointment cancelled successfully and notifications sent",
      appointment,
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({
      error: "Error cancelling appointment",
      details: error.message,
    });
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByPatientId,
  getAppointmentsByDoctorId,
  scheduleAppointments,
  addPrescriptionToAppointment,
  getPrescriptionByPatientId,
  updatePrescription,
  cancelAppointment,
};
