const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// --- Configuration ---
const baseDir = __dirname; // Assumes script is in server/
const dbPath = path.join(baseDir, 'data', 'database.sqlite');
const uploadsDir = path.join(baseDir, 'uploads');
const cardUploadsDir = path.join(uploadsDir, 'cards');
const targetQuality = 80; // WebP quality
const maxWidth = 800; // Max width for resize
// --- End Configuration ---

console.log('--- Existing Card Conversion to WebP Script ---');
console.log(
  'IMPORTANT: Ensure you have backed up your database (server/data/database.sqlite) and your uploads folder (server/uploads/) before running this!',
);
console.log('This script should be run while the main application server is STOPPED.');
console.log(
  'It will attempt to convert non-GIF/non-WebP images in user folders to WebP, update the DB, and delete originals.',
);
console.log('Script starting in 5 seconds... Press Ctrl+C to cancel.');

// --- Main Conversion Logic ---
async function convertExistingCards() {
  console.log('\nConnecting to database:', dbPath);
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log('Successfully connected to the SQLite database.');
  });

  let processedCount = 0;
  let convertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let fileNotFoundCount = 0;

  try {
    const cards = await getAllCards(db);
    if (!cards || cards.length === 0) {
      console.log('No cards found in the database. Nothing to convert.');
      return;
    }
    console.log('Found ' + cards.length + ' card records to check.');

    for (const card of cards) {
      processedCount++;
      // console.log("\nChecking card ID: " + card.id + ", User ID: " + card.userId + ", Path: " + card.imagePath);

      // Basic validation
      if (!card.imagePath || !card.fileName || !card.userId) {
        // console.warn("  [SKIPPING] Missing data for card ID: " + card.id);
        skippedCount++;
        continue;
      }

      // Only process cards within user folders
      const userFolderPattern = /\/uploads\/cards\/user_\d+\//; // Check for /uploads/cards/user_ID/
      if (!userFolderPattern.test(card.imagePath)) {
        // console.log("  [SKIPPING] Not in a user folder: " + card.imagePath);
        skippedCount++;
        continue;
      }

      const fileExtension = path.extname(card.fileName).toLowerCase();

      // Skip already WebP or GIFs
      if (fileExtension === '.webp' || fileExtension === '.gif') {
        // console.log("  [SKIPPING] Already WebP or GIF: " + card.fileName);
        skippedCount++;
        continue;
      }

      console.log(
        '\nProcessing card ID: ' +
          card.id +
          ', User ID: ' +
          card.userId +
          ', File: ' +
          card.fileName,
      );

      // Construct paths
      const currentRelativePath = card.imagePath.substring('/uploads/'.length);
      const currentAbsolutePath = path.join(uploadsDir, currentRelativePath);

      const baseName = path.basename(card.fileName, fileExtension);
      const newFileName = baseName + '.webp';
      const newUserDir = path.join(cardUploadsDir, 'user_' + card.userId);
      const newAbsolutePath = path.join(newUserDir, newFileName);
      const newDbImagePath = '/uploads/cards/user_' + card.userId + '/' + newFileName;

      // Check if source file exists
      if (!fs.existsSync(currentAbsolutePath)) {
        console.error(
          '  [ERROR] Source file not found: ' +
            currentAbsolutePath +
            ' for card ' +
            card.id +
            '. Skipping.',
        );
        fileNotFoundCount++;
        errorCount++;
        continue;
      }

      try {
        // Read original file
        const inputBuffer = fs.readFileSync(currentAbsolutePath);

        // Convert using Sharp
        console.log('  Converting ' + card.fileName + ' to WebP...');
        const outputBuffer = await sharp(inputBuffer)
          .resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: targetQuality })
          .toBuffer();

        // Write new WebP file
        fs.writeFileSync(newAbsolutePath, outputBuffer);
        console.log('  Saved new file: ' + newAbsolutePath);

        // Update database
        await updateCardRecord(db, card.id, newDbImagePath, newFileName);
        console.log('  Updated DB record for card ' + card.id);

        // Delete original file
        fs.unlinkSync(currentAbsolutePath);
        console.log('  Deleted original file: ' + currentAbsolutePath);
        convertedCount++;
      } catch (conversionOrDbError) {
        console.error(
          '  [ERROR] Failed to process card ' + card.id + ' (' + card.fileName + '):',
          conversionOrDbError.message,
        );
        errorCount++;
        // Cleanup potentially created .webp file if DB update or original delete failed?
        if (fs.existsSync(newAbsolutePath)) {
          try {
            fs.unlinkSync(newAbsolutePath);
            console.warn('    Cleaned up partially converted file: ' + newAbsolutePath);
          } catch (e) {
            /* ignore */
          }
        }
      }
    }
  } catch (err) {
    console.error('An unexpected error occurred during conversion:', err);
  } finally {
    console.log('\n--- Conversion Summary ---');
    console.log('Total records checked: ' + processedCount);
    console.log('Files successfully converted & DB updated: ' + convertedCount);
    console.log('Files skipped (WebP, GIF, not in user folder, bad data): ' + skippedCount);
    console.log('Source files not found: ' + fileNotFoundCount);
    console.log('Other errors encountered: ' + (errorCount - fileNotFoundCount));

    db.close(err => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
      console.log('--- Conversion script finished ---');
    });
  }
}

// Helper to get all cards
function getAllCards(db) {
  return new Promise((resolve, reject) => {
    // Select all relevant fields
    db.all('SELECT id, userId, imagePath, fileName FROM cards', [], (err, rows) => {
      if (err) {
        reject(new Error('Failed to fetch cards: ' + err.message));
      } else {
        resolve(rows);
      }
    });
  });
}

// Helper to update card path and filename
function updateCardRecord(db, cardId, newPath, newName) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE cards SET imagePath = ?, fileName = ? WHERE id = ?',
      [newPath, newName, cardId],
      function (err) {
        if (err) {
          reject(new Error('DB update failed for card ' + cardId + ': ' + err.message));
        } else if (this.changes === 0) {
          reject(
            new Error(
              'DB update failed for card ' + cardId + ': No rows affected (card not found?).',
            ),
          );
        } else {
          resolve();
        }
      },
    );
  });
}

// Delay execution to give user time to cancel
setTimeout(() => {
  convertExistingCards();
}, 5000);

// Handle Ctrl+C for graceful early exit if possible
process.on('SIGINT', () => {
  console.log('\nConversion cancelled by user. Exiting.');
  // Note: DB connection might not be closed gracefully here
  process.exit(0);
});
