const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    availableTimeSlots: [{
        type: String,
        required: true
    }],
    selectedTimeSlot: {
        type: String, // This will store the selected time slot
        required: true
    },
    feeStatus: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending'
    },
    appointmentStatus: {
        type: String,
        enum: ['pending', 'visited', 'cancelled'],
        default: 'pending'
    },
    fee: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
