// client/src/components/Lobby.js
import { useState, useEffect } from 'react';
import '../styles/Lobby.css'; // Optional: Add specific styles if needed
import { LoadingSpinner } from './common';

function Lobby({ gameState, socket, playerId, isHost, error, setError, onLeaveGame }) {
  const [copied, setCopied] = useState(false); // State for copy feedback
  const [customPromptInput, setCustomPromptInput] = useState(''); // <-- State for input field
  const [showDisplayPicker, setShowDisplayPicker] = useState(false); // <<< ADDED: State for display picker visibility

  // <<< Game Settings State >>>
  const [promptsPerPlayer, setPromptsPerPlayer] = useState(
    gameState?.settings?.promptsPerPlayer ?? 3,
  );
  const [pointsPerVote, setPointsPerVote] = useState(gameState?.settings?.pointsPerVote ?? 100);
  const [allowMidGameJoin, setAllowMidGameJoin] = useState(
    gameState?.settings?.allowMidGameJoin !== undefined ? gameState.settings.allowMidGameJoin : true,
  );
  const [handSize, setHandSize] = useState(gameState?.settings?.handSize ?? 5);
  const [gameMode, setGameMode] = useState(gameState?.settings?.gameMode ?? 'Classic'); // <-- Add gameMode state
  // <<< End Settings State >>>

  // <<< Destructure general gameState info >>>
  const { players, gameId, hostId, _phase, _settings, _myLobbyAddedPrompts, _isDisplayPlayer } = gameState || {};
  const playerCount = players.length;

  // <<< Find current player state >>>
  const currentPlayerState = players.find(p => p.id === playerId);

  // <<< Get myLobbyPrompts from current player state >>>
  const myLobbyPrompts = currentPlayerState?.myLobbyAddedPrompts || []; // <<< CORRECTED PROPERTY NAME

  // --- Effect to update local settings state if gameState changes ---
  useEffect(() => {
    if (gameState?.settings) {
      setPromptsPerPlayer(gameState.settings.promptsPerPlayer ?? 3);
      setPointsPerVote(gameState.settings.pointsPerVote ?? 100);
      setAllowMidGameJoin(
        gameState.settings.allowMidGameJoin !== undefined
          ? gameState.settings.allowMidGameJoin
          : true,
      );
      setHandSize(gameState.settings.handSize ?? 5);
      setGameMode(gameState.settings.gameMode ?? 'Classic'); // <-- Update gameMode state
    }
  }, [gameState?.settings]);
  // --- End Effect ---

  // --- Helper function to calculate valid prompts per player ---
  const calculateValidPromptsPerPlayer = direction => {
    // Direction: 1 for increment, -1 for decrement
    let newValue = promptsPerPlayer + direction;

    // Enforce minimum of 2
    newValue = Math.max(2, newValue);

    // Enforce maximum of 10
    newValue = Math.min(10, newValue);

    // Check if the total number of prompts would be even
    const totalPrompts = playerCount * newValue;

    if (totalPrompts % 2 !== 0) {
      // If incrementing and result is odd, increment once more
      if (direction > 0 && newValue < 10) {
        newValue += 1;
      }
      // If decrementing and result is odd, decrement once more
      else if (direction < 0 && newValue > 2) {
        newValue -= 1;
      }
      // If at limits (2 or 10) and still odd, find nearest valid value
      else {
        // Find the nearest valid value
        for (let i = 2; i <= 10; i++) {
          if ((playerCount * i) % 2 === 0) {
            // Choose the nearest valid value to current
            if (Math.abs(i - promptsPerPlayer) < Math.abs(newValue - promptsPerPlayer)) {
              newValue = i;
            }
            break;
          }
        }
      }
    }

    return newValue;
  };

  const handleStartGame = () => {
    if (players.length < 2) {
      alert('Need at least 2 players to start.');
      return;
    }
    if (socket && isHost) {
      socket.emit('startGame', gameId);
    }
  };

  // --- Function to copy game code ---
  const handleCopyCode = () => {
    // Check if Clipboard API is available in this context
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(gameId)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        })
        .catch(err => {
          console.error('Failed to copy code automatically: ', err);
          alert('Could not copy code automatically. Please select and copy manually.');
        });
    } else {
      // Fallback for insecure contexts or missing API
      try {
        // Attempt to select the text (may not work in all browsers/elements easily)
        // For simplicity, just alert the user to copy manually.
        alert(
          'Cannot copy automatically in this browser/context. Please select and copy the code manually.',
        );
        setCopied(false); // Ensure copied state is false
      } catch (err) {
        console.error('Fallback copy alert failed:', err);
        alert('Failed to copy game code.');
      }
    }
  };
  // --- End copy function ---

  // <<< Handlers for settings changes >>>
  const handleIncrementPrompts = () => {
    const newValue = calculateValidPromptsPerPlayer(1);
    if (newValue !== promptsPerPlayer) {
      setPromptsPerPlayer(newValue);
      socket?.emit('updateGameSetting', gameId, 'promptsPerPlayer', newValue);
    }
  };

  const handleDecrementPrompts = () => {
    const newValue = calculateValidPromptsPerPlayer(-1);
    if (newValue !== promptsPerPlayer) {
      setPromptsPerPlayer(newValue);
      socket?.emit('updateGameSetting', gameId, 'promptsPerPlayer', newValue);
    }
  };

  const handlePointsChange = e => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      setPointsPerVote(value);
      socket?.emit('updateGameSetting', gameId, 'pointsPerVote', value);
    }
  };
  const handleAllowJoinChange = e => {
    const value = e.target.checked;
    setAllowMidGameJoin(value);
    socket?.emit('updateGameSetting', gameId, 'allowMidGameJoin', value);
  };
  const handleHandSizeChange = e => {
    const value = parseInt(e.target.value, 10);

    if (e.target.value === '') {
      setHandSize('');
      return;
    }

    // Validate 1 to 100
    if (!isNaN(value) && value >= 1 && value <= 100) {
      setHandSize(value);
      // <<< Emit value directly; server will validate against prompts >>>
      socket?.emit('updateGameSetting', gameId, 'handSize', value);
    } else if (!isNaN(value) && (value < 1 || value > 100)) {
      // Clamp value locally and emit the clamped value
      const clampedValue = Math.max(1, Math.min(value, 100));
      setHandSize(clampedValue);
      socket?.emit('updateGameSetting', gameId, 'handSize', clampedValue);
    } else if (isNaN(value)) {
      // Reset state to last known valid or default
      const serverDefault = gameState?.settings?.handSize ?? 5;
      setHandSize(serverDefault);
      socket?.emit('updateGameSetting', gameId, 'handSize', serverDefault);
    }
  };
  const handleGameModeChange = e => {
    const value = e.target.value;
    if (['Classic', 'Mega Deck', 'Flip the Script'].includes(value)) {
      setGameMode(value);
      socket?.emit('updateGameSetting', gameId, 'gameMode', value);
    }
  };
  // <<< End Handlers >>>

  // --- Handler for adding a custom prompt ---
  const handleAddCustomPrompt = e => {
    e.preventDefault(); // Prevent form submission if needed
    const promptToAdd = customPromptInput.trim();
    if (promptToAdd && gameId && socket) {
      socket.emit('addLobbyPrompt', gameId, promptToAdd);
      setCustomPromptInput(''); // Clear input after submitting
    }
  };
  // --- End Handler ---

  // --- Handler for DELETING a custom prompt ---
  const handleDeletePrompt = indexToDelete => {
    if (gameId && socket && typeof indexToDelete === 'number') {
      socket.emit('deleteLobbyPrompt', gameId, indexToDelete);
    }
  };
  // --- End Delete Handler ---

  // --- Game Mode Descriptions ---
  const gameModeDescriptions = {
    Classic: 'Standard Qwik Pik gameplay. Match hilarious images to prompts and vote for the best!',
    'Mega Deck': 'All selected cards are shuffled into one big pile that everyone draws from.',
    'Flip the Script':
      'Players get an image prompt and write a text response. Vote for the funniest response!',
  };

  // <<< Handler for Kicking a Player >>>
  const handleKickPlayer = playerIdToKick => {
    if (!isHost) {
      return; // Only host can kick
    }
    if (playerIdToKick === playerId) {
      return; // Host cannot kick themselves
    }
    if (socket && gameState?.gameId && playerIdToKick) {
      socket.emit('kickPlayer', gameState.gameId, playerIdToKick);
    } else {
      console.error('Cannot kick player: Socket, GameID, or PlayerIDToKick missing.');
      setError('Could not kick player due to a connection issue.');
    }
  };
  // <<< End Kick Handler >>>

  // <<< Handler for Setting Display Player >>>
  const handleSetDisplayPlayer = targetPlayerId => {
    if (!isHost) {
      return;
    }
    if (targetPlayerId === playerId) {
      // playerId is the host's socket ID here
      setError('Host cannot be the display player.'); // Show error to host
      return;
    }
    if (socket && gameId && targetPlayerId) {
      socket.emit('setPlayerAsDisplay', gameId, targetPlayerId);
    } else {
      console.error('Cannot set display player: Socket, GameID, or TargetPlayerID missing.');
      setError('Could not set display player due to a connection issue.');
    }
  };
  // <<< End Display Player Handler >>>

  return (
    <div className='lobby-container card'>
      <h2>Lobby</h2>
      {/* Updated game code display with button */}
      <div className='game-code-display-wrapper'>
        <span className='game-code-text'>
          Game Code: <strong>{gameId}</strong>
        </span>
        <button onClick={handleCopyCode} className='copy-button' title='Copy Game Code'>
          {copied ? 'Copied! ✔' : '📋'}
        </button>
      </div>

      {/* <<< MODIFIED: Host controls for display player >>> */}
      {isHost && (
        <div className='display-player-controls'>
          {/* Button only toggles picker visibility */}
          <button
            onClick={() => setShowDisplayPicker(prev => !prev)}
            className='set-display-button'
          >
            Set Display 📺
          </button>
          {showDisplayPicker && (
            <ul className='display-picker-list simple-list'>
              {players
                .filter(p => p.id !== hostId && p.isConnected) // Exclude host, only show connected players
                .map(p => (
                  <li
                    key={p.id}
                    onClick={() => {
                      handleSetDisplayPlayer(p.id);
                      setShowDisplayPicker(false);
                    }}
                    className='display-picker-item'
                  >
                    {p.icon} {p.nickname} {p.isDisplayPlayer ? '📺' : ''}
                  </li>
                ))}
              {/* Informational item if a display player is already set, no onClick needed */}
              {players.some(p => p.isDisplayPlayer) && (
                <li className='display-picker-info'>
                  <em>(Selecting a player will make them the new display)</em>
                </li>
              )}
              {/* Informational item if NO display player is set */}
              {!players.some(p => p.isDisplayPlayer) && (
                <li className='display-picker-info'>
                  <em>(Pick a player above to set as display)</em>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
      {/* <<< END MODIFIED >>> */}

      <h4>Players ({playerCount})</h4>
      <ul className='player-list'>
        {players.map(player => (
          <li key={player.id} className='player-item'>
            <span className='player-icon'>{player.icon}</span>
            <span className='player-nickname'>{player.nickname}</span>
            <span className='player-indicators'>
              {player.id === hostId ? <span className='host-indicator'>👑</span> : ''}
              {socket?.id === player.id ? <span className='you-indicator'>(You)</span> : ''}
              {player.isDisplayPlayer ? <span className='display-indicator'>📺</span> : ''}{' '}
              {/* <<< MODIFIED: Emoji indicator >>> */}
            </span>
            {/* <<< Kick Button (Host Only, Not Self) >>> */}
            {isHost && player.id !== hostId && (
              <button
                className='kick-button'
                onClick={() => handleKickPlayer(player.id)}
                title={`Kick ${player.nickname}`}
              >
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* <<< Game Settings Area (Host Only) >>> */}
      {isHost && (
        <div className='game-settings'>
          <h4>Game Settings</h4>
          <div className='setting-item'>
            <label htmlFor='promptsPerPlayer'>Prompts per Player:</label>
            <div className='number-control'>
              <button
                className='number-control-button'
                onClick={handleDecrementPrompts}
                disabled={promptsPerPlayer <= 2}
                aria-label='Decrease prompts per player'
              >
                -
              </button>
              <span className='number-display'>{promptsPerPlayer}</span>
              <button
                className='number-control-button'
                onClick={handleIncrementPrompts}
                disabled={promptsPerPlayer >= 10}
                aria-label='Increase prompts per player'
              >
                +
              </button>
            </div>
          </div>
          <div className='setting-item'>
            <label htmlFor='handSize'>Hand Size:</label>
            <input
              type='number'
              id='handSize'
              value={handSize}
              onChange={handleHandSizeChange}
              min='1'
              max='100'
              step='1'
              title={`Max cards visible (1-100)`}
              className='number-input'
            />
          </div>
          <div className='setting-item'>
            <label htmlFor='pointsPerVote'>Points per Vote:</label>
            <input
              type='number'
              id='pointsPerVote'
              value={pointsPerVote}
              onChange={handlePointsChange}
              min='0'
            />
          </div>
          <div className='setting-item'>
            <label htmlFor='allowMidGameJoin'>Allow Joining Mid-Game:</label>
            <input
              type='checkbox'
              id='allowMidGameJoin'
              checked={allowMidGameJoin}
              onChange={handleAllowJoinChange}
            />
          </div>
          {/* Game Mode Selection - Revised Structure */}
          <div className='setting-item game-mode-item'>
            {' '}
            {/* Add specific class */}
            <div className='game-mode-selector-container'>
              {' '}
              {/* New container for label+select */}
              <label htmlFor='gameMode'>Game Mode:</label>
              <select id='gameMode' value={gameMode} onChange={handleGameModeChange}>
                <option value='Classic'>Classic</option>
                <option value='Mega Deck'>Mega Deck</option>
                <option value='Flip the Script'>Flip the Script</option>
              </select>
            </div>
            <p className='game-mode-description'>{gameModeDescriptions[gameMode]}</p>{' '}
            {/* Description outside selector container */}
          </div>
          {/* End Game Mode Selection */}
        </div>
      )}
      {/* <<< End Game Settings Area >>> */}

      {/* <<< Custom Prompts Section >>> */}
      <div className='custom-prompts-section'>
        <h3>Custom Prompts</h3>
        <div className='custom-prompt-input-area'>
          <input
            type='text'
            value={customPromptInput}
            onChange={e => setCustomPromptInput(e.target.value)}
            placeholder='Enter your prompt...'
            maxLength={150} // Match server validation
            className='custom-prompt-input'
          />
          <button
            onClick={handleAddCustomPrompt}
            className='add-prompt-button'
            disabled={!customPromptInput.trim()} // Disable if input is empty
          >
            Add
          </button>
        </div>
        {/* Display the list of custom prompts */}
        {myLobbyPrompts && myLobbyPrompts.length > 0 ? (
          <ul className='custom-prompts-list'>
            {myLobbyPrompts.map((prompt, index) => (
              <li key={prompt}>
                {prompt}
                {/* Add delete button */}
                <button
                  onClick={() => handleDeletePrompt(index)}
                  className='delete-prompt-button'
                  title='Delete this prompt'
                >
                  &times; {/* HTML entity for 'x' sign */}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className='no-custom-prompts-message'>You haven&apos;t added any prompts yet.</p>
        )}
      </div>
      {/* <<< End Custom Prompts Section >>> */}

      {/* Wrap Buttons/Waiting Message in the .lobby-actions container */}
      <div className='lobby-actions'>
        {isHost ? (
          <button onClick={handleStartGame} className='start-button'>
            Start Game
          </button>
        ) : (
          <div className='waiting-container'>
            <LoadingSpinner size='small' />
            <p className='waiting-message'>Waiting for the host to start the game</p>
          </div>
        )}
        {/* Use correct class and place inside container */}
        <button onClick={onLeaveGame} className='leave-lobby-button'>
          Leave Game
        </button>
      </div>

      {error && <p className='error-message'>Error: {error}</p>}
    </div>
  );
}

export default Lobby;
