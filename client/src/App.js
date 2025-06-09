// client/src/App.js
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import io from 'socket.io-client';
import TitleScreen from './components/TitleScreen';
import Header from './components/Header';
import LoginScreen from './components/LoginScreen'; // Import LoginScreen
import RegisterScreen from './components/RegisterScreen'; // Import RegisterScreen
import _FinalResultsScreen from './components/FinalResultsScreen'; // <-- Import FinalResultsScreen if not already
import _DisplayVotingScreen from './components/DisplayVotingScreen'; // <<< Import Display Component
import _DisplayVoteRevealScreen from './components/DisplayVoteRevealScreen';
import _DisplayFinalResultsScreen from './components/DisplayFinalResultsScreen';
import { SERVER_URL, SERVER_BASE_URL } from './config';
import { getClientId } from './utils/clientId'; // Import client ID utility
import CardWallBackground from './components/CardWallBackground'; // <<< Import new component
import { LoadingState, ToastContainer, ConnectionStatus, ErrorBoundary } from './components/common'; // Import loading components, toast, and error boundary
import './styles/global.css';
import useDeviceDetect from './utils/useDeviceDetect';

// Lazy load heavy components for better performance
import {
  LazyGame,
  LazyMyCardsScreen,
  LazyLoginScreen,
  LazyRegisterScreen,
  LazyAccountScreen,
  LazyDisplayVotingScreen,
  LazyDisplayVoteRevealScreen,
  LazyDisplayFinalResultsScreen,
  ComponentLoadingFallback,
} from './components/LazyComponents';

const persistentClientId = getClientId(); // Get or generate client ID on app load

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState(null); // This is the temporary socket ID
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('title'); // 'title', 'game', 'mycards', 'login', 'register', 'account'
  const [appNickname, setAppNickname] = useState(''); // <-- Add nickname state
  // Initialize username from localStorage
  const [loggedInUsername, setLoggedInUsername] = useState(
    () => localStorage.getItem('username') || null,
  );
  const [loggedInUserIcon, setLoggedInUserIcon] = useState(
    localStorage.getItem('userIcon') || '👤',
  ); // <-- Add state for icon
  const [ownedCards, setOwnedCards] = useState([]); // Store paths of owned cards
  const [_showLoginModal, _setShowLoginModal] = useState(false);
  const [_showRegisterModal, _setShowRegisterModal] = useState(false);

  // Add device detection hook
  const deviceInfo = useDeviceDetect();

  // <<< NEW: Effect to register guest client ID with socket >>>
  useEffect(() => {
    // if (socket && persistentClientId && !loggedInUsername) { // Only for guests
    //     console.log(`[App GuestReg] Emitting 'registerGuestClientId' for ${persistentClientId} to socket ${socket.id}`);
    //     socket.emit('registerGuestClientId', persistentClientId);
    // }
    // <<< This logic will be moved to the socket 'connect' handler >>>
  }, [socket, persistentClientId, loggedInUsername]);

  // -- Navigation Functions (Define BEFORE hooks that use them) --
  const navigateToGame = () => setCurrentView('game');
  const navigateToMyCards = () => setCurrentView('mycards');
  const navigateToTitle = () => {
    // Optional: Add logic here if leaving game needs cleanup (e.g., disconnect socket?)
    setGameState(null); // Clear game state when returning to title
    setError(null);
    // Keep appNickname when returning to title
    setCurrentView('title');
  };
  const navigateToLogin = () => setCurrentView('login');
  const navigateToRegister = () => setCurrentView('register');
  const navigateToAccount = () => setCurrentView('account'); // Add account navigation
  // -- End Navigation Functions --

  const fetchOwnedCards = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !loggedInUsername) {
      setOwnedCards([]); // Clear if not logged in
      return;
    }
    try {
      const response = await fetch(`${SERVER_URL}/api/cards/me/paths`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // <<< Specific check for 403 Forbidden >>>
        if (response.status === 403) {
          console.warn(
            '[App fetchOwnedCards] Received 403 Forbidden. Clearing token and navigating to login.',
          );
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('userIcon'); // Also clear icon
          setLoggedInUsername(null);
          setLoggedInUserIcon('👤'); // Reset icon state
          setOwnedCards([]); // Clear cards state
          setError('Your session may have expired. Please log in again.');
          navigateToLogin();
          return; // Stop execution here
        } else {
          // Throw generic error for other non-OK responses
          throw new Error(`Failed to fetch cards: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setOwnedCards(data.ownedCards || []);
      // Clear any previous auth error on success
      if (error === 'Your session may have expired. Please log in again.') {
        setError(null);
      }
    } catch (err) {
      // Avoid logging the specific 403 error again if we handled it above
      if (err.message?.includes('Forbidden')) {
        console.warn('[App fetchOwnedCards] Catch block: Handled 403 above.');
      } else {
        console.error('Error fetching owned cards:', err);
        setError('Could not load your card collection.');
        setOwnedCards([]); // Clear on error
      }
    }
  }, [loggedInUsername]); // <-- Only loggedInUsername is needed here

  // --- Add Card To Collection ---
  const _addCardToCollection = useCallback(
    async imagePath => {
      const token = localStorage.getItem('token');
      if (!token || !loggedInUsername) {
        setError('You must be logged in to add cards.');
        return;
      }
      // Optimistic update: Add card immediately to state
      // NOTE: This assumes ownedCards is an array of paths, which might not be true?
      // Check if MyCardsScreen updates this state or if App needs to manage full card objects.
      // For now, let's assume it IS just paths based on the previous fetchOwnedCards logic.
      if (ownedCards && !ownedCards.includes(imagePath)) {
        // Add null/undefined check for safety
        setOwnedCards(prev => [...prev, imagePath]);
      } else {
        // Optionally show a message to the user
        // return; // Let the API call handle duplicates just in case state is wrong
      }

      try {
        const response = await fetch(`${SERVER_URL}/api/cards/me/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ imagePath }),
        });

        const responseData = await response.json(); // Always try to parse JSON

        if (!response.ok) {
          // Throw error using message from server if available
          throw new Error(responseData.message || `Failed to add card: ${response.statusText}`);
        }

        // Optional: Re-fetch or update state more accurately based on responseData.card?
        // If the optimistic update was wrong (e.g., card was already owned), we might need to adjust.
        // For now, assume optimistic update is okay or handled by MyCardsScreen re-fetch.
      } catch (err) {
        console.error('Error adding card:', err);

        // <<< Check for potential auth/expired token error >>>
        const errorMessage = err.message || '';
        if (
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('Forbidden') ||
          errorMessage.includes('expired')
        ) {
          setError('Session expired. Please log in again to save cards.');
          localStorage.removeItem('token'); // Clear potentially invalid token
          localStorage.removeItem('username');
          localStorage.removeItem('userIcon');
          setLoggedInUsername(null);
          setLoggedInUserIcon('👤');
          navigateToLogin(); // Go directly to login
        } else {
          // Generic error handling for other issues
          setError(`Failed to add card: ${errorMessage}`);
          // Revert optimistic update on error only if it was actually added optimistically
          if (ownedCards && !ownedCards.includes(imagePath)) {
            // Check if it was *not* there before the attempt
            setOwnedCards(prev => prev.filter(path => path !== imagePath));
          }
        }
      }
    },
    [loggedInUsername, ownedCards, navigateToLogin],
  ); // Dependencies: ownedCards needed for optimistic check

  // --- Effect to fetch cards on login ---
  useEffect(() => {
    if (loggedInUsername) {
      fetchOwnedCards(); // <<< UNCOMMENT CALL
    } else {
      setOwnedCards([]); // Clear cards on logout
    }
  }, [loggedInUsername, fetchOwnedCards]); // <<< ADD fetchOwnedCards to dependencies

  // --- NEW Game Action Handlers (Called from FinalResultsScreen) ---
  const _handleContinueGame = useCallback(() => {
    if (socket && gameState?.gameId) {
      socket.emit('continueGame', gameState.gameId);
      // Navigation handled by server pushing 'prompt' phase state
    } else {
      console.error('[App] Cannot continue game: Socket or GameID missing.');
    }
  }, [socket, gameState?.gameId]);

  const _handleResetLobby = useCallback(() => {
    if (socket && gameState?.gameId) {
      socket.emit('resetLobby', gameState.gameId);
    } else {
      console.warn('[App] Cannot reset lobby: Missing socket or gameId');
    }
  }, [socket, gameState?.gameId]);
  // --- END Game Action Handlers ---

  // --- Authentication & Account ---
  const handleLoginSuccess = userData => {
    // Accept the whole user data object
    // Store token and basic info
    localStorage.setItem('token', userData.token);
    localStorage.setItem('username', userData.user.username);
    localStorage.setItem('userIcon', userData.user.defaultIcon); // Also store icon for persistence

    // Update state directly from the login response
    setLoggedInUsername(userData.user.username);
    setLoggedInUserIcon(userData.user.defaultIcon || '👤'); // Use icon from response

    navigateToTitle(); // Navigate after setting state
  };

  const handleRegisterSuccess = (/* username, token */) => {
    // Maybe log them in automatically after registration?
    // handleLoginSuccess(username, token);
    setCurrentView('login'); // Go to login after register for now
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userIcon'); // <-- Clear icon on logout
    setLoggedInUsername(null);
    setLoggedInUserIcon('👤'); // <-- Reset icon state
    setSocket(null); // Disconnect socket?
    // TODO: Add socket disconnect logic if needed
    navigateToTitle();
  };

  const handleSaveChanges = preferences => {
    // Update username only if it actually changed
    const currentStoredUsername = localStorage.getItem('username');
    if (preferences.defaultNickname && preferences.defaultNickname !== currentStoredUsername) {
      localStorage.setItem('username', preferences.defaultNickname);
      setLoggedInUsername(preferences.defaultNickname); // Update state which triggers card re-fetch if needed
    } else if (!preferences.defaultNickname) {
      // Handle case where nickname is cleared
      localStorage.removeItem('username');
      setLoggedInUsername(null);
    }

    if (preferences.defaultIcon) {
      localStorage.setItem('userIcon', preferences.defaultIcon);
      setLoggedInUserIcon(preferences.defaultIcon);
    }
  };

  // --- Socket Connection Effect ---
  useEffect(() => {
    // Force WebSocket transport
    const s = io(SERVER_URL, { transports: ['websocket'] });
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // --- Socket Event Listeners Effect ---
  useEffect(() => {
    if (!socket) {
      return;
    }

    // Define handlers *inside* the effect to capture correct state setters
    const handleConnect = () => {
      setIsConnected(true);
      setPlayerId(socket.id);
      // <<< MOVE GUEST REGISTRATION HERE >>>
      if (
        persistentClientId &&
        !localStorage.getItem(
          'token',
        ) /* Check token directly as loggedInUsername might not be set yet */
      ) {
        socket.emit('registerGuestClientId', persistentClientId);
      }
    };

    const handleDisconnect = _reason => {
      setIsConnected(false);
      setGameState(null);
      setPlayerId(null);
      setError('Disconnected from server.');
      navigateToTitle();
    };

    const handleGameStateUpdate = newState => {
      setGameState(prevState => {
        const updatedState = {
          ...prevState,
          ...newState,
          myId: socket.id,
        };
        return updatedState;
      });
      setError(null);
    };

    const handleGameError = errorMessage => {
      console.error('[App Socket] Game Error:', errorMessage);
      setError(errorMessage);
    };

    const handleGameCreated = initialGameState => {
      if (!initialGameState || !initialGameState.gameId) {
        console.error(
          '[App Socket] ERROR: Received invalid initialGameState in handleGameCreated!',
          initialGameState,
        );
        setError('Failed to initialize game state after creation.');
        return;
      }
      setGameState({ ...initialGameState, myId: socket.id }); // Ensure myId is set here too
      setError(null);
      navigateToGame();
    };

    const handleGameJoined = initialGameState => {
      if (!initialGameState || !initialGameState.gameId) {
        console.error(
          '[App Socket] ERROR: Received invalid initialGameState in handleGameJoined!',
          initialGameState,
        );
        setError('Failed to initialize game state after joining.');
        return;
      }
      setGameState({ ...initialGameState, myId: socket.id }); // Ensure myId is set
      setError(null);
      navigateToGame();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('gameError', handleGameError);
    socket.on('gameCreated', handleGameCreated);
    socket.on('gameJoined', handleGameJoined);

    // Game state update (This is the one the server uses for prompt updates)
    socket.on('update', handleGameStateUpdate);

    // <<< Add Listener for Test Event >>>
    socket.on('test_host_receipt', _data => {
      // Test event received
    });
    // <<< End Listener >>>

    // <<< NEW: Listener for Lobby Closed >>>
    const handleLobbyClosed = message => {
      setError(message || 'Lobby closed by host.');
      setGameState(null); // Clear game state
      navigateToTitle(); // Go back to title
    };
    socket.on('lobbyClosedByHost', handleLobbyClosed);
    // <<< End New Listener >>>

    // <<< Listen for Kicked Event >>>
    socket.on('kicked', message => {
      console.warn(`[App Socket] Kicked from game: ${message}`);
      alert(`You were kicked from the lobby: ${message}`);
      setGameState(null); // Clear game state
      setError(null); // Clear any errors
      setCurrentView('title'); // Go back to title screen
      // Optionally disconnect the socket if required?
      // s.disconnect();
      // setSocket(null);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('gameError', handleGameError);
      socket.off('gameCreated', handleGameCreated);
      socket.off('gameJoined', handleGameJoined);
      socket.off('update', handleGameStateUpdate);
      socket.off('test_host_receipt');
      socket.off('lobbyClosedByHost', handleLobbyClosed);
      socket.off('kicked'); // <<< Clean up kicked listener
    };
  }, [
    socket,
    setGameState,
    setIsConnected,
    setPlayerId,
    setError,
    navigateToTitle,
    navigateToGame,
  ]);

  // --- Effect to Log View Changes ---
  useEffect(() => {
    // View changed to: ${currentView}
  }, [currentView]);

  // Helper function to generate a random nickname
  const _generateNickname = () => {
    const adjectives = ['Happy', 'Snazzy', 'Zippy', 'Bouncy', 'Quirky', 'Jazzy', 'Fluffy'];
    const nouns = ['Turtle', 'Panda', 'Rocket', 'Wizard', 'Ninja', 'Llama', 'Dragon'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}${noun}${num}`;
  };

  // --- Render Logic ---
  const renderView = () => {
    // Find the current player object from gameState
    const currentPlayer = gameState?.players?.find(p => p.id === playerId);
    const isDisplayPlayer = currentPlayer?.isDisplayPlayer || false;

    // Calculate isHost here
    const isHost = gameState?.hostId === playerId;

    if (!isConnected && currentView === 'game') {
      return <LoadingState message='Connecting to server...' />;
    }

    switch (currentView) {
      case 'title':
        // Pass socketId as playerId for connection status etc.
        return (
          <TitleScreen
            socket={socket}
            isConnected={isConnected}
            _playerId={playerId}
            _onNavigateToGame={navigateToGame}
            onNavigateToMyCards={navigateToMyCards}
            error={error}
            setError={setError}
            setAppNickname={setAppNickname} // <-- Pass the setter function
            currentNickname={appNickname} // <-- Pass current nickname
            loggedInUsername={loggedInUsername}
            loggedInUserIcon={loggedInUserIcon} // <-- Pass icon state
            _deviceInfo={deviceInfo} // Pass device info
          />
        );
      case 'game':
        // ADDED: Check for Display Player Role
        if (isDisplayPlayer) {
          // Display player specific rendering based on phase
          switch (gameState?.phase) {
            case 'vote':
              return (
                <Suspense fallback={<ComponentLoadingFallback message="Loading voting display..." />}>
                  <LazyDisplayVotingScreen gameState={gameState} />
                </Suspense>
              );
            case 'cardSelection':
              return <LoadingState message='Waiting for players to select cards...' fullscreen />;
            case 'vote_reveal':
              return (
                <Suspense fallback={<ComponentLoadingFallback message="Loading vote reveal..." />}>
                  <LazyDisplayVoteRevealScreen gameState={gameState} />
                </Suspense>
              );
            case 'final_results':
            case 'ended':
              return (
                <Suspense fallback={<ComponentLoadingFallback message="Loading final results..." />}>
                  <LazyDisplayFinalResultsScreen gameState={gameState} />
                </Suspense>
              );
            // Add cases for other phases later
            default:
              // Fallback: Show the standard component for now if no specific display version exists
              return (
                <LoadingState
                  message={`Display mode: ${gameState?.phase || 'Unknown phase'}`}
                  fullscreen
                />
              );
          }
        }

        if (!gameState) {
          return <LoadingState message='Waiting for game state...' />;
        }

        return (
          <Suspense fallback={<ComponentLoadingFallback message="Loading game..." />}>
            <LazyGame
              gameState={gameState}
              socket={socket}
              playerId={playerId}
              persistentClientId={persistentClientId}
              isHost={isHost}
              error={error}
              setError={setError}
              onLeaveGame={navigateToTitle}
              deviceInfo={deviceInfo} // Pass device info
            />
          </Suspense>
        );

      case 'mycards':
        // Pass persistentClientId and loggedInUsername for fetching
        return (
          <Suspense fallback={<ComponentLoadingFallback message="Loading card collection..." />}>
            <LazyMyCardsScreen
              clientId={persistentClientId}
              loggedInUsername={loggedInUsername} // Pass username for potential user-specific fetching
              onNavigateBack={navigateToTitle}
              deviceInfo={deviceInfo} // Pass device info
            />
          </Suspense>
        );
      case 'login':
        return (
          <Suspense fallback={<ComponentLoadingFallback message="Loading login..." />}>
            <LazyLoginScreen
              onLoginSuccess={handleLoginSuccess}
              onNavigateBack={navigateToTitle}
              onNavigateToRegister={navigateToRegister} // Pass prop
            />
          </Suspense>
        );
      case 'register': // Add register case
        // Use the actual RegisterScreen component
        return (
          <Suspense fallback={<ComponentLoadingFallback message="Loading registration..." />}>
            <LazyRegisterScreen
              onRegisterSuccess={handleRegisterSuccess}
              onNavigateBack={navigateToLogin}
            />
          </Suspense>
        );
      case 'account': // Add account case
        return (
          <Suspense fallback={<ComponentLoadingFallback message="Loading account..." />}>
            <LazyAccountScreen
              currentUsername={loggedInUsername}
              onSaveChanges={handleSaveChanges} // <-- Pass updated handler
              onLogout={handleLogout}
              onNavigateBack={navigateToTitle}
            />
          </Suspense>
        );
      default:
        return <LoadingState message='Loading...' />;
    }
  };

  return (
    <ErrorBoundary>
      <div className='App'>
        {/* Card Wall Background - Behind everything */}
        <CardWallBackground ownedCards={ownedCards} serverUrl={SERVER_BASE_URL} />
        
        {/* Toast Container for global notifications */}
        <ToastContainer />
        
        {/* Connection Status for network feedback */}
        <ConnectionStatus socket={socket} isConnected={isConnected} />
        
        <Header
          gameState={gameState}
          playerId={socket?.id}
          isConnected={isConnected}
          appNickname={appNickname}
          loggedInUsername={loggedInUsername}
          loggedInUserIcon={loggedInUserIcon}
          onNavigateToLogin={navigateToLogin}
          onNavigateToTitle={navigateToTitle}
          onNavigateToAccount={navigateToAccount}
        />
        <div className='main-content'>
          {renderView()}
          {error && <p className='error-message global-error'>Error: {error}</p>}
        </div>

        {/* Modals */}
        {_showLoginModal && (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onNavigateBack={navigateToTitle}
            onNavigateToRegister={navigateToRegister}
          />
        )}
        {_showRegisterModal && (
          <RegisterScreen
            onRegisterSuccess={handleRegisterSuccess}
            onNavigateBack={navigateToLogin}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

// --- Need to import components used in findComponentForPhase ---
import _Lobby from './components/Lobby';
import _CardSelectionScreen from './components/CardSelectionScreen';
import _PromptScreen from './components/PromptScreen';
import _VotingScreen from './components/VotingScreen';
import _VoteRevealScreen from './components/VoteRevealScreen';
// FinalResultsScreen is already imported

export default App;
