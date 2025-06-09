import { useState, useEffect } from 'react';

function useVotingLogic({ gameState, socket, playerId }) {
  const [selectedVoteValue, setSelectedVoteValue] = useState(null);
  const [card1Revealed, setCard1Revealed] = useState(false);
  const [card2Revealed, setCard2Revealed] = useState(false);

  const {
    phase,
    settings,
    currentVotingPrompt,
    players,
    currentVotingIndex: _currentVotingIndex,
    votingPromptCount: _votingPromptCount,
    currentVoteTally,
    gameId,
  } = gameState || {};

  // Determine game mode and player status
  const isFlipTheScript = settings?.gameMode === 'Flip the Script';
  const isTwoPlayerGame = players?.length === 2;
  const iAmSubmitter =
    currentVotingPrompt &&
    (playerId === currentVotingPrompt.player1Id || playerId === currentVotingPrompt.player2Id);
  const iHaveVoted = players?.find(p => p.id === playerId)?.hasVoted ?? false;

  // Loading state
  const isLoading = !gameState || (phase === 'vote' && !currentVotingPrompt);

  // Define prompt and options
  const option1Value = isFlipTheScript
    ? currentVotingPrompt?.player1Response
    : currentVotingPrompt?.player1Image;
  const option2Value = isFlipTheScript
    ? currentVotingPrompt?.player2Response
    : currentVotingPrompt?.player2Image;
  const promptIdentifier = isFlipTheScript
    ? currentVotingPrompt?.promptImagePath
    : currentVotingPrompt?.promptText;

  // Vote handler
  const handleVote = valueToVoteFor => {
    if (iHaveVoted || (iAmSubmitter && !isTwoPlayerGame)) {
      return;
    }
    setSelectedVoteValue(valueToVoteFor);
    socket.emit('submitVote', gameId, playerId, valueToVoteFor);
  };

  // Button state helper
  const getButtonState = _optionValue => {
    const disabled = iHaveVoted || (iAmSubmitter && !isTwoPlayerGame);
    let text = 'Vote';
    if (iHaveVoted) {
      text = 'Voted';
    } else if (iAmSubmitter && !isTwoPlayerGame) {
      text = 'Cannot Vote';
    }
    return { disabled, text };
  };

  // Reset selection when prompt changes
  useEffect(() => {
    setSelectedVoteValue(null);
  }, [currentVotingPrompt]);

  // Card reveal animation effect
  useEffect(() => {
    if (!isFlipTheScript && currentVotingPrompt) {
      setCard1Revealed(false);
      setCard2Revealed(false);

      const timer1 = setTimeout(() => {
        setCard1Revealed(true);
      }, 500);

      const timer2 = setTimeout(() => {
        setCard2Revealed(true);
      }, 1000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setCard1Revealed(true);
      setCard2Revealed(true);
    }
  }, [promptIdentifier, isFlipTheScript, currentVotingPrompt]);

  return {
    // State
    selectedVoteValue,
    card1Revealed,
    card2Revealed,
    isLoading,
    
    // Computed values
    isFlipTheScript,
    isTwoPlayerGame,
    iAmSubmitter,
    iHaveVoted,
    option1Value,
    option2Value,
    promptIdentifier,
    currentVoteTally,
    
    // Functions
    handleVote,
    getButtonState,
  };
}

export default useVotingLogic; 