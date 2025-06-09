import LoadingSpinner from './LoadingSpinner';
import '../../styles/LoadingState.css';

/**
 * A reusable loading state component for the game screens
 * @param {Object} props
 * @param {string} [props.message='Loading...'] - Message to display
 * @param {string} [props.size='medium'] - Size of spinner ('small', 'medium', 'large')
 * @param {boolean} [props.fullscreen=false] - Whether to display full screen
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {boolean} [props.showCardBackground=true] - Whether to show card background
 */
const LoadingState = ({
  message = 'Loading...',
  size = 'medium',
  fullscreen = false,
  className = '',
  showCardBackground = true,
}) => {
  const containerClass = `loading-state-container ${fullscreen ? 'fullscreen' : ''} ${className}`;
  const wrapperClass = `loading-state-wrapper ${showCardBackground ? 'card' : ''}`;

  return (
    <div className={containerClass}>
      <div className={wrapperClass}>
        <LoadingSpinner size={size} message={message} />
      </div>
    </div>
  );
};

export default LoadingState;
