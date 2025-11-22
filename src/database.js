const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'elections.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initDatabase() {
  // Elections table (removed key_code - now each voter has their own)
  db.exec(`
    CREATE TABLE IF NOT EXISTS elections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_datetime TEXT NOT NULL,
      close_datetime TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'closed')),
      closed_manually INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Voters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS voters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_code TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Candidates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
    )
  `);

  // Votes table (now tracks which voter voted)
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      voter_id INTEGER NOT NULL,
      voted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
      FOREIGN KEY (voter_id) REFERENCES voters(id) ON DELETE CASCADE,
      UNIQUE(election_id, voter_id)
    )
  `);

  console.log('Database initialized successfully');
}

// Initialize on import
initDatabase();

module.exports = db;
