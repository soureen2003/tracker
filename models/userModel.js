// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: Number,
  password: String,
  socketId: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('User', userSchema);
