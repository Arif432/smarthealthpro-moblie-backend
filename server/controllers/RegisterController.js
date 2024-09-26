const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User, Doctor, Patient } = require("../models/UserModal");
const { getURI } = require("../../utils/features");
// const { sendMail } = require('../utils/nodemailerConfig');
const { ObjectId } = mongoose.Types;
const cloudinary = require("cloudinary")

const registerUser = async (req, res) => {
  const {
    fullName,
    email,
    password,
    role,
    avatar,
    dateOfBirth,
    bloodType,
    specialization,
    cnic,
    address,
    rating,
    reviewCount,
    numPatients,
    about,
    officeHours,
    education,
  } = req.body;

  try {
    // Check for required fields only for patients
    if (role === "patient" && (!dateOfBirth || !bloodType)) {
      return res.status(400).json({ message: "Missing required fields for patient" });
    }

    // Generate a base username from the name
    let userName = fullName.replace(/\s+/g, "").toLowerCase();
    let uniqueUserName = userName;
    let counter = 1;

    // Check if username already exists and generate a unique username
    while (await User.findOne({ userName: uniqueUserName })) {
      uniqueUserName = `${userName}${counter}`;
      counter++;
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Check password length
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password should be at least 8 characters" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = await User.create({
      userName: uniqueUserName,
      fullName,
      email,
      password: hashedPassword,
      role,
    });

    // Create the patient record if role is 'patient'
    let newRecord = null;
    if (role === "patient") {
      newRecord = await Patient.create({
        user: user._id, // Link the patient record to the user's ID
        dateOfBirth,
        bloodType,
      });
    }

    // Create the doctor record if role is 'doctor'
    if (role === "doctor") {
      newRecord = await Doctor.create({
        user: user._id, // Link the doctor record to the user's ID
        userName: uniqueUserName,
        fullName,
        email,
        specialization,
        cnic,
        address,
        rating,
        reviewCount,
        numPatients,
        about,
        officeHours,
        education,
        avatar,
      });
    }

    // Send a single response after both user and record are created
    res.status(201).json({
      message: "User and record created successfully",
      user: user._id,
      record: newRecord ? newRecord._id : null,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
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
        const token = jwt.sign(
          { _id: user._id, role: user.role },
          "sF4oD3s8qjv%&@Fg2S!L5iYp9s@&A5vG",
          { expiresIn: 3600 }
        );
        res.cookie("token", token);
        res.json({
          id: user._id,
          role: user.role,
          token,
          userName: user.userName,
          email: user.email,
          avatar: user.avatar,
        });
      } else {
        res.status(401).json({ error: "Invalid password." });
      }
    } else {
      res.status(404).json({ error: "User not found." });
    }
  } catch (error) {
    res.status(500).json({ error: "Error finding user." });
  }
};

const verifyUser = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Expect token to be in format "Bearer <token>"
  if (!token) {
    return res.status(401).json({ msg: "Authorization token missing" });
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ msg: "Invalid token" });
      } else {
        req.user = {
          _id: decoded._id,
          role: decoded.role,
        };
        next();
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error verifying user." });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const link = `http://localhost:5000/user/reset-password/${user._id}/${token}`;
    // sendMail(
    //   email,
    //   'Reset Password',
    //   'Reset Password',
    //   `Please click on the given link to reset your password <a href="${link}">Change Password</a>`
    // );
    res.status(200).json({ msg: "Password reset link sent to email", link });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
  const { userId, token } = req.params;
  const { password } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded._id !== userId) {
      return res.status(400).json({ error: "Invalid token" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });
    res.status(200).json({ msg: "Password updated successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getUserInfo = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select("-password"); // Exclude the password from the response
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: "Error fetching user information." });
  }
};

const createDoctor = async (req, res) => {
  try {
    const {
      user,
      specialization,
      cnic,
      address,
      rating,
      reviewCount,
      numPatients,
      about,
      officeHours,
      education,
    } = req.body;

    const newDoctor = await Doctor.create({
      user,
      specialization,
      cnic,
      address,
      rating,
      reviewCount,
      numPatients,
      about,
      officeHours,
      education,
    });

    res.status(201).json({ success: true, doctor: newDoctor });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const createPatient = async (req, res) => {
  try {
    const { user, dateOfBirth, bloodType } = req.body;

    if (!user || !dateOfBirth || !bloodType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newPatient = new Patient({
      user,
      dateOfBirth,
      bloodType,
    });

    await newPatient.save();

    res
      .status(201)
      .json({ message: "Patient created successfully", patient: newPatient });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { userName, email, password, avatar, role } = req.body;

  try {
    if (req.user._id.toString() !== id) {
      return res
        .status(403)
        .json({ error: "You are not authorized to update this user" });
    }

    const updateFields = { userName, email, avatar };
    if (password) {
      updateFields.password = await bcrypt.hash(password, 10);
    }

    if (role === "patient") {
      const { dateOfBirth, bloodType } = req.body;
      await Patient.findOneAndUpdate(
        { user: id },
        { dateOfBirth, bloodType },
        { new: true }
      );
    }

    if (role === "doctor") {
      const { cnic, address, specialization, education } = req.body;
      await Doctor.findOneAndUpdate(
        { user: id },
        { cnic, address, specialization, education },
        { new: true }
      );
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateFields, {
      new: true,
    });
    res
      .status(200)
      .json({ msg: "User updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateDoctorInfo = async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;

  console.log("Received request to update doctor with user ID:", id);

  try {
    // Validate if the id is a valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("Invalid user ID format:", id);
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    console.log("User ID is valid, proceeding to manually find the doctor...");

    // Manually find the doctor document in the doctors collection using the user ID as a string
    const db = mongoose.connection.db;
    const doctorsCursor = await db.collection("doctors").find({ user: id });

    // Convert cursor to array to retrieve the doctor document
    const doctors = await doctorsCursor.toArray();

    if (doctors.length === 0) {
      console.log("Doctor not found for user ID:", id);
      return res
        .status(404)
        .json({ error: "Doctor not found for the given user ID" });
    }

    const doctor = doctors[0];
    console.log("Doctor found:", doctor);

    // Manually update the doctor document
    const updateResult = await db
      .collection("doctors")
      .updateOne({ _id: doctor._id }, { $set: updateFields });

    if (updateResult.modifiedCount === 0) {
      console.log("Failed to update doctor information for ID:", doctor._id);
      return res
        .status(500)
        .json({ error: "Failed to update doctor information" });
    }

    // Retrieve the updated doctor information
    const updatedDoctorCursor = await db
      .collection("doctors")
      .find({ _id: doctor._id });
    const updatedDoctors = await updatedDoctorCursor.toArray();
    const updatedDoctor = updatedDoctors[0];

    console.log("Doctor updated successfully:", updatedDoctor);

    res.status(200).json({
      msg: "Doctor information updated successfully",
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.log("Internal server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getDoctorById = async (req, res) => {
  const { id: doctorId } = req.params;

  try {
    const doctor = await Doctor.findById(doctorId).populate(
      "user",
      "-password"
    );
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found." });
    }
    res.status(200).json(doctor);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while fetching doctor info." });
  }
};

const calculateSatisfactionRatio = (doctor) => {
  if (typeof doctor.rating !== 'number' || typeof doctor.reviewCount !== 'number') {
    return null;
  }
  return (doctor.rating * Math.log(doctor.reviewCount + 1)) / 5;
};


// Suggested fix for the getDoctorsBySatisfaction function
const getDoctorsBySatisfaction = async (req, res) => {
  try {
    const doctors = await Doctor.find({}).populate("user");

    const doctorsWithUser = doctors
      .filter(doctor => doctor.user)
      .map((doctor) => {
        const userObj = doctor.user.toObject();
        const doctorObj = doctor.toObject();
        
        const satisfactionRatio = calculateSatisfactionRatio(doctorObj);

        return {
          ...doctorObj,
          user: userObj,
          satisfactionRatio
        };
      });

    const sortedDoctors = doctorsWithUser.sort((a, b) => 
      (b.satisfactionRatio || 0) - (a.satisfactionRatio || 0)
    );

    res.status(200).json(sortedDoctors);
  } catch (error) {
    res.status(500).json({ error: "Error fetching doctors." });
  }
};

const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({});
    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ error: "Error fetching doctors." });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "doctor") {
      await Doctor.findOneAndDelete({ user: id });
    } else if (user.role === "patient") {
      await Patient.findOneAndDelete({ user: id });
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ msg: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting user." });
  }
};

const updatePassword = async (req, res) => {
  const { userId, newPassword } = req.body;

  try {
    // Validate that both userId and newPassword are provided
    if (!userId || !newPassword) {
      return res
        .status(400)
        .json({ error: "User ID and new password are required" });
    }

    // Check if the new password meets the criteria
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Password should be at least 8 characters long" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ msg: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error updating password" });
  }
};

const updateProfilePic = async (req, res) => {
  console.log("Sdsdsd")
  try {
    console.log("User ID and File:", req.body.id, req.file); // For debugging

    // Find user by ID
    const user = await User.findById(req.body.id);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Check if a file is provided
    if (!req.file) {
      return res.status(400).send({
        success: false,
        message: "File is required",
      });
    }

    const file = getURI(req.file); // Convert file to Data URI

    // Check if user has an avatar and public_id exists
    if (user.avatar && user.avatar.public_id) {
      console.log("Deleting previous avatar:", user.avatar.public_id);
      await cloudinary.v2.uploader.destroy(user.avatar.public_id);
    } else {
      console.log("No previous avatar to delete.");
    }

    // Upload the new avatar
    const uploadResult = await cloudinary.v2.uploader.upload(file.content);
    
    // Update user's avatar information
    user.avatar = {
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url,
    };

    // Save the updated user data
    await user.save();

    res.status(200).send({
      success: true,
      message: "Profile picture updated successfully",
    });
    
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).send({
      success: false,
      message: "Error updating profile picture",
    });
  }
};
const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find({}).populate("user");

    const patientsWithUser = patients
      .filter(patient => patient.user)
      .map((patient) => {
        const userObj = patient.user.toObject();
        const doctorObj = patient.toObject();

        return {
          ...doctorObj,
          user: userObj,
        };
      });

    res.status(200).json(patientsWithUser);
  } catch (error) {
    res.status(500).json({ error: "Error fetching doctors." });
  }
};



module.exports = {
  updateProfilePic,
  registerUser,
  loginUser,
  verifyUser,
  forgotPassword,
  resetPassword,
  getUserInfo,
  createDoctor,
  createPatient,
  updateUser,
  updateDoctorInfo,
  getDoctorById,
  getDoctorsBySatisfaction,
  getAllDoctors,
  deleteUser,
  updatePassword,
  getAllPatients,
};
