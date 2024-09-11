const mongoose = require("mongoose");

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
    type: String,
    default:
      "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
  },
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

const UserModel = mongoose.model("User", UserSchema);
const DoctorModel = mongoose.model("Doctor", DoctorSchema);
const PatientModel = mongoose.model("Patient", PatientSchema);

module.exports = {
  User: UserModel,
  Doctor: DoctorModel,
  Patient: PatientModel,
};
