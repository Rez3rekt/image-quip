import { useState } from 'react';
import '../styles/ResultsScreen.css'; // Keep styles for now
import { SERVER_BASE_URL } from '../config';
import CardInspectorModal from './CardInspectorModal'; // <-- Import the modal
import { LoadingState } from './common';

function FinalResultsScreen({
  gameState,
  playerId,
  loggedInUsername,
  ownedCards = [],
  addCardFunction,
  isHost = false,
  onContinueGame,
  onResetLobby,
  onLeaveGame, // fallback for onGoToMainMenu
  onGoToMainMenu,
  socket,
}) {
  // Use onLeaveGame as a fallback for onGoToMainMenu if not provided
  const handleGoToMainMenu =
    onGoToMainMenu || onLeaveGame || (() => console.warn('No navigation handler provided'));

  // Handle missing callback functions with graceful warnings
  const handleContinueGame = () => {
    if (onContinueGame) {
      onContinueGame();
    } else if (socket && gameState?.gameId) {
      console.log(`[FinalResultsScreen] Emitting continueGame for ${gameState.gameId}`);
      socket.emit('continueGame', gameState.gameId);
    } else {
      console.warn('[FinalResultsScreen] No continue game handler or socket provided');
    }
  };

  const handleResetLobby = () => {
    if (onResetLobby) {
      onResetLobby();
    } else if (socket && gameState?.gameId) {
      console.log(`[FinalResultsScreen] Emitting resetLobby for ${gameState.gameId}`);
      socket.emit('resetLobby', gameState.gameId);
    } else {
      console.warn('[FinalResultsScreen] No reset lobby handler or socket provided');
    }
  };

  // <<< Modal State >>>
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCardData, setSelectedCardData] = useState(null);

  // <<< Add Logging >>>
  // console.log('[FinalResultsScreen] Rendering. gameState:', gameState);
  // console.log('[FinalResultsScreen] Props:', { loggedInUsername, ownedCards: ownedCards?.length, addCardFunction: !!addCardFunction });
  // <<< End Logging >>>

  // <<< FIX: Allow rendering for 'ended' phase as well >>>
  if (!gameState || (gameState.phase !== 'final_results' && gameState.phase !== 'ended')) {
    return <LoadingState message='Loading final results...' />;
  }

  const { players = [], hostId: _hostId, gameId: _gameId } = gameState;
  const leaderboard = Object.values(players || {}).sort((a, b) => b.score - a.score);

  // <<< Use gameState.finalResults for prompt history >>>
  const promptHistory = gameState.finalResults || [];

  // <<< Add Logging >>>
  // console.log('[FinalResultsScreen] Rendering. gameState:', gameState);
  // console.log('[FinalResultsScreen] Using promptHistory:', promptHistory); // Log the correct variable
  // console.log('[FinalResultsScreen] Calculated leaderboard:', leaderboard);
  // console.log('[FinalResultsScreen] Completed prompts:', gameState.completedPrompts); // No longer using completedPrompts
  // <<< End Logging >>>

  // <<< Modal Handlers >>>
  const handleOpenModal = cardInfo => {
    // console.log("[FinalResultsScreen] Opening modal for card:", cardInfo);
    const modalCard = {
      imagePath: cardInfo.imagePath,
      name: cardInfo.title || `Submitted by ${cardInfo.nickname}`,
      tags: [], // No tags available here
      // lifetimeVotes: cardInfo.votes, // <-- REMOVE this line
      // Set to undefined or null so modal shows N/A
      lifetimeVotes: undefined,
      id: cardInfo.imagePath,
    };
    setSelectedCardData(modalCard);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCardData(null);
  };

  // Determine game mode
  const isFlipTheScript = gameState?.settings?.gameMode === 'Flip the Script';

  return (
    <div className='mobile-results-wrapper'>
      <div className='results-container card'>
        <h2 className='results-title'>Game Over! Final Results</h2>

        <h3>Leaderboard</h3>
        <table className='leaderboard-table mobile-leaderboard-fix'>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Rank</th>
              <th style={{ width: '55%' }}>Nickname</th>
              <th style={{ width: '25%' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player, index) => (
              <tr key={player.id} className={player.id === playerId ? 'my-row' : ''}>
                <td style={{ textAlign: 'center' }}>{index + 1}</td>
                <td className='nickname-cell'>
                  <span className='player-icon'>{player.icon}</span>
                  <span className='player-nickname'>
                    {player.nickname}
                    {player.id === playerId ? ' (You)' : ''}
                  </span>
                  {index === 0 && leaderboard.length > 0 && player.score > 0 && (
                    <span className='winner-indicator'>🏆</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>{player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* <<< Updated Actions Section >>> */}
        <div className='results-actions'>
          {/* Continue Button (Host Only) */}
          <button
            onClick={handleContinueGame}
            className='action-button continue-button' // Add specific class
            disabled={!isHost}
            title={
              !isHost ? 'Only the host can continue' : 'Start next round with same players/settings'
            }
          >
            Continue
          </button>

          {/* New Game (Lobby) Button (Host Only) */}
          <button
            onClick={handleResetLobby}
            className='action-button new-game-lobby-button' // Add specific class
            disabled={!isHost}
            title={
              !isHost ? 'Only the host can start a new game' : 'Return to lobby with same players'
            }
          >
            New Game (Lobby)
          </button>

          {/* Main Menu Button */}
          <button
            onClick={handleGoToMainMenu}
            className='action-button main-menu-button mobile-full-width' // Add mobile-specific class
          >
            Main Menu
          </button>
        </div>
        {/* <<< End Actions Section >>> */}

        {/* <<< Prompt History Section (Now below button) >>> */}
        <div className='prompt-history-section' style={{ marginTop: '20px', width: '100%' }}>
          <h3>Prompt History</h3>
          {/* <<< Use promptHistory variable >>> */}
          {promptHistory &&
          Array.isArray(promptHistory.prompts) &&
          promptHistory.prompts.length > 0 ? (
            <div
              className='prompt-history-grid'
              style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}
            >
              {/* <<< Map over promptHistory variable >>> */}
              {promptHistory.prompts.map((promptData, index) => {
                // <<< Determine prompt identifier based on mode >>>
                const promptIdentifier = isFlipTheScript
                  ? promptData.promptImagePath
                  : promptData.promptText;

                // Calculation for unanimous winner (remains the same)
                const totalVotes = (promptData.sub1?.votes || 0) + (promptData.sub2?.votes || 0);
                const player1IsUnanimousWinner =
                  totalVotes > 0 && (promptData.sub1?.votes || 0) === totalVotes;
                const player2IsUnanimousWinner =
                  totalVotes > 0 && (promptData.sub2?.votes || 0) === totalVotes;

                // <<< Validate sub1/sub2 exist >>>
                if (!promptData.sub1 || !promptData.sub2) {
                  console.warn(
                    '[FinalResultsScreen] Skipping history item due to missing sub1/sub2:',
                    promptData,
                  );
                  return null;
                }

                // <<< Get submission content based on mode >>>
                const sub1Content = isFlipTheScript
                  ? promptData.sub1.responseText
                  : promptData.sub1.imagePath;
                const sub2Content = isFlipTheScript
                  ? promptData.sub2.responseText
                  : promptData.sub2.imagePath;

                return (
                  <div
                    key={index}
                    className='prompt-history-item card'
                    style={{ padding: '20px', marginBottom: '30px' }}
                  >
                    {/* Conditional Prompt Display */}
                    <div className='prompt-history-identifier'>
                      {isFlipTheScript ? (
                        <div className='image-card-wrapper prompt-image-wrapper flip-script-prompt-wrapper'>
                          <div className='image-card flip-script-image-card'>
                            <img
                              src={`${SERVER_BASE_URL}${promptIdentifier}`}
                              alt='Prompt'
                              className='prompt-history-image flip-script-image'
                            />
                          </div>
                        </div>
                      ) : (
                        <p className='prompt-history-text'>&quot;{promptIdentifier}&quot;</p>
                      )}
                    </div>
                    <div
                      className='prompt-history-submissions'
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '20px',
                        justifyContent: 'center',
                        marginTop: '15px',
                      }}
                    >
                      {/* Submission 1 */}
                      <div className='submission-pair' style={{ flex: '1', maxWidth: '48%' }}>
                        {/* Conditional Submission Content Display */}
                        {isFlipTheScript ? (
                          // <<< Wrap text in styled div >>>
                          <div className='response-text-wrapper flip-script-response-wrapper'>
                            <p className='response-text-history'>
                              {sub1Content || '(No response)'}
                            </p>
                          </div>
                        ) : /* Image display logic (only for non-FTS) */
                        sub1Content ? (
                          <div className='image-card-wrapper'>
                            <div
                              className='image-card'
                              style={{
                                position: 'relative',
                                width: '100%',
                                height: 'auto',
                                minHeight: '280px',
                                aspectRatio: '9/16',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              {player1IsUnanimousWinner && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    left: '-5px',
                                    fontSize: '1.5em',
                                    zIndex: 1,
                                    textShadow: '0 0 3px black',
                                  }}
                                >
                                  👑
                                </span>
                              )}
                              <img
                                src={`${SERVER_BASE_URL}${sub1Content}`}
                                alt={`Submission by ${promptData.sub1.nickname}`}
                                className='submission-image inspectable-image'
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  objectPosition: 'center',
                                }}
                                onClick={() =>
                                  handleOpenModal({
                                    imagePath: sub1Content,
                                    nickname: promptData.sub1.nickname,
                                    votes: promptData.sub1.votes,
                                  })
                                }
                              />
                              {loggedInUsername &&
                                promptData.sub1.nickname !== loggedInUsername &&
                                sub1Content &&
                                !ownedCards?.includes(sub1Content) && (
                                  <button
                                    className='add-card-button'
                                    onClick={() => addCardFunction(sub1Content)}
                                    title='Add this card to your collection'
                                    style={{
                                      position: 'absolute',
                                      top: '5px',
                                      right: '5px',
                                      zIndex: 1,
                                      cursor: 'pointer',
                                      width: '22px',
                                      height: '22px',
                                      fontSize: '16px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: 'none',
                                      backgroundColor: '#007bff',
                                      color: 'white',
                                      borderRadius: '4px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                            </div>
                          </div>
                        ) : (
                          <div className='submission-placeholder'>No Image</div>
                        )}
                        {/* Submission Info (Same for both modes) */}
                        <div className='submission-info'>
                          <span>{promptData.sub1.nickname || '-'}</span>
                          <span className='vote-count'>({promptData.sub1.votes || 0} votes)</span>
                        </div>
                      </div>
                      {/* Submission 2 */}
                      <div className='submission-pair' style={{ flex: '1', maxWidth: '48%' }}>
                        {isFlipTheScript ? (
                          // <<< Wrap text in styled div >>>
                          <div className='response-text-wrapper flip-script-response-wrapper'>
                            <p className='response-text-history'>
                              {sub2Content || '(No response)'}
                            </p>
                          </div>
                        ) : sub2Content ? (
                          <div className='image-card-wrapper'>
                            <div
                              className='image-card'
                              style={{
                                position: 'relative',
                                width: '100%',
                                height: 'auto',
                                minHeight: '280px',
                                aspectRatio: '9/16',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              {player2IsUnanimousWinner && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    left: '-5px',
                                    fontSize: '1.5em',
                                    zIndex: 1,
                                    textShadow: '0 0 3px black',
                                  }}
                                >
                                  👑
                                </span>
                              )}
                              <img
                                src={`${SERVER_BASE_URL}${sub2Content}`}
                                alt={`Submission by ${promptData.sub2.nickname}`}
                                className='submission-image inspectable-image'
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  objectPosition: 'center',
                                }}
                                onClick={() =>
                                  handleOpenModal({
                                    imagePath: sub2Content,
                                    nickname: promptData.sub2.nickname,
                                    votes: promptData.sub2.votes,
                                  })
                                }
                              />
                              {loggedInUsername &&
                                promptData.sub2.nickname !== loggedInUsername &&
                                sub2Content &&
                                !ownedCards?.includes(sub2Content) && (
                                  <button
                                    className='add-card-button'
                                    onClick={() => addCardFunction(sub2Content)}
                                    title='Add this card to your collection'
                                    style={{
                                      position: 'absolute',
                                      top: '5px',
                                      right: '5px',
                                      zIndex: 1,
                                      cursor: 'pointer',
                                      width: '22px',
                                      height: '22px',
                                      fontSize: '16px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: 'none',
                                      backgroundColor: '#007bff',
                                      color: 'white',
                                      borderRadius: '4px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                            </div>
                          </div>
                        ) : (
                          <div className='submission-placeholder'>No Image</div>
                        )}
                        {/* Submission Info (Same for both modes) */}
                        <div className='submission-info'>
                          <span>{promptData.sub2.nickname || '-'}</span>
                          <span className='vote-count'>({promptData.sub2.votes || 0} votes)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No prompt history available.</p>
          )}
        </div>
        {/* <<< End Prompt History Section >>> */}

        {/* <<< Render Modal >>> */}
        {isModalOpen && selectedCardData && (
          <CardInspectorModal
            card={selectedCardData}
            onClose={handleCloseModal}
            ownedCards={ownedCards}
            addCardFunction={addCardFunction}
            loggedInUsername={loggedInUsername}
            // Pass a flag indicating context if needed, e.g., isFromResults={true}
          />
        )}
      </div>
    </div>
  );
}

export default FinalResultsScreen;
