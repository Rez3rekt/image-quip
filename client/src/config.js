// Define the base URL for the server
// Use environment variables for flexibility across different environments

// Get environment variables safely (browser compatible)
const getEnvVar = (name, defaultValue = null) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || defaultValue;
  }
  return defaultValue;
};

// Default to localhost in development if no environment variables are set
const isProduction = getEnvVar('NODE_ENV') === 'production';
const DEFAULT_SERVER_URL = isProduction
  ? 'http://23.92.140.100:3001' 
  : 'http://localhost:3001';

// Allow override via environment variables
const SERVER_URL = getEnvVar('REACT_APP_SERVER_URL') || DEFAULT_SERVER_URL;
const SERVER_BASE_URL = getEnvVar('REACT_APP_SERVER_BASE_URL') || SERVER_URL;

// Socket.io configuration
const SOCKET_URL = getEnvVar('REACT_APP_SOCKET_URL') || SERVER_URL;

export { SERVER_URL, SERVER_BASE_URL, SOCKET_URL };
