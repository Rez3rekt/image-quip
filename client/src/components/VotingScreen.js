import '../styles/VotingScreen.css';
import { LoadingState } from './common';
import { PromptDisplay, VoteOption, VotingInfo, useVotingLogic } from './voting';

function VotingScreen({ gameState, socket, playerId }) {
  const {
    selectedVoteValue,
    card1Revealed,
    card2Revealed,
    isLoading,
    isFlipTheScript,
    isTwoPlayerGame,
    iAmSubmitter,
    iHaveVoted,
    option1Value,
    option2Value,
    promptIdentifier,
    currentVoteTally,
    handleVote,
    getButtonState,
  } = useVotingLogic({ gameState, socket, playerId });

  if (isLoading) {
    return <LoadingState message='Loading voting round...' />;
  }

  const button1State = getButtonState(option1Value);
  const button2State = getButtonState(option2Value);

  return (
    <div className='voting-screen-container card'>
      <h2>Vote!</h2>

      <PromptDisplay 
        isFlipTheScript={isFlipTheScript} 
        promptIdentifier={promptIdentifier} 
      />

      <div className='vote-options-container'>
        <VoteOption
          optionValue={option1Value}
          isFlipTheScript={isFlipTheScript}
          isSelected={selectedVoteValue === option1Value}
          cardRevealed={card1Revealed}
          buttonState={button1State}
          onVote={handleVote}
          optionNumber={1}
        />

        <VoteOption
          optionValue={option2Value}
          isFlipTheScript={isFlipTheScript}
          isSelected={selectedVoteValue === option2Value}
          cardRevealed={card2Revealed}
          buttonState={button2State}
          onVote={handleVote}
          optionNumber={2}
        />
      </div>

      <VotingInfo
        iAmSubmitter={iAmSubmitter}
        isTwoPlayerGame={isTwoPlayerGame}
        iHaveVoted={iHaveVoted}
        currentVoteTally={currentVoteTally}
      />
    </div>
  );
}

export default VotingScreen;
