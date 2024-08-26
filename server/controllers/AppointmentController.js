const Appointment = require("../models/AppointmentModal");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

// Create a new appointment
const createAppointment = async (req, res) => {
  const {
    title,
    doctor,
    patient,
    date,
    availableTimeSlots,
    selectedTimeSlot,
    feeStatus,
    appointmentStatus,
    fee,
    description,
  } = req.body;
  try {
    const appointment = await Appointment.create({
      title,
      doctor,
      patient,
      date,
      availableTimeSlots,
      selectedTimeSlot,
      feeStatus,
      appointmentStatus,
      fee,
      description,
    });
    res.status(201).json({ appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all appointments
const getAppointments = async (req, res) => {
  try {
    // Extract query parameters
    const { doctorId, patientId } = req.query;

    // Log received query parameters
    console.log("Received Query Parameters:", { doctorId, patientId });

    // Create a query object
    let query = {};

    // Add conditions to the query object based on the presence of parameters
    if (doctorId) {
      console.log("Doctor ID provided, converting to ObjectId:", doctorId);
      query["doctor.id"] = new mongoose.Types.ObjectId(doctorId);
    }
    if (patientId) {
      console.log("Patient ID provided as string:", patientId);
      query.patient = patientId; // No conversion needed
    }

    // Log the query object before executing the database query
    console.log("Query Object:", query);

    // Find appointments based on the query object
    const appointments = await Appointment.find(query);

    // Log the appointments found
    console.log("Appointments Found:", appointments);

    // Send the response
    res.status(200).json({ appointments });
  } catch (error) {
    // Log the error
    console.error("Error in getAppointments function:", error.message);

    // Handle errors
    res.status(500).json({ error: error.message });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const appointmentId = req.params.id; // Extract appointmentId from the request parameters

    // Check if the provided ID is a valid ObjectId
    if (!ObjectId.isValid(appointmentId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid appointment ID format" });
    }

    const db = mongoose.connection.db; // Assuming you're using Mongoose and this is within your Express app
    const collection = db.collection("appointments");

    // Query for the document by comparing _id as a string
    const appointment = await collection.findOne({ _id: appointmentId });

    if (appointment) {
      return res.status(200).json({ success: true, appointment });
    } else {
      return res
        .status(404)
        .json({ success: false, error: "Appointment not found" });
    }
  } catch (error) {
    console.error("Error fetching appointment by ID:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

const getAppointmentsByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params; // Retrieve patientId from route parameters
    console.log("Patient ID:", patientId); // Log patientId for debugging

    const db = mongoose.connection.db; // Assuming you're using Mongoose and this is within your Express app
    const collection = db.collection("appointments");

    // Query for the document by comparing _id as a string
    const appointment = await collection.find({ patient: patientId }).toArray();
    console.log("Appointments found:", appointment); // Log appointments for debugging

    // Return the found appointments with a 200 status
    return res.status(200).json(appointment);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    // Return a 500 status with an error message
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

const getAppointmentsByDoctorId = async (req, res) => {
  try {
    const { doctorId } = req.params; // Retrieve doctorId from route parameters
    console.log("Doctor ID:", doctorId); // Log doctorId for debugging

    const db = mongoose.connection.db; // Assuming you're using Mongoose and this is within your Express app
    const collection = db.collection("appointments");

    // Query for the documents by comparing doctor field
    const appointments = await collection
      .find({ "doctor.id": doctorId })
      .toArray();
    console.log("Appointments found:", appointments); // Log appointments for debugging

    // Return the found appointments with a 200 status
    return res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    // Return a 500 status with an error message
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

// Update appointment
const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    doctor,
    patient,
    date,
    availableTimeSlots,
    selectedTimeSlot,
    feeStatus,
    appointmentStatus,
    fee,
    description,
  } = req.body;
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      {
        title,
        doctor,
        patient,
        date,
        availableTimeSlots,
        selectedTimeSlot,
        feeStatus,
        appointmentStatus,
        fee,
        description,
      },
      { new: true }
    );
    res.status(200).json({ appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete appointment
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

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByPatientId,
  getAppointmentsByDoctorId,
};
