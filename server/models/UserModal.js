const mongoose = require("mongoose");

const userDeviceSchema = new mongoose.Schema({
  fcmToken: {
    type: String,
    required: true,
    unique: true,
  },
  device: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const notesSchema = new mongoose.Schema({
  doctor: {
    _id: mongoose.Schema.Types.ObjectId,
    fullName: String,
    avatar: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function (v) {
          return (
            typeof v === "string" ||
            (typeof v === "object" && v.public_id && v.url)
          );
        },
        message:
          "Avatar must be either a string or an object with public_id and url",
      },
      default:
        "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
    },
  },
  note: {
    type: String,
  },
  date: {
    type: Date,
    required: false,
  },
});

// Common User Schema
const UserSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ["patient", "doctor"], // Role must be either 'patient' or 'doctor'
  },
  avatar: {
    public_id: {
      type: String,
      default: "",
    },
    url: {
      type: String,
      default:
        "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
    },
  },
  devices: [userDeviceSchema],
  notes: [notesSchema],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

// Doctor Schema
const DoctorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  specialization: {
    type: String,
    required: true,
  },
  cnic: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: false,
    default: 0,
  },
  reviewCount: {
    type: Number,
    required: false,
    default: 0,
  },
  numPatients: {
    type: Number,
    required: false,
    default: 0,
  },
  about: {
    type: String,
    required: true,
  },
  officeHours: {
    monday: { type: String, required: true },
    tuesday: { type: String, required: true },
    wednesday: { type: String, required: true },
    thursday: { type: String, required: true },
    friday: { type: String, required: true },
    saturday: { type: String, required: false },
    sunday: { type: String, required: false },
  },
  education: [
    {
      degree: { type: String, required: true },
      institution: { type: String, required: true },
      year: { type: String, required: true },
    },
  ],
});

// Patient Schema
const PatientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  dateOfBirth: {
    type: Date,
    required: false,
  },
  bloodType: {
    type: String,
    required: false,
  },
  // Add other patient-specific fields here
});

const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const PendingDoctorSchema = new mongoose.Schema({
  // Basic user info
  userName: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  avatar: {
    public_id: {
      type: String,
      default: "",
    },
    url: {
      type: String,
      default:
        "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
    },
  },

  // Doctor specific info
  specialization: {
    type: String,
    required: true,
  },
  cnic: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    type: String,
    required: true,
  },
  about: {
    type: String,
    required: true,
  },
  officeHours: {
    monday: { type: String, required: true },
    tuesday: { type: String, required: true },
    wednesday: { type: String, required: true },
    thursday: { type: String, required: true },
    friday: { type: String, required: true },
    saturday: { type: String, required: false },
    sunday: { type: String, required: false },
  },
  education: [
    {
      degree: { type: String, required: true },
      institution: { type: String, required: true },
      year: { type: String, required: true },
    },
  ],
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PendingDoctorModel = mongoose.model(
  "PendingDoctor",
  PendingDoctorSchema,
  "pendingDoctors"
);
const UserModel = mongoose.model("User", UserSchema);
const DoctorModel = mongoose.model("Doctor", DoctorSchema);
const PatientModel = mongoose.model("Patient", PatientSchema);
const AdminModel = mongoose.model("Admin", AdminSchema);

module.exports = {
  User: UserModel,
  Doctor: DoctorModel,
  Patient: PatientModel,
  Admin: AdminModel,
  PendingDoctor: PendingDoctorModel,
};
