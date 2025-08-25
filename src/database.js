const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/groupdeedo.db');
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.initTables();
      }
    });
  }

  initTables() {
    return new Promise((resolve, reject) => {
      // Create messages table
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            channel TEXT DEFAULT 'general',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) console.error('Error creating messages table:', err);
        });

        // Create sessions table for user data
        this.db.run(`
          CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE NOT NULL,
            username TEXT,
            radius REAL DEFAULT 5,
            channel TEXT DEFAULT 'general',
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) console.error('Error creating user_sessions table:', err);
        });

        // Create index for better performance
        this.db.run(`
          CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp 
          ON messages(channel, timestamp DESC)
        `, (err) => {
          if (err) console.error('Error creating channel timestamp index:', err);
        });

        this.db.run(`
          CREATE INDEX IF NOT EXISTS idx_messages_location 
          ON messages(latitude, longitude)
        `, (err) => {
          if (err) {
            console.error('Error creating location index:', err);
            reject(err);
          } else {
            console.log('Database tables initialized successfully');
            resolve();
          }
        });
      });
    });
  }

  // Add a new message
  addMessage(messageData) {
    return new Promise((resolve, reject) => {
      const { username, message, latitude, longitude, channel, timestamp } = messageData;
      
      this.db.run(
        `INSERT INTO messages (username, message, latitude, longitude, channel, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, message, latitude, longitude, channel, timestamp],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Get messages by channel (limited to recent messages for performance)
  getMessagesByChannel(channel, limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, username, message, latitude, longitude, channel, timestamp
         FROM messages 
         WHERE channel = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [channel, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.reverse()); // Return in chronological order
          }
        }
      );
    });
  }

  // Get messages within a time range (for cleanup)
  getMessagesInTimeRange(hoursAgo = 24) {
    return new Promise((resolve, reject) => {
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      
      this.db.all(
        `SELECT id, username, message, latitude, longitude, channel, timestamp
         FROM messages 
         WHERE timestamp >= ?
         ORDER BY timestamp DESC`,
        [cutoffTime],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Clean up old messages (older than specified hours)
  cleanupOldMessages(hoursAgo = 24) {
    return new Promise((resolve, reject) => {
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      
      this.db.run(
        `DELETE FROM messages WHERE timestamp < ?`,
        [cutoffTime],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`Cleaned up ${this.changes} old messages`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // Save user session data
  saveUserSession(sessionData) {
    return new Promise((resolve, reject) => {
      const { sessionId, username, radius, channel } = sessionData;
      
      this.db.run(
        `INSERT OR REPLACE INTO user_sessions (session_id, username, radius, channel, last_active)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [sessionId, username, radius, channel],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Get user session data
  getUserSession(sessionId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT username, radius, channel FROM user_sessions WHERE session_id = ?`,
        [sessionId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}

module.exports = Database;