// client/src/components/TitleScreen.js
import { useState, useEffect } from 'react';
import '../styles/global.css';
import '../styles/TitleScreen.css';

// Define some default emojis
const defaultEmojis = [
  '😀',
  '😎',
  '🤯',
  '🚀',
  '🤖',
  '👽',
  '🥳',
  '😂',
  '✨',
  '👻',
  '😇',
  '😈',
  '🤡',
  '💩',
  '🦄',
  '🐢',
  '🍕',
  '💡',
  '❤️',
  '👑',
];

function TitleScreen({
  socket,
  isConnected,
  _playerId,
  _onNavigateToGame,
  onNavigateToMyCards,
  error,
  setError,
  setAppNickname,
  currentNickname,
  loggedInUsername,
  loggedInUserIcon,
  _deviceInfo,
  // Legacy props (keeping for backward compatibility)
  _onJoinGame,
  _onCreateGame,
  _onNavigateToLogin,
  _onNavigateToAccount,
}) {
  const [nicknameInput, setNicknameInput] = useState('');
  const [gameCodeInput, setGameCodeInput] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(defaultEmojis[0]); // Re-add emoji state
  const [showJoinInput, setShowJoinInput] = useState(false); // Re-add join toggle state
  const [showIconList, setShowIconList] = useState(false); // <<< State for icon list visibility

  // Effect to initialize nicknameInput and selectedEmoji
  useEffect(() => {
    if (loggedInUsername) {
      setNicknameInput(loggedInUsername); // Use logged-in name if available
      if (typeof setAppNickname === 'function') {
        setAppNickname(loggedInUsername); // Update App's nickname state
      }
      // Initialize emoji from App state if logged in
      const initialIcon = loggedInUserIcon || defaultEmojis[0]; // Use prop directly
      setSelectedEmoji(initialIcon);
    } else if (currentNickname) {
      setNicknameInput(currentNickname); // Otherwise, use the nickname from App state
      // Keep default emoji if not logged in but returning to title
      setSelectedEmoji(defaultEmojis[0]); // Or maybe store last selected non-logged-in icon?
    } else {
      // Fresh load, not logged in
      setNicknameInput('');
      setSelectedEmoji(defaultEmojis[0]);
    }
  }, [loggedInUsername, loggedInUserIcon, setAppNickname, currentNickname]); // Add currentNickname dependency

  const handleNicknameChange = event => {
    const newNick = event.target.value;
    setNicknameInput(newNick); // Update local input state
    if (typeof setAppNickname === 'function') {
      setAppNickname(newNick); // Update App state immediately
    }
  };

  const handleGameCodeChange = event => {
    setGameCodeInput(event.target.value.toUpperCase()); // Force uppercase for consistency
  };

  const handleHostGame = () => {
    // <<< Add check for socket and connection >>>
    if (!socket || !isConnected) {
      console.error('[TitleScreen] Cannot host game: Socket not connected or available.', {
        socket,
        isConnected,
      });
      setError('Not connected to server. Please wait or refresh.');
      return;
    }

    // Validate nickname and icon
    if (!nicknameInput.trim()) {
      setError('Please enter a nickname.');
      return;
    }
    if (!selectedEmoji) {
      setError('Please select an icon.');
      return;
    }
    setError('');

    // <<< Define Default Settings >>>
    const defaultSettings = {
      promptsPerPlayer: 3,
      pointsPerVote: 100,
      allowMidGameJoin: true,
      handSize: 5, // Use the same default as the server
    };

    // Determine nickname and icon to use
    const nicknameToUse =
      loggedInUsername || nicknameInput || `Player${Math.floor(Math.random() * 1000)}`;

    // Emit hostGame event with nickname, icon, and default settings
    console.log(
      `[TitleScreen] Emitting hostGame with nickname: ${nicknameToUse} and icon: ${selectedEmoji}`,
    );
    socket.emit('hostGame', {
      nickname: nicknameToUse.trim(),
      icon: selectedEmoji,
      settings: defaultSettings, // <<< Send settings >>>
    });
    // Navigation to game view will likely happen upon receiving 'gameCreated' or similar
  };

  const handleJoinGame = () => {
    // <<< Add check for socket and connection >>>
    if (!socket || !isConnected) {
      console.error('[TitleScreen] Cannot join game: Socket not connected or available.', {
        socket,
        isConnected,
      });
      setError('Not connected to server. Please wait or refresh.');
      return;
    }

    // Toggle input visibility first
    if (!showJoinInput) {
      setShowJoinInput(true);
      setError('');
      return;
    }

    // If input is visible, attempt to join
    if (!nicknameInput.trim()) {
      setError('Please enter a nickname to join a game.');
      return;
    }
    const gameCodeToUse = gameCodeInput.trim(); // Trim whitespace
    if (!gameCodeToUse) {
      setError('Please enter a game code to join.');
      return;
    }

    // <<< ADD Game Code Validation >>>
    const gameCodeRegex = /^[A-Z0-9]{5}$/;
    if (!gameCodeRegex.test(gameCodeToUse)) {
      setError('Invalid game code format. Code must be 5 uppercase letters/numbers.');
      return;
    }
    // <<< END Validation >>>

    const nicknameToUse = nicknameInput.trim();
    if (typeof setAppNickname === 'function') {
      setAppNickname(nicknameToUse);
    }

    // Clear error if validation passes
    setError('');

    console.log(
      `[TitleScreen] Emitting joinGame with nickname: ${nicknameToUse}, gameCode: ${gameCodeToUse}, icon: ${selectedEmoji}`,
    );
    socket.emit('joinGame', {
      nickname: nicknameToUse,
      gameCode: gameCodeToUse,
      icon: selectedEmoji,
    });
  };

  return (
    // Use global card/centering styles + specific class
    <div className='title-screen-container'>
      <h1>Welcome!</h1>
      {/* Connection status (optional) */}
      {/* <p className="connection-status"> ... </p> */}

      {error && <p className='error-message'>{error}</p>}

      {/* --- Nickname Input --- */}
      <div className='nickname-section-reverted'>
        {' '}
        {/* Added a temp class to avoid potential CSS conflicts if needed */}
        <label htmlFor='nickname'>Current Nickname:</label> {/* <<< CHANGE LABEL TEXT */}
        <input
          type='text'
          id='nickname'
          placeholder='Enter your nickname'
          value={nicknameInput}
          onChange={handleNicknameChange}
          maxLength={12}
          className='nickname-input'
          disabled={!isConnected}
        />
      </div>
      {/* --- End Nickname Input --- */}

      {/* --- New Icon Display --- */}
      <div className='current-icon-section'>
        <p>
          Your Current Icon: <span className='current-icon-display'>{selectedEmoji}</span>
        </p>
        {!showIconList && (
          <button
            onClick={() => setShowIconList(true)}
            className='choose-icon-button'
            disabled={!isConnected}
          >
            Choose Another Icon
          </button>
        )}
      </div>
      {/* --- End New Icon Display --- */}

      {/* --- Conditionally Rendered Emoji Selector --- */}
      {showIconList && (
        <div className='emoji-selector show-list'>
          {' '}
          {/* Add class to indicate list is shown */}
          {/* Optional: Add a title back here? */}
          {/* <p>Choose your icon:</p> */}
          <div className='emoji-options'>
            {defaultEmojis.map(emoji => (
              <button
                key={emoji}
                className={`emoji-button ${selectedEmoji === emoji ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedEmoji(emoji);
                  setShowIconList(false); // Hide list after selection
                }}
                disabled={!isConnected}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowIconList(false)}
            className='hide-icon-list-button cancel-button'
            disabled={!isConnected}
          >
            Hide Icons
          </button>
        </div>
      )}
      {/* --- End Emoji Selector --- */}

      <button
        onClick={handleHostGame}
        disabled={!socket || !isConnected}
        className='host-button' /* Keep host button class */
      >
        Host New Game
      </button>

      {/* Join Game Section - Toggle Input */}
      {!showJoinInput ? (
        <button
          onClick={handleJoinGame}
          disabled={!socket || !isConnected} /* Disable if socket unavailable/disconnected */
          className='join-button-toggle' /* Use a different class */
        >
          Join Existing Game
        </button>
      ) : (
        <div className='join-section-active'>
          {' '}
          {/* Container for active join */}
          <input
            type='text'
            value={gameCodeInput}
            onChange={handleGameCodeChange}
            placeholder='Enter Game Code'
            maxLength={5} /* <<< Increase to 5 */
            className='game-code-input' /* Add class */
            disabled={!socket || !isConnected}
          />
          <button
            onClick={handleJoinGame}
            disabled={!socket || !isConnected || !nicknameInput.trim() || !gameCodeInput.trim()}
            className='join-button-confirm' /* Different class */
          >
            Confirm Join
          </button>
          <button
            onClick={() => {
              setShowJoinInput(false);
              setError('');
            }}
            className='cancel-button' /* Add class */
            disabled={!socket || !isConnected}
          >
            Cancel
          </button>
        </div>
      )}

      <button onClick={onNavigateToMyCards} className='my-cards-button' /* Keep class */>
        My Cards
      </button>
    </div>
  );
}

export default TitleScreen;
