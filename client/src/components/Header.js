import '../styles/Header.css';

function Header({
  gameState,
  playerId,
  isConnected,
  appNickname, // Temp nickname for current game
  loggedInUsername, // Logged in user's name
  loggedInUserIcon, // <<< Add prop for user's icon
  onNavigateToLogin,
  onNavigateToTitle,
  onNavigateToAccount,
}) {
  const getPlayerNickname = () => {
    if (!gameState || !gameState.players) {
      return appNickname || null;
    }
    const player = gameState.players.find(p => p.id === playerId);
    return player ? player.nickname : appNickname || null;
  };

  const displayNickname = getPlayerNickname();

  // Determine the icon to display
  const displayIcon = loggedInUsername ? loggedInUserIcon : '❓'; // Use logged in icon or question mark

  // Final display name logic
  const finalDisplayName = loggedInUsername || displayNickname || 'Guest';

  return (
    <header className='app-header'>
      {/* Logo with specific class */}
      <span
        className='header-item-logo header-logo clickable-logo'
        onClick={onNavigateToTitle}
        role='button'
        tabIndex={0} // Make it focusable
        onKeyPress={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            onNavigateToTitle();
          }
        }} // Keyboard accessibility
      >
        Qwik Pik
      </span>

      {/* Game Code with specific class - conditional rendering */}
      {gameState?.gameId && (
        <span className='header-item-code header-game-code'>{gameState.gameId}</span>
      )}
      {/* REMOVED Game Phase Span */}

      {/* User Info / Login Section with specific class */}
      <div className='header-item-userinfo'>
        {/* Display nickname and icon if connected */}
        {isConnected && (
          <span className='header-player-info' title={playerId}>
            {/* If logged in, make icon a clickable button */}
            {loggedInUsername ? (
              <button
                className='link-button account-icon-button'
                onClick={onNavigateToAccount}
                title='Go to Account'
              >
                <span className='player-icon'>{displayIcon}</span>
              </button>
            ) : (
              /* Otherwise, just show the icon */
              <span className='player-icon'>{displayIcon}</span>
            )}

            {/* Account Name Button (visible on desktop, hidden on mobile via CSS) */}
            {loggedInUsername ? (
              <button className='link-button header-account-button' onClick={onNavigateToAccount}>
                {finalDisplayName}
              </button>
            ) : (
              /* Non-logged-in display name (also hidden on mobile) */
              <span className='player-nickname header-account-button'>{finalDisplayName}</span>
            )}
          </span>
        )}
        {/* Login Button - Conditionally Rendered */}
        {!loggedInUsername && (
          <button onClick={onNavigateToLogin} className='login-button'>
            Login
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
