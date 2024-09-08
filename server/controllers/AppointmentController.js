const Appointment = require("../models/AppointmentModal");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const moment = require("moment");
const { Doctor } = require("../models/UserModal");

// Create a new appointment
const createAppointment = async (req, res) => {
  const {
    doctor,
    patient,
    date,
    time,
    appointmentStatus,
    description,
    location,
    priority,
    bookedOn,
  } = req.body;
  try {
    const appointment = await Appointment.create({
      doctor,
      patient,
      date,
      time,
      appointmentStatus,
      description,
      location,
      priority,
      bookedOn,
    });
    res.status(201).json({ appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all appointments
const getAppointments = async (req, res) => {
  try {
    const { doctorId, patientId } = req.query;
    console.log("Received Query Parameters:", { doctorId, patientId });

    let query = {};

    if (doctorId) {
      console.log("Doctor ID provided:", doctorId);
      query["doctor.id"] = doctorId;
    }
    if (patientId) {
      console.log("Patient ID provided:", patientId);
      query.patient = patientId;
    }

    console.log("Query Object:", query);

    const appointments = await Appointment.find(query);
    console.log("Appointments Found:", appointments);

    res.status(200).json({ appointments });
  } catch (error) {
    console.error("Error in getAppointments function:", error.message);
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
    console.error("Error fetching appointment by ID:", error.message);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

const getAppointmentsByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;
    console.log("Patient ID:", patientId);

    const appointments = await Appointment.find({ patient: patientId });
    console.log("Appointments found:", appointments);

    return res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

const getAppointmentsByDoctorId = async (req, res) => {
  try {
    const { doctorId } = req.params;
    console.log("Doctor ID:", doctorId);

    const appointments = await Appointment.find({ "doctor.id": doctorId });
    console.log("Appointments found:", appointments);

    return res.status(200).json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return res.status(500).json({ error: "Error fetching appointments" });
  }
};

// Update appointment
const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body; // Extract only the fields provided in the request body

  try {
    // Log to check ID and connection state
    console.log("ID provided:", id);
    console.log(
      "Mongoose connection readyState:",
      mongoose.connection.readyState
    );

    // Ensure the connection is established before accessing the DB
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGO_URI); // Add your MongoDB connection URI
    }

    const db = mongoose.connection.db;
    const appointmentCollection = db.collection("appointments");

    console.log("Collection name:", appointmentCollection.collectionName);

    // Try querying using ObjectId first
    let updatedAppointment = await appointmentCollection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) }, // Try with ObjectId
      {
        $set: updateFields, // Update only the fields provided in the request
      },
      { returnDocument: "after" }
    );

    // If not found using ObjectId, try querying using a string ID
    if (!updatedAppointment.value) {
      updatedAppointment = await appointmentCollection.findOneAndUpdate(
        { _id: id }, // Try with string ID
        {
          $set: updateFields,
        },
        { returnDocument: "after" }
      );
    }

    // If still not found, return an error
    if (!updatedAppointment.value) {
      console.log("Appointment not found");
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Return the updated document
    res.status(200).json({ appointment: updatedAppointment.value });
  } catch (error) {
    console.error("Error occurred:", error.message);
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

const findDoctorById = async (doctorId) => {
  try {
    const doctor = await Doctor.findById(doctorId).populate(
      "user",
      "-password"
    );
    console.log("Found doctor:", doctor);
    if (!doctor) {
      throw new Error("Doctor not found.");
    }
    return doctor;
  } catch (error) {
    console.error("Error finding doctor:", error);
    throw new Error("An error occurred while fetching doctor info.");
  }
};
// Commented code: Previous sorting logic based on a hardcoded day
// const getNextDay = () => {
//     return moment().add(1, 'days').format('dddd').toLowerCase();
// };

// Simulate the getDoctorById function that returns office hours based on doctor ID
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

// Function to generate time slots for a given day based on doctor ID
const generateTimeSlots = (doctorId, day) => {
  const doctor = getDoctorById(doctorId); // Fetch doctor's office hours
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

// Function to sort patients by priority, booking date, and booking time
const sortPatients = (patients) => {
  return patients.sort((a, b) => {
    // 1. Sort by priority (high first)
    if (a.priority === "high" && b.priority === "low") return -1;
    if (a.priority === "low" && b.priority === "high") return 1;

    // 2. If priority is the same, sort by booking date (earlier date first)
    const dateA = new Date(a.bookedOn);
    const dateB = new Date(b.bookedOn);
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;

    // 3. If both priority and date are the same, sort by booking time (earlier time first)
    const timeA = moment(a.bookedOn).format("hh:mm A");
    const timeB = moment(b.bookedOn).format("hh:mm A");
    return moment(timeA, "hh:mm A").diff(moment(timeB, "hh:mm A"));
  });
};

// Function to assign time slots to sorted patients
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
      waiting_list.push(patient); // Any patient who doesn't get a time slot is added to the waiting list
    }
  });

  return { assigned_appointments, waiting_list };
};

const scheduleAppointments = async (req, res) => {
  console.log("Starting scheduleAppointments function");
  const { day } = req.body;
  console.log("Requested day:", day);

  try {
    console.log("MongoDB connection state:", mongoose.connection.readyState);
    if (!mongoose.connection.readyState) {
      console.log("Connecting to MongoDB...");
      await mongoose.connect(process.env.MONGO_URI);
      console.log("Connected to MongoDB");
    }

    const appointments = await Appointment.find({ appointmentStatus: "tbd" });
    console.log("Found appointments:", appointments.length);
    console.log(
      "Appointment IDs:",
      appointments.map((a) => a._id.toString())
    );

    // Convert the day to a date
    const targetDate = moment().day(day).startOf("day");
    console.log("Target date:", targetDate.format("YYYY-MM-DD"));

    // Extract patient info from appointments
    const patients = appointments.map((appointment) => {
      const bookedOn = new Date(appointment.bookedOn);
      const booking_day = moment(bookedOn).format("dddd").toLowerCase();
      const booking_time = moment(bookedOn).format("hh:mm A");

      return {
        id: appointment._id,
        priority: appointment.priority,
        booking_time,
        booking_day,
        doctorId: appointment.doctor.id,
        appointment,
      };
    });
    console.log("Processed patients:", patients.length);

    // Generate time slots for the specified day
    const firstPatient = patients[0];
    const time_slots = generateTimeSlots(firstPatient.doctorId, day);
    console.log("Generated time slots:", time_slots.length);

    // Sort patients by priority and booking time
    const sorted_patients = sortPatients(patients);
    console.log("Sorted patients:", sorted_patients.length);

    // Assign time slots to sorted patients
    const { assigned_appointments, waiting_list } = assignTimeSlots(
      time_slots,
      sorted_patients
    );
    console.log("Assigned appointments:", assigned_appointments.length);
    console.log("Waiting list:", waiting_list.length);

    console.log(
      "Assigned appointment IDs:",
      assigned_appointments.map((a) => a.appointment._id.toString())
    );

    const db = mongoose.connection.db;
    const appointmentCollection = db.collection("appointments");
    console.log("Collection name:", appointmentCollection.collectionName);

    // Update assigned appointments in the database
    const assigned_appointments_with_date = await Promise.all(
      assigned_appointments.map(async (a) => {
        try {
          console.log("Processing appointment:", a.appointment._id);
          const updateFields = {
            date: moment(targetDate).format("YYYY-MM-DD"),
            time: a.assigned_slot.start,
            appointmentStatus: "pending",
          };
          console.log("Update fields:", updateFields);

          // Try update with ObjectId
          let updatedAppointment = await appointmentCollection.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(a.appointment._id) },
            { $set: updateFields },
            { returnDocument: "after" }
          );

          // If not found, try with string ID
          if (!updatedAppointment.value) {
            console.log(
              "Appointment not found with ObjectId, trying string ID"
            );
            updatedAppointment = await appointmentCollection.findOneAndUpdate(
              { _id: a.appointment._id.toString() },
              { $set: updateFields },
              { returnDocument: "after" }
            );
          }

          console.log("Update result:", updatedAppointment);

          if (!updatedAppointment.value) {
            console.log(`Appointment not found: ${a.appointment._id}`);
            return null;
          }

          return {
            appointment: updatedAppointment.value,
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
        } catch (updateError) {
          console.error("Error updating appointment:", updateError);
          return null;
        }
      })
    );

    console.log(
      "Processed assigned appointments:",
      assigned_appointments_with_date.length
    );

    // Filter out any null values (appointments that weren't found or failed to update)
    const valid_assigned_appointments = assigned_appointments_with_date.filter(
      (a) => a !== null
    );
    console.log(
      "Valid assigned appointments:",
      valid_assigned_appointments.length
    );

    // Return the assigned appointments and waiting list
    console.log("Sending response");
    return res.status(200).json({
      message: `Appointments scheduled successfully for ${day}. ${valid_assigned_appointments.length} appointments updated in database.`,
      nextDay: day,
      assigned_appointments: valid_assigned_appointments,
      waiting_list: waiting_list.map((w) => ({
        appointment: w.appointment,
      })),
    });
  } catch (error) {
    console.error("Error scheduling appointments:", error);
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
