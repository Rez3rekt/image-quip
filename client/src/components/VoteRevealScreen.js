import { useState, useEffect } from 'react';
import { SERVER_BASE_URL } from '../config';
import '../styles/VoteRevealScreen.css';
import { LoadingState } from './common';

function VoteRevealScreen({ gameState, socket, playerId, isHost }) {
  // console.log(`[VoteRevealScreen] Render. Phase: ${gameState?.phase}`);
  const revealData = gameState?.currentVoteRevealData;
  const settings = gameState?.settings;
  const isFlipTheScript = settings?.gameMode === 'Flip the Script';
  const playersArray = gameState?.players || [];

  // <<< Convert players array to a map for easy lookup >>>
  const playersMap = playersArray.reduce((map, player) => {
    map[player.id] = player;
    return map;
  }, {});

  // State for card reveal
  const [card1Revealed, setCard1Revealed] = useState(false);
  const [card2Revealed, setCard2Revealed] = useState(false);
  // <<< Change state for icon reveal start and add crown state >>>
  const [startIconReveal1, setStartIconReveal1] = useState(false);
  const [votes1Revealed, setVotes1Revealed] = useState(false);
  const [showCrown1, setShowCrown1] = useState(false);
  const [startIconReveal2, setStartIconReveal2] = useState(false);
  const [votes2Revealed, setVotes2Revealed] = useState(false);
  const [showCrown2, setShowCrown2] = useState(false);

  // Effect for Sequential Reveal
  useEffect(() => {
    // Only run reveal animation if not FTS and revealData is present
    if (!isFlipTheScript && revealData) {
      // --- Reset All Reveal States ---
      setCard1Revealed(false);
      setCard2Revealed(false);
      setStartIconReveal1(false);
      setVotes1Revealed(false);
      setShowCrown1(false);
      setStartIconReveal2(false);
      setVotes2Revealed(false);
      setShowCrown2(false);

      // --- Calculate Delays ---
      const cardFlipDuration = 600; // Match CSS transition
      const iconAppearDuration = 300; // Duration for each icon to fade in
      const delayBetweenIcons = 200; // Delay before next icon starts appearing
      const delayAfterIcons = 400; // Delay after last icon appears before crown/votes
      const crownAppearDuration = 400; // Duration for crown to fade in
      const delayAfterCrown = 200; // Delay after crown before votes
      const _votesAppearDuration = 1000; // Duration for votes to appear

      const voterIds1 = revealData.sub1.voterIds || [];
      const voterIds2 = revealData.sub2.voterIds || [];
      const totalVoters = new Set([...voterIds1, ...voterIds2]).size; // Unique voters this round
      const iconRevealDuration1 =
        voterIds1.length > 0 ? (voterIds1.length - 1) * delayBetweenIcons + iconAppearDuration : 0;
      const iconRevealDuration2 =
        voterIds2.length > 0 ? (voterIds2.length - 1) * delayBetweenIcons + iconAppearDuration : 0;

      // --- Timeout Refs --- (To manage cleanup properly)
      const timeouts = [];

      // --- Sequence ---

      // 1. Flip Card 1
      timeouts.push(
        setTimeout(() => {
          // console.log("[VoteRevealScreen Reveal] Flipping Card 1");
          setCard1Revealed(true);

          // 2. Start Icons 1 Reveal (after card flip)
          timeouts.push(
            setTimeout(() => {
              // console.log("[VoteRevealScreen Reveal] Starting Icons 1 Reveal");
              setStartIconReveal1(true);

              // 3. Check for Crown 1 & Reveal Votes 1 (after icons finish)
              timeouts.push(
                setTimeout(() => {
                  // console.log("[VoteRevealScreen Reveal] Checking Crown & Starting Votes 1 Reveal");
                  let crownDelay = 0;
                  if (voterIds1.length === totalVoters && totalVoters > 0) {
                    // console.log("[VoteRevealScreen Reveal] Showing Crown 1");
                    setShowCrown1(true);
                    crownDelay = crownAppearDuration + delayAfterCrown;
                  }
                  // Reveal Votes 1 after potential crown
                  timeouts.push(
                    setTimeout(() => {
                      // console.log("[VoteRevealScreen Reveal] Revealing Votes 1");
                      setVotes1Revealed(true);
                    }, crownDelay),
                  );
                }, iconRevealDuration1 + delayAfterIcons),
              );
            }, cardFlipDuration),
          ); // Start icons after card flip duration
        }, 500),
      ); // Start Card 1 flip after initial delay

      // 4. Flip Card 2 (Staggered start)
      timeouts.push(
        setTimeout(() => {
          // console.log("[VoteRevealScreen Reveal] Flipping Card 2");
          setCard2Revealed(true);

          // 5. Start Icons 2 Reveal (after card flip)
          timeouts.push(
            setTimeout(() => {
              // console.log("[VoteRevealScreen Reveal] Starting Icons 2 Reveal");
              setStartIconReveal2(true);

              // 6. Check for Crown 2 & Reveal Votes 2 (after icons finish)
              timeouts.push(
                setTimeout(() => {
                  // console.log("[VoteRevealScreen Reveal] Checking Crown & Starting Votes 2 Reveal");
                  let crownDelay = 0;
                  if (voterIds2.length === totalVoters && totalVoters > 0) {
                    // console.log("[VoteRevealScreen Reveal] Showing Crown 2");
                    setShowCrown2(true);
                    crownDelay = crownAppearDuration + delayAfterCrown;
                  }
                  // Reveal Votes 2 after potential crown
                  timeouts.push(
                    setTimeout(() => {
                      // console.log("[VoteRevealScreen Reveal] Revealing Votes 2");
                      setVotes2Revealed(true);
                    }, crownDelay),
                  );
                }, iconRevealDuration2 + delayAfterIcons),
              );
            }, cardFlipDuration),
          ); // Start icons after card flip duration
        }, 800),
      ); // Start Card 2 flip after initial delay

      // --- Cleanup Function ---
      return () => {
        // console.log("[VoteRevealScreen Cleanup] Clearing timeouts");
        timeouts.forEach(clearTimeout);
      };
    } else {
      // If FTS or no data, reveal everything instantly
      setCard1Revealed(true);
      setCard2Revealed(true);
      setStartIconReveal1(true);
      setVotes1Revealed(true);
      setStartIconReveal2(true);
      setVotes2Revealed(true);
      // Determine crown state instantly too (though less relevant visually here)
      const voterIds1 = revealData?.sub1?.voterIds || [];
      const voterIds2 = revealData?.sub2?.voterIds || [];
      const totalVoters = new Set([...voterIds1, ...voterIds2]).size;
      setShowCrown1(voterIds1.length === totalVoters && totalVoters > 0);
      setShowCrown2(voterIds2.length === totalVoters && totalVoters > 0);
    }
    // Recalculate if revealData changes (or isFlipTheScript, though less likely)
    // Explicitly add sub1/sub2 dependencies as we read voterIds directly now.
  }, [revealData, isFlipTheScript, revealData?.sub1?.voterIds, revealData?.sub2?.voterIds]);

  // Loading Check
  const isLoading = !gameState || gameState.phase !== 'vote_reveal' || !revealData;
  if (isLoading) {
    return <LoadingState message='Loading vote results...' />;
  }

  // Destructure based on mode
  const promptIdentifier = isFlipTheScript ? revealData.promptImagePath : revealData.promptText;
  const { sub1, sub2 } = revealData;

  // Further validation
  if (!promptIdentifier || !sub1 || !sub2) {
    console.error('[VoteRevealScreen] Missing crucial reveal data:', {
      promptIdentifier,
      sub1,
      sub2,
      revealData,
    });
    return (
      <div className='vote-reveal-container card center-content'>
        <p>Error displaying vote results.</p>
      </div>
    );
  }

  // <<< Add console logs for debugging icons >>>
  // console.log("[VoteRevealScreen Debug] revealData:", revealData);
  // console.log("[VoteRevealScreen Debug] players:", playersMap);
  // console.log("[VoteRevealScreen Debug] Voter IDs for Sub1:", sub1.voterIds);
  // console.log("[VoteRevealScreen Debug] Voter IDs for Sub2:", sub2.voterIds);

  // Helper to get voter icons
  const getVoterIcons = (voterIds = []) => {
    const icons = voterIds
      // <<< Use playersMap for lookup >>>
      .map(id => playersMap[id]?.icon)
      .filter(Boolean); // Filter out any potential undefined icons
    // console.log(`[VoteRevealScreen Debug] Icons for [${voterIds.join(', ')}]`, icons); // <<< Log generated icons
    return icons;
  };

  // Get submission values based on mode
  const sub1Value = isFlipTheScript ? sub1.responseText : sub1.imagePath;
  const sub2Value = isFlipTheScript ? sub2.responseText : sub2.imagePath;

  if (!sub1Value || !sub2Value) {
    console.error('[VoteRevealScreen] Missing submission values (image or text) in sub1/sub2:', {
      sub1,
      sub2,
    });
    return (
      <div className='vote-reveal-container card center-content'>
        <p>Error displaying submission content.</p>
      </div>
    );
  }

  // Add Host Continue Button Handler
  const handleContinue = () => {
    if (socket && gameState?.gameId && playerId) {
      // console.log('[VoteRevealScreen Continue] Requesting next...');
      socket.emit('requestNextVoteOrResults', gameState.gameId, playerId);
    } else {
      console.error(
        '[VoteRevealScreen Continue] Cannot continue: Socket, GameID, or PlayerID missing.',
      );
    }
  };

  return (
    <div className='vote-reveal-container card'>
      <h2>Results for:</h2>
      {/* Prompt Display (Conditional) */}
      <div className='prompt-display-area'>
        <div className='current-prompt-box'>
          {isFlipTheScript ? (
            <img
              src={`${SERVER_BASE_URL}${promptIdentifier}`}
              alt='Prompt Image'
              className='prompt-image prompt-reveal-image'
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
            <p className='reveal-prompt'>{promptIdentifier}</p>
          )}
        </div>
      </div>

      <div className='submissions-container'>
        {/* Submission 1 - Use a simple wrapper div */}
        <div className='submission-column'>
          {/* Voter Icons Container - Conditionally Rendered */}
          <div className={`voter-icons-container ${startIconReveal1 ? 'started' : ''}`}>
            {getVoterIcons(sub1.voterIds).map((icon, index) => (
              <span
                key={`${sub1.id}-voter-${index}`}
                className={`voter-icon ${startIconReveal1 ? 'animate-icon' : ''}`} // Add animate class when started
                style={{ animationDelay: `${startIconReveal1 ? index * 0.2 : 0}s` }} // Stagger delay
              >
                {icon}
              </span>
            ))}
          </div>
          {isFlipTheScript ? (
            <div className='submission-content-wrapper'>
              {/* Wrap content and crown in a div */}
              <div className='submission-item-display'>
                {showCrown1 && <span className='submission-crown reveal-item revealed'>👑</span>}
                <div className='response-text-reveal'>{sub1Value || '(No response)'}</div>
              </div>
            </div>
          ) : (
            <div className='submission-content-wrapper'>
              {/* Wrap content and crown in a div */}
              <div className='submission-item-display'>
                {showCrown1 && <span className='submission-crown reveal-item revealed'>👑</span>}
                <div className='flip-card vote-reveal-flip-card'>
                  <div className={`flip-card-inner ${card1Revealed ? 'flipping' : ''}`}>
                    <div className='flip-card-front'>
                      <img
                        src={`${SERVER_BASE_URL}${sub1Value}`}
                        alt={`by ${sub1.nickname}`}
                        className='submission-image'
                      />
                    </div>
                    <div className='flip-card-back'>
                      <span className='card-back-logo'>QP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <p className='submission-nickname'>by {sub1.nickname || '-'}</p>
          {/* Vote Text - Conditionally Rendered */}
          <p className={`submission-votes reveal-item ${votes1Revealed ? 'revealed' : ''}`}>
            {sub1.votes} Vote(s)
          </p>
        </div>
        {/* Submission 2 - Use a simple wrapper div */}
        <div className='submission-column'>
          {/* Voter Icons Container - Conditionally Rendered */}
          <div className={`voter-icons-container ${startIconReveal2 ? 'started' : ''}`}>
            {getVoterIcons(sub2.voterIds).map((icon, index) => (
              <span
                key={`${sub2.id}-voter-${index}`}
                className={`voter-icon ${startIconReveal2 ? 'animate-icon' : ''}`} // Add animate class when started
                style={{ animationDelay: `${startIconReveal2 ? index * 0.2 : 0}s` }} // Stagger delay
              >
                {icon}
              </span>
            ))}
          </div>
          {isFlipTheScript ? (
            <div className='submission-content-wrapper'>
              {/* Wrap content and crown in a div */}
              <div className='submission-item-display'>
                {showCrown2 && <span className='submission-crown reveal-item revealed'>👑</span>}
                <div className='response-text-reveal'>{sub2Value || '(No response)'}</div>
              </div>
            </div>
          ) : (
            <div className='submission-content-wrapper'>
              {/* Wrap content and crown in a div */}
              <div className='submission-item-display'>
                {showCrown2 && <span className='submission-crown reveal-item revealed'>👑</span>}
                <div className='flip-card vote-reveal-flip-card'>
                  <div className={`flip-card-inner ${card2Revealed ? 'flipping' : ''}`}>
                    <div className='flip-card-front'>
                      <img
                        src={`${SERVER_BASE_URL}${sub2Value}`}
                        alt={`by ${sub2.nickname}`}
                        className='submission-image'
                      />
                    </div>
                    <div className='flip-card-back'>
                      <span className='card-back-logo'>QP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <p className='submission-nickname'>by {sub2.nickname || '-'}</p>
          {/* Vote Text - Conditionally Rendered */}
          <p className={`submission-votes reveal-item ${votes2Revealed ? 'revealed' : ''}`}>
            {sub2.votes} Vote(s)
          </p>
        </div>
      </div>
      {isHost && (
        <button onClick={handleContinue} className='continue-button host-action-button'>
          Continue to Next Round / Final Results
        </button>
      )}
      {!isHost && <p className='info-message'>Waiting for host to continue...</p>}
    </div>
  );
}

export default VoteRevealScreen;
