require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const ElectionService = require('./src/electionService');
const VoterService = require('./src/voterService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current election on connection
  try {
    const election = ElectionService.getCurrentElection();
    if (election) {
      socket.emit('election-update', election);
    } else {
      const latestResults = ElectionService.getLatestClosedElection();
      if (latestResults) {
        socket.emit('election-closed', latestResults);
      }
    }
  } catch (error) {
    console.error('Error sending initial data:', error);
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Function to broadcast election updates
function broadcastElectionUpdate() {
  try {
    const election = ElectionService.getCurrentElection();
    if (election) {
      io.emit('election-update', election);
    } else {
      const latestResults = ElectionService.getLatestClosedElection();
      if (latestResults) {
        io.emit('election-closed', latestResults);
      }
    }
  } catch (error) {
    console.error('Error broadcasting update:', error);
  }
}

// Check for election status changes every 5 seconds
setInterval(() => {
  broadcastElectionUpdate();
}, 5000);

// Admin authentication middleware
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey;

  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin key' });
  }

  next();
}

// PUBLIC ROUTES

// Get current active election
app.get('/api/current-election', (req, res) => {
  try {
    const election = ElectionService.getCurrentElection();
    res.json(election);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cast a vote
app.post('/api/vote', (req, res) => {
  try {
    const { keyCode, candidateId } = req.body;

    if (!keyCode || !candidateId) {
      return res.status(400).json({ error: 'Key code and candidate ID are required' });
    }

    const result = ElectionService.castVote(keyCode, candidateId);

    // Broadcast vote event to all clients
    io.emit('vote-cast', {
      candidateId,
      voterName: result.voterName
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get election results by ID
app.get('/api/results/:id', (req, res) => {
  try {
    const electionId = parseInt(req.params.id);
    const results = ElectionService.getElectionResults(electionId);
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get latest closed election results
app.get('/api/results/latest', (req, res) => {
  try {
    const results = ElectionService.getLatestClosedElection();
    res.json(results);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ADMIN ROUTES

// Create a new election
app.post('/api/admin/elections', requireAdmin, (req, res) => {
  try {
    const { name, startDatetime, closeDatetime, candidates } = req.body;

    if (!name || !startDatetime || !closeDatetime || !candidates || candidates.length < 2) {
      return res.status(400).json({
        error: 'Name, start datetime, close datetime, and at least 2 candidates are required'
      });
    }

    const result = ElectionService.createElection(name, startDatetime, closeDatetime, candidates);

    // Broadcast new election to all clients
    broadcastElectionUpdate();

    res.json({
      success: true,
      electionId: result.electionId,
      message: 'Election created successfully!'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Close an election manually
app.post('/api/admin/elections/:id/close', requireAdmin, (req, res) => {
  try {
    const electionId = parseInt(req.params.id);
    const result = ElectionService.closeElection(electionId);

    // Broadcast election closure and results to all clients
    const results = ElectionService.getElectionResults(electionId);
    io.emit('election-closed', results);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all elections
app.get('/api/admin/elections', requireAdmin, (req, res) => {
  try {
    const elections = ElectionService.getAllElections();
    res.json(elections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get election details (admin only)
app.get('/api/admin/elections/:id', requireAdmin, (req, res) => {
  try {
    const electionId = parseInt(req.params.id);
    const election = ElectionService.getElectionById(electionId);

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    res.json(election);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed election results with voter information (admin only)
app.get('/api/admin/elections/:id/detailed-results', requireAdmin, (req, res) => {
  try {
    const electionId = parseInt(req.params.id);
    const results = ElectionService.getDetailedElectionResults(electionId);
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// VOTER MANAGEMENT ROUTES

// Import voters from file
app.post('/api/admin/voters/import', requireAdmin, (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const result = VoterService.importVotersFromFile(filePath);
    res.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      message: `Imported ${result.imported} voters, skipped ${result.skipped}`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add a single voter
app.post('/api/admin/voters', requireAdmin, (req, res) => {
  try {
    const { name, keyCode } = req.body;

    if (!name || !keyCode) {
      return res.status(400).json({ error: 'Name and key code are required' });
    }

    const result = VoterService.addVoter(name, keyCode);
    res.json({
      success: true,
      voter: result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all voters
app.get('/api/admin/voters', requireAdmin, (req, res) => {
  try {
    const voters = VoterService.getAllVoters();
    res.json(voters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a voter
app.delete('/api/admin/voters/:id', requireAdmin, (req, res) => {
  try {
    const voterId = parseInt(req.params.id);
    const result = VoterService.deleteVoter(voterId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Clear all voters
app.delete('/api/admin/voters', requireAdmin, (req, res) => {
  try {
    const result = VoterService.clearAllVoters();
    res.json({
      success: true,
      deleted: result.deleted,
      message: `Deleted ${result.deleted} voters`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate a random key code
app.get('/api/admin/voters/generate-keycode', requireAdmin, (req, res) => {
  try {
    const keyCode = VoterService.generateKeyCode();
    res.json({ keyCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     Election System Server Running                     ║
║     WebSocket Real-time Updates: ENABLED               ║
╚════════════════════════════════════════════════════════╝

Server: http://localhost:${PORT}
Admin Key: ${ADMIN_KEY}

Public Endpoints:
  GET  /api/current-election     - Get active election
  POST /api/vote                 - Cast a vote
  GET  /api/results/:id          - Get election results
  GET  /api/results/latest       - Get latest results

Admin - Election Endpoints (require X-Admin-Key header):
  POST /api/admin/elections      - Create election
  POST /api/admin/elections/:id/close - Close election
  GET  /api/admin/elections      - List all elections
  GET  /api/admin/elections/:id  - Get election details
  GET  /api/admin/elections/:id/detailed-results - Get results with voter info

Admin - Voter Endpoints (require X-Admin-Key header):
  POST   /api/admin/voters/import - Import voters from file
  POST   /api/admin/voters        - Add a voter
  GET    /api/admin/voters        - List all voters
  DELETE /api/admin/voters/:id    - Delete a voter
  DELETE /api/admin/voters        - Clear all voters
  GET    /api/admin/voters/generate-keycode - Generate key code

Ready to accept connections...
  `);
});
