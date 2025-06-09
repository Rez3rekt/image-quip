import LoadingSpinner from './LoadingSpinner';
import '../../styles/LoadingButton.css';

/**
 * A button component that shows loading state during async operations
 * @param {Object} props Component props
 * @param {boolean} props.isLoading - Whether the button is in loading state
 * @param {string} props.loadingText - Text to show when loading
 * @param {string} props.children - Button text when not loading
 * @param {boolean} [props.disabled=false] - Whether button is disabled
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {string} [props.variant='primary'] - Button style variant
 * @param {Function} props.onClick - Click handler
 * @param {string} [props.type='button'] - Button type
 */
const LoadingButton = ({
  isLoading,
  loadingText,
  children,
  disabled = false,
  className = '',
  variant = 'primary',
  onClick,
  type = 'button',
  ...props
}) => {
  const buttonClasses = `loading-button ${variant} ${className} ${isLoading ? 'loading' : ''}`;

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <span className='loading-button-content'>
          <LoadingSpinner size='small' />
          <span className='loading-text'>{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton; 