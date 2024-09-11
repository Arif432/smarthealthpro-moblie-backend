const Appointment = require("../models/AppointmentModal");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const moment = require("moment");
const { Doctor } = require("../models/UserModal");

// Helper functions
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

// Controller functions
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
      query["doctor.id"] = doctorId;
    }
    if (patientId) {
      query["patient.id"] = patientId;
    }

    const appointments = await Appointment.find(query);
    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const appointmentId = req.params.id;

    if (!ObjectId.isValid(appointmentId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid appointment ID format" });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (appointment) {
      return res.status(200).json({ success: true, appointment });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Appointment not found" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

const getAppointmentsByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;
    const appointments = await Appointment.find({ patient: patientId });
    return res.status(200).json(appointments);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

const getAppointmentsByDoctorId = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const appointments = await Appointment.find({ "doctor.id": doctorId });
    return res.status(200).json(appointments);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;

  try {
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
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
  const { id } = req.params;
  try {
    const appointment = await Appointment.findByIdAndDelete(id);
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
    const time_slots = generateTimeSlots(firstPatient.doctorId, day);
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
    return res
      .status(500)
      .json({ message: "Error scheduling appointments", error: error.message });
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
};
