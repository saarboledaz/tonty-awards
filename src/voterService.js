const db = require('./database');
const fs = require('fs');
const path = require('path');

class VoterService {
  // Import voters from a text file
  static importVotersFromFile(filePath) {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(__dirname, '..', filePath);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }

      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      const insertVoter = db.prepare(`
        INSERT OR IGNORE INTO voters (name, key_code)
        VALUES (?, ?)
      `);

      const transaction = db.transaction((lines) => {
        let imported = 0;
        let skipped = 0;

        for (const line of lines) {
          const [name, keyCode] = line.split(',').map(s => s.trim());

          if (!name || !keyCode) {
            console.warn(`Skipping invalid line: ${line}`);
            skipped++;
            continue;
          }

          if (keyCode.length !== 6 || !/^[A-Z0-9]+$/i.test(keyCode)) {
            console.warn(`Skipping invalid key code for ${name}: ${keyCode}`);
            skipped++;
            continue;
          }

          const result = insertVoter.run(name, keyCode.toUpperCase());
          if (result.changes > 0) {
            imported++;
          } else {
            skipped++;
          }
        }

        return { imported, skipped };
      });

      return transaction(lines);
    } catch (error) {
      throw new Error(`Failed to import voters: ${error.message}`);
    }
  }

  // Add a single voter
  static addVoter(name, keyCode) {
    if (!name || !keyCode) {
      throw new Error('Name and key code are required');
    }

    if (keyCode.length !== 6 || !/^[A-Z0-9]+$/i.test(keyCode)) {
      throw new Error('Key code must be exactly 6 alphanumeric characters');
    }

    try {
      const result = db.prepare(`
        INSERT INTO voters (name, key_code)
        VALUES (?, ?)
      `).run(name, keyCode.toUpperCase());

      return {
        id: result.lastInsertRowid,
        name,
        keyCode: keyCode.toUpperCase()
      };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('Key code already exists');
      }
      throw error;
    }
  }

  // Get voter by key code
  static getVoterByKeyCode(keyCode) {
    return db.prepare(`
      SELECT id, name, key_code
      FROM voters
      WHERE key_code = ?
    `).get(keyCode.toUpperCase());
  }

  // Get all voters
  static getAllVoters() {
    return db.prepare(`
      SELECT id, name, key_code, created_at
      FROM voters
      ORDER BY name
    `).all();
  }

  // Delete voter
  static deleteVoter(voterId) {
    const result = db.prepare(`
      DELETE FROM voters
      WHERE id = ?
    `).run(voterId);

    if (result.changes === 0) {
      throw new Error('Voter not found');
    }

    return { success: true };
  }

  // Check if voter has voted in an election
  static hasVoted(voterId, electionId) {
    const vote = db.prepare(`
      SELECT id FROM votes
      WHERE voter_id = ? AND election_id = ?
    `).get(voterId, electionId);

    return !!vote;
  }

  // Clear all voters
  static clearAllVoters() {
    const result = db.prepare(`DELETE FROM voters`).run();
    return { deleted: result.changes };
  }

  // Generate a random 6-letter key code
  static generateKeyCode() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    // Check if code already exists, regenerate if needed
    const exists = this.getVoterByKeyCode(code);
    if (exists) {
      return this.generateKeyCode();
    }

    return code;
  }
}

module.exports = VoterService;
