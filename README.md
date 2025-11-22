# Election System

A simple, secure election system built with Node.js and SQLite. Supports sequential elections with time-based start/close, manual closing, secure voting with individual voter key codes, and real-time result viewing.

## Features

- **Sequential Elections** - One election at a time (pending or active)
- **Time-Based Control** - Elections automatically start and close based on datetime
- **Manual Closing** - Admin can close elections early via protected endpoint
- **Voter Management** - Individual voters with unique 6-letter key codes
- **Secure Voting** - Each voter can only vote once per election
- **Real-Time Updates** - Public webpage auto-refreshes every 5 seconds
- **Vote Tracking** - Tracks which voter voted for which candidate
- **Results Visualization** - Shows winner and vote distribution after closing
- **SQLite Database** - All data persisted in local database

## Installation

1. Clone or navigate to this directory

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Edit `.env` and set your admin key:
```env
PORT=3000
ADMIN_KEY=your-secret-admin-key-here
DB_PATH=./elections.db
```

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start at `http://localhost:3000`

## Quick Start Guide

### 1. Import Voters

First, create voters in the system. You can either:

**Option A: Import from file**

Use the provided `voters.txt` file (format: `Name,KEYCODE`):
```bash
curl -X POST http://localhost:3000/api/admin/voters/import \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-secret-admin-key-here" \
  -d '{"filePath": "voters.txt"}'
```

**Option B: Add voters individually**
```bash
curl -X POST http://localhost:3000/api/admin/voters \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-secret-admin-key-here" \
  -d '{
    "name": "John Doe",
    "keyCode": "ABCDEF"
  }'
```

### 2. Create an Election

```bash
curl -X POST http://localhost:3000/api/admin/elections \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-secret-admin-key-here" \
  -d '{
    "name": "Student Council President 2024",
    "startDatetime": "2024-01-15T09:00:00Z",
    "closeDatetime": "2024-01-15T17:00:00Z",
    "candidates": ["Alice Johnson", "Bob Smith", "Carol Williams"]
  }'
```

### 3. Distribute Key Codes

Share each voter's unique 6-letter key code with them securely.

### 4. Voters Cast Their Votes

Voters visit `http://localhost:3000` and:
1. Enter their 6-letter key code
2. Select their candidate
3. Submit their vote

### 5. View Results

After the election closes (automatically or manually), results are visible on the public page.

## Usage

### For Voters (Public)

1. Open `http://localhost:3000` in your browser
2. Enter your unique 6-letter key code
3. Select your candidate
4. Click "Submit Vote"
5. You'll receive confirmation with your name

**Note**: Each voter can only vote once per election. The system tracks who has voted.

### For Administrators

All admin endpoints require the `X-Admin-Key` header with your admin key.

#### Voter Management

**Import voters from file:**
```bash
curl -X POST http://localhost:3000/api/admin/voters/import \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-secret-admin-key-here" \
  -d '{"filePath": "voters.txt"}'
```

**List all voters:**
```bash
curl http://localhost:3000/api/admin/voters \
  -H "X-Admin-Key: your-secret-admin-key-here"
```

**Generate a random key code:**
```bash
curl http://localhost:3000/api/admin/voters/generate-keycode \
  -H "X-Admin-Key: your-secret-admin-key-here"
```

**Delete a voter:**
```bash
curl -X DELETE http://localhost:3000/api/admin/voters/1 \
  -H "X-Admin-Key: your-secret-admin-key-here"
```

**Clear all voters:**
```bash
curl -X DELETE http://localhost:3000/api/admin/voters \
  -H "X-Admin-Key: your-secret-admin-key-here"
```

#### Election Management

**Create an election:**
```bash
curl -X POST http://localhost:3000/api/admin/elections \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-secret-admin-key-here" \
  -d '{
    "name": "Favorite Programming Language",
    "startDatetime": "2024-01-15T10:00:00Z",
    "closeDatetime": "2024-01-15T18:00:00Z",
    "candidates": ["JavaScript", "Python", "Rust", "Go"]
  }'
```

**Close an election manually:**
```bash
curl -X POST http://localhost:3000/api/admin/elections/1/close \
  -H "X-Admin-Key: your-secret-admin-key-here"
```

**List all elections:**
```bash
curl http://localhost:3000/api/admin/elections \
  -H "X-Admin-Key: your-secret-admin-key-here"
```

**Get election details:**
```bash
curl http://localhost:3000/api/admin/elections/1 \
  -H "X-Admin-Key: your-secret-admin-key-here"
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/current-election` | Get current active election |
| POST | `/api/vote` | Cast a vote (requires keyCode and candidateId) |
| GET | `/api/results/:id` | Get results for a specific election |
| GET | `/api/results/latest` | Get latest closed election results |

### Admin Endpoints (require X-Admin-Key header)

#### Voter Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/voters/import` | Import voters from file |
| POST | `/api/admin/voters` | Add a single voter |
| GET | `/api/admin/voters` | List all voters |
| DELETE | `/api/admin/voters/:id` | Delete a voter |
| DELETE | `/api/admin/voters` | Clear all voters |
| GET | `/api/admin/voters/generate-keycode` | Generate random key code |

#### Election Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/elections` | Create a new election |
| POST | `/api/admin/elections/:id/close` | Close an election manually |
| GET | `/api/admin/elections` | List all elections |
| GET | `/api/admin/elections/:id` | Get election details |

## Postman Collection

Import the `Election_System_API.postman_collection.json` file into Postman to easily test all API endpoints.

1. Open Postman
2. Click "Import"
3. Select `Election_System_API.postman_collection.json`
4. Update the `ADMIN_KEY` variable to match your `.env` file

The collection includes all endpoints organized by category with example requests.

## Voters File Format

The `voters.txt` file should contain one voter per line in the format:
```
Name,KEYCODE
```

Example:
```
John Doe,ABCDEF
Jane Smith,GHIJKL
Bob Johnson,MNOPQR
```

**Requirements:**
- Key codes must be exactly 6 letters (A-Z)
- Key codes must be unique
- Names can contain spaces and special characters

## Election Workflow

1. **Setup Voters**: Admin imports or creates voters with unique key codes
2. **Create Election**: Admin creates an election with start/close times and candidates
3. **Pending State**: Election waits for start time (if in future)
4. **Active State**: Election becomes active at start time, voters can vote
5. **Voting**: Each voter uses their key code to vote (only once per election)
6. **Closed State**: Election closes at close time (or manually by admin)
7. **Results**: Winner and vote counts are revealed
8. **Next Election**: Admin can create the next sequential election

## Database Schema

### Voters Table
- `id`: Unique identifier
- `name`: Voter name
- `key_code`: 6-letter unique key code
- `created_at`: Timestamp

### Elections Table
- `id`: Unique identifier
- `name`: Election name
- `start_datetime`: When election starts
- `close_datetime`: When election closes
- `status`: pending, active, or closed
- `closed_manually`: Whether closed manually by admin

### Candidates Table
- `id`: Unique identifier
- `election_id`: Reference to election
- `name`: Candidate name

### Votes Table
- `id`: Unique identifier
- `election_id`: Reference to election
- `candidate_id`: Reference to candidate
- `voter_id`: Reference to voter (ensures one vote per voter)
- `voted_at`: Timestamp

## Security Features

- Admin endpoints protected by secret key
- Individual voter key codes prevent unauthorized voting
- Database constraint ensures each voter can only vote once per election
- Sequential elections prevent multiple concurrent elections
- Foreign key constraints ensure data integrity
- Input validation on all endpoints

## Example Complete Workflow

```bash
# 1. Start the server
npm start

# 2. Import voters from file
curl -X POST http://localhost:3000/api/admin/voters/import \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: admin-secret-key" \
  -d '{"filePath": "voters.txt"}'

# Response: {"success": true, "imported": 10, "skipped": 0}

# 3. Create an election
curl -X POST http://localhost:3000/api/admin/elections \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: admin-secret-key" \
  -d '{
    "name": "Favorite Programming Language",
    "startDatetime": "2024-01-15T10:00:00Z",
    "closeDatetime": "2024-01-15T18:00:00Z",
    "candidates": ["JavaScript", "Python", "Rust", "Go"]
  }'

# Response: {"success": true, "electionId": 1, "message": "Election created successfully!"}

# 4. Voters visit http://localhost:3000 and vote using their key codes

# 5. Close election (optional, if before close time)
curl -X POST http://localhost:3000/api/admin/elections/1/close \
  -H "X-Admin-Key: admin-secret-key"

# 6. View results
curl http://localhost:3000/api/results/1
```

## Development

Project structure:
```
local-network-elections/
├── public/
│   └── index.html              # Voting webpage
├── src/
│   ├── database.js             # SQLite database setup
│   ├── electionService.js      # Election business logic
│   └── voterService.js         # Voter management logic
├── server.js                   # Express server
├── voters.txt                  # Example voters file
├── package.json
├── .env                        # Environment variables (create this)
├── .env.example                # Example environment file
├── .gitignore
├── Election_System_API.postman_collection.json
└── README.md
```

## Troubleshooting

**Issue**: Cannot create election
- **Solution**: Ensure no other election is pending or active. Elections are sequential.

**Issue**: Invalid key code
- **Solution**: Key codes are case-insensitive but must be exactly 6 letters. Verify the voter exists in the database.

**Issue**: Already voted error
- **Solution**: Each voter can only vote once per election. This is enforced by database constraints.

**Issue**: Unauthorized error
- **Solution**: Ensure `X-Admin-Key` header matches the value in `.env`

**Issue**: Database errors
- **Solution**: Delete `elections.db` and restart the server to recreate the database with the new schema.

## License

MIT
