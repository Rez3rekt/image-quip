import { v4 as uuidv4 } from 'uuid'; // Need to install uuid: npm install uuid

const CLIENT_ID_KEY = 'chirpedClientId';

/**
 * Retrieves the persistent client ID from localStorage,
 * or generates and saves a new one if it doesn't exist.
 *
 * @returns {string} The client ID.
 */
export function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = uuidv4(); // Generate a new UUID
    try {
      localStorage.setItem(CLIENT_ID_KEY, clientId);
    } catch (error) {
      // Handle potential storage errors (e.g., quota full, security settings)
      console.error('Failed to save new client ID to localStorage:', error);
      // Return the generated ID anyway for the current session
    }
  }
  return clientId;
}
