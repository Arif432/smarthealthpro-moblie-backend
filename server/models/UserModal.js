const mongoose = require('mongoose');

// Common User Schema
const UserSchema = new mongoose.Schema({
    userName: {
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
        enum: ['patient', 'doctor'], // Role must be either 'patient' or 'doctor'
    },
    avatar: {
        type: String,
        default: 'https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png',
    },
});

// Doctor Schema
const DoctorSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
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
    // Add other doctor-specific fields here
});

// Patient Schema
const PatientSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    dateOfBirth: {
        type: Date,
        required: true,
    },
    bloodType: {
        type: String,
        required: true,
    },
    // Add other patient-specific fields here
});

const UserModel = mongoose.model('User', UserSchema);
const DoctorModel = mongoose.model('Doctor', DoctorSchema);
const PatientModel = mongoose.model('Patient', PatientSchema);

module.exports = {
    User: UserModel,
    Doctor: DoctorModel,
    Patient: PatientModel,
};
