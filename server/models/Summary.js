const mongoose = require("mongoose");

// Define the schema for Summary
const summarySchema = new mongoose.Schema(
  {
    patientID: {
      type: mongoose.Schema.Types.ObjectId, // Can be ObjectId or String
    },
    doctorID: {
      type: mongoose.Schema.Types.ObjectId, // Can be ObjectId or String
    },
    date: {
      type: Date,
      default: new Date().toISOString(), // Default to the current date if not provided
    },
    summary: {
      type: String,
    },
  },
  { timestamps: true }
); // Adds createdAt and updatedAt fields automatically

// Create the Summary model
const Summary = mongoose.model("Summary", summarySchema);

module.exports = Summary;
