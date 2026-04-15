import { useState } from 'react';
import '../styles/LoginScreen.css'; // Create this CSS file
import { SERVER_URL, isGameServerConfigured, GAME_SERVER_CONFIG_HELP } from '../config';
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
    if (!isGameServerConfigured()) {
      const msg = `Game server is not configured for this site. ${GAME_SERVER_CONFIG_HELP}`;
      setError(msg);
      showError(msg, 12000);
      return;
    }
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
        showSuccess('Login successful! Welcome back!', 3000);
        onLoginSuccess(data);
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
      const base = err?.message || 'Login failed. Please check credentials.';
      const isFetchFail =
        typeof base === 'string' &&
        (base.includes('Failed to fetch') || base.includes('NetworkError'));
      const errorMessage =
        isFetchFail && isGameServerConfigured()
          ? `${base} If the API is on another domain, check CORS (ALLOWED_ORIGINS) and that the API uses HTTPS.`
          : base;
      setError(errorMessage);
      showError(errorMessage, 8000);
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
        <button type='button' onClick={onNavigateToRegister} className='link-button'>
          Register here
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;
