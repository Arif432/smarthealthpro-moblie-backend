const express = require('express');
const router = express.Router();
const {registerUser,loginUser ,verifyUser,updateUser,deleteUser,forgotPassword,resetPassword,getUserInfo} = require('../controllers/RegisterController');
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/logout', (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.status(200).json({ message: 'Logout successful' });
});
router.get('/admin',verifyUser, (req, res) => {
    res.status(200).json('Success');
});
router.get('/getUserInfo', verifyUser, getUserInfo);
router.put('/updateUser/:id',verifyUser, updateUser);
router.delete('/deleteUser/:id',verifyUser, deleteUser);
router.post('/forgot-password',forgotPassword);
router.post('/reset-password/:userId/:token', resetPassword);


module.exports = router;
