const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  doctor: {
    id: {
      type: String,
      ref: "Doctor",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default:
        "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
    },
    specialization: {
      type: String,
      required: true,
    },
  },
  patient: {
    id: {
      type: String,
      ref: "Patient",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default:
        "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
    },
  },
  date: {
    type: String,
    required: false,
  },

  appointmentStatus: {
    type: String,
    enum: ["tbd", "pending", "visited", "cancelled"],
    default: "tbd",
  },
  description: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  priority: {
    type: String,
    default: "low",
    required: true,
  },
  bookedOn: {
    type: String,
    required: true,
  },
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
