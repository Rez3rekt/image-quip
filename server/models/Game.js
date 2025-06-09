// server/models/Game.js
const shuffleArray = array => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

class Player {
  constructor(id, nickname, icon = '😀', isHost = false) {
    this.id = id;
    this.nickname = nickname;
    this.icon = icon;
    this.isHost = isHost;
    this.score = 0;
    this.hand = []; // Player's selected cards for the game
    // this.uploadedImages = []; // Removed
    // --- Refactor #2: Two Prompts Per Player ---
    this.myAssignedPrompts = []; // Array of { promptText: string, isPlayer1: boolean }
    this.promptsAnswered = new Set(); // Set of promptText strings answered by this player
    // --- End Refactor #2 ---
    this.hasVoted = false;
    this.hasConfirmedCards = false; // New state for card selection phase
    // this.hasUploaded = false; // Removed
    this.fullDeck = []; // All cards selected by the player for this game
    this.drawPile = []; // Cards remaining to be drawn
    this.discardPile = []; // Cards already played
    this.isConnected = true; // Added isConnected flag
    this.lobbyAddedPrompts = []; // <-- Add player-specific list
    this.votesCast = new Map(); // <<< Initialize votesCast
    this.isDisplayPlayer = false; // <<< ADDED: Flag for display-only role
  }
  removeImageFromHand(imagePath) {
    const index = this.hand.indexOf(imagePath);
    if (index > -1) {
      this.hand.splice(index, 1);
      return true;
    }
    return false;
  }
  // --- Add helper to get only *active* players (connected and not display) ---
  // MOVED TO Game class
  // --- End helper ---
}

class Game {
  constructor(gameId, hostId, hostNickname, hostIcon, promptsList, settings = {}, db) {
    this.gameId = gameId;
    this.hostId = hostId;
    this.players = new Map();
    this.phase = 'lobby';
    this.prompts = promptsList || [];
    this.usedCustomLobbyPrompts = new Set();
    this.votingQueue = [];
    this.currentVoteCounts = new Map();
    this.currentVotingPromptIndex = -1;
    this.db = db;

    // <<< Game Settings (Using promptsPerPlayer) >>>
    const promptsPerPlayer = settings.promptsPerPlayer ?? 3; // Determine prompts first
    this.settings = {
      promptsPerPlayer: promptsPerPlayer, // Use the determined value
      pointsPerVote: settings.pointsPerVote ?? 100,
      allowMidGameJoin: settings.allowMidGameJoin !== undefined ? settings.allowMidGameJoin : true,
      handSize: settings.handSize ?? 5, // Default hand size of 5
      gameMode: settings.gameMode ?? 'Classic',
    };
    // this.currentRound = 1; // <<< REMOVE currentRound - Already removed
    // <<< End Game Settings >>>

    this.addPlayer(hostId, hostNickname, hostIcon, true);
    this.sharedDrawPile = [];
    this.sharedDiscardPile = [];
  }

  // --- Add helper to get only *active* players (connected and not display) ---
  _getActivePlayersArray() {
    return Array.from(this.players.values()).filter(p => p.isConnected && !p.isDisplayPlayer);
  }
  // --- End helper ---

  addPlayer(playerId, nickname, icon, isHost = false) {
    if (!this.players.has(playerId)) {
      const player = new Player(playerId, nickname, icon, isHost);
      this.players.set(playerId, player);
      return player;
    }
    return null;
  }
  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getPlayerById(playerId) {
    return this.players.get(playerId);
  }

  disconnectPlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isConnected = false;
      const connectedPlayers = Array.from(this.players.values()).filter(p => p.isConnected);
      if (connectedPlayers.length < 2 && this.phase !== 'lobby') {
        this.phase = 'final_results';
        return true;
      }
      return true;
    } else {
      console.log(`Attempted to disconnect non-existent player: ${playerId}`);
      return false;
    }
  }

  // --- REVISED Method to add a prompt for a specific player ---
  addLobbyPromptForPlayer(playerId, promptText) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, message: 'Player not found.' };
    }
    if (typeof promptText !== 'string' || promptText.trim().length === 0) {
      return { success: false, message: 'Prompt cannot be empty.' };
    }
    const trimmedPrompt = promptText.trim();
    if (trimmedPrompt.length > 150) {
      return { success: false, message: 'Prompt too long (max 150 chars).' };
    }

    const globalPrompts = [...this.prompts];
    this.players.forEach(p => globalPrompts.push(...p.lobbyAddedPrompts));
    if (globalPrompts.some(p => p.toLowerCase() === trimmedPrompt.toLowerCase())) {
      return { success: false, message: 'Prompt already exists in game or your list.' };
    }

    player.lobbyAddedPrompts.push(trimmedPrompt);
    return { success: true };
  }
  // --- END REVISED Method ---

  // --- NEW Method to delete a prompt for a specific player ---
  deleteLobbyPromptForPlayer(playerId, promptIndex) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, message: 'Player not found.' };
    }

    if (
      typeof promptIndex !== 'number' ||
      promptIndex < 0 ||
      promptIndex >= player.lobbyAddedPrompts.length
    ) {
      console.warn(
        `[deleteLobbyPromptForPlayer] Invalid index ${promptIndex} for player ${playerId} (List size: ${player.lobbyAddedPrompts.length})`,
      );
      return { success: false, message: 'Invalid prompt index.' };
    }

    const _deletedPrompt = player.lobbyAddedPrompts.splice(promptIndex, 1)[0];
    return { success: true };
  }
  // --- END NEW Method ---

  // <<< Replace entire startPromptPhase function >>>
  startPromptPhase() {
    const activePlayers = this._getActivePlayersArray();
    const numActivePlayers = activePlayers.length;

    if (numActivePlayers < 1) {
      console.error('[startPromptPhase] Cannot start prompt phase with < 1 active players.');
      return false;
    }

    // Reset Phase-Specific State (for ALL players, including display)
    this.players.forEach(player => {
      player.myAssignedPrompts = [];
      player.promptsAnswered.clear();
      player.hasVoted = false;
      player.votesCast.clear();
    });
    this.currentVotingPromptIndex = -1;
    this.votingQueue = [];

    const promptsPerPlayer = this.settings.promptsPerPlayer;
    const totalAnswers = numActivePlayers * promptsPerPlayer;

    // Sanity Check for Pairing
    if (totalAnswers % 2 !== 0) {
      console.error(
        `[startPromptPhase] CRITICAL: Pairing check failed! Total answers (${totalAnswers}) is odd. (Players: ${numActivePlayers}, PromptsPer: ${promptsPerPlayer}). This should have been caught in lobby handlers.`,
      );
      this.phase = 'ended';
      return false;
    }

    // MODE-SPECIFIC PROMPT ASSIGNMENT
    if (this.settings.gameMode === 'Flip the Script') {
      // Collect all selected card paths from ACTIVE players
      const allSelectedCardPaths = [];
      activePlayers.forEach(player => {
        if (Array.isArray(player.drawPile)) {
          allSelectedCardPaths.push(...player.drawPile);
        } else {
          console.warn(
            `[startPromptPhase FTS] Player ${player.nickname} has no drawPile to contribute prompts from.`,
          );
        }
      });

      const uniqueImagePromptsNeeded = totalAnswers / 2;
      const uniqueAvailableImagePrompts = [...new Set(allSelectedCardPaths)];

      if (uniqueAvailableImagePrompts.length < uniqueImagePromptsNeeded) {
        console.error(
          `[startPromptPhase FTS] Not enough unique cards (${uniqueAvailableImagePrompts.length}) selected by players to use as prompts (needed ${uniqueImagePromptsNeeded}).`,
        );
        this.phase = 'ended';
        return false;
      }

      // Select unique image prompts
      const selectedUniqueImagePrompts = shuffleArray(uniqueAvailableImagePrompts).slice(
        0,
        uniqueImagePromptsNeeded,
      );

      // Assign image prompts to ACTIVE players
      const playerIds = shuffleArray(activePlayers.map(p => p.id));
      const playerAssignmentCounts = new Map(playerIds.map(id => [id, 0]));
      let currentPlayerIndex = 0;
      this.players.forEach(player => (player.myAssignedPrompts = []));

      selectedUniqueImagePrompts.forEach(imagePath => {
        let assignedCount = 0;
        let loopGuard = 0;
        while (assignedCount < 2 && loopGuard < numActivePlayers * 2) {
          const targetPlayerId = playerIds[currentPlayerIndex % numActivePlayers];
          const targetPlayer = this.players.get(targetPlayerId);
          const currentCount = playerAssignmentCounts.get(targetPlayerId);

          if (targetPlayer && currentCount < promptsPerPlayer) {
            targetPlayer.myAssignedPrompts.push({
              promptText: imagePath,
              submittedAnswer: null,
              submissionType: 'text',
            });
            playerAssignmentCounts.set(targetPlayerId, currentCount + 1);
            assignedCount++;
          }
          currentPlayerIndex++;
          loopGuard++;
        }
        if (assignedCount < 2) {
          throw new Error(`[FTS] Failed to assign image prompt pair ${imagePath} correctly.`);
        }
      });
    } else {
      // CLASSIC / MEGA DECK PROMPT ASSIGNMENT
      console.log('[startPromptPhase] Classic/Mega Mode Detected - Selecting Text Prompts.');
      // --- Prompt Selection (Prioritize Custom) ---
      // 1. Gather available unused custom prompts
      const lobbyPromptsSet = new Set();
      activePlayers.forEach(p => {
        p.lobbyAddedPrompts.forEach(prompt => lobbyPromptsSet.add(prompt));
      });
      const availableCustomPrompts = [...lobbyPromptsSet].filter(
        promptText => !this.usedCustomLobbyPrompts.has(promptText),
      );
      shuffleArray(availableCustomPrompts);
      console.log(
        `[startPromptPhase] Found ${availableCustomPrompts.length} available unused custom prompts.`,
      );

      // 2. Gather available predefined prompts
      const availablePredefinedPrompts = shuffleArray([...this.prompts]);

      // 3. Determine needed prompts
      const uniquePromptsNeeded = totalAnswers / 2;
      console.log(`[startPromptPhase] Need ${uniquePromptsNeeded} unique prompts for pairing.`);

      // 4. Select prompts, prioritizing custom
      let selectedUniquePrompts = [];

      // Take as many custom prompts as needed/available
      const customPromptsToTake = Math.min(uniquePromptsNeeded, availableCustomPrompts.length);
      if (customPromptsToTake > 0) {
        selectedUniquePrompts = availableCustomPrompts.slice(0, customPromptsToTake);
        console.log(`[startPromptPhase] Taking ${customPromptsToTake} custom prompts.`);
      }

      // Fill the rest with predefined prompts
      const remainingPromptsNeeded = uniquePromptsNeeded - selectedUniquePrompts.length;
      if (remainingPromptsNeeded > 0) {
        console.log(
          `[startPromptPhase] Needing ${remainingPromptsNeeded} more prompts from predefined list.`,
        );
        // Ensure we don't accidentally re-add a custom prompt if it was also in predefined
        const predefinedToAdd = availablePredefinedPrompts
          .filter(
            p => !selectedUniquePrompts.includes(p), // Avoid duplicates if somehow overlapping
          )
          .slice(0, remainingPromptsNeeded);

        selectedUniquePrompts.push(...predefinedToAdd);
        console.log(`[startPromptPhase] Added ${predefinedToAdd.length} predefined prompts.`);
      }

      // 5. Final Check & Error Handling
      if (selectedUniquePrompts.length < uniquePromptsNeeded) {
        console.error(
          `[startPromptPhase] CRITICAL: Could not gather enough unique prompts! Needed ${uniquePromptsNeeded}, got ${selectedUniquePrompts.length}.`,
        );
        this.phase = 'ended';
        return false;
      }
      console.log(
        `[startPromptPhase] Final selected unique prompts count: ${selectedUniquePrompts.length}.`,
      );

      // 6. Record usage of selected CUSTOM prompts AND REMOVE from player lists
      selectedUniquePrompts.forEach(promptText => {
        if (lobbyPromptsSet.has(promptText)) {
          // Check if it was from the original custom set
          this.usedCustomLobbyPrompts.add(promptText); // Mark as used for this game instance

          // <<< NEW: Remove from all players' lobby lists >>>
          this.players.forEach(player => {
            const indexToRemove = player.lobbyAddedPrompts.indexOf(promptText);
            if (indexToRemove > -1) {
              player.lobbyAddedPrompts.splice(indexToRemove, 1);
              console.log(
                `[startPromptPhase] Removed used custom prompt "${promptText}" from player ${player.nickname}'s lobby list.`,
              );
            }
          });
          // <<< End NEW >>>
        }
      });
      console.log(
        `[startPromptPhase] Recorded usage for ${this.usedCustomLobbyPrompts.size} unique custom prompts this game.`,
      );
      // --- End Prompt Selection ---

      // --- NEW Assignment Logic (for Classic/Mega) ---
      const playerIds = shuffleArray(activePlayers.map(p => p.id)); // Use active player IDs
      const playerAssignmentCounts = new Map(playerIds.map(id => [id, 0]));
      let currentPlayerIndex = 0;
      this.players.forEach(player => (player.myAssignedPrompts = []));

      console.log('[startPromptPhase] Starting new assignment loop...');
      selectedUniquePrompts.forEach(promptText => {
        let assignedCount = 0;
        let loopGuard = 0;
        while (assignedCount < 2 && loopGuard < numActivePlayers * 2) {
          const targetPlayerId = playerIds[currentPlayerIndex % numActivePlayers];
          const targetPlayer = this.players.get(targetPlayerId);
          const currentCount = playerAssignmentCounts.get(targetPlayerId);

          if (targetPlayer && currentCount < promptsPerPlayer) {
            // Assign the prompt
            targetPlayer.myAssignedPrompts.push({
              promptText: promptText,
              submittedAnswer: null,
              submissionType: null,
            }); // Add placeholder for answer
            playerAssignmentCounts.set(targetPlayerId, currentCount + 1);
            assignedCount++;
            console.log(
              ` -> Assigned prompt "${promptText}" to ${targetPlayer.nickname} (${currentCount + 1}/${promptsPerPlayer})`,
            );
          }
          currentPlayerIndex++;
          loopGuard++;
        }
        if (assignedCount < 2) {
          console.error(
            `[startPromptPhase] CRITICAL ERROR: Could not assign prompt "${promptText}" twice. LoopGuard: ${loopGuard}, AssignedCount: ${assignedCount}`,
          );
          // Handle error - maybe end game?
          this.phase = 'ended';
          // Return false inside the loop doesn't work, maybe throw error or set flag
          throw new Error('Failed to assign prompt pair correctly.');
        }
      });
      console.log('[startPromptPhase] Finished new assignment loop.');
      // --- End NEW Assignment Logic ---

      // --- Final Check and Log ---
      console.log('[startPromptPhase] Final assignment counts per player:');
      this.players.forEach(p =>
        console.log(`  ${p.nickname}: ${p.myAssignedPrompts.length} prompts.`),
      );
      // Verify counts
      let assignmentError = false;
      this._getActivePlayersArray().forEach(p => {
        if (p.myAssignedPrompts.length !== promptsPerPlayer) {
          console.error(
            `  -> ERROR: ${p.nickname} has ${p.myAssignedPrompts.length} prompts, expected ${promptsPerPlayer}`,
          );
          assignmentError = true;
        }
      });
      if (assignmentError) {
        console.error('[startPromptPhase] Assignment count verification failed!');
        this.phase = 'ended';
        return false; // Exit if counts are wrong
      }
      // --- End Final Check ---
    }
    // ================================================
    // <<< END MODE-SPECIFIC PROMPT ASSIGNMENT >>>
    // ================================================

    // --- Deal initial hands (Classic Mode Only - Should NOT run for FTS) ---
    if (this.settings.gameMode === 'Classic') {
      console.log(
        '[startPromptPhase] Game mode is Classic, dealing initial hands from draw piles.',
      );
      activePlayers.forEach(player => {
        if (Array.isArray(player.drawPile)) {
          this._drawCardsForPlayer(player.id, this.settings.handSize);
        } else {
          console.warn(
            `[startPromptPhase] Player ${player.id} has no draw pile to deal hand from.`,
          );
          player.hand = [];
        }
      });
    } else if (this.settings.gameMode === 'Mega Deck') {
      // Hands for Mega Deck are dealt in processAllCardSelections
      console.log(
        `[startPromptPhase] Game mode is ${this.settings.gameMode}, hands dealt previously.`,
      );
    } else {
      // Flip the Script - No hand dealing needed here
      console.log(
        `[startPromptPhase] Game mode is ${this.settings.gameMode}, no hand dealing in this phase.`,
      );
    }
    // --- End Deal Initial Hands ---

    this.phase = 'prompt';
    console.log(`[startPromptPhase] Successfully started prompt phase.`);
    return true;
  } // End startPromptPhase

  // --- REMOVE MENTION OF player1/player2 from submitAnswer logic ---
  // The promptData map is gone, so the validation needs to change
  submitAnswer(playerId, promptIdentifier, submissionValue) {
    const player = this.getPlayer(playerId);
    console.log(
      `[game.submitAnswer] Received - Player: ${playerId}, Mode: ${this.settings.gameMode}, Prompt: "${promptIdentifier}", Value: "${submissionValue}"`,
    );
    console.log(`[game.submitAnswer] Current Phase: ${this.phase}`);

    if (!player) {
      console.warn(`[game.submitAnswer Validation Failed] Player ${playerId} not found.`);
      return { success: false, message: 'Player not found.' };
    }
    if (this.phase !== 'prompt') {
      console.warn(`[game.submitAnswer Validation Failed] Incorrect phase: ${this.phase}`);
      return { success: false, message: `Cannot submit answer during ${this.phase} phase.` };
    }

    // Find the assigned prompt object
    const assignedPrompt = player.myAssignedPrompts.find(p => p.promptText === promptIdentifier);
    if (!assignedPrompt) {
      console.warn(
        `[game.submitAnswer Validation Failed] Prompt "${promptIdentifier}" not assigned to player ${playerId}`,
      );
      return { success: false, message: 'Prompt not assigned to you.' };
    }

    // --- Simplified Validation: Rely ONLY on the promptsAnswered Set ---
    if (player.promptsAnswered.has(promptIdentifier)) {
      console.warn(
        `[game.submitAnswer Validation Failed] Player ${playerId} already answered prompt "${promptIdentifier}" (Set Check).`,
      );
      return { success: false, message: 'You already submitted an answer for this prompt.' };
    }
    // REMOVED Check: if (assignedPrompt.submittedAnswer) { ... }

    // --- Mode-Specific Logic (Simplified: Store submission with assignedPrompt) ---
    let submissionSuccessful = false;
    if (this.settings.gameMode === 'Flip the Script') {
      // ... (FTS logic as before) ...
      const responseText = submissionValue;
      if (typeof responseText !== 'string' || responseText.trim().length === 0) {
        // ... return error ...
      }
      assignedPrompt.submittedAnswer = responseText.trim();
      assignedPrompt.submissionType = 'text';
      submissionSuccessful = true;
      console.log(
        `[game.submitAnswer - FTS] Recorded text response for ${playerId} on prompt "${promptIdentifier}".`,
      );
    } else {
      // Classic / Mega Deck
      // ... (Classic/Mega logic as before) ...
      const imagePath = submissionValue;
      if (typeof imagePath !== 'string' || !player.hand.includes(imagePath)) {
        // ... return error ...
      }
      const cardIndex = player.hand.indexOf(imagePath);
      if (cardIndex === -1) {
        // ... return error ...
      }
      const [submittedCard] = player.hand.splice(cardIndex, 1);
      if (
        this.settings.cardSelectionMode === 'Mega Deck' ||
        this.settings.gameMode === 'Mega Deck'
      ) {
        this.sharedDiscardPile.push(submittedCard);
      } else {
        player.discardPile.push(submittedCard);
      }
      assignedPrompt.submittedAnswer = imagePath;
      assignedPrompt.submissionType = 'image';
      submissionSuccessful = true;
      console.log(
        `[game.submitAnswer - Classic/Mega] Recorded image submission for ${playerId} on prompt "${promptIdentifier}".`,
      );

      // <<< MODIFIED: Draw card for Classic OR Mega Deck mode >>>
      if (this.settings.gameMode === 'Classic' || this.settings.gameMode === 'Mega Deck') {
        this._drawCardsForPlayer(playerId, 1);
      }
    }

    // --- If submission logic was successful, update the Set and check phase transition ---
    if (submissionSuccessful) {
      // Mark prompt as answered (Common logic)
      player.promptsAnswered.add(promptIdentifier); // Add to set ONLY after successful processing
      console.log(
        `[game.submitAnswer] Marked prompt "${promptIdentifier}" as answered for player ${playerId}. Count: ${player.promptsAnswered.size}`,
      );

      // Check if all players have answered all their prompts
      if (this.checkAllPlayersSubmitted()) {
        console.log(
          '[submitAnswer] All players have submitted answers for all their prompts, attempting to start vote phase...',
        );
        this.startVotingPhase();
      }
      return { success: true }; // Indicate successful submission
    } else {
      // Should not happen if validation works, but as a safeguard
      console.error(
        `[game.submitAnswer] Reached end of function without successful submission flag for prompt "${promptIdentifier}"`,
      );
      return { success: false, message: 'Internal error processing submission.' };
    }
  } // End submitAnswer

  // --- Update checkAllPlayersSubmitted to work with the new structure ---
  checkAllPlayersSubmitted() {
    const activePlayers = this._getActivePlayersArray();
    if (activePlayers.length === 0) {
      return false;
    } // Can't proceed with no active players

    for (const player of activePlayers) {
      if (player.promptsAnswered.size < this.settings.promptsPerPlayer) {
        console.log(
          `[checkAllPlayersSubmitted] Player ${player.nickname} has answered ${player.promptsAnswered.size}/${this.settings.promptsPerPlayer} assigned prompts. Waiting...`,
        );
        return false;
      }
    }
    console.log(
      '[checkAllPlayersSubmitted] All active players have answered the required number of prompts.',
    );
    return true;
  } // End checkAllPlayersSubmitted

  // --- Update startVotingPhase to handle the new prompt structure ---
  startVotingPhase() {
    if (this.phase !== 'prompt' && this.phase !== 'voteReveal') {
      // Can transition from prompt or voteReveal
      console.warn(`[startVotingPhase] Cannot start voting phase from ${this.phase}.`);
      return false;
    }

    console.log('[startVotingPhase] Attempting to start voting phase...');

    // --- Generate the voting pairs/items from the submitted answers ---
    // This needs careful implementation based on how voting should work now.
    // Do we pair up answers for the same prompt? How are text/images displayed?

    // Example: Create pairs based on player submissions for each *unique* prompt text
    this.votingQueue = []; // Reset voting queue
    const uniquePrompts = new Map(); // Map promptText -> submissions: [{playerId, submissionValue, type}]

    this.players.forEach(player => {
      player.myAssignedPrompts.forEach(assignedPrompt => {
        if (assignedPrompt.submittedAnswer) {
          if (!uniquePrompts.has(assignedPrompt.promptText)) {
            uniquePrompts.set(assignedPrompt.promptText, []);
          }
          uniquePrompts.get(assignedPrompt.promptText).push({
            playerId: player.id,
            nickname: player.nickname, // Include for display
            submissionValue: assignedPrompt.submittedAnswer,
            type: assignedPrompt.submissionType,
            votes: 0, // Initialize votes for this submission
          });
        } else {
          console.warn(
            `[startVotingPhase] Player ${player.nickname} has an assigned prompt "${assignedPrompt.promptText}" without a submitted answer. This shouldn't happen.`,
          );
        }
      });
    });

    // Now structure the votingQueue based on uniquePrompts
    // For simplicity, let's assume each prompt text becomes a voting item,
    // and players vote on the submissions associated with that text.
    uniquePrompts.forEach((submissions, promptText) => {
      // Basic structure: Add each prompt text with its submissions to the queue
      // Filter out prompts that somehow ended up with fewer than 2 submissions if pairing is required
      if (submissions.length >= 2) {
        // Allow voting even on single submissions for a prompt? Or >= 2? Let's say >=1 for now.
        this.votingQueue.push({
          promptText: promptText,
          submissions: submissions, // Array of {playerId, nickname, submissionValue, type, votes}
        });
      } else {
        console.warn(
          `[startVotingPhase] Prompt "${promptText}" had only ${submissions.length} submissions. Skipping for voting queue.`,
        );
      }
    });

    // Shuffle the voting order
    shuffleArray(this.votingQueue);

    if (this.votingQueue.length === 0) {
      console.warn(
        '[startVotingPhase] Voting queue is empty after processing submissions. Moving to results.',
      );
      this.moveToFinalResults();
      return false;
    }

    // Reset voting state for the first item
    this.currentVotingPromptIndex = 0;
    this.players.forEach(player => player.votesCast.clear()); // Reset votes cast by players
    this.currentVoteCounts.clear(); // Clear counts for the new item

    this.phase = 'vote';
    console.log(
      `[startVotingPhase] Voting phase started. Queue length: ${this.votingQueue.length}. First item prompt: "${this.votingQueue[0]?.promptText}"`,
    );
    return true;
  } // End startVotingPhase

  // <<< NEW: submitVote Method >>>
  submitVote(playerId, votedSubmissionValue) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, message: 'Player not found.' };
    }
    if (this.phase !== 'vote') {
      return { success: false, message: `Cannot vote during ${this.phase} phase.` };
    }
    if (
      this.currentVotingPromptIndex < 0 ||
      this.currentVotingPromptIndex >= this.votingQueue.length
    ) {
      return { success: false, message: 'Invalid voting state (no active prompt).' };
    }

    const currentVotingItem = this.votingQueue[this.currentVotingPromptIndex];
    const currentPromptText = currentVotingItem.promptText;

    // Check if player submitted one of the answers
    const submitterIds = new Set(currentVotingItem.submissions.map(s => s.playerId));
    if (submitterIds.has(playerId)) {
      return { success: false, message: 'You cannot vote on your own prompt submissions.' };
    }

    // Check if player already voted for this prompt
    if (player.votesCast.has(currentPromptText)) {
      return { success: false, message: 'You have already voted for this prompt.' };
    }

    // Check if the voted value is actually one of the submissions
    const isValidVoteTarget = currentVotingItem.submissions.some(
      s => s.submissionValue === votedSubmissionValue,
    );
    if (!isValidVoteTarget) {
      console.warn(
        `[submitVote] Player ${playerId} voted for invalid value: ${votedSubmissionValue} for prompt ${currentPromptText}`,
      );
      return { success: false, message: 'Invalid vote target.' };
    }

    // Record the vote
    player.votesCast.set(currentPromptText, votedSubmissionValue);
    console.log(
      `[submitVote] Recorded vote from ${player.nickname} for ${votedSubmissionValue} on prompt "${currentPromptText}"`,
    );

    // --- Check if all eligible voters have voted ---
    const eligibleVoters = Array.from(this.players.values()).filter(
      p => !submitterIds.has(p.id) && p.isConnected && !p.isDisplayPlayer,
    );
    let votesReceivedCount = 0;
    eligibleVoters.forEach(voter => {
      if (voter.votesCast.has(currentPromptText)) {
        votesReceivedCount++;
      }
    });

    console.log(
      `[submitVote Check] Votes received: ${votesReceivedCount} / Eligible voters: ${eligibleVoters.length} for prompt "${currentPromptText}"`,
    );

    if (votesReceivedCount >= eligibleVoters.length) {
      console.log(
        `[submitVote Check] All eligible votes received for "${currentPromptText}". Processing votes...`,
      );
      this.processVotesForCurrentPrompt(); // Process and move to reveal
    } else {
      // Not all votes are in, just mark player state for UI update (handled in getStateBase)
      console.log(
        `[submitVote Check] Still waiting for ${eligibleVoters.length - votesReceivedCount} votes.`,
      );
    }

    return { success: true };
  }

  // <<< NEW: processVotesForCurrentPrompt Helper >>>
  processVotesForCurrentPrompt() {
    if (this.phase !== 'vote') {
      console.warn('[processVotesForCurrentPrompt] Called outside of vote phase.');
      return false;
    }
    if (
      this.currentVotingPromptIndex < 0 ||
      this.currentVotingPromptIndex >= this.votingQueue.length
    ) {
      console.warn('[processVotesForCurrentPrompt] Invalid voting index.');
      return false;
    }

    const currentVotingItem = this.votingQueue[this.currentVotingPromptIndex];
    const currentPromptText = currentVotingItem.promptText;
    const pointsPerVote = this.settings.pointsPerVote;

    console.log(`[processVotes] Processing votes for prompt: "${currentPromptText}"`);

    // Reset vote counts for the submissions in the current item
    currentVotingItem.submissions.forEach(sub => (sub.votes = 0));

    // Tally votes from players' votesCast map
    const submitterIds = new Set(currentVotingItem.submissions.map(s => s.playerId));
    this.players.forEach(player => {
      // Only count votes from non-submitters who are connected
      if (!submitterIds.has(player.id) && player.isConnected && !player.isDisplayPlayer) {
        const voteCast = player.votesCast.get(currentPromptText);
        if (voteCast) {
          // Find the submission that received the vote
          const votedSubmission = currentVotingItem.submissions.find(
            s => s.submissionValue === voteCast,
          );
          if (votedSubmission) {
            votedSubmission.votes = (votedSubmission.votes || 0) + 1;
            console.log(
              ` -> Vote from ${player.nickname} tallied for ${votedSubmission.nickname}'s submission (${voteCast}). New vote count: ${votedSubmission.votes}`,
            );
          } else {
            console.warn(
              ` -> Vote from ${player.nickname} for value ${voteCast} does not match any submission value for prompt "${currentPromptText}".`,
            );
          }
        }
      }
    });

    // Award points to the submitters based on votes received
    currentVotingItem.submissions.forEach(submission => {
      if (submission.votes > 0) {
        const submitter = this.getPlayer(submission.playerId);
        if (submitter) {
          const pointsEarned = submission.votes * pointsPerVote;
          submitter.score += pointsEarned;
          console.log(
            ` -> Awarded ${pointsEarned} points to ${submitter.nickname} for ${submission.votes} vote(s). New score: ${submitter.score}`,
          );
        } else {
          console.warn(` -> Submitter ${submission.playerId} not found when awarding points.`);
        }
      }
    });

    // <<< ADD Lifetime Vote Update Logic >>>
    if (this.db) {
      // Check if db connection exists
      const updates = [];
      currentVotingItem.submissions.forEach(sub => {
        // Only update if votes > 0 and it's an image submission (Classic/Mega)
        if (sub.votes > 0 && sub.type === 'image') {
          updates.push({ imagePath: sub.submissionValue, votesToAdd: sub.votes });
        }
      });

      if (updates.length > 0) {
        console.log(
          `[Lifetime Votes] Updating DB for ${updates.length} cards from prompt "${currentPromptText}".`,
        );
        try {
          const stmt = this.db.prepare(
            'UPDATE cards SET lifetimeVotes = lifetimeVotes + ? WHERE imagePath = ?',
          );
          updates.forEach(update => {
            // Use a callback for run to handle potential errors per row
            stmt.run(update.votesToAdd, update.imagePath, function (runErr) {
              if (runErr) {
                console.error(
                  `[Lifetime Votes DB Error] Failed updating ${update.imagePath}:`,
                  runErr.message,
                );
              }
              // Optional: Log success per row
              // else { console.log(`[Lifetime Votes DB] Updated ${update.imagePath} by ${update.votesToAdd}.`); }
            });
          });
          // Finalize the statement after all runs are queued
          stmt.finalize(finalizeErr => {
            if (finalizeErr) {
              console.error('[Lifetime Votes DB Error] Finalize stmt error:', finalizeErr.message);
            } else {
              console.log(
                `[Lifetime Votes DB] Statement finalized for prompt "${currentPromptText}".`,
              );
            }
          });
        } catch (prepareErr) {
          console.error(
            '[Lifetime Votes DB Error] Failed to prepare statement:',
            prepareErr.message,
          );
        }
      }
    } else {
      console.warn(
        '[processVotes] Database connection (this.db) not available, skipping lifetime vote update.',
      );
    }
    // <<< END Lifetime Vote Update Logic >>>

    // Move to the reveal phase for this prompt
    this.phase = 'vote_reveal';
    console.log(
      `[processVotes] Finished processing for "${currentPromptText}". Moved to phase: ${this.phase}.`,
    );
    return true;
  }

  // <<< ADD BACK MISSING METHOD >>>
  moveToFinalResults() {
    console.log(`Game ${this.gameId} moving to final results.`);
    this.phase = 'final_results';
    // Calculate final scores
    this.calculateFinalScores();

    // TODO: Calculate final winner, final scores are already tallied
    // Calculate and set the final winner
    this.calculateFinalWinner();

    // Set the results flag
    this.resultsGenerated = true;
    return true;
  }

  // --- Update getCurrentVotingPromptData to work with votingQueue ---
  getCurrentVotingPromptData() {
    if (this.phase !== 'vote' && this.phase !== 'vote_reveal') {
      return null;
    }
    if (
      this.currentVotingPromptIndex < 0 ||
      this.currentVotingPromptIndex >= this.votingQueue.length
    ) {
      return null;
    }

    // Return the current item from the queue
    const currentVotingItem = this.votingQueue[this.currentVotingPromptIndex];

    // Structure might need adjustment based on client needs
    // Return the prompt text and the submissions array
    return {
      promptText: currentVotingItem.promptText,
      submissions: currentVotingItem.submissions, // Array of {playerId, nickname, submissionValue, type, votes}
      // We might need to add isComplete or other flags later
    };
  } // End getCurrentVotingPromptData

  // --- ADD NEW METHODS for Card Selection ---
  setPlayerSelectedCards(playerId, imagePaths) {
    const player = this.getPlayer(playerId);
    if (player && this.phase === 'cardSelection') {
      // Validate cardIds (e.g., check against player's actual collection if possible, check count)
      // For now, just trust the client and set the hand
      player.submittedCardPaths = imagePaths; // Store as submitted paths
      console.log(
        `Player ${player.nickname} set submittedCardPaths to ${imagePaths.length} image paths.`,
      );
      return true;
    }
    return false;
  }

  confirmPlayerCardSelection(playerId, submittedPaths) {
    const player = this.getPlayer(playerId);
    if (player && this.phase === 'cardSelection') {
      const requiredCards = this.settings.promptsPerPlayer;
      if (!submittedPaths || submittedPaths.length < requiredCards) {
        console.warn(
          `[confirmPlayerCardSelection] Failed: Player ${playerId} submitted ${submittedPaths?.length ?? 0} cards, requires ${requiredCards}.`,
        );
        return false;
      }

      // Store the submitted paths temporarily on the player object
      player.submittedCardPaths = submittedPaths || [];
      player.hasConfirmedCards = true;
      console.log(
        `Player ${player.nickname} confirmed card selection with ${player.submittedCardPaths.length} paths.`,
      );
      return true;
    }
    console.warn(
      `[confirmPlayerCardSelection] Failed: Player ${playerId} not found or phase is not cardSelection (${this.phase})`,
    );
    return false;
  }

  checkAllPlayersConfirmedCards() {
    const activePlayers = this._getActivePlayersArray();
    if (activePlayers.length === 0) {
      return false;
    }
    for (const player of activePlayers) {
      if (!player.hasConfirmedCards) {
        return false;
      }
    }
    console.log('All active players confirmed cards.');
    return true;
  }

  getRequiredCardsPerPlayer() {
    // Determine how many cards each player needs.
    // Directly use the promptsPerPlayer setting.
    return this.settings.promptsPerPlayer;
  }
  // --- END NEW METHODS ---

  // <<< RENAME function to getStateBase >>>
  getStateBase(_requestingPlayerId = null) {
    const playersArray = Array.from(this.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      icon: p.icon || '😀',
      isHost: p.isHost,
      score: p.score,
      isDisplayPlayer: !!p.isDisplayPlayer,
      hasConfirmedCards: this.phase === 'cardSelection' ? p.hasConfirmedCards : undefined,
      promptsAnsweredCount:
        this.phase === 'prompt' ||
        this.phase === 'vote' ||
        this.phase === 'vote_reveal' ||
        this.phase === 'final_results'
          ? p.promptsAnswered.size
          : undefined,
      promptsAssignedCount:
        this.phase === 'prompt' ||
        this.phase === 'vote' ||
        this.phase === 'vote_reveal' ||
        this.phase === 'final_results'
          ? p.myAssignedPrompts.length
          : undefined,
      hasVoted: this.phase === 'vote' || this.phase === 'vote_reveal' ? p.hasVoted : undefined,
      isConnected: p.isConnected,
    }));

    // --- Final Results Calculation (Mode-Dependent) ---
    const finalPromptResults = [];
    if (this.phase === 'final_results') {
      // console.log(`[getStateBase Debug] final_results phase - Building final results. Mode: ${this.settings.gameMode}`); // REMOVED
      this.votingQueue.forEach(votingItem => {
        const promptIdentifier = votingItem.promptText;
        const submissions = votingItem.submissions || [];

        // Ensure we have at least two submissions to display as a pair
        if (submissions.length >= 2) {
          // Assuming the first two submissions are the pair to display
          const sub1Data = submissions[0];
          const sub2Data = submissions[1];
          const p1 = this.getPlayer(sub1Data.playerId);
          const p2 = this.getPlayer(sub2Data.playerId);

          let resultEntry = {};
          if (this.settings.gameMode === 'Flip the Script') {
            resultEntry = {
              promptImagePath: promptIdentifier, // Identifier is image path in FTS
              sub1: {
                submitterId: sub1Data.playerId,
                nickname: p1?.nickname || '?',
                responseText: sub1Data.submissionValue,
                votes: sub1Data.votes,
              },
              sub2: {
                submitterId: sub2Data.playerId,
                nickname: p2?.nickname || '?',
                responseText: sub2Data.submissionValue,
                votes: sub2Data.votes,
              },
            };
            console.log(` -> Adding Flip the Script result for: ${promptIdentifier}`);
          } else {
            // Classic / Mega Deck
            resultEntry = {
              promptText: promptIdentifier, // Identifier is text
              sub1: {
                submitterId: sub1Data.playerId,
                nickname: p1?.nickname || '?',
                imagePath: sub1Data.submissionValue,
                votes: sub1Data.votes,
              },
              sub2: {
                submitterId: sub2Data.playerId,
                nickname: p2?.nickname || '?',
                imagePath: sub2Data.submissionValue,
                votes: sub2Data.votes,
              },
            };
            console.log(` -> Adding Classic/Mega result for: ${promptIdentifier}`);
          }
          finalPromptResults.push(resultEntry);
        } else {
          console.log(
            ` -> Skipping identifier ${promptIdentifier} (submissions count: ${submissions.length})`,
          );
        }
      });
      console.log(
        `[getStateBase Debug] final_results phase - finalPromptResults built:`,
        JSON.stringify(finalPromptResults, null, 2),
      );
    }

    // --- Current Voting/Reveal Data (Mode-Aware via currentPromptData) ---
    const currentPromptData = this.getCurrentVotingPromptData(); // Already gets correct data based on mode
    // <<< FIX: Use votingQueue and get promptText from item >>>
    const currentPromptIdentifier =
      (this.phase === 'vote' || this.phase === 'vote_reveal') &&
      this.votingQueue.length > this.currentVotingPromptIndex &&
      this.currentVotingPromptIndex >= 0
        ? this.votingQueue[this.currentVotingPromptIndex].promptText
        : null;

    // Current Vote Reveal Data (vote_reveal phase)
    let currentPromptVoteRevealData = null;
    if (this.phase === 'vote_reveal' && currentPromptData && currentPromptIdentifier) {
      console.log(
        `[getStateBase Debug] vote_reveal phase - Building reveal data for identifier: ${currentPromptIdentifier}, Mode: ${this.settings.gameMode}`,
      );
      // <<< FIX: Get data from currentPromptData.submissions >>>
      const submissions = currentPromptData.submissions || [];
      if (submissions.length >= 2) {
        // Should always be true if it made it to the voting queue
        const sub1 = submissions[0]; // Assume order is consistent or doesn't matter for reveal
        const sub2 = submissions[1];
        const p1 = this.getPlayer(sub1.playerId);
        const p2 = this.getPlayer(sub2.playerId);

        // <<< FIX: Calculate Voter IDs based on votesCast and submissionValue >>>
        const sub1VoterIds = [];
        const sub2VoterIds = [];
        // Get all votes cast for this specific prompt text
        this.players.forEach(voter => {
          const voteCastValue = voter.votesCast.get(currentPromptIdentifier);
          if (voteCastValue === sub1.submissionValue) {
            sub1VoterIds.push(voter.id);
          } else if (voteCastValue === sub2.submissionValue) {
            sub2VoterIds.push(voter.id);
          }
        });
        console.log(
          `[getStateBase Debug] vote_reveal phase - Calculated Voter IDs - Sub1: [${sub1VoterIds.join(', ')}], Sub2: [${sub2VoterIds.join(', ')}]`,
        );
        // <<< End FIX >>>

        if (this.settings.gameMode === 'Flip the Script') {
          currentPromptVoteRevealData = {
            promptImagePath: currentPromptIdentifier,
            sub1: {
              submitterId: sub1.playerId,
              nickname: p1?.nickname || '?',
              responseText: sub1.submissionValue,
              votes: sub1.votes,
              voterIds: sub1VoterIds,
            },
            sub2: {
              submitterId: sub2.playerId,
              nickname: p2?.nickname || '?',
              responseText: sub2.submissionValue,
              votes: sub2.votes,
              voterIds: sub2VoterIds,
            },
          };
        } else {
          // Classic / Mega Deck
          currentPromptVoteRevealData = {
            promptText: currentPromptIdentifier,
            sub1: {
              submitterId: sub1.playerId,
              nickname: p1?.nickname || '?',
              imagePath: sub1.submissionValue,
              votes: sub1.votes,
              voterIds: sub1VoterIds,
            },
            sub2: {
              submitterId: sub2.playerId,
              nickname: p2?.nickname || '?',
              imagePath: sub2.submissionValue,
              votes: sub2.votes,
              voterIds: sub2VoterIds,
            },
          };
        }
        console.log(
          `[getStateBase Debug] vote_reveal phase - Built reveal data:`,
          currentPromptVoteRevealData,
        );
      } else {
        console.warn(
          `[getStateBase Debug] vote_reveal phase - Not enough submissions (${submissions.length}) found for prompt "${currentPromptIdentifier}" to build reveal data.`,
        );
        // currentPromptVoteRevealData remains null
      }
    } else if (this.phase === 'vote_reveal') {
      console.warn(
        `[getStateBase Debug] vote_reveal phase - Could not build reveal data. currentPromptData: ${!!currentPromptData}, currentPromptIdentifier: ${currentPromptIdentifier}`,
      );
    }

    // Current Voting Prompt (vote phase)
    let currentVotingPrompt = null;
    if (this.phase === 'vote' && currentPromptData && currentPromptIdentifier) {
      console.log(
        `[getStateBase Debug] vote phase - Building voting prompt for identifier: ${currentPromptIdentifier}, Mode: ${this.settings.gameMode}`,
      );
      // <<< FIX: Extract submissions from currentPromptData >>>
      const submissions = currentPromptData.submissions || [];

      // Assuming we need at least two distinct submissions for a prompt to be votable
      // This might need adjustment if single-submission prompts are allowed
      if (submissions.length >= 2) {
        if (this.settings.gameMode === 'Flip the Script') {
          // <<< FIX: Get data from submissions array >>>
          const sub1 = submissions[0]; // NOTE: Assumes order or only 2 submissions
          const sub2 = submissions[1];
          currentVotingPrompt = {
            promptImagePath: currentPromptIdentifier, // Identifier is image path in FTS?
            player1Response: sub1.submissionValue, // Submission 1 text
            player2Response: sub2.submissionValue, // Submission 2 text
            player1Id: sub1.playerId,
            player2Id: sub2.playerId,
          };
        } else {
          // Classic / Mega Deck
          // <<< FIX: Get data from submissions array >>>
          const sub1 = submissions[0]; // NOTE: Assumes order or only 2 submissions
          const sub2 = submissions[1];
          currentVotingPrompt = {
            promptText: currentPromptIdentifier, // Identifier is text
            player1Image: sub1.submissionValue, // Submission 1 image path
            player2Image: sub2.submissionValue, // Submission 2 image path
            player1Id: sub1.playerId,
            player2Id: sub2.playerId,
          };
        }
        console.log(`[getStateBase Debug] vote phase - Built voting prompt:`, currentVotingPrompt);
      } else {
        // <<< ADDED Warning for insufficient submissions >>>
        console.warn(
          `[getStateBase Debug] vote phase - Not enough submissions (${submissions.length}) found for prompt "${currentPromptIdentifier}" to build voting prompt.`,
        );
        // currentVotingPrompt remains null
      }
    } else if (this.phase === 'vote') {
      console.warn(
        `[getStateBase Debug] vote phase - Could not build voting prompt. currentPromptData: ${!!currentPromptData}, currentPromptIdentifier: ${currentPromptIdentifier}`,
      );
    }

    // --- Vote Tally (for UI display during 'vote') ---
    let voteTally = null;
    // <<< FIX: Rework tally logic >>>
    if (this.phase === 'vote' && currentPromptIdentifier && currentPromptData) {
      const currentVotingItem = this.votingQueue[this.currentVotingPromptIndex];

      // Calculate target votes: number of connected players NOT submitting for this prompt
      const submitterIds = new Set((currentVotingItem.submissions || []).map(s => s.playerId));
      const targetVotes = Array.from(this.players.values()).filter(
        p => p.isConnected && !submitterIds.has(p.id) && !p.isDisplayPlayer,
      ).length;

      // Calculate actual votes received so far for this prompt
      let actualVotesReceived = 0;
      this.players.forEach(p => {
        // Count vote if player is connected, not a submitter for this item, and has cast a vote for this specific prompt
        if (
          p.isConnected &&
          !submitterIds.has(p.id) &&
          !p.isDisplayPlayer &&
          p.votesCast.has(currentPromptIdentifier)
        ) {
          actualVotesReceived++;
        }
      });

      voteTally = { totalVotes: actualVotesReceived, targetVotes };
      console.log(
        `[getStateBase Debug] vote phase - Calculated voteTally: ${JSON.stringify(voteTally)} for prompt "${currentPromptIdentifier}"`,
      );
    } else if (this.phase === 'vote') {
      console.warn(
        `[getStateBase Debug] vote phase - Could not calculate voteTally. Identifier: ${currentPromptIdentifier}, Data: ${!!currentPromptData}`,
      );
    }

    // --- Base State Object ---
    const state = {
      gameId: this.gameId,
      phase: this.phase,
      settings: this.settings,
      players: playersArray,
      hostId: this.hostId,
      // Phase specific data
      currentVotingPrompt: currentVotingPrompt, // Populated only in 'vote' phase
      currentVoteTally: voteTally, // Populated only in 'vote' phase
      currentVoteRevealData: currentPromptVoteRevealData, // Populated only in 'vote_reveal' phase
      finalResults: this.phase === 'final_results' ? { prompts: finalPromptResults } : null, // Populated only in 'final_results' phase
      // Shared deck info (consider if relevant for FlipTheScript variants)
      sharedDrawPileCount:
        this.settings.cardSelectionMode === 'Mega Deck' || this.settings.gameMode === 'Mega Deck'
          ? this.sharedDrawPile.length
          : undefined,
      sharedDiscardPileCount:
        this.settings.cardSelectionMode === 'Mega Deck' || this.settings.gameMode === 'Mega Deck'
          ? this.sharedDiscardPile.length
          : undefined,
    };

    return state;
  }

  // <<< Ensure getPersonalizedState calls getStateBase >>>
  getPersonalizedState(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      console.error(`[getPersonalizedState] Player ${playerId} not found in this.players map.`);
      return null;
    }

    // Get the base state
    const baseState = this.getStateBase(playerId); // NOTE: getStateBase itself should ideally return new objects/arrays too
    if (!baseState || !baseState.players) {
      console.error(
        `[getPersonalizedState] getStateBase did not return a valid baseState or players array for ${playerId}.`,
      );
      return null;
    }

    // Create a NEW players array with the target player updated
    const newPlayersArray = baseState.players.map(p => {
      if (p.id === playerId) {
        // Return a NEW object for the matching player
        return {
          ...p, // Keep existing base player state from baseState.players
          // Add personalized fields
          myHand: player.hand || [],
          myAssignedPrompts: player.myAssignedPrompts || [],
          myAnsweredPrompts: Array.from(player.promptsAnswered || new Set()),
          myLobbyAddedPrompts: player.lobbyAddedPrompts || [],
          // Draw/Discard counts (if Classic mode)
          ...(this.settings.cardSelectionMode === 'Classic' &&
            this.settings.gameMode !== 'Flip the Script' && {
              myDrawPileCount: player.drawPile?.length ?? 0,
              myDiscardPileCount: player.discardPile?.length ?? 0,
            }),
          // Shared Deck Count (if Mega Deck mode)
          ...((this.settings.cardSelectionMode === 'Mega Deck' ||
            this.settings.gameMode === 'Mega Deck') && {
            myRemainingDeckCount: this.sharedDrawPile?.length ?? 0,
          }),
        };
      } else {
        // Return the original object reference for other players
        return p;
      }
    });

    // Log what's being returned FOR DEBUGGING
    const updatedPlayerState = newPlayersArray.find(p => p.id === playerId);
    console.log(
      `[getPersonalizedState for ${playerId}] Returning new state object. Player object has myLobbyPrompts:`,
      updatedPlayerState?.myLobbyAddedPrompts,
    );

    // Return a NEW state object containing the NEW players array
    return {
      ...baseState,
      players: newPlayersArray, // Explicitly use the new array reference
    };
  }

  // <<< Helper to draw cards >>>
  _drawCardsForPlayer(playerId, count) {
    // <<< Log Entry >>>
    console.log(
      `[DEBUG _drawCardsForPlayer] ENTER - Player: ${playerId}, Count: ${count}, Mode: ${this.settings.gameMode}`,
    );
    const player = this.getPlayer(playerId);
    if (!player) {
      // <<< Log Exit (Player not found) >>>
      console.error(`[DEBUG _drawCardsForPlayer] EXIT - Player ${playerId} not found.`);
      return [];
    }

    const drawnCards = [];
    let sourcePile, discardPileRef;
    let sourceName;

    // Determine source based on game mode
    if (this.settings.gameMode === 'Mega Deck') {
      sourcePile = this.sharedDrawPile;
      discardPileRef = this.sharedDiscardPile; // Discard pile for reshuffling
      sourceName = 'Shared Draw Pile';
      // <<< Log Mega Deck Piles >>>
      console.log(
        `[DEBUG _drawCardsForPlayer] Mega Deck - Initial sharedDrawPile size: ${this.sharedDrawPile?.length ?? 'undefined'}, sharedDiscardPile size: ${this.sharedDiscardPile?.length ?? 'undefined'}`,
      );
    } else {
      // Classic mode
      sourcePile = player.drawPile;
      discardPileRef = player.discardPile; // Discard pile for reshuffling
      sourceName = `Player ${playerId}'s Draw Pile`;
      // <<< Log Classic Piles >>>
      console.log(
        `[DEBUG _drawCardsForPlayer] Classic - Initial player.drawPile size: ${player.drawPile?.length ?? 'undefined'}, player.discardPile size: ${player.discardPile?.length ?? 'undefined'}`,
      );
    }

    // <<< Log Before Loop >>>
    console.log(
      `[DEBUG _drawCardsForPlayer ${sourceName}] Before loop - Drawing ${count} cards. Source size: ${sourcePile?.length ?? 'undefined'}`,
    );

    for (let i = 0; i < count; i++) {
      // <<< Log Loop Iteration >>>
      console.log(
        `[DEBUG _drawCardsForPlayer ${sourceName}] Loop iteration ${i + 1}/${count}. Source size: ${sourcePile?.length ?? 'undefined'}`,
      );

      if (!sourcePile || sourcePile.length === 0) {
        // <<< Log Reshuffle Start >>>
        console.log(
          `[DEBUG _drawCardsForPlayer ${sourceName}] Draw pile empty. Attempting reshuffle. Discard size: ${discardPileRef?.length ?? 'undefined'}`,
        );
        if (!discardPileRef || discardPileRef.length === 0) {
          console.warn(
            `[DEBUG _drawCardsForPlayer ${sourceName}] Both draw and discard piles are empty! Breaking draw loop.`,
          );
          break; // No more cards available anywhere
        }
        // Shuffle discard pile and move it to the source pile
        const shuffledDiscard = shuffleArray([...discardPileRef]);
        console.log(
          `[DEBUG _drawCardsForPlayer ${sourceName}] Shuffled ${shuffledDiscard.length} cards from discard.`,
        );

        // Ensure sourcePile is an array before pushing
        if (!sourcePile) {
          sourcePile = [];
        }
        sourcePile.push(...shuffledDiscard);
        console.log(
          `[DEBUG _drawCardsForPlayer ${sourceName}] Pushed shuffled cards to source. New source size: ${sourcePile.length}`,
        );

        // Clear the original discard pile reference
        if (this.settings.gameMode === 'Mega Deck') {
          this.sharedDiscardPile = [];
          console.log(`[DEBUG _drawCardsForPlayer ${sourceName}] Cleared shared discard pile.`);
        } else {
          player.discardPile = [];
          console.log(
            `[DEBUG _drawCardsForPlayer ${sourceName}] Cleared player ${playerId}'s discard pile.`,
          );
        }

        // Check again if source pile has cards after reshuffle
        if (sourcePile.length === 0) {
          console.error(
            `[DEBUG _drawCardsForPlayer ${sourceName}] Reshuffle completed, but source pile is STILL empty. Breaking loop.`,
          );
          break;
        }
        console.log(
          `[DEBUG _drawCardsForPlayer ${sourceName}] Reshuffle successful. Continuing loop.`,
        );
      }
      // Draw one card from the source pile
      const card = sourcePile.pop();
      if (card) {
        // <<< Log Card Drawn >>>
        console.log(`[DEBUG _drawCardsForPlayer ${sourceName}] Popped card: ${card}`);
        drawnCards.push(card);
      } else {
        // <<< Log Failed Pop (Shouldn't happen if length checks work) >>>
        console.error(
          `[DEBUG _drawCardsForPlayer ${sourceName}] Popped undefined card despite non-zero length check? Source size: ${sourcePile?.length ?? 'undefined'}`,
        );
      }
    }

    // Add drawn cards to player's hand
    // Ensure player.hand is an array
    if (!Array.isArray(player.hand)) {
      player.hand = [];
    }
    player.hand.push(...drawnCards);
    // <<< Log Exit >>>
    console.log(
      `[DEBUG _drawCardsForPlayer] EXIT - Drew ${drawnCards.length} cards for ${playerId}. Final hand size: ${player.hand.length}`,
    );
    return drawnCards; // Return the cards that were actually drawn
  }

  // --- NEW Method to Reset Lobby State ---
  resetLobby() {
    try {
      console.log(`[resetLobby Method START] Resetting lobby for game ${this.gameId}`);

      // Log context check
      console.log(
        `[resetLobby Method] Context Check: this.gameId = ${this.gameId}, this.players is Map? ${this.players instanceof Map}`,
      );

      this.phase = 'lobby';
      console.log('[resetLobby Method] Phase set to lobby.');
      this.votingQueue = [];
      console.log('[resetLobby Method] votingQueue cleared.');
      this.currentVotingPromptIndex = -1;
      console.log('[resetLobby Method] currentVotingPromptIndex reset.');
      this.sharedDrawPile = [];
      console.log('[resetLobby Method] sharedDrawPile cleared.');
      this.sharedDiscardPile = [];
      console.log('[resetLobby Method] sharedDiscardPile cleared.');
      this.usedCustomLobbyPrompts.clear();
      console.log('[resetLobby Method] usedCustomLobbyPrompts cleared.');

      console.log('[resetLobby Method] Starting player state reset loop...');
      this.players.forEach((player, playerId) => {
        console.log(
          `[resetLobby Method] Resetting state for player ${playerId} (${player.nickname})`,
        );
        player.score = 0;
        player.hand = [];
        player.myAssignedPrompts = [];
        player.promptsAnswered = new Set();
        player.hasVoted = false;
        player.hasConfirmedCards = false;
        player.fullDeck = [];
        player.drawPile = [];
        player.discardPile = [];
        console.log(`[resetLobby Method] Finished resetting state for player ${playerId}`);
      });
      console.log('[resetLobby Method] Player state reset loop COMPLETE.');

      console.log('[resetLobby Method] Reset complete. About to return true.');
      return true;
    } catch (error) {
      console.error(
        `[resetLobby Method ERROR] Caught error during reset for game ${this.gameId}:`,
        error,
      );
      return false; // Return false explicitly on error
    }
  }
  // --- END resetLobby ---

  // --- NEW Method to Start the Next Round (Revised: Go back to Card Selection) ---
  startNextRound() {
    if (this.phase !== 'final_results') {
      console.error(`Cannot start next round from phase: ${this.phase}`);
      return false;
    }
    console.log(`Starting next round for game ${this.gameId}`);
    // DON'T reset phase here, startPromptPhase does it
    // DON'T reset player scores
    // DON'T reset player lobbyAddedPrompts
    // DON'T reset usedCustomLobbyPrompts

    this.votingQueue = [];
    this.currentVotingPromptIndex = -1;
    this.sharedDrawPile = []; // Reset shared piles if applicable
    this.sharedDiscardPile = [];

    // Reset player round-specific state, keep decks
    this.players.forEach(player => {
      player.hand = [];
      player.myAssignedPrompts = [];
      player.promptsAnswered = new Set();
      player.hasVoted = false;
      player.hasConfirmedCards = false;
      // Reset draw/discard, assuming they are rebuilt from fullDeck
      player.drawPile = [];
      player.discardPile = [];
    });

    // Set phase to cardSelection to trigger new card selection/confirmation
    this.phase = 'cardSelection';
    console.log(`Game ${this.gameId} phase set to 'cardSelection' for next round.`);
    return true;
  }
  // --- END startNextRound ---

  updateSetting(key, value) {
    // <<< ADD Phase Check: Only allow updates in lobby >>>
    if (this.phase !== 'lobby') {
      console.warn(
        `[updateSetting] Attempt rejected: Cannot update settings outside of lobby phase (current: ${this.phase}). Key: ${key}`,
      );
      return false; // Reject update if game has started
    }
    // <<< END Phase Check >>>

    if (key in this.settings) {
      // Add specific validation if needed
      if (key === 'gameMode' && !['Classic', 'Mega Deck'].includes(value)) {
        console.warn(`[updateSetting] Invalid gameMode received: ${value}`);
        return false; // Invalid mode
      }
      // Add other validations (like for handSize, promptsPerPlayer, etc.)
      if (key === 'handSize' && (typeof value !== 'number' || value < 1 || value > 100)) {
        console.warn(`[updateSetting] Invalid handSize received: ${value}`);
        return false;
      }
      if (key === 'promptsPerPlayer' && (typeof value !== 'number' || value < 1 || value > 10)) {
        console.warn(`[updateSetting] Invalid promptsPerPlayer received: ${value}`);
        return false;
      }
      if (key === 'pointsPerVote' && (typeof value !== 'number' || value < 0)) {
        console.warn(`[updateSetting] Invalid pointsPerVote received: ${value}`);
        return false;
      }
      if (key === 'allowMidGameJoin' && typeof value !== 'boolean') {
        console.warn(`[updateSetting] Invalid allowMidGameJoin received: ${value}`);
        return false;
      }

      this.settings[key] = value;
      console.log(`[Game ${this.gameId}] Setting updated in lobby: ${key} = ${value}`);
      return true;
    } else {
      console.warn(`[Game ${this.gameId}] Attempted to update invalid setting: ${key}`);
      return false;
    }
  }

  // NEW: Method to process selections AFTER all players confirm
  processAllCardSelections() {
    console.log(
      `[processAllCardSelections] Processing selections for game mode: ${this.settings.gameMode}`,
    );
    const activePlayers = this._getActivePlayersArray(); // Get active players

    // --- Clear shared deck for Mega Deck mode ---
    if (this.settings.gameMode === 'Mega Deck') {
      this.sharedDrawPile = [];
      this.sharedDiscardPile = [];
      console.log('[processAllCardSelections] Mega Deck mode: Cleared shared piles.');
    }

    // --- Process each active player's selected cards ---
    activePlayers.forEach(player => {
      const selectedPaths = player.submittedCardPaths || [];
      player.fullDeck = [...selectedPaths]; // Store the full set they brought
      player.drawPile = shuffleArray([...selectedPaths]); // Shuffle their selections into their draw pile
      player.discardPile = []; // Ensure discard is empty
      player.hand = []; // Reset hand before initial deal
      console.log(
        `[processAllCardSelections] Player ${player.nickname} has ${player.drawPile.length} cards in draw pile.`,
      );

      // --- Add cards to shared deck for Mega Deck mode ---
      if (this.settings.gameMode === 'Mega Deck') {
        this.sharedDrawPile.push(...player.drawPile); // Add player's shuffled pile to shared pile
        // Don't clear player's drawPile here, they might need it if Mega Deck fails?
        console.log(
          `[processAllCardSelections] Mega Deck: Added ${player.drawPile.length} cards from ${player.nickname}. Shared pile size: ${this.sharedDrawPile.length}`,
        );
      }
    });

    // --- Shuffle the Mega Deck if applicable ---
    if (this.settings.gameMode === 'Mega Deck') {
      this.sharedDrawPile = shuffleArray(this.sharedDrawPile);
      console.log(
        `[processAllCardSelections] Mega Deck mode: Shuffled shared draw pile. Total cards: ${this.sharedDrawPile.length}`,
      );

      // --- Deal initial hands to all players in Mega Deck mode ---
      console.log(`[processAllCardSelections] Mega Deck mode: Dealing initial hands to players...`);
      activePlayers.forEach(player => {
        const handSize = this.settings.handSize || 5; // Use default 5 if not specified
        this._drawCardsForPlayer(player.id, handSize);
        console.log(
          `[processAllCardSelections] Dealt ${handSize} cards to player ${player.nickname}. Hand size: ${player.hand.length}`,
        );
      });
      console.log(
        `[processAllCardSelections] Mega Deck mode: Initial hands dealt. Remaining in shared draw pile: ${this.sharedDrawPile.length}`,
      );
    }

    return true; // Indicate success
  }

  // <<< NEW: Helper to calculate minimum prompts for pairing >>>
  calculateMinValidPromptsPerPlayer(numPlayers) {
    if (numPlayers <= 0) {
      return 1;
    } // Default or error case
    if (numPlayers % 2 === 0) {
      return 1; // If players are even, 1 prompt each works (total is even)
    } else {
      return 2; // If players are odd, need 2 prompts each for an even total
    }
  }
  // <<< END NEW HELPER >>>

  // <<< NEW: Method to advance after reveal >>>
  advanceGameFromReveal() {
    if (this.phase !== 'vote_reveal') {
      console.warn(`[advanceGameFromReveal] Cannot advance from phase: ${this.phase}`);
      return false;
    }

    this.currentVotingPromptIndex++;
    console.log(
      `[advanceGameFromReveal] Incremented voting index to: ${this.currentVotingPromptIndex}`,
    );

    if (this.currentVotingPromptIndex < this.votingQueue.length) {
      // More prompts to vote on
      this.phase = 'vote';
      // Reset player votes for the new prompt
      this.players.forEach(player => player.votesCast.clear());
      this.currentVoteCounts.clear(); // Clear vote counts for the new item
      console.log(
        `[advanceGameFromReveal] Moving to next voting item. Phase set to: ${this.phase}. Prompt: "${this.votingQueue[this.currentVotingPromptIndex]?.promptText}"`,
      );
    } else {
      // No more prompts, move to final results
      console.log(`[advanceGameFromReveal] Voting queue complete. Moving to final results.`);
      this.moveToFinalResults(); // This sets phase to 'final_results'
    }
    return true;
  }
  // <<< END NEW Method >>>

  // Calculate final scores
  calculateFinalScores() {
    // Calculate final scores based on votes received throughout the game
    const finalScores = {};
    
    // Initialize scores for all players
    this.players.forEach((player, playerId) => {
      finalScores[playerId] = player.score || 0;
    });
    
    // Add any bonus points or final calculations here
    // For now, we use the existing scores that were calculated during voting phases
    
    // Update player scores
    Object.entries(finalScores).forEach(([playerId, score]) => {
      const player = this.players.get(playerId);
      if (player) {
        player.finalScore = score;
      }
    });
    
    console.log(`[Game ${this.gameId}] Final scores calculated:`, finalScores);
  }

  // Calculate final winner
  calculateFinalWinner() {
    let highestScore = -1;
    let winners = [];
    
    // Find the highest score and all players who achieved it
    this.players.forEach((player, playerId) => {
      const score = player.finalScore || player.score || 0;
      
      if (score > highestScore) {
        highestScore = score;
        winners = [playerId];
      } else if (score === highestScore) {
        winners.push(playerId);
      }
    });
    
    // Set the winner(s)
    if (winners.length === 1) {
      this.winner = winners[0];
      console.log(`[Game ${this.gameId}] Winner determined: ${this.winner} with score ${highestScore}`);
    } else if (winners.length > 1) {
      this.winner = winners; // Multiple winners (tie)
      console.log(`[Game ${this.gameId}] Tie between players: ${winners.join(', ')} with score ${highestScore}`);
    } else {
      this.winner = null;
      console.log(`[Game ${this.gameId}] No winner determined`);
    }
    
    // Store final results for easy access
    this.finalResults = {
      winner: this.winner,
      highestScore,
      playerScores: Object.fromEntries(
        Array.from(this.players.entries()).map(([id, player]) => [
          id, 
          { 
            nickname: player.nickname, 
            score: player.finalScore || player.score || 0, 
          },
        ]),
      ),
    };
  }
}

const generateGameId = (length = 5) => {
  const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

module.exports = { Game, generateGameId };
