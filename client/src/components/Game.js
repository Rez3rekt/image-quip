import { useState, useEffect } from 'react';
import Lobby from './Lobby';
// import ImageUpload from './ImageUpload'; // Removed
import CardSelectionScreen from './CardSelectionScreen';
import PromptScreen from './PromptScreen';
import VotingScreen from './VotingScreen';
import VoteRevealScreen from './VoteRevealScreen';
import FinalResultsScreen from './FinalResultsScreen';
import { LoadingState } from './common';
import '../styles/Game.css'; // Optional: Add specific styles if needed

// Mobile orientation warning component
const OrientationWarning = ({ isVisible, gamePhase }) => {
  if (!isVisible) {
    return null;
  }

  // Different messages based on game phase
  const getMessage = () => {
    switch (gamePhase) {
      case 'prompt':
        return 'Portrait orientation works best for selecting cards from your hand.';
      case 'voting':
        return 'Landscape orientation works best for viewing submissions.';
      case 'reveal':
        return 'Landscape orientation works best for viewing results.';
      default:
        return 'Rotate your device for the best experience.';
    }
  };

  return (
    <div className='orientation-warning'>
      <div className='orientation-message'>
        <span className='orientation-icon'>📱↻</span>
        <p>{getMessage()}</p>
      </div>
    </div>
  );
};

function Game({
  socket,
  gameState,
  playerId,
  persistentClientId,
  error,
  onLeaveGame,
  isHost,
  deviceInfo,
}) {
  const [_leftGame, _setLeftGame] = useState(false);
  const [showOrientationWarning, setShowOrientationWarning] = useState(false);
  const [currentOrientation, setCurrentOrientation] = useState(
    window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
  );

  // Add this useEffect to detect orientation changes
  useEffect(() => {
    // Only relevant for mobile devices
    if (!deviceInfo?.isMobile && !deviceInfo?.isTablet) {
      return;
    }

    const handleOrientationChange = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const newOrientation = isPortrait ? 'portrait' : 'landscape';

      if (newOrientation !== currentOrientation) {
        setCurrentOrientation(newOrientation);

        // Show warning if orientation changes
        setShowOrientationWarning(true);

        // Hide warning after 3 seconds
        setTimeout(() => {
          setShowOrientationWarning(false);
        }, 3000);
      }
    };

    window.addEventListener('resize', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [currentOrientation, deviceInfo]);

  // Removed initial render log

  // Loading state or invalid state handling
  if (!gameState || !socket?.id) {
    // Removed loading log
    return <LoadingState message='Loading game state...' />;
  }

  // If isHost wasn't passed directly, determine from gameState
  const hostStatus =
    isHost !== undefined ? isHost : gameState?.hostId && playerId === gameState.hostId;

  // Game Ended State
  if (gameState.phase === 'ended') {
    // Removed ended log
    return (
      <div className='game-container card center-content'>
        <h2>Game Over!</h2>
        <p>The game has concluded.</p>
        <p>Final standings might be shown on Results screen before this, or add here.</p>
        {/* Optionally show final leaderboard again? */}
        <button onClick={onLeaveGame} className='back-button'>
          Back to Title
        </button>
      </div>
    );
  }

  // Render component based on game phase
  const renderGamePhase = () => {
    // Removed phase check log
    switch (gameState.phase) {
      case 'lobby':
        // Removed lobby match log
        return (
          <Lobby
            gameState={gameState}
            socket={socket}
            playerId={playerId}
            isHost={hostStatus}
            error={error}
            onLeaveGame={onLeaveGame}
          />
        );
      // case 'upload': // Removed phase
      case 'cardSelection':
        // Removed cardSelection match log
        return (
          <CardSelectionScreen
            gameState={gameState}
            socket={socket}
            persistentClientId={persistentClientId}
          />
        );
      case 'prompt':
        return <PromptScreen gameState={gameState} socket={socket} currentPlayerId={playerId} />;
      case 'vote':
        return <VotingScreen gameState={gameState} socket={socket} playerId={playerId} />;
      case 'vote_reveal':
        // Keep essential host check logging but make it more concise
        return (
          <VoteRevealScreen
            gameState={gameState}
            socket={socket}
            playerId={playerId}
            isHost={hostStatus}
          />
        );
      case 'final_results':
        return (
          <FinalResultsScreen
            gameState={gameState}
            playerId={playerId}
            socket={socket}
            isHost={hostStatus}
            onLeaveGame={onLeaveGame}
          />
        );
      case 'ended':
        // ... (logic)
        break;
      default:
        console.warn(
          `[Game renderGamePhase] Unknown phase: ${gameState.phase}. Rendering default.`,
        );
        return <LoadingState message={`Unknown game state: ${gameState.phase}`} />;
    }
  };

  // Removed final return log
  return (
    <div className='game-container'>
      {/* Only show for mobile */}
      {(deviceInfo?.isMobile || deviceInfo?.isTablet) && (
        <OrientationWarning isVisible={showOrientationWarning} gamePhase={gameState?.phase} />
      )}

      {/* Optional: Display general game errors here */}
      {error && <p className='error-message game-error'>Error: {error}</p>}
      {renderGamePhase()}

      {/* Removed Debug State Display */}
    </div>
  );
}

export default Game;
