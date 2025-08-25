const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');
const Database = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize database
const db = new Database();

// Wait for database initialization
let dbReady = false;
db.initTables().then(() => {
  dbReady = true;
  console.log('Database ready for operations');
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Socket.io
}));
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'groupdeedo-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 * 7 // 7 days session timeout
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Store active users and their locations
const activeUsers = new Map();

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in miles
}

// Helper function to filter messages by location and radius
function filterMessagesByLocation(messages, userLat, userLon, radiusMiles) {
  return messages.filter(message => {
    const distance = calculateDistance(userLat, userLon, message.latitude, message.longitude);
    return distance <= radiusMiles;
  });
}

// API Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Get messages within radius and channel
app.post('/api/messages', async (req, res) => {
  try {
    if (!dbReady) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const { latitude, longitude, radius = 5, channel = 'general' } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Get all messages from the database for the channel
    const allMessages = await db.getMessagesByChannel(channel);
    
    // Filter messages by location
    const nearbyMessages = filterMessagesByLocation(allMessages, latitude, longitude, radius);
    
    res.json({ messages: nearbyMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Post a new message
app.post('/api/message', async (req, res) => {
  try {
    if (!dbReady) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const { username, message, latitude, longitude, channel = 'general' } = req.body;
    
    if (!username || !message || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Username, message, latitude, and longitude are required' 
      });
    }

    // Save message to database
    const messageId = await db.addMessage({
      username,
      message,
      latitude,
      longitude,
      channel,
      timestamp: new Date().toISOString()
    });

    const newMessage = {
      id: messageId,
      username,
      message,
      latitude,
      longitude,
      channel,
      timestamp: new Date().toISOString()
    };

    // Broadcast to users in the same channel within radius
    activeUsers.forEach((userData, socketId) => {
      if (userData.channel === channel) {
        const distance = calculateDistance(
          latitude, longitude,
          userData.latitude, userData.longitude
        );
        
        if (distance <= userData.radius) {
          io.to(socketId).emit('newMessage', newMessage);
        }
      }
    });

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Error posting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user settings
app.post('/api/settings', (req, res) => {
  try {
    const { username, radius, channel } = req.body;
    
    if (!req.session.userId) {
      req.session.userId = Date.now().toString();
    }
    
    req.session.username = username;
    req.session.radius = radius || 5;
    req.session.channel = channel || 'general';
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user settings
app.get('/api/settings', (req, res) => {
  res.json({
    username: req.session.username || '',
    radius: req.session.radius || 5,
    channel: req.session.channel || 'general'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user location and settings updates
  socket.on('updateLocation', (data) => {
    const { latitude, longitude, radius = 5, channel = 'general' } = data;
    
    activeUsers.set(socket.id, {
      latitude,
      longitude,
      radius,
      channel,
      lastSeen: new Date()
    });
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeUsers.delete(socket.id);
  });
});

// Clean up inactive users every 5 minutes
setInterval(() => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  activeUsers.forEach((userData, socketId) => {
    if (userData.lastSeen < fiveMinutesAgo) {
      activeUsers.delete(socketId);
    }
  });
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`GroupDeedo server running on port ${PORT}`);
});

module.exports = app;