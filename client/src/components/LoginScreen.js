import { useState } from 'react';
import '../styles/LoginScreen.css'; // Create this CSS file
import { SERVER_URL } from '../config'; // Import SERVER_URL
import { LoadingButton } from './common';
import { useToast } from './common'; // Import toast hook

function LoginScreen({ onLoginSuccess, onNavigateBack, onNavigateToRegister }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError } = useToast(); // Initialize toast hooks

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Pass identifier as email parameter for backward compatibility with API
      const requestBody = { email: identifier, password };

      const response = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        showSuccess('Login successful! Welcome back!', 3000); // Show success toast
        onLoginSuccess(data); // Pass the full data object

        // Navigate back to title screen after a brief delay
        setTimeout(() => {
          onNavigateBack();
        }, 500);
      } else {
        if (response.status === 401) {
          const errorMsg = 'Invalid username/email or password. Please try again.';
          setError(errorMsg);
          showError(errorMsg, 5000); // Show error toast
        } else {
          const errorMsg = 'An error occurred during login. Please try again.';
          setError(errorMsg);
          showError(errorMsg, 5000);
        }
      }
    } catch (err) {
      // Safely extract error message without relying on err directly
      const errorMessage = err?.message || 'Login failed. Please check credentials.';
      setError(errorMessage);
      showError(errorMessage, 5000); // Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='login-container card'>
      <h2>Login</h2>
      <form onSubmit={handleLogin} className='login-form'>
        <div className='form-group'>
          <label htmlFor='identifier'>Email or Username:</label>
          <input
            type='text'
            id='identifier'
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder='Enter your email or username'
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
        {error && <p className='error-message'>{error}</p>}
        <div className='form-actions'>
          <LoadingButton
            type='submit'
            className='login-submit-button'
            disabled={!identifier || !password}
            isLoading={isLoading}
            loadingText='Logging in...'
            variant='primary'
          >
            Login
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
      <div className='register-link'>
        Don&apos;t have an account?{' '}
        <a onClick={onNavigateToRegister} className='link-button'>
          Register here
        </a>
      </div>
    </div>
  );
}

export default LoginScreen;
