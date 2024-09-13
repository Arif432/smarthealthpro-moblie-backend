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

    if (!specializations || Object.keys(specializations).length === 0) {
      throw new Error("No specializations provided in the request body");
    }

    const startDate = moment().add(1, "days").startOf("day");
    const endDate = moment(startDate).add(7, "days"); // Search for up to a week
    console.log(
      `3. Checking availability from ${startDate.format(
        "YYYY-MM-DD"
      )} to ${endDate.format("YYYY-MM-DD")}`
    );

    // Step 1: Get all doctors
    let doctors;
    try {
      console.log("4. Fetching doctors from database");
      doctors = await Doctor.find().populate("user", "-password");
      console.log(`5. Retrieved ${doctors.length} doctors from database`);
      if (doctors.length === 0) {
        throw new Error("No doctors found in the database");
      }
    } catch (error) {
      console.error("6. Error fetching doctors:", error);
      throw new Error(
        "Failed to fetch doctors from database: " + error.message
      );
    }

    // Step 2: Filter doctors based on availability for the next week
    let availableDoctors = [];
    try {
      console.log("7. Starting to filter doctors based on availability");
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
          if (!doctor.officeHours) {
            console.log(
              `Doctor ${doctor._id} has no office hours defined, skipping`
            );
            continue;
          }

          if (availableDoctors.some((d) => d.doctor._id.equals(doctor._id)))
            continue; // Skip if doctor already added

          const officeHours = doctor.officeHours[dayOfWeek];
          if (officeHours === "Closed") continue;

          const [start, end] = officeHours.split(" - ");
          const startTime = moment(start, "hh:mm A");
          const endTime = moment(end, "hh:mm A");
          const totalSlots = endTime.diff(startTime, "minutes") / 30;

          const appointments = await Appointment.find({
            "doctor.id": doctor._id,
            date: currentDate.toDate(),
            appointmentStatus: { $in: ["pending", "confirmed"] },
          });

          if (appointments.length < totalSlots) {
            availableDoctors.push({
              doctor: doctor,
              availableDate: currentDate.toDate(),
              totalSlots: totalSlots,
              bookedSlots: appointments.length,
            });
            console.log(
              `9. Doctor ${doctor._id} is available on ${currentDate.format(
                "YYYY-MM-DD"
              )}`
            );
          }

          if (availableDoctors.length >= 6) break; // Stop if we have enough doctors
        }

        if (availableDoctors.length >= 6) break; // Stop if we have enough doctors
      }

      console.log(`10. Found ${availableDoctors.length} available doctors`);
      if (availableDoctors.length === 0) {
        throw new Error("No available doctors found for the given date range");
      }
    } catch (error) {
      console.error("11. Error filtering available doctors:", error);
      throw new Error("Failed to filter available doctors: " + error.message);
    }

    // Step 3: Select doctors based on specialization percentages and ratings
    const totalDoctors = Math.min(6, availableDoctors.length);
    const selectedDoctors = [];

    try {
      console.log("12. Starting doctor selection process");
      // Group doctors by specialization and sort by availability date and rating
      const doctorsBySpecialization = {};
      for (const doctorInfo of availableDoctors) {
        const { doctor } = doctorInfo;
        if (!doctorsBySpecialization[doctor.specialization]) {
          doctorsBySpecialization[doctor.specialization] = [];
        }
        doctorsBySpecialization[doctor.specialization].push(doctorInfo);
      }

      for (const specialization in doctorsBySpecialization) {
        doctorsBySpecialization[specialization].sort((a, b) => {
          if (a.availableDate.getTime() !== b.availableDate.getTime()) {
            return a.availableDate.getTime() - b.availableDate.getTime();
          }
          return b.doctor.rating - a.doctor.rating;
        });
      }

      console.log(
        "13. Doctors grouped and sorted by specialization, date, and rating"
      );
      console.log(
        "Available specializations:",
        Object.keys(doctorsBySpecialization)
      );

      // Calculate the number of doctors needed for each specialization
      const doctorCounts = {};
      let remainingDoctors = totalDoctors;
      const sortedSpecializations = Object.entries(specializations).sort(
        (a, b) => b[1] - a[1]
      ); // Sort by percentage descending

      console.log("13a. Total doctors to allocate:", totalDoctors);

      // Allocate doctors based on percentages
      for (const [specialization, percentage] of sortedSpecializations) {
        const exactCount = (percentage / 100) * totalDoctors;
        const roundedCount = Math.round(exactCount);
        doctorCounts[specialization] = Math.min(roundedCount, remainingDoctors);
        remainingDoctors -= doctorCounts[specialization];
      }

      console.log(
        "13b. After initial allocation:",
        doctorCounts,
        "Remaining:",
        remainingDoctors
      );

      // If we have any remaining doctors due to rounding, allocate them to the specialization with the highest decimal part
      if (remainingDoctors > 0) {
        const decimalParts = sortedSpecializations
          .map(([spec, percentage]) => ({
            spec,
            decimal: ((percentage / 100) * totalDoctors) % 1,
          }))
          .sort((a, b) => b.decimal - a.decimal);

        for (const { spec } of decimalParts) {
          if (remainingDoctors > 0) {
            doctorCounts[spec]++;
            remainingDoctors--;
          } else {
            break;
          }
        }
      }

      console.log("14. Final calculated doctor counts:", doctorCounts);

      // Adjust based on actual availability while trying to maintain original percentages
      let totalSelectedDoctors = 0;
      for (const specialization in doctorCounts) {
        const availableCount = doctorsBySpecialization[specialization]
          ? doctorsBySpecialization[specialization].length
          : 0;
        doctorCounts[specialization] = Math.min(
          doctorCounts[specialization],
          availableCount
        );
        totalSelectedDoctors += doctorCounts[specialization];
      }

      // If we have fewer doctors than needed, try to fill from other specializations
      if (totalSelectedDoctors < totalDoctors) {
        const sortedSpecializations = Object.entries(specializations)
          .sort((a, b) => b[1] - a[1])
          .map(([spec]) => spec);

        for (const specialization of sortedSpecializations) {
          const availableCount = doctorsBySpecialization[specialization]
            ? doctorsBySpecialization[specialization].length
            : 0;
          while (
            doctorCounts[specialization] < availableCount &&
            totalSelectedDoctors < totalDoctors
          ) {
            doctorCounts[specialization]++;
            totalSelectedDoctors++;
          }
          if (totalSelectedDoctors >= totalDoctors) break;
        }
      }

      console.log(
        "15. Adjusted doctor counts based on availability:",
        doctorCounts
      );

      // Select doctors based on calculated counts
      for (const [specialization, count] of Object.entries(doctorCounts)) {
        console.log(
          `16. Attempting to select ${count} doctors for ${specialization}`
        );
        const availableDoctorsForSpec =
          doctorsBySpecialization[specialization] || [];
        const selected = availableDoctorsForSpec.slice(0, count);
        selectedDoctors.push(...selected);
        console.log(
          `17. Selected ${selected.length} doctors for ${specialization}`
        );
      }

      console.log(`18. Final selection: ${selectedDoctors.length} doctors`);

      if (selectedDoctors.length === 0) {
        throw new Error(
          "No doctors could be selected based on the given criteria"
        );
      }

      // Prepare the final response
      const finalSelection = selectedDoctors.map((doctorInfo) => ({
        ...doctorInfo.doctor.toObject(),
        availableDate: doctorInfo.availableDate,
        totalSlots: doctorInfo.totalSlots,
        bookedSlots: doctorInfo.bookedSlots,
      }));

      // Shuffle the selected doctors to randomize the order
      for (let i = finalSelection.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalSelection[i], finalSelection[j]] = [
          finalSelection[j],
          finalSelection[i],
        ];
      }
      console.log("19. Shuffled the selected doctors");

      res.status(200).json({
        success: true,
        count: finalSelection.length,
        data: finalSelection,
      });
    } catch (error) {
      console.error("20. Error in doctor selection process:", error);
      throw new Error(
        "Failed to select doctors based on criteria: " + error.message
      );
    }
  } catch (error) {
    console.error("21. Fatal error in getAvailableDoctors:", error);
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
