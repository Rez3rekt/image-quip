function VotingInfo({ 
  iAmSubmitter, 
  isTwoPlayerGame, 
  iHaveVoted, 
  currentVoteTally, 
}) {
  return (
    <>
      {/* Info Messages */}
      {iAmSubmitter && isTwoPlayerGame && !iHaveVoted && (
        <p className='info-message'>You submitted one of these, but you can vote in a 2P game!</p>
      )}
      {iAmSubmitter && !isTwoPlayerGame && (
        <p className='info-message'>You submitted one of these answers.</p>
      )}
      {iHaveVoted && <p className='info-message'>Waiting for other players to vote...</p>}

      {/* Vote Tally Display */}
      <div className='vote-status'>
        Votes Cast: {currentVoteTally?.totalVotes ?? 0} / {currentVoteTally?.targetVotes ?? 'N/A'}
      </div>
    </>
  );
}

export default VotingInfo; 