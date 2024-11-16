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
    const db = mongoose.connection.db;
    const appointments = db.collection("appointments");

    const appointmentId = req.params.id;
    console.log("Received appointment ID:", appointmentId);

    // Try to find the appointment using both ObjectId and string ID
    let appointment;
    try {
      appointment = await appointments.findOne({
        _id: new ObjectId(appointmentId),
      });
      console.log("Query result using ObjectId:", appointment);
    } catch (error) {
      console.log("Error with ObjectId, trying string ID");
      appointment = await appointments.findOne({ _id: appointmentId });
      console.log("Query result using string ID:", appointment);
    }

    if (!appointment) {
      console.log("Appointment not found, trying flexible search");

      // Flexible search query
      const flexibleQuery = {
        $or: [
          { _id: appointmentId },
          { "doctor.id": appointmentId },
          { "doctor.name": { $regex: appointmentId, $options: "i" } },
          { "patient.id": appointmentId },
          { "patient.name": { $regex: appointmentId, $options: "i" } },
          { appointmentStatus: { $regex: appointmentId, $options: "i" } },
          { description: { $regex: appointmentId, $options: "i" } },
          { location: { $regex: appointmentId, $options: "i" } },
        ],
      };

      appointment = await appointments.findOne(flexibleQuery);
      console.log("Flexible query result:", appointment);
    }

    if (!appointment) {
      console.log("Appointment not found in database");

      // Log all document IDs in the collection
      const allIds = await appointments
        .find({}, { projection: { _id: 1 } })
        .toArray();
      console.log(
        "All document IDs in collection:",
        allIds.map((doc) => doc._id.toString())
      );

      return res.status(404).json({ message: "Appointment not found" });
    }

    console.log("Found appointment:", appointment);
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

const getAvailableDoctors = async (req, res) => {
  try {
    console.log("1. Starting getAvailableDoctors function");
    const { specializations } = req.body;
    console.log(
      "2. Requested specializations:",
      JSON.stringify(specializations)
    );

    const startDate = moment().add(1, "days").startOf("day");
    const endDate = moment(startDate).add(7, "days");
    console.log(
      `3. Checking availability from ${startDate.format(
        "YYYY-MM-DD"
      )} to ${endDate.format("YYYY-MM-DD")}`
    );

    // Step 1: Get all doctors
    let doctors;
    try {
      console.log("4. Fetching doctors from database");
      const query =
        specializations && Object.keys(specializations).length > 0
          ? {
              specialization: {
                $in: Object.keys(specializations).map(
                  (spec) => new RegExp(`^${spec}$`, "i")
                ),
              },
            }
          : {};
      doctors = await Doctor.find(query).populate("user", "-password");
      console.log(`5. Retrieved ${doctors.length} doctors from database`);
      if (doctors.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No doctors found for the requested specializations or in general",
        });
      }
    } catch (error) {
      console.error("6. Error fetching doctors:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch doctors from database",
        error: error.message,
      });
    }

    // Step 2: Filter doctors based on availability for the next week
    let availableDoctors = [];
    try {
      console.log("7. Starting to filter doctors based on availability");
      const appointmentPromises = [];

      for (
        let currentDate = moment(startDate);
        currentDate.isSameOrBefore(endDate);
        currentDate.add(1, "day")
      ) {
        const dayOfWeek = currentDate.format("dddd").toLowerCase();
        console.log(
          `8. Checking availability for ${dayOfWeek}, ${currentDate.format(
            "YYYY-MM-DD"
          )}`
        );

        for (const doctor of doctors) {
          if (
            !doctor.officeHours ||
            !doctor.officeHours[dayOfWeek] ||
            doctor.officeHours[dayOfWeek] === "Closed"
          ) {
            continue;
          }

          const [start, end] = doctor.officeHours[dayOfWeek].split(" - ");
          const startTime = moment(start, "hh:mm A");
          const endTime = moment(end, "hh:mm A");
          const totalSlots = Math.floor(
            endTime.diff(startTime, "minutes") / 30
          );

          appointmentPromises.push(
            Appointment.countDocuments({
              "doctor.id": doctor._id,
              date: currentDate.toDate(),
              appointmentStatus: { $in: ["pending", "confirmed"] },
            }).then((count) => ({
              doctor,
              availableDate: currentDate.toDate(),
              totalSlots,
              bookedSlots: count,
            }))
          );
        }
      }

      const results = await Promise.all(appointmentPromises);
      availableDoctors = results.filter(
        (result) => result.bookedSlots < result.totalSlots
      );

      console.log(`9. Found ${availableDoctors.length} available doctors`);
      if (availableDoctors.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No available doctors found for the given date range",
        });
      }
    } catch (error) {
      console.error("10. Error filtering available doctors:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to filter available doctors",
        error: error.message,
      });
    }

    // Step 3: Select doctors based on specialization percentages and ratings
    const totalDoctors = 6; // Set this to your desired number of doctors to return
    let selectedDoctors = [];

    try {
      console.log("11. Starting doctor selection process");
      // Group doctors by specialization and sort by availability date and rating
      const doctorsBySpecialization = availableDoctors.reduce(
        (acc, doctorInfo) => {
          const { doctor } = doctorInfo;
          if (!acc[doctor.specialization]) {
            acc[doctor.specialization] = [];
          }
          acc[doctor.specialization].push(doctorInfo);
          return acc;
        },
        {}
      );

      for (const specialization in doctorsBySpecialization) {
        doctorsBySpecialization[specialization].sort((a, b) => {
          if (a.availableDate.getTime() !== b.availableDate.getTime()) {
            return a.availableDate.getTime() - b.availableDate.getTime();
          }
          return b.doctor.rating - a.doctor.rating;
        });
      }

      console.log(
        "12. Doctors grouped and sorted by specialization, date, and rating"
      );
      console.log(
        "Available specializations:",
        Object.keys(doctorsBySpecialization)
      );

      // Calculate the number of doctors needed for each specialization
      let doctorCounts = {};
      if (!specializations || Object.keys(specializations).length === 0) {
        // If no specializations given, select 2 doctors from each available specialization
        Object.keys(doctorsBySpecialization).forEach((spec) => {
          doctorCounts[spec] = 2;
        });
      } else if (Object.keys(specializations).length === 1) {
        // If only one specialization is given, select all 6 doctors from it
        const spec = Object.keys(specializations)[0];
        doctorCounts[spec] = totalDoctors;
      } else {
        // Calculate based on given percentages
        doctorCounts = Object.entries(specializations).reduce(
          (acc, [spec, percentage]) => {
            acc[spec] = Math.round((percentage / 100) * totalDoctors);
            return acc;
          },
          {}
        );
      }

      console.log("13. Calculated doctor counts:", doctorCounts);

      // Select doctors based on calculated counts
      for (const [specialization, count] of Object.entries(doctorCounts)) {
        console.log(
          `14. Attempting to select ${count} doctors for ${specialization}`
        );
        const availableDoctorsForSpec =
          doctorsBySpecialization[specialization] || [];
        const selected = availableDoctorsForSpec.slice(0, count);
        selectedDoctors.push(
          ...selected.map((d) => ({ ...d, specialization }))
        );

        // Remove selected doctors from the pool
        doctorsBySpecialization[specialization] =
          availableDoctorsForSpec.slice(count);
      }

      // If we have fewer doctors than needed, fill from other specializations
      const allSpecializations = Object.keys(doctorsBySpecialization);
      let currentSpecIndex = 0;

      while (
        selectedDoctors.length < totalDoctors &&
        currentSpecIndex < allSpecializations.length
      ) {
        const specialization = allSpecializations[currentSpecIndex];
        const availableDoctors = doctorsBySpecialization[specialization];

        if (availableDoctors && availableDoctors.length > 0) {
          const doctor = availableDoctors.shift();
          selectedDoctors.push({ ...doctor, specialization });
        } else {
          currentSpecIndex++;
        }

        if (currentSpecIndex >= allSpecializations.length) {
          currentSpecIndex = 0; // Reset to the beginning if we've gone through all specializations
        }
      }

      console.log(
        "15. Selected doctors before shuffling:",
        selectedDoctors.map((d) => d.specialization)
      );

      if (selectedDoctors.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No doctors could be selected based on the given criteria",
        });
      }

      // Shuffle the selected doctors
      for (let i = selectedDoctors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedDoctors[i], selectedDoctors[j]] = [
          selectedDoctors[j],
          selectedDoctors[i],
        ];
      }

      console.log(
        "16. Selected doctors after shuffling:",
        selectedDoctors.map((d) => d.specialization)
      );

      // Prepare the final response
      const finalSelection = selectedDoctors.map((doctorInfo) => ({
        ...doctorInfo.doctor.toObject(),
        availableDate: doctorInfo.availableDate,
        totalSlots: doctorInfo.totalSlots,
        bookedSlots: doctorInfo.bookedSlots,
      }));

      res.status(200).json({
        success: true,
        count: finalSelection.length,
        data: finalSelection,
      });
    } catch (error) {
      console.error("17. Error in doctor selection process:", error);
      res.status(500).json({
        success: false,
        message: "Failed to select doctors based on criteria",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("18. Fatal error in getAvailableDoctors:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available doctors",
      error: error.message,
    });
  }
};

const addMedicinesToAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { medicines } = req.body;

    // Get direct access to MongoDB collection
    const db = mongoose.connection.db;
    const appointments = db.collection("appointments");

    console.log("Looking for appointment with ID:", id);

    // Get full document dump for debugging
    const allAppointments = await appointments.find({}).toArray();
    console.log("First appointment full document:", allAppointments[0]);

    // Try with string comparison
    const appointment = await appointments.findOne({
      _id: { $eq: id },
    });
    console.log("Found appointment with string comparison:", appointment);

    if (!appointment) {
      // Try with ObjectId
      try {
        const objectId = new mongoose.Types.ObjectId(id);
        const appointmentWithObjectId = await appointments.findOne({
          _id: objectId,
        });
        console.log(
          "Found appointment with ObjectId:",
          appointmentWithObjectId
        );

        if (appointmentWithObjectId) {
          // Update the appointment with new medicines
          const updateResult = await appointments.updateOne(
            { _id: objectId },
            { $set: { medicines: medicines } }
          );

          if (updateResult.modifiedCount === 0) {
            return res.status(400).json({
              success: false,
              message: "Failed to update appointment",
            });
          }

          // Fetch the updated appointment
          const updatedAppointment = await appointments.findOne({
            _id: objectId,
          });

          return res.status(200).json({
            success: true,
            message: "Medicines added successfully",
            appointment: updatedAppointment,
          });
        }
      } catch (error) {
        console.log("Error with ObjectId:", error);
      }

      // If we reached here, no appointment was found
      const allIds = await appointments
        .find({}, { projection: { _id: 1 } })
        .toArray();
      console.log(
        "All document IDs in collection:",
        allIds.map((doc) => doc._id.toString())
      );

      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // If string comparison worked, update using string ID
    const updateResult = await appointments.updateOne(
      { _id: id },
      { $set: { medicines: medicines } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to update appointment",
      });
    }

    // Fetch the updated appointment
    const updatedAppointment = await appointments.findOne({
      _id: id,
    });

    res.status(200).json({
      success: true,
      message: "Medicines added successfully",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Error adding medicines:", error);
    res.status(500).json({
      success: false,
      message: "Error adding medicines to appointment",
      error: error.message,
    });
  }
};

const getMedicinesByAppointmentId = async (req, res) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.db;
    const appointments = db.collection("appointments");

    console.log("Looking for medicines for appointment ID:", id);

    // Try to find the appointment and get its medicines
    let appointment;
    try {
      appointment = await appointments.findOne(
        { _id: id },
        { projection: { medicines: 1, "doctor.name": 1, "patient.name": 1 } }
      );
      console.log("Found appointment:", appointment);
    } catch (error) {
      console.log("Error finding appointment:", error);
    }

    if (!appointment) {
      // If not found with string ID, try with ObjectId
      try {
        const objectId = new mongoose.Types.ObjectId(id);
        appointment = await appointments.findOne(
          { _id: objectId },
          { projection: { medicines: 1, "doctor.name": 1, "patient.name": 1 } }
        );
        console.log("Found appointment with ObjectId:", appointment);
      } catch (error) {
        console.log("Error with ObjectId:", error);
      }
    }

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // If no medicines array exists
    if (!appointment.medicines || appointment.medicines.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No medicines prescribed for this appointment",
        data: {
          doctorName: appointment.doctor?.name,
          patientName: appointment.patient?.name,
          medicines: [],
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Medicines fetched successfully",
      data: {
        doctorName: appointment.doctor?.name,
        patientName: appointment.patient?.name,
        medicines: appointment.medicines,
      },
    });
  } catch (error) {
    console.error("Error fetching medicines:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching medicines",
      error: error.message,
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
  getAvailableDoctors,
  addMedicinesToAppointment,
  getMedicinesByAppointmentId,
};
