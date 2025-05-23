const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');

const errorController = require('./controllers/error');
const User = require('./models/user');

const imagesDir = path.join(__dirname, 'images');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://BalajiPathak:Bpathakji%40123@cluster0.x0xuyyk.mongodb.net/shop';

const app = express();

// Initialize session store with error handling
let store;
try {
  store = new MongoDBStore({
    uri: MONGODB_URI,
    collection: 'sessions',
    connectionOptions: {
      serverSelectionTimeoutMS: 5000
    }
  });

  store.on('error', function(error) {
    console.error('Session store error:', error);
  });
} catch (error) {
  console.error('Failed to initialize session store:', error);
  // Fallback to memory store if MongoDB store fails
  store = new session.MemoryStore();
}

const csrfProtection = csrf();

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Session configuration with error handling
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch(err => {
      next(new Error(err));
    });
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500);
app.use(errorController.get404);

app.use((error, req, res, next) => {
  res.status(500).render('500', {
    pageTitle: 'Error!',
    path: '/500',
    isAuthenticated: req.session ? req.session.isLoggedIn : false
  });
});

// Connect to MongoDB with retry logic
const connectWithRetry = () => {
  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    })
    .then(() => {
      console.log('Connected to MongoDB');
      const port = process.env.PORT || 3000;
      app.listen(port, '0.0.0.0', () => {
        console.log(`Server running on port ${port}`);
      });
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      console.log('Retrying connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();
