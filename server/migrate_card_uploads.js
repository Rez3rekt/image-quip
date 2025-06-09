const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// --- Configuration ---
const baseDir = __dirname; // Assumes script is in server/
const dbPath = path.join(baseDir, 'data', 'database.sqlite');
const uploadsDir = path.join(baseDir, 'uploads');
const cardUploadsDir = path.join(uploadsDir, 'cards');

console.log('--- Card Upload Migration Script ---');
console.log(
  'IMPORTANT: Ensure you have backed up your database (server/data/database.sqlite) and your uploads folder (server/uploads/cards) before running this!',
);
console.log('This script should be run while the main application server is STOPPED.');
console.log('Script starting in 5 seconds... Press Ctrl+C to cancel.');

// --- Main Migration Logic ---
async function migrateUploads() {
  console.log('\nConnecting to database:', dbPath);
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log('Successfully connected to the SQLite database.');
  });

  try {
    const cards = await getAllCards(db);
    if (!cards || cards.length === 0) {
      console.log('No cards found in the database. Nothing to migrate.');
      return;
    }
    console.log('Found ' + cards.length + ' card records to process.');

    let processedCount = 0;
    let movedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const card of cards) {
      processedCount++;
      console.log(
        '\nProcessing card ID: ' +
          card.id +
          ', User ID: ' +
          card.userId +
          ', Current Path: ' +
          card.imagePath,
      );

      if (!card.imagePath || !card.fileName) {
        console.warn(
          '  [SKIPPING] Card ' +
            card.id +
            ' is missing imagePath or fileName. Old Path: ' +
            card.imagePath +
            ', FileName: ' +
            card.fileName,
        );
        skippedCount++;
        continue;
      }

      // Check if already migrated (simple check)
      if (card.imagePath.includes('/user_' + card.userId + '/')) {
        console.log(
          '  [SKIPPED] Card ' + card.id + ' appears to be already migrated. Path: ' + card.imagePath,
        );
        skippedCount++;
        continue;
      }

      // Expecting old imagePath to be like /uploads/cards/somefile.webp
      // and fileName to be somefile.webp
      const expectedOldPrefix = '/uploads/cards/';
      if (!card.imagePath.startsWith(expectedOldPrefix)) {
        console.warn(
          '  [SKIPPING] Card ' + card.id + ' has an unexpected imagePath format: ' + card.imagePath,
        );
        skippedCount++;
        continue;
      }

      // Ensure fileName matches the end of imagePath for safety
      if (path.basename(card.imagePath) !== card.fileName) {
        console.warn(
          '  [SKIPPING] Card ' +
            card.id +
            ': fileName (' +
            card.fileName +
            ') does not match basename of imagePath (' +
            card.imagePath +
            '). Manual review needed.',
        );
        skippedCount++;
        continue;
      }

      const currentAbsolutePath = path.join(cardUploadsDir, card.fileName);
      const newUserDir = path.join(cardUploadsDir, 'user_' + card.userId);
      const newAbsolutePath = path.join(newUserDir, card.fileName);
      const newDbImagePath = '/uploads/cards/user_' + card.userId + '/' + card.fileName;

      if (!fs.existsSync(currentAbsolutePath)) {
        console.error(
          '  [ERROR] Source file not found: ' +
            currentAbsolutePath +
            ' for card ' +
            card.id +
            '. Skipping.',
        );
        errorCount++;
        continue;
      }

      try {
        // Create user-specific directory if it doesn't exist
        if (!fs.existsSync(newUserDir)) {
          fs.mkdirSync(newUserDir, { recursive: true });
          console.log('  Created directory: ' + newUserDir);
        }

        // Move the file
        fs.renameSync(currentAbsolutePath, newAbsolutePath);
        console.log('  Moved: ' + currentAbsolutePath + ' -> ' + newAbsolutePath);

        // Update database
        await updateCardPath(db, card.id, newDbImagePath);
        console.log('  Updated DB for card ' + card.id + ' to path: ' + newDbImagePath);
        movedCount++;
      } catch (moveOrDbError) {
        console.error('  [ERROR] Failed to process card ' + card.id + ':', moveOrDbError.message);
        errorCount++;
        // If move succeeded but DB update failed, this is problematic.
        // Manual intervention might be needed. For now, just log.
        // A more robust script might try to move it back or keep a failed updates log.
      }
    }

    console.log('\n--- Migration Summary ---');
    console.log('Total records processed: ' + processedCount);
    console.log('Files successfully moved & DB updated: ' + movedCount);
    console.log('Records skipped (already migrated or invalid data): ' + skippedCount);
    console.log('Errors encountered: ' + errorCount);
    if (errorCount > 0) {
      console.warn(
        'Please review errors above. Manual intervention may be required for some files/records.',
      );
    }
  } catch (err) {
    console.error('An unexpected error occurred during migration:', err);
  } finally {
    db.close(err => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
      console.log('--- Migration script finished ---');
    });
  }
}

// Helper to get all cards
function getAllCards(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, userId, imagePath, fileName FROM cards', [], (err, rows) => {
      if (err) {
        reject(new Error('Failed to fetch cards: ' + err.message));
      } else {
        resolve(rows);
      }
    });
  });
}

// Helper to update card path
function updateCardPath(db, cardId, newPath) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE cards SET imagePath = ? WHERE id = ?', [newPath, cardId], function (err) {
      if (err) {
        reject(new Error('DB update failed for card ' + cardId + ': ' + err.message));
      } else if (this.changes === 0) {
        reject(
          new Error('DB update failed for card ' + cardId + ': No rows affected (card not found?).'),
        );
      } else {
        resolve();
      }
    });
  });
}

// Delay execution to give user time to cancel
setTimeout(() => {
  migrateUploads();
}, 5000);

// Handle Ctrl+C for graceful early exit if possible
process.on('SIGINT', () => {
  console.log('\nMigration cancelled by user. Exiting.');
  // Note: DB connection might not be closed gracefully here if migration hasn't started/finished try/finally block
  process.exit(0);
});
