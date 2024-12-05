const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const userRoutes = require("./server/routes/userRoutes");
const appointmentRoutes = require("./server/routes/AppointmentRoute");
const chatRoutes = require("./server/routes/chatRoutes");
const { ObjectId } = require("mongodb");
const { Conversation, Message } = require("./server/models/ChatMessageModal");
const { CLOUDNARY, KEY, SECRET } = require("./cloud");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const crypto = require("crypto");

require("dotenv").config();

const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./secrets/serviceAccountKey.json");
const { User, Doctor } = require("./server/models/UserModal");
const { Console } = require("console");

// Server Initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

cloudinary.config({
  cloud_name: process.env.CLOUDNARY || CLOUDNARY,
  api_key: process.env.KEY || KEY,
  api_secret: process.env.SECRET || SECRET,
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors());

// Updated CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000", // Replace with your frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

const mongodbURI =
  process.env.MONGODB_URI || "mongodb+srv://MuhammadArifNawaz:03006340067@task-manager-2nd.mesyzb7.mongodb.net/doctorsHealthSystem";
const PORT = process.env.PORT || 5000;

mongoose
  .connect(mongodbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

// Use routes
app.use("/user", userRoutes);
app.use("/appointment", appointmentRoutes);
app.use("/chats", chatRoutes);
app.use("/", router);

// Create HTTP server for Express and Socket.IO
const http = require("http").createServer(app);

// Updated Socket.IO setup
const io = require("socket.io")(http, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Replace with your frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

app.set("io", io);

// Add error handling for Socket.IO connections
io.on("connect_error", (err) => {
  console.log(`Connect error due to ${err.message}`);
});

const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("A user is connected", socket.id);

  const userId = socket.handshake.query.userId;

  if (userId !== "undefined") {
    userSocketMap[userId] = socket.id;
  }

  console.log("User socket data", userSocketMap);

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
    delete userSocketMap[userId];
  });

  socket.on("joinRoom", (room) => {
    socket.rooms.forEach((r) => {
      if (r !== socket.id) {
        socket.leave(r);
      }
    });
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  socket.on("leaveRoom", (room) => {
    socket.leave(room);
    console.log(`User ${socket.id} left room: ${room}`);
  });

  socket.on("sendMessage", ({ newMessage, conversationId }) => {
    if (!conversationId) {
      console.error("No conversationId provided for message");
      return;
    }

    io.to(conversationId).emit("newMessage", {
      ...newMessage,
      conversationId,
    });
  });
});

// Start the server
http.listen(PORT, "0.0.0.0", () => {
  console.log(`Server and Socket.IO running on port ${PORT}`);
});

// Functionality remains unchanged
const IV_LENGTH = 16;
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.ENCRYPTION_KEY || "your-fallback-secret-key",
  "salt",
  32
);

// Add the new route from `Stashed changes`
router.get("/check-cnic/:cnic", async (req, res) => {
  try {
    const { cnic } = req.params;

    const existingDoctor = await Doctor.findOne({ cnic });

    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: "This CNIC is already registered with another doctor",
      });
    }

    return res.status(200).json({
      success: true,
      message: "CNIC is available",
    });
  } catch (error) {
    console.error("CNIC check error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Export the app for further use
module.exports = app;
