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
      type: mongoose.Schema.Types.Mixed,
      default:
        "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
      validate: {
        validator: function (value) {
          // Check if value is a string (URL)
          if (typeof value === "string") {
            return true;
          }
          // Check if value is an object with required properties
          if (typeof value === "object" && value !== null) {
            return (
              value.public_id &&
              value.url &&
              typeof value.public_id === "string" &&
              typeof value.url === "string"
            );
          }
          return false;
        },
        message:
          "Avatar must be either a string URL or an object with public_id and url properties",
      },
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
