import LoadingSpinner from './LoadingSpinner';
import '../../styles/LoadingScreen.css';

/**
 * A full-screen loading component with animation for smooth transitions
 * @param {Object} props Component props
 * @param {string} [props.message='Loading...'] - Message to display
 * @param {string} [props.logo] - Optional logo or icon to display
 */
const LoadingScreen = ({ message = 'Loading...', logo }) => {
  return (
    <div className='loading-screen'>
      <div className='loading-screen-content'>
        {logo && <div className='loading-logo'>{logo}</div>}
        <LoadingSpinner size='large' />
        <p className='loading-screen-message'>{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
