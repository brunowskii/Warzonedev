// PRODUCTION-READY WARZONE TOURNAMENT SERVER
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import winston from 'winston';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Configure Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'warzone-tournament-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

const app = express();
const httpServer = createServer(app);

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.'
    });
  }
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts, please try again later.'
  },
  skipSuccessfulRequests: true
});

// Apply rate limiting
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Enhanced Socket.io configuration
const io = new Server(httpServer, {
  cors: {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'https://warzone-portal.netlify.app',
        'https://*.netlify.app',
        'https://*.bolt.new',
        'http://localhost:3000',
        'http://localhost:5173'
      ];
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        return allowed.test(origin);
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`Socket.io CORS blocked origin: ${origin}`);
        callback(null, true); // Still allow for now
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  },
  // Production optimizations
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true
});

// Express middleware
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '50mb',
  verify: (req, res, buf) => {
    // Log large payloads
    if (buf.length > 10 * 1024 * 1024) { // 10MB
      logger.warn(`Large payload received: ${buf.length} bytes`, {
        ip: req.ip,
        endpoint: req.path,
        size: buf.length
      });
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || '50mb' 
}));

// Enhanced CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'https://warzone-portal.netlify.app',
        /https:\/\/.*\.netlify\.app$/,
        /https:\/\/.*\.bolt\.new$/
      ];
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        return allowed.test(origin);
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['set-cookie']
}));

// Trust proxy for deployment
app.set('trust proxy', 1);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, 'HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
});

// Enhanced MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/warzone-tournaments';

logger.info('Connecting to MongoDB...', {
  environment: process.env.NODE_ENV || 'development',
  database: MONGODB_URI.includes('mongodb.net') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB'
});

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,
  bufferCommands: false,
})
.then(() => {
  logger.info('Connected to MongoDB', {
    database: mongoose.connection.db.databaseName,
    host: mongoose.connection.host,
    port: mongoose.connection.port
  });
})
.catch(err => {
  logger.error('MongoDB connection error', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Enhanced connection monitoring
mongoose.connection.on('error', err => {
  logger.error('MongoDB error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

// Input validation schemas
const tournamentValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).escape(),
  body('type').isIn(['Ritorno', 'BR']),
  body('startDate').optional().isISO8601(),
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('settings.lobbies').isInt({ min: 1, max: 10 }),
  body('settings.totalMatches').isInt({ min: 1, max: 20 }),
  body('settings.countedMatches').isInt({ min: 1, max: 20 })
];

const teamValidation = [
  body('name').trim().isLength({ min: 1, max: 50 }).escape(),
  body('tournamentId').isMongoId(),
  body('playerName').optional().trim().isLength({ max: 50 }).escape(),
  body('clanName').optional().trim().isLength({ max: 50 }).escape()
];

const matchValidation = [
  body('position').isInt({ min: 1, max: 100 }),
  body('kills').isInt({ min: 0, max: 100 }),
  body('teamCode').trim().isLength({ min: 1, max: 20 }).escape(),
  body('tournamentId').isMongoId(),
  body('photos').isArray({ max: 5 })
];

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors', {
      errors: errors.array(),
      ip: req.ip,
      endpoint: req.path
    });
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Tournament Schema with enhanced validation
const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  type: { type: String, enum: ['Ritorno', 'BR'], default: 'Ritorno' },
  status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
  startDate: String,
  startTime: { type: String, default: '20:00' },
  createdAt: { type: Number, default: Date.now },
  endedAt: Number,
  completedAt: Number,
  createdBy: { type: String, default: 'admin' },
  assignedManagers: [String],
  settings: {
    lobbies: { type: Number, default: 2, min: 1, max: 10 },
    slotsPerLobby: { type: Number, default: 15, min: 1, max: 100 },
    totalMatches: { type: Number, default: 4, min: 1, max: 20 },
    countedMatches: { type: Number, default: 3, min: 1, max: 20 }
  },
  finalLeaderboard: [mongoose.Schema.Types.Mixed],
  isDemo: { type: Boolean, default: false }
});

// Team Schema with enhanced validation
const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 50 },
  code: { type: String, required: true, unique: true, maxlength: 20 },
  lobby: String,
  lobbyNumber: Number,
  createdAt: { type: Number, default: Date.now },
  tournamentId: { type: String, required: true },
  playerName: { type: String, maxlength: 50 },
  clanName: { type: String, maxlength: 50 }
});

// Match Schema with enhanced validation
const matchSchema = new mongoose.Schema({
  position: { type: Number, required: true, min: 1, max: 100 },
  kills: { type: Number, required: true, min: 0, max: 100 },
  score: { type: Number, required: true, min: 0 },
  teamCode: { type: String, required: true, maxlength: 20 },
  photos: { type: [String], validate: [arrayLimit, '{PATH} exceeds the limit of 5'] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Number, default: Date.now },
  reviewedAt: Number,
  reviewedBy: String,
  tournamentId: { type: String, required: true },
  rejectionReason: String
});

function arrayLimit(val) {
  return val.length <= 5;
}

// Pending Submission Schema
const pendingSubmissionSchema = new mongoose.Schema({
  teamCode: { type: String, required: true, maxlength: 20 },
  teamName: { type: String, required: true, maxlength: 50 },
  position: { type: Number, required: true, min: 1, max: 100 },
  kills: { type: Number, required: true, min: 0, max: 100 },
  photos: { type: [String], validate: [arrayLimit, '{PATH} exceeds the limit of 5'] },
  submittedAt: { type: Number, default: Date.now },
  tournamentId: { type: String, required: true }
});

// Score Adjustment Schema
const scoreAdjustmentSchema = new mongoose.Schema({
  teamCode: { type: String, required: true, maxlength: 20 },
  teamName: { type: String, required: true, maxlength: 50 },
  points: { type: Number, required: true, min: -1000, max: 1000 },
  reason: { type: String, required: true, maxlength: 200 },
  type: { type: String, enum: ['penalty', 'reward', 'crash'], required: true },
  appliedAt: { type: Number, default: Date.now },
  appliedBy: { type: String, required: true },
  tournamentId: { type: String, required: true }
});

// Manager Schema
const managerSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 50 },
  code: { type: String, required: true, unique: true, maxlength: 20 },
  permissions: [String],
  createdAt: { type: Number, default: Date.now },
  createdBy: { type: String, default: 'admin' },
  isActive: { type: Boolean, default: true }
});

// Audit Log Schema
const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, maxlength: 100 },
  details: { type: String, required: true, maxlength: 500 },
  performedBy: { type: String, required: true, maxlength: 50 },
  performedByType: { type: String, enum: ['admin', 'manager', 'team'], required: true },
  timestamp: { type: Number, default: Date.now },
  tournamentId: String,
  targetTeam: String,
  metadata: mongoose.Schema.Types.Mixed
});

// Models
const Tournament = mongoose.model('Tournament', tournamentSchema);
const Team = mongoose.model('Team', teamSchema);
const Match = mongoose.model('Match', matchSchema);
const PendingSubmission = mongoose.model('PendingSubmission', pendingSubmissionSchema);
const ScoreAdjustment = mongoose.model('ScoreAdjustment', scoreAdjustmentSchema);
const Manager = mongoose.model('Manager', managerSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Add indexes for performance
tournamentSchema.index({ status: 1, createdAt: -1 });
teamSchema.index({ tournamentId: 1, code: 1 });
matchSchema.index({ tournamentId: 1, teamCode: 1 });
auditLogSchema.index({ timestamp: -1, tournamentId: 1 });

// Socket.io connection handling with enhanced security
io.on('connection', (socket) => {
  logger.info('User connected', { socketId: socket.id, ip: socket.handshake.address });
  
  socket.on('join-tournament', (tournamentId) => {
    if (typeof tournamentId === 'string' && tournamentId.length <= 50) {
      socket.join(`tournament-${tournamentId}`);
      logger.info('User joined tournament', { 
        socketId: socket.id, 
        tournamentId,
        ip: socket.handshake.address 
      });
    } else {
      logger.warn('Invalid tournament ID in join request', { 
        socketId: socket.id, 
        tournamentId 
      });
    }
  });
  
  socket.on('disconnect', (reason) => {
    logger.info('User disconnected', { 
      socketId: socket.id, 
      reason,
      ip: socket.handshake.address 
    });
  });

  socket.on('error', (error) => {
    logger.error('Socket error', { 
      socketId: socket.id, 
      error: error.message,
      ip: socket.handshake.address 
    });
  });
});

// API Routes with enhanced error handling

// Get all tournaments
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await Tournament.find({ status: { $ne: 'archived' } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    logger.info('Tournaments fetched', { count: tournaments.length, ip: req.ip });
    
    res.json({ 
      success: true,
      tournaments: tournaments || [] 
    });
  } catch (error) {
    logger.error('Get tournaments error', { error: error.message, ip: req.ip });
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch tournaments' 
    });
  }
});

// Get tournament by ID
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id).lean();
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }
    
    res.json({ success: true, tournament });
  } catch (error) {
    logger.error('Get tournament error', { error: error.message, tournamentId: req.params.id, ip: req.ip });
    res.status(500).json({ success: false, error: 'Failed to fetch tournament' });
  }
});

// Create tournament with validation
app.post('/api/tournaments', tournamentValidation, handleValidationErrors, async (req, res) => {
  try {
    const tournament = new Tournament(req.body);
    await tournament.save();
    
    logger.info('Tournament created', { 
      tournamentId: tournament._id, 
      name: tournament.name,
      createdBy: req.body.createdBy || 'admin',
      ip: req.ip 
    });
    
    // Emit to all connected clients
    io.emit('tournamentCreated', { tournament });
    
    res.json({ success: true, tournament });
  } catch (error) {
    logger.error('Create tournament error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, error: 'Failed to create tournament' });
  }
});

// Update tournament
app.put('/api/tournaments/:id', tournamentValidation, handleValidationErrors, async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }
    
    logger.info('Tournament updated', { 
      tournamentId: tournament._id, 
      name: tournament.name,
      ip: req.ip 
    });
    
    io.emit('tournamentUpdated', { tournament });
    
    res.json({ success: true, tournament });
  } catch (error) {
    logger.error('Update tournament error', { error: error.message, tournamentId: req.params.id, ip: req.ip });
    res.status(500).json({ success: false, error: 'Failed to update tournament' });
  }
});

// Get teams for tournament
app.get('/api/tournaments/:id/teams', async (req, res) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.id }).lean();
    res.json({ success: true, teams });
  } catch (error) {
    logger.error('Get teams error', { error: error.message, tournamentId: req.params.id, ip: req.ip });
    res.status(500).json({ success: false, error: 'Failed to fetch teams' });
  }
});

// Create team with validation
app.post('/api/teams', teamValidation, handleValidationErrors, async (req, res) => {
  try {
    const team = new Team(req.body);
    await team.save();
    
    logger.info('Team created', { 
      teamId: team._id, 
      name: team.name,
      code: team.code,
      tournamentId: team.tournamentId,
      ip: req.ip 
    });
    
    io.to(`tournament-${team.tournamentId}`).emit('teamCreated', { team });
    
    res.json({ success: true, team });
  } catch (error) {
    logger.error('Create team error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, error: 'Failed to create team' });
  }
});

// Get matches for tournament
app.get('/api/tournaments/:id/matches', async (req, res) => {
  try {
    const matches = await Match.find({ tournamentId: req.params.id }).lean();
    res.json({ success: true, matches });
  } catch (error) {
    logger.error('Get matches error', { error: error.message, tournamentId: req.params.id, ip: req.ip });
    res.status(500).json({ success: false, error: 'Failed to fetch matches' });
  }
});

// Create match with validation
app.post('/api/matches', matchValidation, handleValidationErrors, async (req, res) => {
  try {
    const match = new Match(req.body);
    await match.save();
    
    logger.info('Match created', { 
      matchId: match._id, 
      teamCode: match.teamCode,
      position: match.position,
      kills: match.kills,
      tournamentId: match.tournamentId,
      ip: req.ip 
    });
    
    io.to(`tournament-${match.tournamentId}`).emit('matchCreated', { match });
    
    res.json({ success: true, match });
  } catch (error) {
    logger.error('Create match error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, error: 'Failed to create match' });
  }
});

// Authentication with enhanced security
app.post('/api/auth/login', [
  body('code').trim().isLength({ min: 1, max: 50 }).escape(),
  body('type').isIn(['admin', 'manager', 'team'])
], handleValidationErrors, async (req, res) => {
  try {
    const { code, type } = req.body;
    
    logger.info('Login attempt', { type, ip: req.ip, userAgent: req.get('User-Agent') });
    
    if (type === 'admin') {
      if (code === process.env.ADMIN_CODE_1 || code === process.env.ADMIN_CODE_2 || 
          code === 'MISOKIETI' || code === 'MISOKIETI8') {
        logger.info('Admin login successful', { ip: req.ip });
        return res.json({ success: true, userType: 'admin', identifier: 'admin' });
      }
    } else if (type === 'manager') {
      const manager = await Manager.findOne({ code, isActive: true }).lean();
      if (manager) {
        logger.info('Manager login successful', { managerCode: code, ip: req.ip });
        return res.json({ success: true, userType: 'manager', identifier: code });
      }
    } else if (type === 'team') {
      const team = await Team.findOne({ code }).lean();
      if (team) {
        const tournament = await Tournament.findById(team.tournamentId).lean();
        if (tournament && tournament.status === 'active') {
          logger.info('Team login successful', { teamCode: code, tournamentId: team.tournamentId, ip: req.ip });
          return res.json({ 
            success: true, 
            userType: 'team', 
            identifier: code,
            tournamentId: team.tournamentId 
          });
        }
      }
    }
    
    logger.warn('Login failed', { type, code: code.substring(0, 3) + '***', ip: req.ip });
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  } catch (error) {
    logger.error('Login error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Health check endpoint with enhanced information
app.get('/api/health', (req, res) => {
  const healthData = {
    success: true,
    status: 'healthy',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    nodeVersion: process.version
  };
  
  logger.info('Health check', { ip: req.ip, status: healthData.status });
  res.json(healthData);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  logger.error('Server error', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip 
  });
  
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
    
  res.status(500).json({ 
    success: false, 
    error: errorMessage,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  logger.warn('API endpoint not found', { url: req.url, method: req.method, ip: req.ip });
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...',
    frontendUrl: process.env.FRONTEND_URL || 'Not set'
  });
  
  if (process.env.NODE_ENV === 'production') {
    logger.info('Production mode: Serving static files from /dist');
  } else {
    logger.info('Development mode: API only');
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
    
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      logger.info('Server shutdown complete');
      process.exit(0);
    });
  });
  
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  gracefulShutdown('UNHANDLED_REJECTION');
});