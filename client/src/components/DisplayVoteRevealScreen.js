import '../styles/DisplayVoteRevealScreen.css'; // Create this CSS file
import { SERVER_BASE_URL } from '../config';
import { LoadingState } from './common';

// Define the inline styles to force rounded corners
const _roundedStyles = {
  borderRadius: '6px',
  overflow: 'hidden',
};

// Define card container styles that exactly match DisplayVotingScreen
const cardContainerStyle = {
  width: '100%',
  maxWidth: '400px',
  aspectRatio: '9/16',
  borderRadius: '6px',
  border: 'none', // Remove border to make it invisible
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#2A2F3A', // Adding background color to match cards
  padding: '4px',
};

// Updated image style to better fill container
const imageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'contain', // Changed from 'cover' to 'contain' to prevent GIF cropping
  objectPosition: 'center',
  borderRadius: '4px',
};

function DisplayVoteRevealScreen({ gameState }) {
  const revealData = gameState?.currentVoteRevealData;
  const settings = gameState?.settings;
  const isFlipTheScript = settings?.gameMode === 'Flip the Script';
  const playersArray = gameState?.players || [];

  const playersMap = playersArray.reduce((map, player) => {
    map[player.id] = player;
    return map;
  }, {});

  if (!gameState || gameState.phase !== 'vote_reveal' || !revealData) {
    return <LoadingState message='Loading vote results...' fullscreen />;
  }

  const promptIdentifier = isFlipTheScript ? revealData.promptImagePath : revealData.promptText;
  const { sub1, sub2 } = revealData;

  if (!promptIdentifier || !sub1 || !sub2) {
    return <LoadingState message='Error displaying vote results.' fullscreen />;
  }

  const getPlayerInfo = playerId => playersMap[playerId] || { nickname: 'Unknown', icon: '?' };

  const sub1Value = isFlipTheScript ? sub1.responseText : sub1.imagePath;
  const sub2Value = isFlipTheScript ? sub2.responseText : sub2.imagePath;

  const sub1Player = getPlayerInfo(sub1.submitterId);
  const sub2Player = getPlayerInfo(sub2.submitterId);

  if (!sub1Value || !sub2Value) {
    return <LoadingState message='Error displaying submission content.' fullscreen />;
  }

  const totalVoters = new Set([...(sub1.voterIds || []), ...(sub2.voterIds || [])]).size;
  let sub1Crown = sub1.votes === totalVoters && totalVoters > 0 ? '👑' : '';
  let sub2Crown = sub2.votes === totalVoters && totalVoters > 0 ? '👑' : '';

  // If tied and both have all votes (e.g. 1 voter, votes for self in a 2 player game), both get crown.
  // If tied but not all votes, no crown for tie.
  if (sub1.votes === sub2.votes && sub1.votes > 0) {
    if (sub1.votes === totalVoters) {
      // Both are winners with all votes
    } else {
      // Standard tie, no crown
      sub1Crown = '';
      sub2Crown = '';
    }
  } else if (sub1.votes > sub2.votes) {
    sub2Crown = ''; // Ensure non-winner doesn't get crown if logic was too simple
  } else if (sub2.votes > sub1.votes) {
    sub1Crown = ''; // Ensure non-winner doesn't get crown
  }

  return (
    <div className='display-vote-reveal-container'>
      <div className='display-vr-prompt-area'>
        {isFlipTheScript ? (
          <img
            src={`${SERVER_BASE_URL}${promptIdentifier}`}
            alt='Prompt Image'
            className='display-vr-prompt-image'
            style={{
              display: 'block',
              width: '170px',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
              margin: '0',
            }}
          />
        ) : (
          <p className='display-vr-prompt-text'>{promptIdentifier}</p>
        )}
      </div>

      <div className='display-vr-submissions-area'>
        {/* Submission 1 */}
        <div className={`display-vr-submission ${sub1Crown ? 'winner' : ''}`}>
          <div className='display-vr-content'>
            {isFlipTheScript ? (
              <div className='display-vr-response-text-card'>
                <p className='display-vr-response-text'>{sub1Value}</p>
              </div>
            ) : (
              <div style={cardContainerStyle}>
                <img
                  src={`${SERVER_BASE_URL}${sub1Value}`}
                  alt={`Submission by ${sub1Player.nickname}`}
                  style={imageStyle}
                />
              </div>
            )}
          </div>
          <div className='display-vr-details'>
            <p className='display-vr-submitter'>
              <span className='icon'>{sub1Player.icon}</span>
              by {sub1Player.nickname}
            </p>
            <p className='display-vr-votes'>
              {sub1Crown}
              {sub1.votes} Vote(s)
            </p>
          </div>
        </div>

        {/* Submission 2 */}
        <div className={`display-vr-submission ${sub2Crown ? 'winner' : ''}`}>
          <div className='display-vr-content'>
            {isFlipTheScript ? (
              <div className='display-vr-response-text-card'>
                <p className='display-vr-response-text'>{sub2Value}</p>
              </div>
            ) : (
              <div style={cardContainerStyle}>
                <img
                  src={`${SERVER_BASE_URL}${sub2Value}`}
                  alt={`Submission by ${sub2Player.nickname}`}
                  style={imageStyle}
                />
              </div>
            )}
          </div>
          <div className='display-vr-details'>
            <p className='display-vr-submitter'>
              <span className='icon'>{sub2Player.icon}</span>
              by {sub2Player.nickname}
            </p>
            <p className='display-vr-votes'>
              {sub2Crown}
              {sub2.votes} Vote(s)
            </p>
          </div>
        </div>
      </div>

      <p className='display-vr-status-message'>Waiting for host to continue...</p>
    </div>
  );
}

export default DisplayVoteRevealScreen;
