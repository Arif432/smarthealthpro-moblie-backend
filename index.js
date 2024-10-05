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

const serviceAccount = require("./secrets/serviceAccountKey.json");
const { User } = require("./server/models/UserModal");
const { Console } = require("console");

// Server Initialization (update this in your server code)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

cloudinary.config({
  cloud_name: CLOUDNARY,
  api_key: KEY,
  api_secret: SECRET,
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors());

const mongodbURI =
  process.env.MONGODB_URI ||
  "mongodb+srv://MuhammadArifNawaz:03006340067@task-manager-2nd.mesyzb7.mongodb.net/doctorsHealthSystem";
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

// Socket.IO setup
const io = require("socket.io")(http);

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

  socket.on("sendMessage", ({ senderId, receiverId, message }) => {
    const receiverSocketId = userSocketMap[receiverId];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", {
        senderId,
        message,
      });
    }
  });
});

// Start the server
http.listen(PORT, () => {
  console.log(`Server and Socket.IO running on port ${PORT}`);
});

const IV_LENGTH = 16; // This is correct for AES
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.ENCRYPTION_KEY || "your-fallback-secret-key",
  "salt",
  32
);

// Create a new conversation
app.post("/conversations", async (req, res) => {
  const {
    currentUserId,
    otherUserId,
    currentUserObjectIdAvatar,
    otherUserObjectIdAvatar,
    currentUserObjectIdName,
    otherUserObjectIdName,
  } = req.body;
  console.log("Entering conversation creation endpoint");

  try {
    console.log(
      "Searching for existing conversation between",
      currentUserId,
      "and",
      otherUserId
    );

    const db = mongoose.connection.db;
    const collection = db.collection("conversations");

    const conversation = await collection.findOne({
      participants: { $all: [currentUserId, otherUserId] },
    });

    console.log("Conversation found:", conversation);

    if (!conversation) {
      console.log("No existing conversation found. Creating a new one...");

      const newConversation = {
        participants: [currentUserId, otherUserId],
        lastMessage: null,
        updatedAt: new Date(),
        avatar: [currentUserObjectIdAvatar, otherUserObjectIdAvatar],
        name: [currentUserObjectIdName, otherUserObjectIdName],
      };

      const result = await collection.insertOne(newConversation);
      console.log("Conversation successfully created:", result);

      // Convert the ObjectId to a string and send the response
      res.json({
        _id: result.insertedId.toString(),
        ...newConversation,
      });
    } else {
      console.log("Existing conversation found:", conversation);

      // Convert the ObjectId to a string before sending the response
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

//get all convo by id
app.get("/conversations/:userId", async (req, res) => {
  const { userId } = req.params;

  console.log("Received request to fetch conversations for userId:", userId);

  try {
    // Correctly instantiate ObjectId with the 'new' keyword
    const objectId = new ObjectId(userId);
    console.log("Converted userId to ObjectId:", objectId);

    // Fetch all conversations where the user is a participant
    const db = mongoose.connection.db;
    const conversations = await db
      .collection("conversations")
      .find({
        participants: userId,
      })
      .toArray();

    console.log("Fetched conversations:", conversations);

    // Convert ObjectId to string in each conversation
    const conversationsWithStringId = conversations.map((convo) => ({
      ...convo,
      _id: convo._id.toString(),
    }));

    res.status(200).json(conversationsWithStringId);
  } catch (error) {
    console.error("Error fetching conversations:", error.message);
    console.error("Stack trace:", error.stack);
    res
      .status(500)
      .json({ message: "Failed to fetch conversations", error: error.message });
  }
});

//fetch messages by convo id
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

    // Convert message IDs to strings and decrypt the content
    const messagesWithDecryptedContent = messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
      // content: decryptText(message.content, encryptionKey),  // Decrypt content
      content: message.content,
    }));

    res.json(messagesWithDecryptedContent);
  } catch (error) {
    res.status(500).send(error.message);
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

app.put("/conversations/:id/lastMessage", async (req, res) => {
  try {
    const { id } = req.params;
    const { lastMessage } = req.body;

    console.log("Received ID:", id);
    console.log("Received lastMessage:", lastMessage);

    // Create a query that checks for both string and ObjectId
    let query = {
      $or: [
        { _id: id },
        { _id: ObjectId.isValid(id) ? new ObjectId(id) : null },
      ],
    };

    console.log("Querying the database with:", query);

    // Get the database and collection
    const db = mongoose.connection.db;
    const collection = db.collection("conversations");

    // Find the document
    const conversation = await collection.findOne(query);

    // Check if the conversation was found
    if (!conversation) {
      console.log("Conversation not found with ID:", id);
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Update the document
    const updateResult = await collection.updateOne(query, {
      $set: {
        lastMessage: lastMessage,
        updatedAt: new Date(),
      },
    });

    // Log update result
    console.log("Update result:", updateResult);

    if (updateResult.matchedCount === 0) {
      console.log("No documents matched the query");
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Retrieve the updated document to send in the response
    const updatedConversation = await collection.findOne(query);

    // Log the updated document
    console.log("Updated conversation:", updatedConversation);

    res.json(updatedConversation);
  } catch (error) {
    console.error("Error updating last message:", error);
    res.status(500).json({ message: "Server error" });
  }
});

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

async function verifyFCMToken(token) {
  try {
    const message = {
      data: { test: "test" },
      token: token,
    };
    await admin.messaging().send(message, true); // dryRun = true
    console.log("Token is valid");
    return true;
  } catch (error) {
    console.error("Token is invalid:", error);
    return false;
  }
}

// Function to send notification to a specific user
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
        console.log("Valid token is: ", token);
        const message = {
          notification: { title, body },
          token: token,
        };

        console.log(`Sending message to FCM:`, message);
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
        console.log(`Removing invalid token: ${token}`);
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

// Route to send a notification
router.post("/send-notification", async (req, res) => {
  const { receiverId, title, body } = req.body;
  if (!receiverId || !title || !body) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }
  try {
    const result = await sendNotificationToUser(receiverId, title, body);
    res.json({
      success: true,
      message: "Notification process completed",
      result: {
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
    });
  } catch (error) {
    console.error("Error in send-notification route:", error);
    res.status(500).json({
      success: false,
      message: "Error sending notification",
      error: error.message,
    });
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

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads",
    allowed_formats: ["jpg", "png", "pdf", "doc", "docx", "xls", "xlsx"], // Add more formats as needed
  },
});

const upload = multer({ storage: storage });

// File upload route
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const fileInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.bytes,
    url: req.file.path, // Cloudinary URL
  };

  res.status(200).json({
    message: "File uploaded successfully to Cloudinary",
    file: fileInfo,
  });
});

// Add this route to your existing chat-related routes
app.post("/conversations/:conversationId/messages", async (req, res) => {
  try {
    const { content, sender, fileInfo } = req.body;
    const conversationId = req.params.conversationId;

    console.log("file info from index.js: ", fileInfo);
    const newMessage = {
      conversationId,
      content: content,
      sender,
      timestamp: new Date(),
      fileInfo: fileInfo || null,
    };

    const db = mongoose.connection.db;
    const result = await db.collection("messages").insertOne(newMessage);

    if (result.insertedId) {
      const insertedMessage = {
        _id: result.insertedId.toString(),
        ...newMessage,
      };

      // Emit the new message to connected clients
      const receiverSocketId = userSocketMap[newMessage.sender];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", insertedMessage);
      }

      res.status(201).json(insertedMessage);
    } else {
      res.status(500).json({ error: "Failed to insert message" });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Error sending message" });
  }
});

async function validateToken(token) {
  try {
    const message = { data: {}, token };
    await admin.messaging().send(message, true); // dryRun = true
    return true;
  } catch (error) {
    console.error("Invalid token:", error);
    return false;
  }
}
