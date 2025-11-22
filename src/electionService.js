const db = require('./database');
const VoterService = require('./voterService');

class ElectionService {

  // Update election statuses based on current time
  static updateElectionStatuses() {
    const now = new Date().toISOString();

    // Set elections to active if start time has passed
    db.prepare(`
      UPDATE elections
      SET status = 'active'
      WHERE status = 'pending'
      AND start_datetime <= ?
    `).run(now);

    // Set elections to closed if close time has passed
    db.prepare(`
      UPDATE elections
      SET status = 'closed'
      WHERE status = 'active'
      AND close_datetime <= ?
    `).run(now);
  }

  // Create a new election
  static createElection(name, startDatetime, closeDatetime, candidates) {
    // Check if there's already an active or pending election
    const existingElection = db.prepare(`
      SELECT id FROM elections
      WHERE status IN ('pending', 'active')
    `).get();

    if (existingElection) {
      throw new Error('Cannot create election: another election is pending or active');
    }

    const status = new Date(startDatetime) <= new Date() ? 'active' : 'pending';

    const insertElection = db.prepare(`
      INSERT INTO elections (name, start_datetime, close_datetime, status)
      VALUES (?, ?, ?, ?)
    `);

    const insertCandidate = db.prepare(`
      INSERT INTO candidates (election_id, name)
      VALUES (?, ?)
    `);

    const transaction = db.transaction((name, startDatetime, closeDatetime, status, candidates) => {
      const result = insertElection.run(name, startDatetime, closeDatetime, status);
      const electionId = result.lastInsertRowid;

      for (const candidate of candidates) {
        insertCandidate.run(electionId, candidate);
      }

      return { electionId };
    });

    return transaction(name, startDatetime, closeDatetime, status, candidates);
  }

  // Get current active election
  static getCurrentElection() {
    this.updateElectionStatuses();

    const election = db.prepare(`
      SELECT id, name, start_datetime, close_datetime, status, closed_manually
      FROM elections
      WHERE status = 'active'
      ORDER BY id DESC
      LIMIT 1
    `).get();

    if (!election) {
      return null;
    }

    const candidates = db.prepare(`
      SELECT id, name
      FROM candidates
      WHERE election_id = ?
      ORDER BY id
    `).all(election.id);

    return {
      ...election,
      candidates
    };
  }

  // Get election by ID
  static getElectionById(electionId) {
    const election = db.prepare(`
      SELECT id, name, start_datetime, close_datetime, status, closed_manually
      FROM elections
      WHERE id = ?
    `).get(electionId);

    if (!election) {
      return null;
    }

    const candidates = db.prepare(`
      SELECT id, name
      FROM candidates
      WHERE election_id = ?
      ORDER BY id
    `).all(election.id);

    return {
      ...election,
      candidates
    };
  }

  // Cast a vote
  static castVote(keyCode, candidateId) {
    this.updateElectionStatuses();

    // Get active election
    const election = db.prepare(`
      SELECT id, status
      FROM elections
      WHERE status = 'active'
      ORDER BY id DESC
      LIMIT 1
    `).get();

    if (!election) {
      throw new Error('No active election');
    }

    // Validate voter by key code
    const voter = VoterService.getVoterByKeyCode(keyCode);
    if (!voter) {
      throw new Error('Invalid key code');
    }

    // Check if voter has already voted in this election
    if (VoterService.hasVoted(voter.id, election.id)) {
      throw new Error('You have already voted in this election');
    }

    // Validate candidate
    const candidate = db.prepare(`
      SELECT id, election_id
      FROM candidates
      WHERE id = ? AND election_id = ?
    `).get(candidateId, election.id);

    if (!candidate) {
      throw new Error('Invalid candidate');
    }

    // Insert vote
    db.prepare(`
      INSERT INTO votes (election_id, candidate_id, voter_id)
      VALUES (?, ?, ?)
    `).run(election.id, candidateId, voter.id);

    return {
      success: true,
      voterName: voter.name
    };
  }

  // Close election manually
  static closeElection(electionId) {
    const result = db.prepare(`
      UPDATE elections
      SET status = 'closed', closed_manually = 1
      WHERE id = ? AND status = 'active'
    `).run(electionId);

    if (result.changes === 0) {
      throw new Error('Election not found or not active');
    }

    return { success: true };
  }

  // Get election results
  static getElectionResults(electionId) {
    const election = db.prepare(`
      SELECT id, name, start_datetime, close_datetime, status, closed_manually
      FROM elections
      WHERE id = ?
    `).get(electionId);

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'closed') {
      throw new Error('Election is not closed yet');
    }

    const results = db.prepare(`
      SELECT
        c.id,
        c.name,
        COUNT(v.id) as vote_count
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      WHERE c.election_id = ?
      GROUP BY c.id, c.name
      ORDER BY vote_count DESC, c.name
    `).all(electionId);

    const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);
    const winner = results[0];

    return {
      election,
      results,
      totalVotes,
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        votes: winner.vote_count
      } : null
    };
  }

  // Get all elections
  static getAllElections() {
    this.updateElectionStatuses();

    return db.prepare(`
      SELECT id, name, start_datetime, close_datetime, status, closed_manually, created_at
      FROM elections
      ORDER BY id DESC
    `).all();
  }

  // Get latest closed election
  static getLatestClosedElection() {
    this.updateElectionStatuses();

    const election = db.prepare(`
      SELECT id
      FROM elections
      WHERE status = 'closed'
      ORDER BY id DESC
      LIMIT 1
    `).get();

    if (!election) {
      return null;
    }

    return this.getElectionResults(election.id);
  }

  // Get detailed election results with voter information (admin only)
  static getDetailedElectionResults(electionId) {
    const election = db.prepare(`
      SELECT id, name, start_datetime, close_datetime, status, closed_manually
      FROM elections
      WHERE id = ?
    `).get(electionId);

    if (!election) {
      throw new Error('Election not found');
    }

    if (election.status !== 'closed') {
      throw new Error('Election is not closed yet');
    }

    // Get vote summary by candidate
    const results = db.prepare(`
      SELECT
        c.id,
        c.name,
        COUNT(v.id) as vote_count
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      WHERE c.election_id = ?
      GROUP BY c.id, c.name
      ORDER BY vote_count DESC, c.name
    `).all(electionId);

    // Get detailed vote information with voter names
    const detailedVotes = db.prepare(`
      SELECT
        v.id as vote_id,
        v.voted_at,
        c.id as candidate_id,
        c.name as candidate_name,
        vo.id as voter_id,
        vo.name as voter_name,
        vo.key_code
      FROM votes v
      JOIN candidates c ON v.candidate_id = c.id
      JOIN voters vo ON v.voter_id = vo.id
      WHERE v.election_id = ?
      ORDER BY v.voted_at DESC
    `).all(electionId);

    // Get votes grouped by candidate
    const votesByCandidate = db.prepare(`
      SELECT
        c.id as candidate_id,
        c.name as candidate_name,
        vo.id as voter_id,
        vo.name as voter_name,
        vo.key_code,
        v.voted_at
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      LEFT JOIN voters vo ON v.voter_id = vo.id
      WHERE c.election_id = ?
      ORDER BY c.name, v.voted_at
    `).all(electionId);

    // Group votes by candidate
    const candidateVotes = {};
    votesByCandidate.forEach(row => {
      if (!candidateVotes[row.candidate_id]) {
        candidateVotes[row.candidate_id] = {
          candidateId: row.candidate_id,
          candidateName: row.candidate_name,
          votes: []
        };
      }
      if (row.voter_id) {
        candidateVotes[row.candidate_id].votes.push({
          voterId: row.voter_id,
          voterName: row.voter_name,
          keyCode: row.key_code,
          votedAt: row.voted_at
        });
      }
    });

    const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);
    const winner = results[0];

    return {
      election,
      results,
      totalVotes,
      winner: winner && winner.vote_count > 0 ? {
        id: winner.id,
        name: winner.name,
        votes: winner.vote_count
      } : null,
      detailedVotes,
      votesByCandidate: Object.values(candidateVotes)
    };
  }
}

module.exports = ElectionService;
