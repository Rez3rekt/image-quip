import { useState } from 'react';
import '../styles/RegisterScreen.css'; // Create this CSS file
import { SERVER_URL } from '../config'; // Import SERVER_URL
import { LoadingButton } from './common';

function RegisterScreen({ onRegisterSuccess, onNavigateBack }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [receiveEmails, setReceiveEmails] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async e => {
    e.preventDefault();
    setError('');

    // Basic Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      // Example: Minimum password length
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    // --- Placeholder for actual Register API call ---
    const _registrationData = { username, email, password, receiveEmails };
    try {
      const response = await fetch(`${SERVER_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password /*, receiveEmails: receivesEmails */ }),
      });

      const result = await response.json(); // Get JSON response regardless of status

      if (response.ok) {
        // Check if status code was 2xx (specifically 201 for created)
        onRegisterSuccess(result); // Call the success callback from App
      } else {
        // Throw error only if response status was not ok
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
    // --- End Placeholder ---
  };

  const isFormValid = username && email && password && confirmPassword && password === confirmPassword;

  return (
    <div className='register-container card'>
      <h2>Register New Account</h2>
      <form onSubmit={handleRegister} className='register-form'>
        <div className='form-group'>
          <label htmlFor='username'>Username:</label>
          <input
            type='text'
            id='username'
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className='form-group'>
          <label htmlFor='email'>Email:</label>
          <input
            type='email'
            id='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className='form-group'>
          <label htmlFor='password'>Password:</label>
          <input
            type='password'
            id='password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className='form-group'>
          <label htmlFor='confirmPassword'>Confirm Password:</label>
          <input
            type='password'
            id='confirmPassword'
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className='form-group checkbox-group'>
          <input
            type='checkbox'
            id='receiveEmails'
            checked={receiveEmails}
            onChange={e => setReceiveEmails(e.target.checked)}
            disabled={isLoading}
          />
          <label htmlFor='receiveEmails'>I would like to receive promotional emails.</label>
        </div>

        {error && <p className='error-message'>{error}</p>}

        <div className='form-actions'>
          <LoadingButton
            type='submit'
            className='register-submit-button'
            disabled={!isFormValid}
            isLoading={isLoading}
            loadingText='Registering...'
            variant='primary'
          >
            Register
          </LoadingButton>
          <button
            type='button'
            onClick={onNavigateBack}
            className='back-button'
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default RegisterScreen;
