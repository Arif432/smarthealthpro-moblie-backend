const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Doctor, Patient } = require('../models/UserModal'); // Importing updated models
// const CartModel = require('../models/');
// const { sendMail } = require('../utils/nodemailerConfig');

const registerUser = async (req, res) => {
    const { userName, email, password, role } = req.body;
    try {
        // Check password length
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password should be at least 6 characters' });
        }
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await User.create({ userName, email, password: hashedPassword, role });

        // If the role is patient, create a patient linked to the user
        if (role === 'patient') {
            const { dateOfBirth, bloodType } = req.body;
            const patient = await Patient.create({ user: user._id, dateOfBirth, bloodType });
            return res.status(201).json({ user: user._id, patient: patient._id });
        }

        // If the role is doctor, create a doctor linked to the user
        if (role === 'doctor') {
            console.log('Doctor:', req.body);
            const { cnic, address , specialization } = req.body;
            const doctor = await Doctor.create({ user: user._id, cnic, address , specialization : specialization});
            return res.status(201).json({ user: user._id, doctor: doctor._id });
        }

        res.status(201).json({ user: user._id });
    } catch (error) {
        // Handle errors
        console.error('Error:', error); 
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: error.message });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user) {
            const isPasswordCorrect = await bcrypt.compare(password, user.password);
            if (isPasswordCorrect) {
                const token = jwt.sign({ _id: user._id, role: user.role },
                    'sF4oD3s8qjv%&@Fg2S!L5iYp9s@&A5vG',
                    { expiresIn: 3600 });
                res.cookie('token', token);
                res.json({ id: user._id, role: user.role, token, userName: user.userName, email: user.email, avatar: user.avatar });
            } else {
                res.status(401).json({ error: 'Invalid password.' });
            }
        } else {
            res.status(404).json({ error: 'User not found.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error finding user.' });
    }
};

const verifyUser = (req, res, next) => {
    const token = req.headers['token'];
    console.log('Token:', token);
    if (!token) {
        return res.status(401).json({ msg: 'Authorization token missing' });
    }
    try {
        jwt.verify(token, 'sF4oD3s8qjv%&@Fg2S!L5iYp9s@&A5vG', (err, decoded) => {
            if (err) {
                return res.status(401).json({ msg: 'Invalid token' });
            } else {
                req.user = {
                    _id: decoded._id,
                    role: decoded.role
                };
                next();
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error verifying user.' });
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { userName, email, password, avatar , role } = req.body;
    try {
        if (req.user._id.toString() !== id) {
            return res.status(403).json({ error: 'You are not authorized to update this user' });
        }
        if(role === 'patient'){
            const { dateOfBirth, bloodType } = req.body;
            await Patient.findOneAndUpdate({ user: id }, { dateOfBirth, bloodType }, { new: true });
        }
        if(role === 'doctor'){
            const { cnic, address , specialization } = req.body;
            await Doctor.findOneAndUpdate({ user: id }, { cnic, address , specialization }, { new: true });
        }
        const updatedUser = await User.findByIdAndUpdate(id, { userName, email, password, avatar }, { new: true });
        res.status(200).json({ msg: 'User updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    console.log('ID:', id);
    try {
        const user = await User.findById(id);
        console.log('User:', user);
        if (!user) {
            return res.status(404).json({ error: 'User not found during deletion' });
        }
        if (req.user._id.toString() !== id) {
            return res.status(403).json({ error: 'You are not authorized to delete this user' });
        }
        // await CartModel.findOneAndDelete({ user: id });
        if (user.role === 'patient') {
             await Patient.findOneAndDelete({ user: id });
        }
        if (user.role === 'doctor') {
            await Doctor.findOneAndDelete({ user: id });
        }
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found during deletion' });
        }
        res.status(200).json({ msg: 'User and associated cart deleted successfully', user: deletedUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log('Error:', error);
    }
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('User:', user._id);
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log('Token:', token);
        const link = `http://localhost:5000/user/reset-password/${user._id}/${token}`;
        //   sendMail(
        //     email,
        //     'Reset Password',
        //     'Reset Password',
        //     `Please click on the given link to reset your password <a href="${link}">Change Password</a>`
        //   );
        res.status(200).json({ msg: 'Password reset link sent to email', link: link });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const resetPassword = async (req, res) => {
    console.log('Params:', req.params);
    const { userId, token } = req.params;
    const { password } = req.body;
    console.log('Request body:', req.body);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded._id !== userId) {
            return res.status(400).json({ error: 'Invalid token' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.findByIdAndUpdate(userId, { password: hashedPassword });
        res.status(200).json({ msg: 'Password updated successfully' });
    } catch (error) {
        console.log('Error:', error);
        res.status(400).json({ error: error });
    }
};

const getUserInfo = async (req, res) => {
    const userId = req.user._id; // Assuming you have a middleware that verifies the user and adds user information to the request object
    console.log('User ID:', userId);
    try {
        const user = await User.findById(userId).select('-password'); // Exclude the password from the response
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user information.' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    verifyUser,
    updateUser,
    deleteUser,
    forgotPassword,
    resetPassword,
    getUserInfo
};
