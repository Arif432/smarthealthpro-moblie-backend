const Appointment = require('../models/AppointmentModal');

// Create a new appointment
const createAppointment = async (req, res) => {
    const { title, doctor, patient, date, availableTimeSlots, selectedTimeSlot, feeStatus, appointmentStatus, fee, description } = req.body;
    try {
        const appointment = await Appointment.create({
            title,
            doctor,
            patient,
            date,
            availableTimeSlots,
            selectedTimeSlot,
            feeStatus,
            appointmentStatus,
            fee,
            description
        });
        res.status(201).json({ appointment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all appointments
const getAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find();
        res.status(200).json({ appointments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single appointment by ID
const getAppointmentById = async (req, res) => {
    const { id } = req.params;
    try {
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.status(200).json({ appointment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update appointment
const updateAppointment = async (req, res) => {
    const { id } = req.params;
    const { title, doctor, patient, date, availableTimeSlots, selectedTimeSlot, feeStatus, appointmentStatus, fee, description } = req.body;
    try {
        const appointment = await Appointment.findByIdAndUpdate(id, {
            title,
            doctor,
            patient,
            date,
            availableTimeSlots,
            selectedTimeSlot,
            feeStatus,
            appointmentStatus,
            fee,
            description
        }, { new: true });
        res.status(200).json({ appointment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete appointment
const deleteAppointment = async (req, res) => {
    const { id } = req.params;
    try {
        const appointment = await Appointment.findByIdAndDelete(id);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.status(200).json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createAppointment,
    getAppointments,
    getAppointmentById,
    updateAppointment,
    deleteAppointment
};
