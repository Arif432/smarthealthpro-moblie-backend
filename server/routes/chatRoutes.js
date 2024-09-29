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

router.delete("/deleteChat/:chatId", async (req, res) => {
  const { chatId } = req.params;
  console.log("Received request to delete chat with ID:", chatId);
  
  try {
    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    // Convert string ID to ObjectId
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(chatId);
    } catch (error) {
      console.error("Invalid ObjectId:", error);
      return res.status(400).json({ message: "Invalid chat ID format" });
    }

    // Log all conversations in the database
    const allConversations = await Conversation.find({}).lean();
    console.log("All conversations in database:", 
      allConversations.map(c => ({
        _id: c._id.toString(),
        participants: c.participants,
        lastMessage: c.lastMessage
      }))
    );

    // Log type of chatId for debugging
    console.log("Type of chatId:", typeof chatId);

    // Attempt to find the conversation using different methods
    const conversationByObjectId = await Conversation.findOne({ _id: objectId }).lean();
    console.log("Conversation found by ObjectId:", conversationByObjectId);

    const conversationByStringId = await Conversation.findOne({ _id: chatId }).lean();
    console.log("Conversation found by string ID:", conversationByStringId);

    const conversationByCustomQuery = await Conversation.findOne({ 
      $or: [
        { _id: objectId },
        { _id: chatId },
        { 'participants': { $in: [objectId, chatId] } }
      ]
    }).lean();
    console.log("Conversation found by custom query:", conversationByCustomQuery);

    // Check if the conversation exists in allConversations
    const conversationInList = allConversations.find(c => c._id.toString() === chatId);
    console.log("Conversation found in list:", conversationInList);

    if (!conversationByObjectId && !conversationByStringId && !conversationByCustomQuery) {
      if (conversationInList) {
        console.log("Conversation exists in list but can't be retrieved individually. Possible data inconsistency.");
        
        // Attempt to force delete using string ID
        const forceDeleteResult = await Conversation.deleteOne({ _id: chatId });
        console.log("Force delete by string ID result:", forceDeleteResult);

        if (forceDeleteResult.deletedCount > 0) {
          return res.status(200).json({ message: "Conversation force deleted by string ID due to data inconsistency" });
        }

        return res.status(404).json({ message: "Conversation found in list but deletion failed" });
      }
      return res.status(404).json({ message: "Conversation not found in the database" });
    }

    const conversationToDelete = conversationByObjectId || conversationByStringId || conversationByCustomQuery;

    // Delete messages
    const messagesResult = await Message.deleteMany({ conversationId: objectId });
    console.log("Messages deleted:", messagesResult.deletedCount);

    // Delete conversation
    const deletionResult = await Conversation.findByIdAndDelete(objectId);
    console.log("Conversation deletion result:", deletionResult);

    if (!deletionResult) {
      return res.status(500).json({ message: "Failed to delete conversation" });
    }

    res.status(200).json({ 
      message: "Chat and associated data deleted successfully",
      messagesDeleted: messagesResult.deletedCount,
      conversationDeleted: deletionResult
    });
  } catch (error) {
    console.error("Error in delete chat route:", error);
    res.status(500).json({ message: "Error deleting chat", error: error.message });
  }
});


module.exports = router;
