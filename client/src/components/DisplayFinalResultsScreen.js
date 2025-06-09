import { useEffect, useState } from 'react';
import { SERVER_BASE_URL } from '../config';
import '../styles/DisplayFinalResultsScreen.css';
import { LoadingState } from './common';

function DisplayFinalResultsScreen({ gameState }) {
  // State to track the currently displayed prompt
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);

  // Force body to be full screen
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.width = '100vw';
    document.body.style.height = '100vh';

    return () => {
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.overflow = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Set up cycling through prompts
  useEffect(() => {
    const promptHistory = gameState?.finalResults?.prompts || [];
    if (promptHistory.length <= 1) {
      return;
    } // No need to cycle if 0 or 1 prompts

    const cycleInterval = setInterval(() => {
      setCurrentPromptIndex(prevIndex =>
        prevIndex >= promptHistory.length - 1 ? 0 : prevIndex + 1,
      );
    }, 8000); // Change every 8 seconds

    return () => clearInterval(cycleInterval);
  }, [gameState?.finalResults?.prompts]);

  if (!gameState || (gameState.phase !== 'final_results' && gameState.phase !== 'ended')) {
    return <LoadingState message='Loading final results...' fullscreen />;
  }

  const { players } = gameState;
  const leaderboard = Object.values(players || {}).sort((a, b) => b.score - a.score);
  const promptHistory = gameState.finalResults?.prompts || []; // Access prompts array directly
  const isFlipTheScript = gameState?.settings?.gameMode === 'Flip the Script';

  // Get the current prompt to display
  const currentPrompt = promptHistory.length > 0 ? promptHistory[currentPromptIndex] : null;

  // Crown badge style
  const crownBadgeStyle = {
    position: 'absolute',
    top: '15px',
    left: '15px',
    fontSize: '3.5em',
    zIndex: 10,
    textShadow: '0 0 5px black, 0 0 8px rgba(0,0,0,0.8)',
    pointerEvents: 'none',
  };

  // Handle image loading errors
  const handleImageError = e => {
    console.error('Image failed to load:', e.target.src);
    e.target.src = 'fallback-image.jpg'; // Optional: provide a fallback image
  };

  // Create formatted leaderboard items
  const renderLeaderboard = () => {
    return leaderboard.map((player, index) => {
      const displayName = player.nickname || `Player ${index + 1}`;
      const isWinner = index === 0 && leaderboard.length > 0 && player.score > 0;

      return (
        <tr key={player.id || index}>
          <td className='rank'>{index + 1}</td>
          <td className='nickname'>
            <span className='icon'>{player.icon}</span>
            <span className='name' title={displayName}>
              {displayName.length > 15 ? `${displayName.substring(0, 15)}...` : displayName}
            </span>
            {isWinner && <span className='winner-trophy'>🏆</span>}
          </td>
          <td className='score'>{player.score}</td>
        </tr>
      );
    });
  };

  return (
    <div className='display-fr-container'>
      <div className='display-fr-content-wrapper'>
        {/* Left column - Leaderboard */}
        <div className='display-fr-leaderboard-column'>
          <h3>Scores</h3>
          <table className='display-fr-leaderboard-table'>
            <thead>
              <tr>
                <th className='rank-header'>Rank</th>
                <th className='player-header'>Player</th>
                <th className='score-header'>Score</th>
              </tr>
            </thead>
            <tbody>{renderLeaderboard()}</tbody>
          </table>
        </div>

        {/* Right column - Cycling Prompts & Submissions */}
        <div className='display-fr-highlights-column'>
          {currentPrompt && (
            <div className='display-fr-highlight-card'>
              {/* Prompt as Heading */}
              <h3 className='prompt-heading'>
                {isFlipTheScript && currentPrompt.promptImagePath ? (
                  <img
                    src={`${SERVER_BASE_URL}${currentPrompt.promptImagePath}`}
                    alt='Prompt'
                    className='highlight-prompt-image'
                    onError={handleImageError}
                  />
                ) : (
                  <span>&quot;{currentPrompt.promptText}&quot;</span>
                )}
              </h3>

              {/* Images container */}
              <div className='images-container'>
                {currentPrompt.sub1 && !isFlipTheScript && (
                  <div className='image-container left'>
                    {currentPrompt.sub1.votes > currentPrompt.sub2.votes && (
                      <span style={crownBadgeStyle}>👑</span>
                    )}
                    <img
                      src={`${SERVER_BASE_URL}${currentPrompt.sub1.imagePath}`}
                      alt='Submission 1'
                      className='submission-image'
                      onError={handleImageError}
                      loading='eager'
                    />
                  </div>
                )}

                {currentPrompt.sub2 && !isFlipTheScript && (
                  <div className='image-container right'>
                    {currentPrompt.sub2.votes > currentPrompt.sub1.votes && (
                      <span style={crownBadgeStyle}>👑</span>
                    )}
                    <img
                      src={`${SERVER_BASE_URL}${currentPrompt.sub2.imagePath}`}
                      alt='Submission 2'
                      className='submission-image'
                      onError={handleImageError}
                      loading='eager'
                    />
                  </div>
                )}

                {/* Text responses for Flip the Script mode */}
                {isFlipTheScript && currentPrompt.sub1 && (
                  <div className='text-response'>
                    {currentPrompt.sub1.votes > currentPrompt.sub2.votes && (
                      <span style={crownBadgeStyle}>👑</span>
                    )}
                    <p>{currentPrompt.sub1.responseText}</p>
                    <div className='display-fr-details'>
                      <div className='player-name'>
                        <span>{players[currentPrompt.sub1.submitterId]?.icon || '😀'}</span>
                        {players[currentPrompt.sub1.submitterId]?.nickname || 'Player'}
                      </div>
                      <div className='vote-count'>{currentPrompt.sub1.votes} Vote(s)</div>
                    </div>
                  </div>
                )}

                {isFlipTheScript && currentPrompt.sub2 && (
                  <div className='text-response'>
                    {currentPrompt.sub2.votes > currentPrompt.sub1.votes && (
                      <span style={crownBadgeStyle}>👑</span>
                    )}
                    <p>{currentPrompt.sub2.responseText}</p>
                    <div className='display-fr-details'>
                      <div className='player-name'>
                        <span>{players[currentPrompt.sub2.submitterId]?.icon || '😀'}</span>
                        {players[currentPrompt.sub2.submitterId]?.nickname || 'Player'}
                      </div>
                      <div className='vote-count'>{currentPrompt.sub2.votes} Vote(s)</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Improved prompt navigation indicators */}
              {promptHistory.length > 1 && (
                <div className='display-fr-prompt-indicators'>
                  {promptHistory.map((_, index) => (
                    <div
                      key={index}
                      className={`prompt-indicator ${index === currentPromptIndex ? 'active' : ''}`}
                      onClick={() => setCurrentPromptIndex(index)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DisplayFinalResultsScreen;
