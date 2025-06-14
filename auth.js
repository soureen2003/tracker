const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('./models/userModel');
const Driver = require('./models/driverModel');

// GET Pages
router.get('/login', (req, res) => res.render('login'));
router.get('/signup', (req, res) => res.render('signup'));

// POST Signup
router.post('/signup', async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    if (role === 'driver') {
      await Driver.create({ name, email, password: hash, phone });
    } else {
      await User.create({ name, email, password: hash });
    }
    req.flash('success', 'Signup successful! Please login.');
    res.redirect('/login');
  } catch (err) {
    req.flash('error', 'Signup failed.');
    res.redirect('/signup');
  }
});

// POST Login
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const Model = role === 'driver' ? Driver : User;
    const user = await Model.findOne({ email });
    if (!user) throw new Error();

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error();

    req.session.userId = user._id;
    req.session.role = role;

    res.redirect(role === 'driver' ? '/driver' : '/user');
  } catch {
    req.flash('error', 'Invalid email or password.');
    res.redirect('/login');
  }
});
