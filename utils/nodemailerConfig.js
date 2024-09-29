const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  secure: true,
  auth: {
    user: "sp21-bcs-029@cuilahore.edu.pk",
    pass: "zfwucgilkgfoskny",
  },
});
async function sendMail(to,subject,text,html) {
  const info = await transporter.sendMail({
    from: 'sp21-bcs-029@cuilahore.edu.pk',
    to,
    subject,
    text,
    html,
  });
}

module.exports = {sendMail};

