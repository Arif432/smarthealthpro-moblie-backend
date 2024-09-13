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

const getAvailableDoctors = async (req, res) => {
  try {
    console.log("1. Starting getAvailableDoctors function");
    const { specializations } = req.body;
    console.log(
      "2. Requested specializations:",
      JSON.stringify(specializations)
    );

    const tomorrow = moment().add(3, "days").startOf("day");
    const dayOfWeek = tomorrow.format("dddd").toLowerCase();
    console.log(
      `3. Checking availability for ${dayOfWeek}, ${tomorrow.format(
        "YYYY-MM-DD"
      )}`
    );

    // Step 1: Get all doctors
    let doctors;
    try {
      console.log("4. Fetching doctors from database");
      doctors = await Doctor.find().populate("user", "-password");
      console.log(`5. Retrieved ${doctors.length} doctors from database`);
    } catch (error) {
      console.error("6. Error fetching doctors:", error);
      throw new Error("Failed to fetch doctors from database");
    }

    // Step 2: Filter doctors based on availability for tomorrow
    let filteredDoctors;
    try {
      console.log("7. Starting to filter doctors based on availability");
      const availableDoctors = await Promise.all(
        doctors.map(async (doctor, index) => {
          try {
            console.log(
              `8. Processing doctor ${index + 1}/${doctors.length}: ${
                doctor._id
              }`
            );
            const officeHours = doctor.officeHours[dayOfWeek];
            console.log(
              `9. Doctor ${doctor._id} office hours for ${dayOfWeek}: ${officeHours}`
            );

            if (officeHours === "Closed") {
              console.log(`10. Doctor ${doctor._id} is closed on ${dayOfWeek}`);
              return null;
            }

            const [start, end] = officeHours.split(" - ");
            const startTime = moment(start, "hh:mm A");
            const endTime = moment(end, "hh:mm A");
            const totalSlots = endTime.diff(startTime, "minutes") / 30;
            console.log(`11. Doctor ${doctor._id} total slots: ${totalSlots}`);

            const appointments = await Appointment.find({
              "doctor.id": doctor._id,
              date: tomorrow.toDate(),
              appointmentStatus: { $in: ["pending", "confirmed"] },
            });
            console.log(
              `12. Doctor ${doctor._id} appointments: ${appointments.length}`
            );

            const isAvailable = appointments.length < totalSlots;
            console.log(
              `13. Doctor ${doctor._id} is ${
                isAvailable ? "available" : "not available"
              }`
            );
            return isAvailable ? doctor : null;
          } catch (error) {
            console.error(`14. Error processing doctor ${doctor._id}:`, error);
            return null;
          }
        })
      );

      filteredDoctors = availableDoctors.filter((doctor) => doctor !== null);
      console.log(
        `15. Filtered to ${filteredDoctors.length} available doctors`
      );
    } catch (error) {
      console.error("16. Error filtering available doctors:", error);
      throw new Error("Failed to filter available doctors");
    }

    // Step 3: Filter and select doctors based on specialization percentages and ratings
    const totalDoctors = 6;
    const selectedDoctors = [];

    try {
      console.log("17. Starting doctor selection process");
      // Group doctors by specialization and sort by rating
      const doctorsBySpecialization = {};
      for (const doctor of filteredDoctors) {
        if (!doctorsBySpecialization[doctor.specialization]) {
          doctorsBySpecialization[doctor.specialization] = [];
        }
        doctorsBySpecialization[doctor.specialization].push(doctor);
      }
      console.log(
        "18. Doctors grouped by specialization:",
        Object.keys(doctorsBySpecialization).map(
          (spec) => `${spec}: ${doctorsBySpecialization[spec].length}`
        )
      );

      // Sort doctors in each specialization by rating (highest first)
      for (const specialization in doctorsBySpecialization) {
        doctorsBySpecialization[specialization].sort(
          (a, b) => b.rating - a.rating
        );
        console.log(`19. Sorted doctors for ${specialization} by rating`);
      }

      // Sort specializations by requested percentage (descending)
      const sortedSpecializations = Object.entries(specializations).sort(
        (a, b) => b[1] - a[1]
      );

      console.log("20. Sorted specializations:", sortedSpecializations);

      // Select doctors based on percentages, cascading through specializations
      for (const [specialization, percentage] of sortedSpecializations) {
        const count = Math.round((percentage / 100) * totalDoctors);
        console.log(
          `21. Attempting to select ${count} doctors for ${specialization}`
        );
        let selected = [];

        // Try to fill slots from the current specialization and then cascade through others
        for (const [currentSpec, _] of sortedSpecializations) {
          if (doctorsBySpecialization[currentSpec]) {
            console.log(`22. Checking ${currentSpec} for ${specialization}`);
            while (
              selected.length < count &&
              doctorsBySpecialization[currentSpec].length > 0
            ) {
              const doctor = doctorsBySpecialization[currentSpec].shift();
              selected.push(doctor);
              selectedDoctors.push(doctor);
              console.log(
                `23. Selected doctor ${doctor._id} for ${specialization}`
              );
            }
          }
          if (selected.length === count) {
            console.log(`24. Filled all slots for ${specialization}`);
            break;
          }
        }

        console.log(
          `25. Selected ${selected.length}/${count} doctors for ${specialization}`
        );
        if (selectedDoctors.length >= totalDoctors) {
          console.log("26. Reached total required doctors");
          break;
        }
      }

      console.log(
        `27. Selected ${selectedDoctors.length} doctors based on specializations`
      );

      // If we still don't have enough doctors, fill remaining slots randomly
      if (selectedDoctors.length < totalDoctors) {
        const remainingDoctors = filteredDoctors.filter(
          (d) => !selectedDoctors.includes(d)
        );
        console.log(
          `28. ${remainingDoctors.length} doctors remaining for random selection`
        );
        while (
          selectedDoctors.length < totalDoctors &&
          remainingDoctors.length > 0
        ) {
          const randomIndex = Math.floor(
            Math.random() * remainingDoctors.length
          );
          const randomDoctor = remainingDoctors.splice(randomIndex, 1)[0];
          selectedDoctors.push(randomDoctor);
          console.log(`29. Randomly selected doctor ${randomDoctor._id}`);
        }
        console.log(
          `30. Added ${
            totalDoctors - selectedDoctors.length
          } random doctors to fill slots`
        );
      }

      // Shuffle the selected doctors to randomize the order
      for (let i = selectedDoctors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedDoctors[i], selectedDoctors[j]] = [
          selectedDoctors[j],
          selectedDoctors[i],
        ];
      }
      console.log("31. Shuffled the selected doctors");
    } catch (error) {
      console.error("32. Error in doctor selection process:", error);
      throw new Error("Failed to select doctors based on criteria");
    }

    console.log("33. Successfully completed getAvailableDoctors function");
    res.status(200).json({
      success: true,
      count: selectedDoctors.length,
      data: selectedDoctors,
    });
  } catch (error) {
    console.error("34. Fatal error in getAvailableDoctors:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available doctors",
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
};
