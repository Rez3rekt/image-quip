// client/src/App.js
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, Suspense } from 'react';
import io from 'socket.io-client';
import TitleScreen from './components/TitleScreen';
import Header from './components/Header';
import { SERVER_URL, SERVER_BASE_URL, lobbyMusicSrc, isGameServerConfigured } from './config';
import { getClientId } from './utils/clientId'; // Import client ID utility
import CardWallBackground from './components/CardWallBackground'; // <<< Import new component
import {
  LoadingState,
  ToastContainer,
  ConnectionStatus,
  ErrorBoundary,
  showToast,
} from './components/common';
import FirstRunOnboarding, { isOnboardingDismissed } from './components/FirstRunOnboarding';
import { useGameAudio } from './hooks/useGameAudio';
import './styles/global.css';
import './styles/game-cards.css';
import useDeviceDetect from './utils/useDeviceDetect';
import { getUserIdFromToken } from './utils/jwtPayload';

// Lazy load heavy components for better performance
import {
  LazyGame,
  LazyMyCardsScreen,
  LazyLoginScreen,
  LazyRegisterScreen,
  LazyAccountScreen,
  LazyTradingScreen,
  LazyDisplayVotingScreen,
  LazyDisplayVoteRevealScreen,
  LazyDisplayFinalResultsScreen,
  ComponentLoadingFallback,
} from './components/LazyComponents';

const persistentClientId = getClientId(); // Get or generate client ID on app load
const REJOIN_KEY = 'imageQuip_rejoinPayload';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState(null); // This is the temporary socket ID
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('title'); // 'title', 'game', 'mycards', 'trading', 'login', 'register', 'account'
  const [appNickname, setAppNickname] = useState(''); // <-- Add nickname state
  // Initialize username from localStorage
  const [loggedInUsername, setLoggedInUsername] = useState(
    () => localStorage.getItem('username') || null,
  );
  const [loggedInUserIcon, setLoggedInUserIcon] = useState(
    localStorage.getItem('userIcon') || '👤',
  ); // <-- Add state for icon
  const [ownedCards, setOwnedCards] = useState([]); // Store paths of owned cards
  /** Trading room UI state — listeners live on App so Strict Mode remounts of TradingScreen do not drop tradeRoomJoined. */
  const [tradeRoomState, setTradeRoomState] = useState(null);
  /** Logged-in trade partner selection — lives in App so socket.io handlers can update the invitee when tradePartnerOpened fires. */
  const [tradePartnerUserId, setTradePartnerUserId] = useState('');
  /** Inline banner when someone taps Trade with you (supplements toast). */
  const [tradeIncomingBanner, setTradeIncomingBanner] = useState(null);
  const tradeRoomStateRef = useRef(null);
  // Add device detection hook
  const deviceInfo = useDeviceDetect();
  const currentViewRef = useRef('title');
  const [showOnboarding, setShowOnboarding] = useState(
    () => typeof window !== 'undefined' && !isOnboardingDismissed(),
  );

  const { lobbyAudioRef } = useGameAudio(gameState?.phase, currentView);

  // Sync before paint so socket handlers (e.g. tradePartnerOpened) never see stale null refs ahead of useEffect.
  useLayoutEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useLayoutEffect(() => {
    tradeRoomStateRef.current = tradeRoomState;
  }, [tradeRoomState]);

  useEffect(() => {
    if (!tradeRoomState) {
      setTradePartnerUserId('');
      setTradeIncomingBanner(null);
    }
  }, [tradeRoomState]);

  /** Leave trading room when navigating away (do not emit from TradingScreen unmount — Strict Mode remount would fire leave immediately after host). */
  const prevViewForTradingRef = useRef(currentView);
  useEffect(() => {
    const prev = prevViewForTradingRef.current;
    if (prev === 'trading' && currentView !== 'trading' && socket) {
      socket.emit('leaveTradeRoom');
      setTradeRoomState(null);
    }
    prevViewForTradingRef.current = currentView;
  }, [currentView, socket]);

  useEffect(() => {
    if (currentView !== 'game' || !gameState?.gameId) {
      return;
    }
    const selfId = gameState.myId;
    const me = gameState.players?.find(p => p.id === selfId);
    try {
      sessionStorage.setItem(
        REJOIN_KEY,
        JSON.stringify({
          gameId: gameState.gameId,
          nickname: appNickname || me?.nickname || 'Player',
          icon: me?.icon || '👤',
        }),
      );
    } catch {
      /* ignore */
    }
  }, [gameState, currentView, appNickname]);

  // -- Navigation (useCallback so socket listener effect does not re-run every render) --
  const navigateToGame = useCallback(() => setCurrentView('game'), []);
  const navigateToMyCards = useCallback(() => setCurrentView('mycards'), []);
  const navigateToTitle = useCallback(() => {
    try {
      sessionStorage.removeItem(REJOIN_KEY);
    } catch {
      /* ignore */
    }
    setGameState(null);
    setError(null);
    setCurrentView('title');
  }, []);
  const navigateToLogin = useCallback(() => setCurrentView('login'), []);
  const navigateToRegister = useCallback(() => setCurrentView('register'), []);
  const navigateToAccount = useCallback(() => setCurrentView('account'), []);
  const navigateToTrading = useCallback(() => {
    setTradeRoomState(null);
    setTradePartnerUserId('');
    setTradeIncomingBanner(null);
    setCurrentView('trading');
  }, []);
  // -- End Navigation Functions --

  const fetchOwnedCards = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !loggedInUsername) {
      setOwnedCards([]); // Clear if not logged in
      return;
    }
    if (!isGameServerConfigured()) {
      setOwnedCards([]);
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
      setError(prev =>
        prev === 'Your session may have expired. Please log in again.' ? null : prev,
      );
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
  }, [loggedInUsername]);

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
          setOwnedCards(prev => prev.filter(path => path !== imagePath));
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

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userIcon');
    setLoggedInUsername(null);
    setLoggedInUserIcon('👤');
    setTradeRoomState(null);
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    navigateToTitle();
  }, [socket]);

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
    if (!isGameServerConfigured()) {
      console.warn(
        '[Chirped] Socket disabled: no game server URL. Set REACT_APP_SERVER_URL for this deployment.',
      );
      return undefined;
    }
    const s = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
    });
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
      const token = localStorage.getItem('token');
      if (token) {
        socket.emit('identifyUser', token);
      }
      if (
        persistentClientId &&
        !localStorage.getItem(
          'token',
        ) /* Check token directly as loggedInUsername might not be set yet */
      ) {
        socket.emit('registerGuestClientId', persistentClientId);
      }

      if (currentViewRef.current === 'game') {
        try {
          const raw = sessionStorage.getItem(REJOIN_KEY);
          if (raw) {
            const { gameId, nickname, icon } = JSON.parse(raw);
            if (gameId && nickname) {
              socket.emit('joinGame', {
                gameCode: gameId,
                nickname,
                icon: icon || '👤',
                authToken: token || undefined,
              });
            }
          }
        } catch {
          /* ignore */
        }
      }
    };

    const handleDisconnect = _reason => {
      setIsConnected(false);
      setGameState(null);
      setPlayerId(null);
      setTradeRoomState(null);
      showToast('Disconnected from server. Reconnecting…', 'warning', 5000);
    };

    const handleGameStateUpdate = newState => {
      setGameState(prevState => {
        const updatedState = {
          ...(prevState || {}),
          ...newState,
          myId: socket.id,
        };
        return updatedState;
      });
      setError(null);
    };

    const handleGameError = errorMessage => {
      console.error('[App Socket] Game Error:', errorMessage);
      const text = typeof errorMessage === 'string' ? errorMessage : String(errorMessage);
      setError(text);
      showToast(text, 'error', 6000);
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
      setGameState(null);
      setError(message || 'You were kicked from the lobby.');
      setCurrentView('title');
    });

    const handleTradeRoomJoined = state => {
      const next = {
        roomId: state.roomId,
        hostId: state.hostId,
        players: state.players || [],
        myId: state.myId,
      };
      tradeRoomStateRef.current = next;
      setTradeRoomState(next);
    };
    const handleTradeRoomUpdate = state => {
      setTradeRoomState(prev => {
        const next = {
          roomId: state.roomId,
          hostId: state.hostId,
          players: state.players || [],
          myId: prev?.myId ?? socket.id,
        };
        tradeRoomStateRef.current = next;
        return next;
      });
    };
    const handleTradeRoomClosed = payload => {
      setTradeRoomState(null);
      showToast(payload?.message || 'Trading room closed.', 'warning', 6000);
    };
    const handleTradeRoomLeft = () => {
      setTradeRoomState(null);
    };
    const handleTradeRoomError = msg => {
      const text = typeof msg === 'string' ? msg : String(msg);
      showToast(text, 'error', 6000);
    };

    /** Must live with [socket]-scoped listeners — do not register in TradingScreen (mount order / early deps can drop it). */
    const handleTradePartnerOpened = payload => {
      if (!payload?.tradingRoomId) {
        return;
      }
      // Do not require currentViewRef === 'trading' — ref can lag navigation; server only targets invitee sockets.
      const state = tradeRoomStateRef.current;
      // If room ref is synced, codes must match. If ref is still null (rare race), still notify when we're the target.
      if (state?.roomId && payload.tradingRoomId !== state.roomId) {
        return;
      }
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      const myUid = getUserIdFromToken(token);
      if (myUid == null) {
        return;
      }
      if (Number(payload.toUserId) !== Number(myUid)) {
        return;
      }
      setTradePartnerUserId(String(payload.fromUserId));
      setTradeIncomingBanner({
        fromUserId: payload.fromUserId,
        fromNickname: payload.fromNickname || 'Someone',
      });
      showToast(
        `${payload.fromNickname || 'Someone'} wants to trade with you. Card trades are open below.`,
        'info',
        8000,
      );
    };

    socket.on('tradeRoomJoined', handleTradeRoomJoined);
    socket.on('tradeRoomUpdate', handleTradeRoomUpdate);
    socket.on('tradeRoomClosed', handleTradeRoomClosed);
    socket.on('tradeRoomLeft', handleTradeRoomLeft);
    socket.on('tradeRoomError', handleTradeRoomError);
    socket.on('tradePartnerOpened', handleTradePartnerOpened);

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
      socket.off('tradeRoomJoined', handleTradeRoomJoined);
      socket.off('tradeRoomUpdate', handleTradeRoomUpdate);
      socket.off('tradeRoomClosed', handleTradeRoomClosed);
      socket.off('tradeRoomLeft', handleTradeRoomLeft);
      socket.off('tradeRoomError', handleTradeRoomError);
      socket.off('tradePartnerOpened', handleTradePartnerOpened);
    };
    // Intentionally only [socket]: navigation handlers are useCallback-stable so this effect must NOT
    // re-run on every render (that was removing all listeners and dropping tradeRoomJoined / game events).
  }, [socket]);

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
    const selfId = gameState?.myId ?? playerId ?? socket?.id;
    const currentPlayer = gameState?.players?.find(p => p.id === selfId);
    const isDisplayPlayer = currentPlayer?.isDisplayPlayer || false;

    // Calculate isHost here (use myId so it stays correct if socket id and React state diverge)
    const isHost = gameState?.hostId === selfId;

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
            onNavigateToTrading={navigateToTrading}
            error={error}
            setError={setError}
            setAppNickname={setAppNickname} // <-- Pass the setter function
            currentNickname={appNickname} // <-- Pass current nickname
            loggedInUsername={loggedInUsername}
            loggedInUserIcon={loggedInUserIcon} // <-- Pass icon state
            _deviceInfo={deviceInfo} // Pass device info
            authToken={typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null}
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
      case 'trading':
        return (
          <Suspense fallback={<ComponentLoadingFallback message="Loading trading..." />}>
            <LazyTradingScreen
              socket={socket}
              isConnected={isConnected || !!socket?.connected}
              tradeRoomState={tradeRoomState}
              setTradeRoomState={setTradeRoomState}
              tradePartnerUserId={tradePartnerUserId}
              setTradePartnerUserId={setTradePartnerUserId}
              tradeIncomingBanner={tradeIncomingBanner}
              setTradeIncomingBanner={setTradeIncomingBanner}
              onNavigateBack={navigateToTitle}
              authToken={typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null}
              loggedInUsername={loggedInUsername}
              loggedInUserIcon={loggedInUserIcon}
              setAppNickname={setAppNickname}
              currentNickname={appNickname}
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
        <audio
          ref={lobbyAudioRef}
          src={lobbyMusicSrc()}
          preload='auto'
          loop
          aria-hidden='true'
        />
        <div className='main-content'>
          {showOnboarding && currentView === 'title' && (
            <FirstRunOnboarding onClose={() => setShowOnboarding(false)} />
          )}
          {renderView()}
          {error && <p className='error-message global-error'>Error: {error}</p>}
        </div>

      </div>
    </ErrorBoundary>
  );
}

export default App;
