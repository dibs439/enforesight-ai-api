const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Read the template
const templatePath = path.join(__dirname, 'src/templates/admin-welcome.hbs');
const templateSource = fs.readFileSync(templatePath, 'utf-8');

// Compile the template
const template = Handlebars.compile(templateSource);

// Dummy data
const dummyData = {
  firstName: 'John',
  email: 'john.doe@example.com',
  activationUrl:
    'https://enforesight.example.com/api/admin/users/activate/dummyActivationCode123456',
  logoUrl: 'https://localhost:3000/assets/enforesight-logo.svg',
  companyAddress: '123 Financial District, New York, NY 10004',
};

// Render the template
const html = template(dummyData);

// Write to output file
const outputPath = path.join(__dirname, 'email-preview.html');
fs.writeFileSync(outputPath, html, 'utf-8');

console.log('✅ Email preview generated: email-preview.html');
console.log('');
console.log('📧 Email Template Preview with Dummy Data:');
console.log('─'.repeat(50));
console.log(`First Name: ${dummyData.firstName}`);
console.log(`Email: ${dummyData.email}`);
console.log(`Activation URL: ${dummyData.activationUrl}`);
console.log(`Logo URL: ${dummyData.logoUrl}`);
console.log(`Company Address: ${dummyData.companyAddress}`);
console.log('─'.repeat(50));
console.log('');
console.log(
  'Open email-preview.html in your browser to view the rendered email.'
);
