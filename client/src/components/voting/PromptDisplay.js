import { SERVER_BASE_URL } from '../../config';

function PromptDisplay({ isFlipTheScript, promptIdentifier }) {
  return (
    <div className='prompt-display-area'>
      <div className='current-prompt-box'>
        {isFlipTheScript ? (
          <img
            src={`${SERVER_BASE_URL}${promptIdentifier}`}
            alt='Prompt Image'
            className='prompt-image prompt-vote-image'
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
          <p>{promptIdentifier}</p>
        )}
      </div>
    </div>
  );
}

export default PromptDisplay; 