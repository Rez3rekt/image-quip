import '../../styles/LoadingSpinner.css';

/**
 * A reusable loading spinner component
 * @param {Object} props Component props
 * @param {string} [props.size='medium'] - Size of the spinner ('small', 'medium', 'large')
 * @param {string} [props.color] - Custom color for the spinner
 * @param {string} [props.message] - Optional message to display
 */
const LoadingSpinner = ({ size = 'medium', color, message }) => {
  const spinnerClasses = `loading-spinner ${size}`;

  return (
    <div className='loading-container'>
      <div className={spinnerClasses} style={color ? { borderTopColor: color } : undefined}></div>
      {message && <p className='loading-message'>{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
