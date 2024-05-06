const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
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
        // default: 'patient',
    },
    // Additional fields for patients
    dateOfBirth: {
        type: Date,
        required: function() {
            return this.role === 'patient'; // Date of Birth required only for patients
        }
    },
    bloodType: {
        type: String,
        required: function() {
            return this.role === 'patient'; // Blood type required only for patients
        }
    },
    // Additional fields for doctors
    cnic: {
        type: String,
        required: function() {
            return this.role === 'doctor'; // CNIC required only for doctors
        }
    },
    address: {
        type: String,
        required: function() {
            return this.role === 'doctor'; // Address required only for doctors
        }
    },
    avatar: {
        type: String,
        default: 'https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png',
    },
});

const UserModel = mongoose.model('users', UserSchema);
module.exports = UserModel;
