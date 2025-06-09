import { SERVER_BASE_URL } from '../../config';

function VoteOption({ 
  optionValue, 
  isFlipTheScript, 
  isSelected, 
  cardRevealed, 
  buttonState, 
  onVote,
  optionNumber, 
}) {
  return (
    <div className={`vote-option ${isSelected ? 'selected' : ''}`}>
      <div className='vote-content-wrapper'>
        {isFlipTheScript ? (
          <p className='response-text-option'>{optionValue}</p>
        ) : (
          <div className='flip-card vote-option-flip-card'>
            <div className={`flip-card-inner ${cardRevealed ? 'flipping' : ''}`}>
              <div className='flip-card-front'>
                <img
                  src={`${SERVER_BASE_URL}${optionValue}`}
                  alt={`Vote Option ${optionNumber}`}
                  className='vote-option-image'
                />
              </div>
              <div className='flip-card-back'>
                <span className='card-back-logo'>QP</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <button onClick={() => onVote(optionValue)} disabled={buttonState.disabled}>
        {buttonState.text}
      </button>
    </div>
  );
}

export default VoteOption; 