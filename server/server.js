// server/server.js
require('dotenv').config(); // Load environment variables first

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Game: _Game, generateGameId: _generateGameId } = require('./models/Game');
const _bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const _saltRounds = 10;

// Import new middleware and utilities
const logger = require('./utils/logger');
const ApiResponse = require('./utils/apiResponse');
const performanceMonitor = require('./middleware/performance');
const { generalLimiter, authLimiter, uploadLimiter, readLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/validation');

const createAuthRouter = require('./routes/auth');
const createAccountRouter = require('./routes/account');
const createCardRouter = require('./routes/cards'); // <<< Import card router factory
const createDeckRouter = require('./routes/decks'); // <<< Import deck router factory
const { initializeSocketHandlers } = require('./socket/handlers'); // <<< Import socket handler initializer
const { createGuestRouter } = require('./routes/guest'); // <<< Import guest router factory

// Security: Validate JWT secret
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'YOUR_REALLY_SECRET_KEY_CHANGE_ME') {
  logger.error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be set to a secure value!');
  logger.error('Please set JWT_SECRET in your .env file or environment variables.');
  process.exit(1);
}

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

logger.info('Server starting', {
  nodeEnv: NODE_ENV,
  port: PORT,
  host: HOST,
  nodeVersion: process.version,
});

// CORS configuration
const getAllowedOrigins = () => {
  if (NODE_ENV === 'production') {
    const origins = process.env.ALLOWED_ORIGINS;
    if (!origins) {
      logger.error('SECURITY WARNING: ALLOWED_ORIGINS not set in production!');
      return ['http://localhost:3000']; // Fallback for safety
    }
    return origins.split(',').map(origin => origin.trim());
  }
  // Development mode - allow localhost on common development ports
  return [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'http://localhost:1234',  // Add support for Parcel dev server
    'http://127.0.0.1:1234',
  ];
};

const allowedOrigins = getAllowedOrigins();
logger.info('CORS configuration', { allowedOrigins });

// --- Load Static Prompt List from JSON ---
let PREDEFINED_PROMPTS = [];
try {
  const promptsPath = path.join(__dirname, 'data', 'prompts.json');
  const promptsJson = fs.readFileSync(promptsPath, 'utf8');
  PREDEFINED_PROMPTS = JSON.parse(promptsJson);
  logger.info('Prompts loaded successfully', { count: PREDEFINED_PROMPTS.length });
} catch (err) {
  logger.error('Error loading predefined prompts', { error: err.message });
  // Optional: Fallback to a default small list or exit if prompts are essential
  PREDEFINED_PROMPTS = ['Error loading prompts', 'Submit your own!'];
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// CORS middleware MUST come before rate limiting to handle preflight requests
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {return callback(null, true);}
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin, 'Allowed:', allowedOrigins);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Debug: Log each CORS request
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight:', {
      origin: req.headers.origin,
      allowedOrigins: allowedOrigins,
      isAllowed: allowedOrigins.includes(req.headers.origin),
    });
  }
  next();
});

// Apply middleware in correct order
app.use(performanceMonitor.middleware()); // Performance monitoring first
app.use(sanitizeInput); // Input sanitization early
app.use(generalLimiter); // General rate limiting

app.use(express.json({ limit: '10mb' })); // Increase limit for image uploads

// Ensure directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const cardUploadsDir = path.join(uploadsDir, 'cards');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(cardUploadsDir)) {
  fs.mkdirSync(cardUploadsDir);
}

// --- Database Setup ---
const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    // Create users table if it doesn't exist
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      defaultIcon TEXT DEFAULT '👤' 
      /* Add other preferences later if needed: receiveEmails BOOLEAN */
    )`,
      err => {
        if (err) {
          console.error('Error creating users table', err.message);
        }
      },
    );
    // <<< Add Cards Table Creation >>>
    db.run(
      `CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,          -- Use the generated unique ID like 'card-timestamp-random'
      userId INTEGER NOT NULL,      -- Foreign key to link to the user
      imagePath TEXT NOT NULL,      -- Relative path on the server (e.g., /uploads/cards/filename.jpg)
      fileName TEXT NOT NULL,       -- The actual filename on disk
      name TEXT DEFAULT '',         -- Optional user-defined name for the card
      tags TEXT DEFAULT '[]',       -- Store tags as a JSON string array
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lifetimeVotes INTEGER DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE -- If user is deleted, delete their cards
    )`,
      err => {
        if (err) {
          console.error('Error creating cards table', err.message);
        } else {
          db.run(`CREATE INDEX IF NOT EXISTS idx_cards_userId ON cards (userId)`, indexErr => {
            if (indexErr) {
              console.error('Error creating index on cards(userId)', indexErr.message);
            }
          });
        }
      },
    );
    // <<< Add Decks Table Creation >>>
    db.run(
      `CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,          -- Use a generated unique ID (e.g., 'deck-uuid')
      userId INTEGER NOT NULL,      -- Foreign key to link to the user
      name TEXT NOT NULL,           -- Name of the deck
      cardIds TEXT DEFAULT '[]',    -- Store card IDs as a JSON string array
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE -- If user is deleted, delete their decks
    )`,
      err => {
        if (err) {
          console.error('Error creating decks table', err.message);
        }
      },
    );
    // <<< End Decks Table Creation >>>
  }
});

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token === null) {
    return res.sendStatus(401); // if there isn't any token
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Forbidden (invalid token)
    }
    req.user = user; // Add the decoded payload to the request object
    next(); // pass the execution off to whatever request the client intended
  });
};

// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadsDir));

const games = new Map(); // { gameId: Game }
const playerGameMap = new Map(); // { socketId: gameId }
const socketClientMap = new Map(); // <<< ADDED: { socketId: clientId } for guests

// --- Card Storage (Only needed for guest routes now) ---
const cardStore = {};

// --- Multer Config for User Card Uploads (Using Memory Storage) ---
const cardMemoryStorage = multer.memoryStorage(); // Use memory storage
const cardUpload = multer({ storage: cardMemoryStorage }); // Apply memory storage

// API Routers
const authRouter = createAuthRouter(db, JWT_SECRET);
const accountRouter = createAccountRouter(db, authenticateToken);
const cardRouter = createCardRouter(db, authenticateToken, cardUpload, path, fs, cardUploadsDir);
const deckRouter = createDeckRouter(db, authenticateToken);
const guestRouter = createGuestRouter(cardUpload, cardStore, path, fs, cardUploadsDir);

// Apply specific rate limiters to routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/account', accountRouter);
app.use('/api/cards', uploadLimiter, cardRouter);
app.use('/api/decks', deckRouter);
app.use('/api/guest-cards', uploadLimiter, guestRouter);

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  const healthData = performanceMonitor.getHealthCheck();
  res.status(healthData.status === 'healthy' ? 200 : 503).json(healthData);
});

// Metrics endpoint (protected, read-only rate limiting)
app.get('/metrics', readLimiter, (req, res) => {
  // In production, you might want to protect this endpoint
  if (NODE_ENV === 'production') {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${process.env.METRICS_TOKEN || 'admin'}`) {
      return ApiResponse.unauthorized(res, 'Metrics access denied');
    }
  }
  
  const metrics = performanceMonitor.getMetrics();
  return ApiResponse.success(res, metrics, 'Performance metrics retrieved');
});

// API documentation endpoint
app.get('/api', readLimiter, (req, res) => {
  const apiInfo = {
    name: 'Chirped API',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
      },
      account: {
        'GET /api/account/profile': 'Get user profile',
        'PUT /api/account/profile': 'Update user profile',
      },
      cards: {
        'GET /api/cards': 'Get all cards',
        'POST /api/cards/upload': 'Upload new card',
        'GET /api/cards/me': 'Get user cards',
        'POST /api/cards/me/add': 'Add card to collection',
      },
      system: {
        'GET /health': 'Health check',
        'GET /metrics': 'Performance metrics (protected)',
      },
    },
    rateLimit: {
      general: '100 requests per 15 minutes',
      auth: '5 requests per 15 minutes',
      uploads: '10 requests per hour',
    },
  };
  
  return ApiResponse.success(res, apiInfo, 'API information');
});

// <<< Initialize Socket Handlers >>>
initializeSocketHandlers(
  io,
  games,
  playerGameMap,
  db,
  PREDEFINED_PROMPTS,
  path,
  fs,
  cardStore,
  cardUploadsDir,
  socketClientMap,
  uploadsDir,
);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  return ApiResponse.notFound(res, `API endpoint not found: ${req.originalUrl}`);
});

// --- Centralized Error Handling ---
app.use((err, req, res, _next) => {
  logger.error('Global error handler caught error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.error(res, 'File too large', 400, null, 'FILE_TOO_LARGE');
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiResponse.error(res, 'Unexpected file field', 400, null, 'UNEXPECTED_FILE');
    }
    return ApiResponse.error(res, `File upload error: ${err.message}`, 400, null, 'UPLOAD_ERROR');
  }
  
  return ApiResponse.internalError(res, 'Internal Server Error', err);
});

// Development cache-busting middleware
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
  });
}

// --- Start Server ---
server.listen(PORT, HOST, () => {
  logger.info('Server started successfully', {
    environment: NODE_ENV,
    host: HOST,
    port: PORT,
    corsOrigins: allowedOrigins,
    database: dbPath,
  });
  
  if (NODE_ENV === 'development') {
    console.log(`🚀 Chirped Server started successfully!`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Server: http://${HOST}:${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   API Info: http://${HOST}:${PORT}/api`);
    console.log(`   Frontend: http://localhost:1234`);
  }
});

// Ensure NO old/duplicate routes remain here
