
const express = require('express');
const { verifyUser } = require('../controllers/RegisterController');
const router = express.Router();
const {
    createAppointment,
    getAppointments,
    getAppointmentById,
    updateAppointment,
    deleteAppointment
} = require('../controllers/AppointmentController')


router.use(verifyUser);
router.get('/getAllAppointments', getAppointments);
router.get('/getSingleAppointment/:id',  getAppointmentById);
router.post('/postAppointment', createAppointment);
router.put('/updateAppointment/:id', updateAppointment);
router.delete('/deleteAppointment/:id', deleteAppointment);

module.exports = router;
