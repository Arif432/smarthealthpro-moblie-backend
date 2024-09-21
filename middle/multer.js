const multer = require("multer");
const store = multer.memoryStorage();
const singlePic = multer({ store }).single("file");

module.exports = { singlePic };
