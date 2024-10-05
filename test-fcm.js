const admin = require("firebase-admin");
const serviceAccount = require("./secrets/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const message = {
  notification: {
    title: "Test Notification",
    body: "This is a test notification",
  },
  token:
    "f1k0h1YNSvSShLXOUjiGrl:APA91bHfOoeq4DqxnlFCYgWpZORs0Kyq-agTd2RiZ0emWKgUezn69r3qrYyBQEAUjPYdfxkrlA5QaBRly0Sjdafhrq_B4_b1yJKUQMSPnrX_sC6N_zvab45vOkX_oDCzUnsX35MGQzsQ",
};

admin
  .messaging()
  .send(message)
  .then((response) => {
    console.log("Successfully sent message:", response);
  })
  .catch((error) => {
    console.log("Error sending message:", error);
  });
