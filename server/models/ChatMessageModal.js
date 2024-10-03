const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  users: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  receiverName: {
    type: String,
    required: true,
  },
  recieverAvatar: {
    type: String,
    default:
      "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
  },
  messages: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  lastMessage: {
    type: String,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Define the Message schema
const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    ref: "Conversation",
  }, // Link to Conversation
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  }, // Sender's user ID
  content: {
    type: String,
    required: true,
  }, // Message content
  timestamp: {
    type: Date,
    default: Date.now,
  }, // Time when the message was sent
  fileInfo: [
    {
      url: {
        type: String,
        required: true,
      },
      publicId: {
        type: String,
        required: true,
      },
      originalName: {
        type: String,
        required: true,
      },
      mimetype: {
        type: String,
        required: true,
      },
      size: {
        type: String,
        required: true,
      },
    },
  ],
});

// Define the Conversation schema
const conversationSchema = new mongoose.Schema({
  participants: [mongoose.Schema.Types.ObjectId],
  lastMessage: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
  avatar: [mongoose.Schema.Types.ObjectId],
  name: [mongoose.Schema.Types.ObjectId],
});

// Create the Message model
const Chat = mongoose.model("Chat", chatSchema, "chats");
const Conversation = mongoose.model("Conversation", conversationSchema);
const Message = mongoose.model("Message", MessageSchema);

module.exports = { Chat, Conversation, Message };
