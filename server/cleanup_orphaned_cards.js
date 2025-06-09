const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Configuration ---
const baseDir = __dirname; // Assumes script is in server/
const dbPath = path.join(baseDir, 'data', 'database.sqlite');

// <<< List of Card IDs to delete (identified from migration script errors) >>>
const orphanedCardIds = [
  'card-1744509268766-9a9249',
  'card-1744509283023-c1d5af',
  'card-1744509284282-458b2c',
  'card-1744509284786-38a2fd',
  'card-1744509288550-7b185c',
  'card-1744509291502-83bea9',
  'card-1744509292142-152e79',
  'card-1745195536204-f5754d',
  'card-1745195538285-756caf',
  'card-1745195769330-cbfebf',
];
// --- End Configuration ---

console.log('--- Orphaned Card Record Cleanup Script ---');
console.log(
  'IMPORTANT: Ensure you have backed up your database (server/data/database.sqlite) before running this!',
);
console.log('This script should be run while the main application server is STOPPED.');
console.log(
  'This script will attempt to DELETE ' +
    orphanedCardIds.length +
    ' specific card records from the database.',
);
console.log('Script starting in 5 seconds... Press Ctrl+C to cancel.');

// --- Main Cleanup Logic ---
async function cleanupRecords() {
  console.log('\nConnecting to database:', dbPath);
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log('Successfully connected to the SQLite database.');
  });

  let deletedCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  try {
    const deletePromises = orphanedCardIds.map(cardId => deleteCardRecord(db, cardId));
    const results = await Promise.allSettled(deletePromises);

    results.forEach((result, index) => {
      const cardId = orphanedCardIds[index];
      if (result.status === 'fulfilled') {
        if (result.value === true) {
          console.log('  [SUCCESS] Deleted record for card ID: ' + cardId);
          deletedCount++;
        } else {
          // deleteCardRecord resolves false if no rows affected
          console.warn(
            '  [NOT FOUND] Record for card ID ' + cardId + ' not found in DB (already deleted?).',
          );
          notFoundCount++;
        }
      } else {
        console.error(
          '  [ERROR] Failed to process card ID ' + cardId + ':',
          result.reason?.message || result.reason,
        );
        errorCount++;
      }
    });
  } catch (err) {
    console.error('An unexpected error occurred during cleanup:', err);
    errorCount = orphanedCardIds.length - deletedCount - notFoundCount; // Estimate errors if main loop fails
  } finally {
    console.log('\n--- Cleanup Summary ---');
    console.log('Total IDs processed: ' + orphanedCardIds.length);
    console.log('Records successfully deleted: ' + deletedCount);
    console.log('Records not found (already deleted?): ' + notFoundCount);
    console.log('Errors encountered: ' + errorCount);

    db.close(err => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
      console.log('--- Cleanup script finished ---');
    });
  }
}

// Helper to delete a card record
function deleteCardRecord(db, cardId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM cards WHERE id = ?', [cardId], function (err) {
      if (err) {
        reject(new Error('DB delete failed for card ' + cardId + ': ' + err.message));
      } else if (this.changes === 0) {
        resolve(false); // Indicate record was not found / not deleted
      } else {
        resolve(true); // Indicate record was successfully deleted
      }
    });
  });
}

// Delay execution to give user time to cancel
setTimeout(() => {
  cleanupRecords();
}, 5000);

// Handle Ctrl+C for graceful early exit if possible
process.on('SIGINT', () => {
  console.log('\nCleanup cancelled by user. Exiting.');
  // Note: DB connection might not be closed gracefully here
  process.exit(0);
});
