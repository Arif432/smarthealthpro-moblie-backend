const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const chats = require("../models/ChatMessageModal");
const { Chat, Message, Conversation } = require("../models/ChatMessageModal");
// Fetch all chats
router.get("/chats", async (req, res) => {
  try {
    // Fetch all chats
    const allChats = await chats.find().exec();
    console.log("Fetched all chats:", allChats);

    // Check if no chats are found
    if (allChats.length === 0) {
      console.log("No chats found");
      return res.status(404).json({ message: "No chats found" });
    }

    // Send the result
    res.json(allChats);
  } catch (error) {
    console.error("Error fetching all chats:", error);
    res.status(500).json({ message: "Error fetching all chats", error });
  }
});

// Fetch chats for a specific user by user ID manually
router.get("/chats/user/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    console.log("Received userId:", userId);

    // Validate the userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Invalid userId format:", userId);
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);
    console.log("Converted userId to ObjectId:", userObjectId);

    // Fetch all chats
    const allChats = await chats.find().exec();
    console.log("Fetched all chats:", allChats);

    // Manually filter chats by user ID
    const userChats = allChats.filter((chats) =>
      chats.users.includes(userObjectId.toString())
    );

    // Log the filtered chats
    console.log("Filtered chats for user:", userChats);

    // Check if no chats are found
    if (userChats.length === 0) {
      console.log("No chats found for userId:", userId);
      return res.status(404).json({ message: "No chats found for this user" });
    }

    // Send the result
    res.json(userChats);
  } catch (error) {
    console.error("Error fetching chats for user:", error);
    res.status(500).json({ message: "Error fetching chats for user", error });
  }
});

// Fetch all messages for a specific chats room
router.get("/messages/:chatId", async (req, res) => {
  const { chatId } = req.params;
  try {
    console.log("Received chatId:", chatId);

    // Validate the chatId format
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      console.log("Invalid chatId format:", chatId);
      return res.status(400).json({ message: "Invalid chat ID" });
    }

    // Convert chatId to ObjectId
    const chatObjectId = new mongoose.Types.ObjectId(chatId);
    console.log("Converted chatId to ObjectId:", chatObjectId);

    // Fetch all chats
    const allChats = await chats.find().exec();
    console.log("Fetched all chats:", allChats);

    // Manually filter chats by chat ID
    const chat = allChats.find((chat) => chat._id.equals(chatObjectId));

    // Log the filtered chat
    console.log("Filtered chat:", chat);

    // Check if no chat is found
    if (!chat) {
      console.log("No chat found for chatId:", chatId);
      return res
        .status(404)
        .json({ message: "No chat found for this chat ID" });
    }

    // Send the result
    res.json(chat);
  } catch (error) {
    console.error("Error fetching chat for chatId:", error);
    res.status(500).json({ message: "Error fetching chat for chatId", error });
  }
});

router.delete("/:chatId", async (req, res) => {
  const { chatId } = req.params;

  console.log("Received request to delete chat with ID:", chatId);
  try {
    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const messagesResult = await Message.deleteMany({ conversationId: chatId });
    console.log("Messages deleted:", messagesResult.deletedCount);

    const conversation = await Conversation.findById(chatId);
    console.log("conver",conversation)
    if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
    }

    const conversationResult = await Conversation.deleteOne({ _id: chatId });
    console.log("Conversation deleted:", conversationResult.deletedCount);

    res.status(200).json({ message: "Chat and associated data deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ message: "Error deleting chat", error });
  }
});


module.exports = router;
