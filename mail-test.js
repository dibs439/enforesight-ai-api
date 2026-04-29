const nodemailer = require('nodemailer');

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: 'support@enforesight.ai',
      pass: 'Y.322647026263ab',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Test App" <support@enforesight.ai>',
      to: 'yourpersonalemail@gmail.com', // change this
      subject: 'SMTP Test Email',
      text: 'This is a test email from Microsoft 365 SMTP',
    });

    console.log('Email sent:', info.messageId);
  } catch (err) {
    console.error('Error:', err);
  }
}

testEmail();
