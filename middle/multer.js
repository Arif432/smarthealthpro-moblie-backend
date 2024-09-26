const multer = require("multer");
const storage = multer.memoryStorage();
const singlePic = multer({ storage }).single("file");

module.exports = { singlePic };
