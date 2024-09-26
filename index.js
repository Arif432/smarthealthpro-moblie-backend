const cloudinary  = require("cloudinary")
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const userRoutes = require("./server/routes/userRoutes");
const appointmentRoutes = require("./server/routes/AppointmentRoute");
const chatRoutes = require("./server/routes/chatRoutes");
const { ObjectId } = require("mongodb");
const { Conversation } = require("./server/models/ChatMessageModal");
const { CLOUDNARY, KEY, SECRET } = require('./cloud');
const  encryptText = require("./middle/encryptText")
const decryptText = require("./middle/encryptText")

require("dotenv").config();

cloudinary.v2.config({
  cloud_name: CLOUDNARY,
  api_key : KEY,
  api_secret : SECRET
})


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

//add message to convo
app.post("/conversations/:conversationId/messages", async (req, res) => {
  console.log("Received request to send a message");

  try {
    const { content, sender, receiverId } = req.body;
    const conversationId = req.params.conversationId;

    console.log("Request body:", { content, sender, receiverId });
    console.log("Conversation ID:", conversationId);

    if (!content || !sender) {
      console.error("Missing content or sender in request body");
      return res.status(400).json({ error: "Content and sender are required" });
    }

    const encryptionKey = 'your-secret-key'; // Replace this with a key of your choice
    const encryptedContent = encryptText(content, encryptionKey);

    const db = mongoose.connection.db;
    const message = {
      conversationId,
      content: encryptedContent,  // Store encrypted content
      sender,
      timestamp: new Date(),
    };

    console.log("Message object:", message);

    const result = await db.collection("messages").insertOne(message);
    console.log("Database insert result:", result);

    const receiverSocketId = userSocketMap[receiverId];

    if (receiverSocketId) {
      console.log("Emitting receiveMessage event to the receiver", receiverId);
      io.to(receiverSocketId).emit("newMessage", message);
    } else {
      console.log("Receiver socket ID not found");
    }

    if (result.insertedId) {
      return res.status(201).json({ _id: result.insertedId.toString() });
    } else {
      console.error("Message not inserted, unexpected result:", result);
      return res.status(500).json({ error: "Failed to insert message" });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Error sending message" });
  }
});

//fetch messages by convo id
app.get("/conversations/getMessages/:id", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const conversationId = req.params.id;

    const encryptionKey = 'your-secret-key'; // The same key used for encryption

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
      content: decryptText(message.content, encryptionKey),  // Decrypt content
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



app.put('/conversations/:id/lastMessage', async (req, res) => {
  try {
    const { id } = req.params;
    const { lastMessage } = req.body;

    console.log('Received ID:', id);
    console.log('Received lastMessage:', lastMessage);

    // Create a query that checks for both string and ObjectId
    let query = {
      $or: [
        { _id: id },
        { _id: ObjectId.isValid(id) ? new ObjectId(id) : null }
      ]
    };

    console.log('Querying the database with:', query);

    // Get the database and collection
    const db = mongoose.connection.db;
    const collection = db.collection('conversations');

    // Find the document
    const conversation = await collection.findOne(query);

    // Check if the conversation was found
    if (!conversation) {
      console.log('Conversation not found with ID:', id);
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Update the document
    const updateResult = await collection.updateOne(
      query,
      {
        $set: {
          lastMessage: lastMessage,
          updatedAt: new Date()
        }
      }
    );

    // Log update result
    console.log('Update result:', updateResult);

    if (updateResult.matchedCount === 0) {
      console.log('No documents matched the query');
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Retrieve the updated document to send in the response
    const updatedConversation = await collection.findOne(query);

    // Log the updated document
    console.log('Updated conversation:', updatedConversation);

    res.json(updatedConversation);
  } catch (error) {
    console.error('Error updating last message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

