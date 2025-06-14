// models/driverModel.js
const mongoose = require('mongoose');
const driverSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: Number,
  password: String,
});
module.exports = mongoose.model('Driver', driverSchema);
