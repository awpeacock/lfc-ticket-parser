const { getMockFor } = require('nodemailer-mock');
const nodemailer = require('nodemailer');
module.exports = getMockFor(nodemailer);