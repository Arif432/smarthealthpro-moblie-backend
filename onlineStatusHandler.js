// onlineStatusHandler.js
const onlineUsers = new Map();

const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

const handleSocketConnection = (io, socket) => {
  const userId = socket.handshake.query.userId;

  const handleUserConnection = () => {
    if (userId && userId !== "undefined") {
      // Add user to online users
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} is now online with socket ${socket.id}`);

      // Broadcast to all clients that this user is online
      io.emit("userStatus", { userId, isOnline: true });

      // Send current online users list to the newly connected user
      socket.emit("onlineUsers", getOnlineUsers());
    }
  };

  // Log all online users whenever there's a change
  console.log("Current online users:", Array.from(onlineUsers.entries()));

  const handleUserDisconnect = () => {
    if (userId && userId !== "undefined") {
      console.log(`User ${userId} went offline from socket ${socket.id}`);
      onlineUsers.delete(userId);
      io.emit("userStatus", { userId, isOnline: false });
    }
  };

  // Initialize connection
  handleUserConnection();

  // Handle disconnect
  socket.on("disconnect", handleUserDisconnect);

  // Handle status check requests
  socket.on("checkOnlineStatus", (targetUserId) => {
    const isOnline = onlineUsers.has(targetUserId);
    socket.emit("userStatus", {
      userId: targetUserId,
      isOnline,
      lastChecked: new Date().toISOString(),
    });
  });

  // Handle explicit user logout
  socket.on("userDisconnected", (logoutUserId) => {
    if (onlineUsers.has(logoutUserId)) {
      console.log(`User ${logoutUserId} logged out explicitly`);
      onlineUsers.delete(logoutUserId);
      io.emit("userStatus", {
        userId: logoutUserId,
        isOnline: false,
        reason: "logout",
      });
    }
  });

  // Cleanup on socket disconnection
  socket.on("disconnect", () => {
    handleUserDisconnect();

    // Cleanup all listeners
    socket.removeAllListeners("checkOnlineStatus");
    socket.removeAllListeners("userDisconnected");
  });
};

module.exports = {
  handleSocketConnection,
  getOnlineUsers,
  isUserOnline,
  onlineUsers,
};
