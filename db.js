const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://soureenlaha:9RA7E5XSOCgk6EPd@cluster0.rmug6cj.mongodb.net/ambulanceTracker?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch((err) => console.error('❌ MongoDB connection error:', err));
