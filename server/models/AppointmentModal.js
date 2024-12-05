const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema({
  id: {
    type: String,
  },
  medication: {
    type: String,
    required: true,
  },
  dosage: {
    type: String,
    required: true,
  },
  frequency: {
    type: String,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
  instructions: {
    type: String,
    required: true,
  },
});

const appointmentSchema = new mongoose.Schema({
  doctor: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
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
      type: mongoose.Schema.Types.ObjectId,
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
          if (typeof value === "string") {
            return true;
          }
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
  // Added medicines array
  prescription: {
    type: [prescriptionSchema],
    default: [],
  },
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
