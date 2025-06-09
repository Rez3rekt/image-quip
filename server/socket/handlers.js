// server/socket/handlers.js
const { Game, generateGameId } = require('../models/Game'); // Import necessary Game logic

// This function will contain all the socket event listeners.
// It needs access to io, games map, playerGameMap, db, etc.
function initializeSocketHandlers(
  io,
  games,
  playerGameMap,
  db,
  PREDEFINED_PROMPTS,
  path,
  fs,
  cardStore,
  cardUploadsDir,
  socketClientMap,
  baseUploadsDir,
) {
  // Helper function (moved from server.js) - needs access to io and games
  const emitPersonalizedGameStateUpdate = gameId => {
    const game = games.get(gameId);
    if (!game) {
      console.error(`[Emit State Error] Game ${gameId} not found during emission.`);
      return;
    }

    game.players.forEach(player => {
      if (player.isConnected) {
        const personalizedState = game.getPersonalizedState(player.id);
        if (personalizedState) {
          io.to(player.id).emit('update', personalizedState);
        } else {
          console.error(
            `[Emit State Error] Failed to get personalized state for player ${player.id}`,
          );
        }
      }
    });
  };

  io.on('connection', socket => {
    console.log(`Socket ${socket.id} connected.`);

    // Check if this socket ID is already associated with a game
    const existingGameId = playerGameMap.get(socket.id);
    // TODO: Handle reconnection logic if existingGameId is found?

    // <<< NEW: Listener to map socket.id to clientId for guests >>>
    socket.on('registerGuestClientId', clientId => {
      if (clientId && typeof clientId === 'string') {
        socketClientMap.set(socket.id, clientId);
      } else {
        console.warn(
          `[Socket Handler] Invalid clientId received for registerGuestClientId from socket ${socket.id}:`,
          clientId,
        );
      }
    });

    // --- Host Game Listener ---
    socket.on('hostGame', data => {
      const nickname = data.nickname;
      const icon = data.icon;
      const gameSettings = {
        promptsPerPlayer: data.settings?.promptsPerPlayer,
        pointsPerVote: data.settings?.pointsPerVote,
        allowMidGameJoin: data.settings?.allowMidGameJoin,
        handSize: data.settings?.handSize,
      };

      try {
        let newGameId = generateGameId();
        while (games.has(newGameId)) {
          newGameId = generateGameId();
        }
        const game = new Game(
          newGameId,
          socket.id,
          nickname,
          icon,
          PREDEFINED_PROMPTS,
          gameSettings,
          db,
        );
        games.set(newGameId, game);
        playerGameMap.set(socket.id, newGameId);
        socket.join(newGameId);

        const personalizedState = game.getPersonalizedState(socket.id);
        if (personalizedState) {
          socket.emit('gameCreated', personalizedState);
        } else {
          socket.emit('gameError', 'Failed to get initial game state.');
        }
      } catch (error) {
        console.error('Error creating game:', error);
        socket.emit('gameError', 'Failed to create game.');
      }
    });

    // --- Join Game Listener (Update to use data object too for consistency) ---
    socket.on('joinGame', data => {
      const gameId = data.gameCode;
      const nickname = data.nickname;
      const icon = data.icon;

      const game = games.get(gameId);
      if (!game) {
        console.log(`[joinGame Error] Game ${gameId} not found.`);
        return socket.emit('gameError', `Game ${gameId} not found.`);
      }

      // Check if player was previously in the game but disconnected
      // Need to search for player by nickname instead of socket.id since socket.id changes on reconnect
      let existingPlayer = null;
      let existingPlayerId = null;

      // Search for player with the same nickname (case insensitive) who is marked as disconnected
      game.players.forEach((player, id) => {
        if (player.nickname.toLowerCase() === nickname.toLowerCase() && !player.isConnected) {
          existingPlayer = player;
          existingPlayerId = id;
        }
      });

      // Reconnection logic - if this is a player that was previously in the game
      if (existingPlayer) {
        // Update the player's connection status and socket ID
        existingPlayer.isConnected = true;

        // Remove old socket ID mapping if it exists
        if (existingPlayerId !== socket.id) {
          playerGameMap.delete(existingPlayerId);

          // Create a new player with same data but new ID
          const reconnectedPlayer = {
            ...existingPlayer,
            id: socket.id,
          };

          // Remove old player and add new one with updated socket ID
          game.players.delete(existingPlayerId);
          game.players.set(socket.id, reconnectedPlayer);

          // If this was the host, update the host ID
          if (game.hostId === existingPlayerId) {
            game.hostId = socket.id;
          }
        }

        // Add to socket room and player-game mapping
        socket.join(gameId);
        playerGameMap.set(socket.id, gameId);

        // Send personalized state to reconnected player
        const personalizedState = game.getPersonalizedState(socket.id);
        if (personalizedState) {
          socket.emit('gameJoined', personalizedState);
          // Notify other players about reconnection
          emitPersonalizedGameStateUpdate(gameId);
        } else {
          socket.emit('gameError', 'Failed to get game state upon reconnection.');
        }
        return;
      }

      // Check for new player with same nickname as an ACTIVE player (duplicate)
      let nicknameTaken = false;
      game.players.forEach(p => {
        if (p.nickname.toLowerCase() === nickname.toLowerCase() && p.isConnected) {
          nicknameTaken = true;
        }
      });

      if (nicknameTaken) {
        console.log(`[joinGame Error] Nickname "${nickname}" taken in game ${gameId}.`);
        return socket.emit('gameError', `Nickname "${nickname}" is already taken.`);
      }

      // If player is not rejoining, check if joining is allowed based on phase and SETTING
      if (game.phase !== 'lobby') {
        if (!game.settings.allowMidGameJoin) {
          console.log(`[joinGame Error] Mid-game join disabled for game ${gameId}.`);
          return socket.emit('gameError', 'Joining mid-game is disabled for this game.');
        }
        // --- Logic for joining mid-game ---
        // Add player as a spectator or limited participant if game is in progress
        // For now, let's just add them normally but skip parts that assume lobby state

        const player = game.addPlayer(socket.id, nickname, icon);
        if (!player) {
          console.log(`[joinGame Error] Failed to add player ${nickname} to game ${gameId}.`);
          return socket.emit('gameError', 'Failed to join game mid-progress.');
        }
        playerGameMap.set(socket.id, gameId);
        socket.join(gameId);
        const personalizedState = game.getPersonalizedState(socket.id);
        if (personalizedState) {
          socket.emit('gameJoined', personalizedState);
        } else {
          socket.emit('gameError', 'Failed to get initial game state after joining mid-progress.');
        }
        emitPersonalizedGameStateUpdate(gameId); // Notify everyone a new player joined
        // --- End logic for joining mid-game ---
        return; // Important: Exit after handling mid-game join
      }

      // Original logic for joining during lobby phase
      const player = game.addPlayer(socket.id, nickname, icon);
      if (!player) {
        return socket.emit('gameError', 'Failed to join game.');
      }
      playerGameMap.set(socket.id, gameId);
      socket.join(gameId);

      // Check if odd number of prompts after adding player, adjust if needed
      const currentPlayerCount = Array.from(game.players.values()).filter(
        p => p.isConnected && !p.isDisplayPlayer,
      ).length;
      const currentPromptsSetting = game.settings.promptsPerPlayer;
      const currentTotalPrompts = currentPlayerCount * currentPromptsSetting;
      if (currentTotalPrompts % 2 !== 0) {
        const minValidPrompts = game.calculateMinValidPromptsPerPlayer(currentPlayerCount);
        game.updateSetting('promptsPerPlayer', minValidPrompts);
      }

      const personalizedState = game.getPersonalizedState(socket.id);
      if (personalizedState) {
        socket.emit('gameJoined', personalizedState);
      } else {
        socket.emit('gameError', 'Failed to get initial game state after joining.');
      }
      emitPersonalizedGameStateUpdate(gameId);
    });

    // Update Game Setting Listener
    socket.on('updateGameSetting', (gameId, settingKey, settingValue) => {
      const game = games.get(gameId);
      if (!game) {
        return socket.emit('gameError', 'Game not found.');
      }
      if (game.hostId !== socket.id) {
        return socket.emit('gameError', 'Only host can change settings.');
      }
      if (game.phase !== 'lobby') {
        return socket.emit('gameError', 'Settings can only be changed in the lobby.');
      }

      // Simple validation - only allow known keys
      const allowedKeys = [
        'promptsPerPlayer',
        'pointsPerVote',
        'allowMidGameJoin',
        'handSize',
        'gameMode',
      ];

      // Check if the received key exists in the allowed list
      if (!allowedKeys.includes(settingKey)) {
        console.warn(`[Handler updateGameSetting] Invalid setting key received: "${settingKey}"`);
        return socket.emit('gameError', `Invalid setting key: ${settingKey}`);
      }

      // Basic validation (can be more specific)
      let valueToSet = settingValue;
      if (
        settingKey === 'promptsPerPlayer' ||
        settingKey === 'pointsPerVote' ||
        settingKey === 'handSize'
      ) {
        valueToSet = parseInt(settingValue, 10);
        const maxVal =
          settingKey === 'promptsPerPlayer'
            ? 10
            : settingKey === 'handSize'
              ? 100
              : settingKey === 'pointsPerVote'
                ? 10000
                : 100;
        const minVal = settingKey === 'pointsPerVote' ? 0 : 1;

        if (isNaN(valueToSet) || valueToSet < minVal || valueToSet > maxVal) {
          return socket.emit(
            'gameError',
            `Invalid value for ${settingKey}. Must be a number between ${minVal} and ${maxVal}.`,
          );
        }
      } else if (settingKey === 'allowMidGameJoin') {
        valueToSet = !!settingValue;
      }

      game.settings[settingKey] = valueToSet;
      emitPersonalizedGameStateUpdate(gameId);
    });

    // Add Lobby Prompt Listener (Player-Specific)
    socket.on('addLobbyPrompt', (gameId, promptText) => {
      const game = games.get(gameId);
      const playerId = socket.id;
      const player = game?.getPlayer(playerId);

      if (!game || !player) {
        return socket.emit('gameError', 'Game or player not found.');
      }
      if (game.phase !== 'lobby') {
        return socket.emit('gameError', 'Can only add prompts in the lobby.');
      }

      const result = game.addLobbyPromptForPlayer(playerId, promptText);

      if (result.success) {
        const personalizedState = game.getPersonalizedState(playerId);
        if (personalizedState) {
          io.to(playerId).emit('update', personalizedState);
        } else {
          console.error(
            `[addLobbyPrompt Handler] FAILED to get personalized state for player ${playerId} after adding prompt.`,
          );
          socket.emit('gameError', 'Failed to get updated state after adding prompt.');
        }
      } else {
        socket.emit('gameError', `Failed to add prompt: ${result.message}`);
      }
    });

    // Delete Lobby Prompt Listener
    socket.on('deleteLobbyPrompt', (gameId, promptIndex) => {
      const game = games.get(gameId);
      const playerId = socket.id;
      const player = game?.getPlayer(playerId);

      if (!game || !player) {
        return socket.emit('gameError', 'Game or player not found.');
      }
      if (game.phase !== 'lobby') {
        return socket.emit('gameError', 'Can only delete prompts in the lobby.');
      }

      const result = game.deleteLobbyPromptForPlayer(playerId, promptIndex);

      if (result.success) {
        const personalizedState = game.getPersonalizedState(playerId);
        if (personalizedState) {
          io.to(playerId).emit('update', personalizedState);
        } else {
          console.error(
            `[deleteLobbyPrompt Handler] FAILED to get personalized state for player ${playerId} after deleting prompt.`,
          );
          socket.emit('gameError', 'Failed to get updated state after deleting prompt.');
        }
      } else {
        socket.emit('gameError', `Failed to delete prompt: ${result.message}`);
      }
    });

    // Continue Game Listener
    socket.on('continueGame', gameId => {
      const game = games.get(gameId);
      if (!game) {
        return socket.emit('gameError', 'Game not found.');
      }
      if (game.hostId !== socket.id) {
        return socket.emit('gameError', 'Only host can continue the game.');
      }
      if (game.phase !== 'final_results') {
        return socket.emit('gameError', 'Can only continue from final results.');
      }

      const success = game.startNextRound();
      if (success) {
        emitPersonalizedGameStateUpdate(gameId);
      } else {
        console.error(
          `[Handler continueGame] game.startNextRound failed for ${gameId}. Emitting potentially updated state.`,
        );
        emitPersonalizedGameStateUpdate(gameId);
        socket.emit(
          'gameError',
          'Failed to start next round (e.g., not enough players or prompts). Returned to lobby.',
        );
      }
    });

    // Reset Lobby Listener
    socket.on('resetLobby', gameId => {
      const game = games.get(gameId);

      if (!game) {
        return socket.emit('gameError', 'Game not found.');
      }
      if (game.hostId !== socket.id) {
        return socket.emit('gameError', 'Only host can return to lobby.');
      }
      if (game.phase !== 'final_results') {
        return socket.emit(
          'gameError',
          `Can only return to lobby from final results (current: ${game.phase}).`,
        );
      }

      const resetSuccess = game.resetLobby();

      if (resetSuccess) {
        try {
          emitPersonalizedGameStateUpdate(gameId);
        } catch (emitError) {
          console.error(
            `[Handler resetLobby EMIT ERROR] Error during emitPersonalizedGameStateUpdate for ${gameId}:`,
            emitError,
          );
        }
      } else {
        console.error(
          `[Handler resetLobby FAILED] game.resetLobby() returned false for game ${gameId}.`,
        );
        socket.emit(
          'gameError',
          'Failed to return to lobby (internal state issue). Please try again or start a new game.',
        );
      }
    });

    // Kick Player Listener
    socket.on('kickPlayer', (gameId, playerIdToKick) => {
      const game = games.get(gameId);
      const kickerId = socket.id;

      if (!game) {
        return socket.emit('gameError', 'Game not found.');
      }
      const playerToKick = game.getPlayer(playerIdToKick);
      if (!playerToKick) {
        return;
      }

      // Permission checks
      if (game.hostId !== kickerId) {
        return socket.emit('gameError', 'Only the host can kick players.');
      }
      if (playerIdToKick === game.hostId) {
        return socket.emit('gameError', 'Host cannot kick themselves.');
      }

      // Optional: Only allow kicking in lobby?
      // if (game.phase !== 'lobby') {
      //   return socket.emit('gameError', 'Can only kick players in the lobby.');
      // }

      // 1. Remove player from the game
      const _deleted = game.players.delete(playerIdToKick);

      // 2. Remove from player-game mapping
      playerGameMap.delete(playerIdToKick);

      // 3. Try to notify the kicked player (if they're still connected)
      const kickedSocket = io.sockets.sockets.get(playerIdToKick);
      if (kickedSocket) {
        kickedSocket.emit('kicked', `You have been kicked from the game by the host.`);
        kickedSocket.leave(gameId);
        // Optionally force disconnect?
        // kickedSocket.disconnect(true);
      } else {
        console.warn(`[kickPlayer] Could not find socket for kicked player ${playerIdToKick}.`);
      }

      // 5. Emit updated state to remaining players
      emitPersonalizedGameStateUpdate(gameId);
    });

    // Set Player as Display Listener
    socket.on('setPlayerAsDisplay', (gameId, targetPlayerId) => {
      const game = games.get(gameId);
      const requesterId = socket.id;

      if (!game) {
        return socket.emit('gameError', 'Game not found.');
      }
      if (game.hostId !== requesterId) {
        return socket.emit('gameError', 'Only the host can set display players.');
      }
      if (game.phase !== 'lobby') {
        return socket.emit('gameError', 'Can only set display players in the lobby.');
      }

      const targetPlayer = game.getPlayer(targetPlayerId);
      if (!targetPlayer) {
        return socket.emit('gameError', 'Target player not found.');
      }

      // Set all players to not be display player first
      game.players.forEach(player => {
        player.isDisplayPlayer = false;
      });

      // Set the target player as the display player
      targetPlayer.isDisplayPlayer = true;

      emitPersonalizedGameStateUpdate(gameId);
    });

    // Start Game Listener
    socket.on('startGame', gameId => {
      const game = games.get(gameId);
      if (!game) {
        return socket.emit('gameError', 'Game not found.');
      }
      if (game.hostId !== socket.id) {
        return socket.emit('gameError', 'Only host can start game.');
      }
      if (game.phase !== 'lobby') {
        return socket.emit('gameError', 'Game already started.');
      }

      // Transition to card selection phase
      game.phase = 'cardSelection';
      
      // Reset player confirmation states
      game.players.forEach(player => {
        player.hasConfirmedCards = false;
        player.submittedCardPaths = [];
      });

      emitPersonalizedGameStateUpdate(gameId);
    });

    socket.on('selectCards', (gameId, playerId, selectedImagePaths) => {
      if (socket.id !== playerId) {
        return;
      }
      const game = games.get(gameId);
      if (!game || game.phase !== 'cardSelection') {
        return;
      }
      const _success = game.setPlayerSelectedCards(playerId, selectedImagePaths);
    });

    // Confirm Card Selection Listener
    socket.on('confirmCardSelection', (gameId, playerId, payload) => {
      if (socket.id !== playerId) {
        console.warn(
          `Security mismatch: confirmCardSelection received for ${playerId} from socket ${socket.id}`,
        );
        return;
      }

      const game = games.get(gameId);
      if (!game || game.phase !== 'cardSelection') {
        return;
      }

      const submittedImagePaths = payload?.imagePaths;
      if (!Array.isArray(submittedImagePaths)) {
        console.warn(
          `[confirmCardSelection Handler] Invalid payload received from ${playerId}. Expected { imagePaths: [...] }, got:`,
          payload,
        );
        socket.emit('gameError', 'Invalid card confirmation data sent.');
        return;
      }

      const success = game.confirmPlayerCardSelection(playerId, submittedImagePaths);

      if (success) {
        emitPersonalizedGameStateUpdate(gameId);
        if (game.checkAllPlayersConfirmedCards()) {
          const cardsProcessed = game.processAllCardSelections();
          if (!cardsProcessed) {
            console.error(
              `[Handler confirmCardSelection] Failed to process card selections for game ${gameId}.`,
            );
            game.phase = 'ended';
            emitPersonalizedGameStateUpdate(gameId);
            return;
          }

          const promptPhaseStarted = game.startPromptPhase();
          if (promptPhaseStarted) {
            emitPersonalizedGameStateUpdate(gameId);
          } else {
            console.error(
              `[Handler confirmCardSelection] Failed to start prompt phase (likely pairing/prompt count issue). Game phase is now '${game.phase}'.`,
            );
            emitPersonalizedGameStateUpdate(gameId);
          }
        }
      } else {
        console.warn(`[confirmCardSelection Handler] Confirmation failed for ${playerId}.`);
        socket.emit(
          'gameError',
          `Failed to confirm: Please select at least ${game.cardsPerPlayerRequired} cards.`,
        );
      }
    });

    // Submit Answer Listener
    socket.on('submitAnswer', (gameId, playerId, promptText, imagePath) => {
      if (socket.id !== playerId) {
        console.warn(
          `[Handler submitAnswer] Security mismatch: Received for ${playerId} from socket ${socket.id}`,
        );
        return;
      }
      const game = games.get(gameId);
      if (!game) {
        return;
      }

      const success = game.submitAnswer(playerId, promptText, imagePath);

      if (success) {
        emitPersonalizedGameStateUpdate(gameId);
      } else {
        console.warn(
          `[Handler submitAnswer] Submission failed for player ${playerId}. No update emitted.`,
        );
        socket.emit(
          'gameError',
          'Submission failed. Card might not be in hand or prompt already answered.',
        );
      }
    });

    // Submit Vote Listener
    socket.on('submitVote', (gameId, playerId, votedImagePath) => {
      if (socket.id !== playerId) {
        console.warn(`Security: submitVote from wrong socket ${socket.id} for player ${playerId}`);
        return;
      }
      const game = games.get(gameId);
      if (!game) {
        return socket.emit('error', 'Game not found.');
      }

      const result = game.submitVote(playerId, votedImagePath);

      if (result.success) {
        emitPersonalizedGameStateUpdate(gameId);
      } else {
        socket.emit('error', `Vote failed: ${result.message}`);
      }
    });

    // Request Next Vote or Results Listener
    socket.on('requestNextVoteOrResults', (gameId, playerId) => {
      if (socket.id !== playerId) {
        console.warn(
          `Security: requestNextVoteOrResults from wrong socket ${socket.id} for player ${playerId}`,
        );
        return;
      }
      const game = games.get(gameId);
      if (!game) {
        return socket.emit('error', 'Game not found.');
      }

      const success = game.advanceGameFromReveal();

      if (success) {
        emitPersonalizedGameStateUpdate(gameId);
      } else {
        socket.emit('error', 'Failed to advance from vote reveal.');
      }
    });

    // Advance from Reveal Handler
    socket.on('advanceFromReveal', () => {
      const gameId = playerGameMap.get(socket.id);
      if (!gameId) {
        return console.warn(`[Handler advanceFromReveal] User ${socket.id} not in game map.`);
      }
      const game = games.get(gameId);
      if (!game) {
        return console.warn(`[Handler advanceFromReveal] Game ${gameId} not found.`);
      }
      const player = game.getPlayer(socket.id);
      if (!player) {
        return console.warn(
          `[Handler advanceFromReveal] Player ${socket.id} not found in game ${gameId}.`,
        );
      }

      // Only host can advance
      if (!player.isHost) {
        console.warn(
          `[Handler advanceFromReveal] Rejected: Player ${player.nickname} is not the host.`,
        );
        return socket.emit('gameError', 'Only the host can advance the game.');
      }

      const success = game.advanceGameFromReveal();

      if (success) {
        emitPersonalizedGameStateUpdate(gameId);
      } else {
        console.warn(
          `[Handler advanceFromReveal] game.advanceGameFromReveal() returned false. Current phase: ${game.phase}.`,
        );
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const gameId = playerGameMap.get(socket.id);
      if (gameId) {
        const game = games.get(gameId);
        if (game) {
          // Check if host is leaving the lobby
          if (game.hostId === socket.id && game.phase === 'lobby') {
            const hostNickname = game.getPlayer(socket.id)?.nickname || 'The host';
            // Emit to remaining players
            game.players.forEach(p => {
              if (p.id !== socket.id) {
                io.to(p.id).emit('lobbyClosedByHost', `Lobby closed: Host (${hostNickname}) left.`);
                playerGameMap.delete(p.id);
              }
            });
            const _deleted = games.delete(gameId);
            playerGameMap.delete(socket.id);
            return;
          }

          const player = game.getPlayer(socket.id);
          if (player) {
            player.isConnected = false;
          }

          const gameEnded = game.disconnectPlayer(socket.id);
          const remainingConnectedPlayerCount = Array.from(game.players.values()).filter(
            p => p.isConnected,
          ).length;
          playerGameMap.delete(socket.id);

          if (gameEnded && game.phase === 'final_results') {
            emitPersonalizedGameStateUpdate(gameId);
          } else if (remainingConnectedPlayerCount > 0) {
            emitPersonalizedGameStateUpdate(gameId);
          } else {
            setTimeout(() => {
              const currentGame = games.get(gameId);
              if (currentGame) {
                const connectedPlayers = Array.from(currentGame.players.values()).filter(
                  p => p.isConnected,
                ).length;
                if (connectedPlayers === 0) {
                  const _deleted = games.delete(gameId);
                }
              }
            }, 300000); // 5 minutes timeout
          }
        } else {
          console.warn(
            `Game ${gameId} not found for disconnected player ${socket.id}. Removing mapping.`,
          );
          playerGameMap.delete(socket.id);
        }
      }

      // Guest card cleanup logic
      const guestClientId = socketClientMap.get(socket.id);
      if (guestClientId) {
        const clientCards = cardStore[guestClientId];
        if (clientCards && clientCards.length > 0) {
          clientCards.forEach(card => {
            const imagePathToDelete = path.join(baseUploadsDir, card.imagePath.substring(1));
            try {
              fs.unlinkSync(imagePathToDelete);
            } catch (deleteError) {
              if (deleteError.code !== 'ENOENT') {
                console.error(
                  `[Disconnect Cleanup] Error deleting guest card file ${imagePathToDelete}:`,
                  deleteError,
                );
              }
            }
          });
          delete cardStore[guestClientId];
        }
        socketClientMap.delete(socket.id);
      }

      // Basic error handler per socket
      socket.on('error', err => {
        console.error(`Socket ${socket.id} error:`, err);
      });
    });

    // TODO: Handle reconnection logic if existingGameId is found?
    // Basic reconnection handling - rejoin previous game if it exists
    if (existingGameId && games.has(existingGameId)) {
      const game = games.get(existingGameId);
      if (game.players.has(socket.id)) {
        // Player was in this game, rejoin them
        socket.join(existingGameId);
        console.log(`[Reconnection] Socket ${socket.id} rejoined game ${existingGameId}`);
        
        // Send current game state to reconnected player
        const gameState = game.getStateForPlayer(socket.id);
        socket.emit('gameState', gameState);
      }
    }
  });

  console.log('Socket.IO handlers initialized.');
}

module.exports = { initializeSocketHandlers };