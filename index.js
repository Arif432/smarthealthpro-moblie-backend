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
const { encrypt, decrypt } = require("./encrypt");

require("dotenv").config();

const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  "./secrets/serviceAccountKey.json");
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
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

const mongodbURI =
  process.env.MONGODB_URI ||
  "mongodb+srv://MuhammadArifNawaz:03006340067@task-manager-2nd.mesyzb7.mongodb.net/doctorsHealthSystem";
const PORT = process.env.PORT || 5000;
console.log("port", PORT);

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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

const userSocketMap = {};

app.set("io", io);
app.set("userSocketMap", userSocketMap);

// Add error handling for Socket.IO connections
io.on("connect_error", (err) => {
  console.log(`Connect error due to ${err.message}`);
});

io.on("connection", (socket) => {
  console.log("A user is connected", socket.id);

  const userId = socket.handshake.query.userId;

  if (userId !== "undefined" && userId) {
    userSocketMap[userId] = socket.id;
  }

  console.log("User socket data", userSocketMap);

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
    delete userSocketMap[userId];
  });

  socket.on("joinRoom", (room) => {
    // Leave all previous rooms
    socket.rooms.forEach((r) => {
      if (r !== socket.id) {
        socket.leave(r);
      }
    });

    socket.join(room);
    console.log(`User ${userId} joined room: ${room}`);

    // Broadcast room join event
    io.to(room).emit("userJoinedRoom", { userId, socketId: socket.id });
  });

  socket.on("sendMessage", async ({ newMessage, conversationId }) => {
    if (!conversationId) {
      console.error("No conversationId provided for message");
      return;
    }

    const db = mongoose.connection.db;

    // Get the participants from the conversation
    const conversation = await db.collection("conversations").findOne({
      _id: new ObjectId(conversationId),
    });

    if (!conversation) {
      console.error("Conversation not found");
      return;
    }

    const receiverId = conversation.participants.find(
      (id) => id !== newMessage.sender
    );

    // Check if receiver is connected
    const receiverSocketId = userSocketMap[receiverId];
    const isReceiverOnline = !!receiverSocketId;

    // Set initial read status
    const messageReadStatus = {
      [newMessage.sender]: true, // sender has read their message
      [receiverId]: false, // initial receiver status
    };

    console.log(`User ${userId} sending message to room: ${conversationId}`);

    // Get all socket IDs in the room
    const roomSockets = io.sockets.adapter.rooms.get(conversationId);
    console.log(
      "Sockets in room:",
      roomSockets ? Array.from(roomSockets) : "No sockets"
    );

    if (roomSockets && receiverSocketId) {
      const isReceiverInRoom = roomSockets.has(receiverSocketId);
      if (isReceiverInRoom) {
        messageReadStatus[receiverId] = true;
      }
    }

    const messageStatus = isReceiverOnline ? "delivered" : "sent";

    await db.collection("messages").updateOne(
      { _id: new ObjectId(newMessage._id) },
      {
        $set: {
          readStatus: messageReadStatus,
          status: messageStatus,
          updatedAt: new Date(),
        },
      }
    );

    io.to(conversationId).emit("newMessage", {
      ...newMessage,
      readStatus: messageReadStatus,
      status: messageStatus,
    });
  });

  socket.on("messageRead", async ({ messageId, conversationId, userId }) => {
    const db = mongoose.connection.db;

    // First fetch the current message to get existing readStatus
    const message = await db
      .collection("messages")
      .findOne({ _id: new ObjectId(messageId) });

    const updatedReadStatus = {
      ...message.readStatus,
      [userId]: true,
    };

    // Update message read status in database
    await db.collection("messages").updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          readStatus: updatedReadStatus,
          status: "read",
          updatedAt: new Date(),
        },
      }
    );

    // Emit to all users in the conversation
    io.to(conversationId).emit("messageRead", {
      messageId,
      userId,
      status: "read",
      readStatus: updatedReadStatus,
    });
  });
});

// Encryption Configuration
const IV_LENGTH = 16;
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.ENCRYPTION_KEY || "your-fallback-secret-key",
  "salt",
  32
);

// Helper Functions
async function validateToken(token) {
  try {
    const message = { data: {}, token };
    await admin.messaging().send(message, true);
    return true;
  } catch (error) {
    console.error("Invalid token:", error);
    return false;
  }
}

async function verifyFCMToken(token) {
  try {
    const message = {
      data: { test: "test" },
      token: token,
    };
    await admin.messaging().send(message, true);
    return true;
  } catch (error) {
    console.error("Token is invalid:", error);
    return false;
  }
}

async function sendNotificationToUser(receiverId, title, body) {
  try {
    console.log(`Attempting to send notification to ${receiverId}`);
    const user = await User.findById(receiverId);
    if (!user || user.devices.length === 0) {
      console.log(`No devices found for user ${receiverId}`);
      return;
    }

    console.log(`Found ${user.devices.length} devices for user ${receiverId}`);
    const tokens = user.devices.map((device) => device.fcmToken);

    let successCount = 0;
    let failureCount = 0;
    const failedTokens = [];

    for (const token of tokens) {
      if (await validateToken(token)) {
        const message = {
          notification: { title, body },
          token: token,
        };

        try {
          const response = await admin.messaging().send(message);
          console.log(`FCM Response for token ${token}:`, response);
          successCount++;
        } catch (error) {
          console.error(
            `Error sending notification for token ${token}:`,
            error
          );
          failedTokens.push(token);
          failureCount++;
        }
      } else {
        failedTokens.push(token);
        failureCount++;
      }
    }

    console.log(
      `Notifications sent. Success: ${successCount}, Failure: ${failureCount}`
    );

    if (failedTokens.length > 0) {
      console.log(`Cleaning up invalid tokens...`);
      user.devices = user.devices.filter(
        (device) => !failedTokens.includes(device.fcmToken)
      );
      await user.save();
      console.log(`Removed ${failedTokens.length} invalid token(s)`);
    }

    return { successCount, failureCount };
  } catch (error) {
    console.error("Error in sendNotificationToUser:", error);
    throw error;
  }
}

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads",
    allowed_formats: ["jpg", "png", "pdf", "doc", "docx", "xls", "xlsx"],
  },
});

const upload = multer({ storage: storage });

// Routes

// Conversation Routes
app.post("/conversations", async (req, res) => {
  const {
    currentUserId,
    otherUserId,
    currentUserObjectIdAvatar,
    otherUserObjectIdAvatar,
    currentUserObjectIdName,
    otherUserObjectIdName,
  } = req.body;

  try {
    const db = mongoose.connection.db;
    const collection = db.collection("conversations");

    const conversation = await collection.findOne({
      participants: { $all: [currentUserId, otherUserId] },
    });

    if (!conversation) {
      const newConversation = {
        participants: [currentUserId, otherUserId],
        lastMessage: null,
        updatedAt: new Date(),
        avatar: [currentUserObjectIdAvatar, otherUserObjectIdAvatar],
        name: [currentUserObjectIdName, otherUserObjectIdName],
        unreadCount: { [currentUserId]: 0, [otherUserId]: 0 },
        lastReadTimestamp: {
          [currentUserId]: new Date(),
          [otherUserId]: new Date(),
        },
      };

      const result = await collection.insertOne(newConversation);
      res.json({
        _id: result.insertedId.toString(),
        ...newConversation,
      });
    } else {
      res.json({
        ...conversation,
        _id: conversation._id.toString(),
      });
    }
  } catch (error) {
    console.error("Error during conversation creation or retrieval:", error);
    res
      .status(500)
      .json({ error: "Failed to create or retrieve conversation" });
  }
});

app.get("/conversations/getOrCreate/:doctorId/:patientId", async (req, res) => {
  try {
    const { doctorId, patientId } = req.params;

    let conversation = await Conversation.findOne({
      participants: { $all: [doctorId, patientId] },
    });

    if (conversation) {
      res.status(200).json({ conversationId: conversation._id.toString() });
    } else {
      const newConversation = new Conversation({
        participants: [doctorId, patientId],
        lastMessage: null,
        updatedAt: new Date(),
        unreadCount: { [doctorId]: 0, [patientId]: 0 }, // Add this
        lastReadTimestamp: {
          // And this
          [doctorId]: new Date(),
          [patientId]: new Date(),
        },
      });

      const savedConversation = await newConversation.save();
      res
        .status(201)
        .json({ conversationId: savedConversation._id.toString() });
    }
  } catch (error) {
    console.error("Error in /conversations/getOrCreate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/conversations/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const objectId = new ObjectId(userId);
    const db = mongoose.connection.db;
    const conversations = await db
      .collection("conversations")
      .find({
        participants: userId,
      })
      .toArray();

    const conversationsWithUnread = conversations.map((convo) => ({
      ...convo,
      _id: convo._id.toString(),
      unreadCount: convo.unreadCount?.[userId] || 0,
    }));

    res.status(200).json(conversationsWithUnread);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch conversations", error: error.message });
  }
});

// Messages Routes
app.get("/conversations/:id/messages", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const conversationId = req.params.id;

    if (!ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    console.log("Fetching messages for conversation:", conversationId);

    const messages = await db
      .collection("messages")
      .find({ conversationId })
      .toArray();

    console.log(`Found ${messages.length} messages`);

    if (!messages.length) {
      return res.json([]);
    }

    const messagesWithStringIds = messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
    }));

    res.json(messagesWithStringIds);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/conversations/getMessages/:id", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const conversationId = req.params.id;

    const messages = await db
      .collection("messages")
      .find({ conversationId: conversationId })
      .toArray();

    if (messages.length === 0) {
      return res.status(404).send("No messages found for this conversation");
    }

    const messagesWithDecryptedContent = messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
      content: message.content,
    }));

    res.json(messagesWithDecryptedContent);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/conversations/:conversationId/messages", async (req, res) => {
  try {
    const { content, sender, fileInfo } = req.body;
    const conversationId = req.params.conversationId;
    const io = req.app.get("io");

    // Add debug logging
    console.log("Received message request:", {
      content,
      sender,
      fileInfo,
      conversationId,
    });

    // Input validation
    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    if (!content && !fileInfo) {
      return res
        .status(400)
        .json({ error: "Message content or file info is required" });
    }

    if (!sender) {
      return res.status(400).json({ error: "Sender ID is required" });
    }

    const db = mongoose.connection.db;
    const conversation = await db.collection("conversations").findOne({
      _id: new ObjectId(conversationId),
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const receiverId = conversation.participants.find((id) => id !== sender);

    // Prepare new message object with proper initialization
    const newMessage = {
      conversationId,
      content: content || "File shared",
      sender,
      timestamp: new Date(),
      fileInfo: fileInfo || null,
      readStatus: {
        [sender]: true,
        [receiverId]: false,
      },
      status: "sent", // Initial status
    };

    // Debug log the message before insertion
    console.log("Attempting to insert message:", newMessage);

    const result = await db.collection("messages").insertOne(newMessage);

    if (!result.insertedId) {
      console.error("Failed to insert message - no insertedId returned");
      return res.status(500).json({ error: "Failed to insert message" });
    }

    // Get user socket info
    const userSocketMap = req.app.get("userSocketMap") || {};
    const receiverSocketId = userSocketMap[receiverId];
    const isReceiverOnline = !!receiverSocketId;

    // Update message status based on receiver online status
    const messageStatus = isReceiverOnline ? "delivered" : "sent";

    // Update the message with final status
    await db.collection("messages").updateOne(
      { _id: result.insertedId },
      {
        $set: {
          status: messageStatus,
        },
      }
    );

    const insertedMessage = {
      _id: result.insertedId.toString(),
      ...newMessage,
      status: messageStatus,
    };

    if (io) {
      io.to(conversationId).emit("newMessage", insertedMessage);
    }

    // Update unread count and last message
    await db.collection("conversations").updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: {
          lastMessage: content || "File shared",
          updatedAt: new Date(),
          [`unreadCount.${receiverId}`]:
            (conversation.unreadCount?.[receiverId] || 0) + 1,
        },
      }
    );

    return res.status(201).json(insertedMessage);
  } catch (error) {
    console.error("Message insertion error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.post(
  "/conversations/:conversationId/mark-messages-read",
  async (req, res) => {
    try {
      const { conversationId, userId } = req.body;
      const db = mongoose.connection.db;

      // Update all unread messages in this conversation for this user
      await db.collection("messages").updateMany(
        {
          conversationId,
          "readStatus.receiver": false,
          sender: { $ne: userId },
        },
        {
          $set: { "readStatus.receiver": true },
        }
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.put("/conversations/:id/lastMessage", async (req, res) => {
  try {
    const { id } = req.params;
    const { lastMessage } = req.body;

    let query = {
      $or: [
        { _id: id },
        { _id: ObjectId.isValid(id) ? new ObjectId(id) : null },
      ],
    };

    const db = mongoose.connection.db;
    const collection = db.collection("conversations");
    const conversation = await collection.findOne(query);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const updateResult = await collection.updateOne(query, {
      $set: {
        lastMessage: lastMessage,
        updatedAt: new Date(),
      },
    });

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const updatedConversation = await collection.findOne(query);
    res.json(updatedConversation);
  } catch (error) {
    console.error("Error updating last message:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Notification Routes
router.post("/update-fcm-token", async (req, res) => {
  const { email, fcmToken, device } = req.body;
  if (!email || !fcmToken || !device) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }
  try {
    const isValid = await validateToken(fcmToken);
    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid FCM token" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const existingDeviceIndex = user.devices.findIndex(
      (d) => d.device === device
    );

    if (existingDeviceIndex !== -1) {
      user.devices[existingDeviceIndex].fcmToken = fcmToken;
      user.devices[existingDeviceIndex].createdAt = new Date();
    } else {
      user.devices.push({ fcmToken, device, createdAt: new Date() });
    }

    await user.save();
    res.json({ success: true, message: "FCM token updated successfully" });
  } catch (error) {
    console.error("Error updating FCM token:", error);
    res.status(500).json({
      success: false,
      message: "Error updating FCM token",
      error: error.message,
    });
  }
});

router.post("/send-notification", async (req, res) => {
  const { receiverId, title, body } = req.body;
  if (!receiverId || !title || !body) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  // Send response immediately
  res.json({ success: true, message: "Notification queued" });

  // Process notification asynchronously
  try {
    const result = await sendNotificationToUser(receiverId, title, body);
    console.log("Notification sent:", {
      success: true,
      result: {
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
    });
  } catch (error) {
    console.error("Error in send-notification:", error);
  }
});

app.post("/test-fcm", async (req, res) => {
  const { token } = req.body;
  if (!(await validateToken(token))) {
    return res.status(400).json({ success: false, error: "Invalid FCM token" });
  }
  const message = {
    notification: {
      title: "Test Notification",
      body: "This is a test notification",
    },
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/cleanup-tokens", async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const result = await User.updateMany(
      {},
      { $pull: { devices: { createdAt: { $lt: thirtyDaysAgo } } } }
    );
    res.json({
      message: `Cleaned up old tokens. Modified ${result.nModified} users.`,
    });
  } catch (error) {
    console.error("Error cleaning up tokens:", error);
    res.status(500).json({ message: "Error cleaning up tokens" });
  }
});

// File Upload Routes
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const fileInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.bytes,
    url: req.file.path,
  };

  res.status(200).json({
    message: "File uploaded successfully to Cloudinary",
    file: fileInfo,
  });
});

// Check Conversation Route
app.get("/check-conversation/:userId1/:userId2", async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    if (!ObjectId.isValid(userId1) || !ObjectId.isValid(userId2)) {
      return res.status(400).json({ error: "Invalid user IDs" });
    }

    const db = mongoose.connection.db;
    const collection = db.collection("conversations");

    const conversation = await collection.findOne({
      participants: { $all: [userId1, userId2] },
    });

    if (conversation) {
      res.json({ conversationId: conversation._id.toString() });
    } else {
      res.json({ conversationId: null });
    }
  } catch (error) {
    console.error("Error checking conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add this to your server.js
app.post("/conversations/:conversationId/read/:userId", async (req, res) => {
  try {
    const { conversationId, userId } = req.params;
    const db = mongoose.connection.db; // Add this line
    const collection = db.collection("conversations");

    await collection.updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: {
          [`unreadCount.${userId}`]: 0,
          [`lastReadTimestamp.${userId}`]: new Date(),
        },
      }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CNIC Check Route
// Modified CNIC check route to handle encrypted CNICs
router.get("/check-cnic/:encryptedCnic", async (req, res) => {
  try {
    const { encryptedCnic } = req.params;

    // Encrypt the incoming CNIC for comparison
    const encryptedValue = encrypt(decrypt(encryptedCnic)); // Re-encrypt after decryption to match stored format

    const existingDoctor = await Doctor.findOne({
      cnic: encryptedValue,
    });

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

// Start the server
http.listen(PORT, "0.0.0.0", () => {
  console.log(`Server and Socket.IO running on port ${PORT}`);
});

module.exports = app;
