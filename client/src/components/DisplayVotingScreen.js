import { SERVER_BASE_URL } from '../config';
import '../styles/DisplayVotingScreen.css'; // We'll create this CSS file next

function DisplayVotingScreen({ gameState }) {
  if (!gameState || gameState.phase !== 'vote') {
    return <div>Not in voting phase or invalid game state.</div>;
  }

  const currentVotingPrompt = gameState.currentVotingPrompt;
  if (!currentVotingPrompt) {
    return <div>No voting prompt available.</div>;
  }

  const { promptText, submissions } = currentVotingPrompt;

  if (!submissions || submissions.length < 2) {
    return <div>Not enough submissions to display voting.</div>;
  }

  const voteTally = gameState?.currentVoteTally;
  const players = gameState?.players || [];
  const settings = gameState?.settings;
  const isFlipTheScript = settings?.gameMode === 'Flip the Script'; // To handle text vs image prompts

  // Helper to find player nickname/icon by ID
  const getPlayerInfo = playerId => {
    return players.find(p => p.id === playerId) || { nickname: 'Unknown', icon: '❓' };
  };

  // Get player info - marking as unused since they're not displayed in this version
  const _player1Info = getPlayerInfo(submissions[0]?.playerId);
  const _player2Info = getPlayerInfo(submissions[1]?.playerId);

  const submission1Value = isFlipTheScript
    ? submissions[0]?.response
    : submissions[0]?.image;
  const submission2Value = isFlipTheScript
    ? submissions[1]?.response
    : submissions[1]?.image;

  return (
    <div className='display-voting-container'>
      <h1 className='display-prompt-text'>{promptText}</h1>

      <div className='display-submissions-area'>
        {/* Submission 1 */}
        <div className='display-submission'>
          {isFlipTheScript ? (
            <div className='display-submission-text-content'>{submission1Value}</div>
          ) : (
            <div className='image-card-wrapper display-submission-image-card-wrapper'>
              <div className='image-card display-submission-image-card'>
                <img
                  src={`${SERVER_BASE_URL}${submission1Value}`}
                  alt={`Submission 1`}
                  className='display-submission-image'
                />
              </div>
            </div>
          )}
        </div>

        {/* Submission 2 */}
        <div className='display-submission'>
          {isFlipTheScript ? (
            <div className='display-submission-text-content'>{submission2Value}</div>
          ) : (
            <div className='image-card-wrapper display-submission-image-card-wrapper'>
              <div className='image-card display-submission-image-card'>
                <img
                  src={`${SERVER_BASE_URL}${submission2Value}`}
                  alt={`Submission 2`}
                  className='display-submission-image'
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='display-vote-tally'>
        Votes Cast: {voteTally?.totalVotes ?? 0} / {voteTally?.targetVotes ?? 'N/A'}
      </div>
    </div>
  );
}

export default DisplayVotingScreen;
