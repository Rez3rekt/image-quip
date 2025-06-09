import React, { useState, useEffect, useCallback, memo } from 'react';
import { SERVER_BASE_URL } from '../config'; // Assuming you have a config file
import '../styles/CardSelectionScreen.css'; // Create this CSS file later
// Import the deck item component (adjust path if necessary)
import DeckItem from './DeckItem'; // Changed from SortableDeckItem
// import { FixedSizeGrid } from 'react-window'; // <<< REMOVE FixedSizeGrid
// import AutoSizer from 'react-virtualized-auto-sizer'; // <<< REMOVE AutoSizer

// Removed mock interface

// --- Cell component for the virtualized selection grid (No longer strictly needed for virtualization but keep structure) ---
const SelectionCardCell = memo(({ card, isSelected, handleCardSelection, style }) => {
  return (
    <div
      style={style || {}}
      className={`card-selection-item-virtualized`}
      onClick={() => handleCardSelection(card)}
    >
      {card ? (
        <div className={`image-card-wrapper card-selection-item ${isSelected ? 'selected' : ''}`}>
          <div className='image-card'>
            <img src={`${SERVER_BASE_URL}${card.imagePath}`} alt={card.name || card.id} />
          </div>
        </div>
      ) : null}
    </div>
  );
});
// --- End Cell Component ---

function CardSelectionScreen({ gameState, socket, persistentClientId }) {
  const [availableCards, setAvailableCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [decks, setDecks] = useState([]);
  const [_isDeckLoading, _setIsDeckLoading] = useState(true); // Keep separate deck loading state

  // <<< Add state for selected deck IDs >>>
  const [selectedDeckIds, setSelectedDeckIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // <<< Filter availableCards based on searchTerm >>>
  const displayableCards = React.useMemo(() => {
    if (!searchTerm) {
      return availableCards;
    }
    const lowerSearchTerm = searchTerm.toLowerCase(); // <<< Optimize: lowercase search term once
    return availableCards.filter(card => {
      const cardName = card.name || '';
      const cardPath = card.imagePath || '';
      // <<< Add tag search logic >>>
      const cardTags = card.tags || []; // Ensure tags is an array
      const tagMatch = cardTags.some(tag => tag.toLowerCase().includes(lowerSearchTerm));
      // <<< Combine checks >>>
      return (
        cardName.toLowerCase().includes(lowerSearchTerm) ||
        cardPath.toLowerCase().includes(lowerSearchTerm) ||
        tagMatch
      );
    });
  }, [availableCards, searchTerm]);

  // <<< Get the required number from gameState >>>
  const requiredCards = gameState?.settings?.promptsPerPlayer ?? 0;

  // Use socket.id to find the current player reliably
  const player = gameState?.players?.find(p => p.id === socket?.id);

  // Fetch player's cards AND decks on component mount
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    let fetchError = null;

    const clientId = persistentClientId; // Still needed for guest cards
    const token = localStorage.getItem('token'); // Check for login token

    // --- Fetch Cards (Keep existing logic for auth vs guest) ---
    try {
      let cardsUrl = '';
      const cardsHeaders = {};
      let _cardsSource = 'unknown';

      if (token) {
        _cardsSource = 'authenticated /api/cards';
        cardsUrl = `${SERVER_BASE_URL}/api/cards`;
        cardsHeaders['Authorization'] = `Bearer ${token}`;
      } else {
        _cardsSource = 'guest /api/guest-cards/:clientId';
        if (!clientId) {
          throw new Error('Cannot fetch guest cards without a client ID.');
        }
        cardsUrl = `${SERVER_BASE_URL}/api/guest-cards/${clientId}`;
      }

      const cardsResponse = await fetch(cardsUrl, { headers: cardsHeaders });

      const responseText = await cardsResponse.text(); // Get raw text first

      if (!cardsResponse.ok) {
        let errorData = {};
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          // Keep essential error parsing warning
          console.warn('[CardSelectionScreen] Failed to parse error response as JSON.');
        }
        if (token && (cardsResponse.status === 401 || cardsResponse.status === 403)) {
          throw new Error('Authentication failed for cards. Please log out and log back in.');
        } else {
          throw new Error(
            errorData.message || `Failed to fetch cards: ${cardsResponse.statusText}`,
          );
        }
      }

      let cardsData = {};
      try {
        cardsData = JSON.parse(responseText);
      } catch (e) {
        console.error('[CardSelectionScreen] Failed to parse card response text as JSON:', e);
        throw new Error('Received card data was not valid JSON.');
      }

      if (cardsData.success) {
        const receivedCards = cardsData.cards || [];
        // Keep this essential log for debugging card loading issues
        console.log('[CardSelectionScreen] Received cards:', receivedCards.length, 'cards');
        setAvailableCards(receivedCards);
      } else {
        throw new Error(cardsData.message || 'Card fetch operation reported not successful.');
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
      fetchError = err.message || 'Could not load your cards.';
      setAvailableCards([]);
    }

    // --- Fetch Decks ---
    try {
      if (token) {
        // <<< Logged-in User: Fetch from authenticated endpoint >>>
        // console.log(`[CardSelectionScreen fetchData] Fetching decks from authenticated /api/decks`);
        const decksHeaders = { Authorization: `Bearer ${token}` };
        const decksResponse = await fetch(`${SERVER_BASE_URL}/api/decks`, {
          headers: decksHeaders,
        });
        if (!decksResponse.ok) {
          const errorData = await decksResponse.json().catch(() => ({}));
          if (decksResponse.status === 401 || decksResponse.status === 403) {
            throw new Error('Authentication failed for decks. Please log out and log back in.');
          } else {
            throw new Error(
              errorData.message || `Failed to fetch decks: ${decksResponse.statusText}`,
            );
          }
        }
        const decksData = await decksResponse.json();
        if (decksData.success) {
          setDecks(decksData.decks || []);
        } else {
          throw new Error(decksData.message || 'Failed to parse deck data.');
        }
      } else {
        // <<< Guest User: Don't fetch decks (no endpoint) >>>
        // console.log(`[CardSelectionScreen fetchData] Guest user, skipping deck fetch.`);
        setDecks([]);
        // Optionally fetch from guest endpoint if/when implemented
        // const decksResponse = await fetch(`${SERVER_BASE_URL}/api/guest-decks/${clientId}`); ...
      }
    } catch (err) {
      console.error('Error fetching decks:', err);
      fetchError = fetchError
        ? `${fetchError} | ${err.message || 'Could not load decks.'}`
        : err.message || 'Could not load decks.';
      setDecks([]);
    }

    // <<< Combined Loading/Error State Setting >>>
    if (fetchError) {
      setError(fetchError);
    }
    setIsLoading(false);
  }, [persistentClientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handle Card Selection (Manual) ---
  const handleCardSelection = card => {
    // console.log(`[CardSelectionScreen] Manual card selection toggled for card ID: ${card.id}`);
    // setSelectedDeckIds([]); // <<< REMOVE THIS LINE to allow mixed selection
    setSelectedCards(prevSelected => {
      const isSelected = prevSelected.some(c => c.id === card.id);
      if (isSelected) {
        return prevSelected.filter(c => c.id !== card.id);
      } else {
        return [...prevSelected, card];
      }
    });
  };

  // --- Handle selecting/deselecting a whole deck ---
  const handleDeckSelect = deckId => {
    // console.log(`[CardSelectionScreen] Deck selection toggled for deck ID: ${deckId}`);
    const toggledDeck = decks.find(d => d.id === deckId);
    if (!toggledDeck) {
      return;
    }

    const cardIdsInToggledDeck = new Set(toggledDeck.cardIds || []);
    const cardsFromToggledDeck = availableCards.filter(c => cardIdsInToggledDeck.has(c.id));

    setSelectedDeckIds(prevDeckIds => {
      const isCurrentlySelected = prevDeckIds.includes(deckId);
      if (isCurrentlySelected) {
        // Deck is being DESELECTED
        setSelectedCards(prevSelCards =>
          prevSelCards.filter(sc => !cardIdsInToggledDeck.has(sc.id)),
        );
        return prevDeckIds.filter(id => id !== deckId);
      } else {
        // Deck is being SELECTED
        setSelectedCards(prevSelCards => {
          const newCardsToAdd = cardsFromToggledDeck.filter(
            newCard => !prevSelCards.some(existingCard => existingCard.id === newCard.id),
          );
          return [...prevSelCards, ...newCardsToAdd];
        });
        return [...prevDeckIds, deckId];
      }
    });
  };

  // <<< COMMENT OUT Effect to update selectedCards based on selectedDeckIds >>>
  /*
    useEffect(() => {
        if (selectedDeckIds.length === 0) {
            // If no decks are selected, don't automatically change selectedCards
            // This allows manual selection to persist after deselecting all decks.
            return; 
        }

        // Gather all unique card IDs from the selected decks
        const allCardIdsFromSelectedDecks = new Set();
        selectedDeckIds.forEach(deckId => {
            const deck = decks.find(d => d.id === deckId);
            if (deck && deck.cardIds) {
                deck.cardIds.forEach(cardId => allCardIdsFromSelectedDecks.add(cardId));
            }
        });

        // Filter availableCards to get the full card objects for the unique IDs
        const cardsToSelect = availableCards.filter(card => 
            allCardIdsFromSelectedDecks.has(card.id)
        );

        // Check against 100 card limit (optional, but good practice)
        if (cardsToSelect.length > 100) {
            setError("Combined selected decks exceed the 100 card limit. Please deselect some decks.");
            // Optionally, could truncate the selection or prevent this state
            setSelectedCards(cardsToSelect.slice(0, 100)); 
        } else {
            setSelectedCards(cardsToSelect);
            setError(''); // Clear any previous error
        }

    }, [selectedDeckIds, decks, availableCards]); // Rerun when selected decks or available data changes
    */

  // Helper to find a preview card for a deck
  const getDeckPreviewCard = deck => {
    if (!deck || !deck.cardIds || deck.cardIds.length === 0) {
      return null;
    }
    // Simple logic: return the first card found in myCards
    return availableCards.find(card => card.id === deck.cardIds[0]);
    // Could add cycling logic here later if needed
  };

  // Send selected cards to server (but don't confirm yet)
  useEffect(() => {
    if (socket?.id && gameState?.gameId && availableCards.length > 0) {
      const currentSocketId = socket.id;
      const selectedImagePaths = selectedCards.map(card => card.imagePath);

      socket.emit('selectCards', gameState.gameId, currentSocketId, selectedImagePaths);
    }
  }, [selectedCards, availableCards, socket, gameState?.gameId]);

  // --- Handle Confirmation ---
  const handleConfirmSelection = () => {
    // Basic validation
    // console.log(`[CardSelectionScreen] Confirming selection. Required: ${requiredCards}, Selected: ${selectedCards.length}`);
    if (selectedCards.length < requiredCards) {
      setError(`You need to select at least ${requiredCards} cards.`);
      return;
    }
    setError('');
    // console.log(`[CardSelectionScreen] Confirming selection for ${socket?.id} with ${selectedCards.length} cards.`);
    const payload = {
      imagePaths: selectedCards.map(c => c.imagePath),
    };
    // console.log("[CardSelectionScreen] Emitting confirmCardSelection with payload:", payload);
    socket?.emit('confirmCardSelection', gameState.gameId, socket.id, payload);
  };

  // --- Constants for Grid Calculation ---
  const _BASE_CARD_WIDTH = 120;
  const _CARD_ASPECT_RATIO = 16 / 9;
  // const DYNAMIC_CARD_HEIGHT = BASE_CARD_WIDTH * CARD_ASPECT_RATIO; // No longer directly needed for grid config

  // --- Debugging Logs (Comment out for production) ---
  /* // Keep these blocks commented
    useEffect(() => {
        // console.log("[CardSelectionScreen] Selected Cards Updated:", selectedCards.map(c => c.id));
    }, [selectedCards]);

    useEffect(() => {
        // console.log("[CardSelectionScreen] Selected Deck IDs Updated:", selectedDeckIds);
    }, [selectedDeckIds]);

    useEffect(() => {
        // console.log("[CardSelectionScreen] Available Cards Updated, Count:", availableCards.length);
    }, [availableCards]);

    useEffect(() => {
        // console.log("[CardSelectionScreen] Displayable Cards Updated (filtered by search), Count:", displayableCards.length);
    }, [displayableCards]);
    */

  // console.log(`[CardSelectionScreen Render] Required: ${requiredCards}, Selected: ${selectedCards.length}`);
  // console.log(`[CardSelectionScreen Render] Player hasConfirmedCards: ${player?.hasConfirmedCards}`);
  // console.log(`[CardSelectionScreen Render] GameState phase: ${gameState?.phase}`);

  // --- Render Logic ---
  if (isLoading) {
    return (
      <div className='card-selection-container card center-content'>
        <p>Loading your cards...</p>
      </div>
    );
  }

  if (error && !player?.hasConfirmedCards) {
    // Only show fetch error if not waiting for others
    return (
      <div className='card-selection-container card'>
        <h2>{player?.nickname || 'Player'}, Select Your Cards</h2>

        {/* <<< Update Instruction Text >>> */}
        <p className='selection-instructions'>
          Select <strong>at least {requiredCards}</strong> cards to bring into the game.
        </p>
        {/* <<< Update Counter Text >>> */}
        <p className='selection-counter'>
          Selected: {selectedCards.length} / {requiredCards} (min)
        </p>

        {error && <p className='error-message'>{error}</p>}

        {/* Confirmation Button - MOVED HERE */}
        {!player.hasConfirmedCards ? (
          <button
            onClick={handleConfirmSelection}
            className='confirm-selection-button'
            disabled={selectedCards.length < requiredCards}
          >
            Confirm Selection ({selectedCards.length}/{requiredCards})
          </button>
        ) : (
          <p className='waiting-message'>Waiting for other players to confirm...</p>
        )}

        {/* Deck Selection Area - Now after confirm button */}
        {decks && decks.length > 0 && (
          <div className='deck-selection-area'>
            <h4>Select a Deck (Optional)</h4>
            <div className='deck-items-grid'>
              {decks.map(deck => (
                <DeckItem
                  key={deck.id}
                  _id={deck.id}
                  name={deck.name}
                  cardCount={deck.cardIds ? deck.cardIds.length : 0}
                  isSelected={selectedDeckIds.includes(deck.id)}
                  cardForPreview={getDeckPreviewCard(deck)}
                  onSelectDeck={handleDeckSelect}
                  onDeleteDeck={() => {}}
                  attributes={{}}
                  listeners={{}}
                  transform={null}
                  transition={null}
                  isDragging={false}
                />
              ))}
            </div>
          </div>
        )}

        <div className='card-search-container'>
          <input
            type='text'
            placeholder='Search your cards'
            className='card-search-input'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Card Selection Grid (NOT Virtualized) */}
        <div className='card-pool-container'>
          <div className='card-pool-grid'>
            {' '}
            {/* This is our CSS grid container */}
            {displayableCards.map(card => {
              const isSelected = selectedCards.some(c => c.id === card.id);
              return (
                <SelectionCardCell
                  key={card.id} // Important for React lists
                  card={card}
                  isSelected={isSelected}
                  handleCardSelection={handleCardSelection}
                  // No style prop needed from a virtualized grid here
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Log the received gameState prop just before rendering
  console.log('[CardSelectionScreen] Rendering with gameState:', gameState);

  return (
    <div className='card-selection-container card'>
      <h2>{player?.nickname || 'Player'}, Select Your Cards</h2>

      {/* <<< Update Instruction Text >>> */}
      <p className='selection-instructions'>
        Select <strong>at least {requiredCards}</strong> cards to bring into the game.
      </p>
      {/* <<< Update Counter Text >>> */}
      <p className='selection-counter'>
        Selected: {selectedCards.length} / {requiredCards} (min)
      </p>

      {error && <p className='error-message'>{error}</p>}

      {/* Confirmation Button - MOVED HERE */}
      {!player.hasConfirmedCards ? (
        <button
          onClick={handleConfirmSelection}
          className='confirm-selection-button'
          disabled={selectedCards.length < requiredCards}
        >
          Confirm Selection ({selectedCards.length}/{requiredCards})
        </button>
      ) : (
        <p className='waiting-message'>Waiting for other players to confirm...</p>
      )}

      {/* Deck Selection Area - Now after confirm button */}
      {decks && decks.length > 0 && (
        <div className='deck-selection-area'>
          <h4>Select a Deck (Optional)</h4>
          <div className='deck-items-grid'>
            {decks.map(deck => (
              <DeckItem
                key={deck.id}
                _id={deck.id}
                name={deck.name}
                cardCount={deck.cardIds ? deck.cardIds.length : 0}
                isSelected={selectedDeckIds.includes(deck.id)}
                cardForPreview={getDeckPreviewCard(deck)}
                onSelectDeck={handleDeckSelect}
                onDeleteDeck={() => {}}
                attributes={{}}
                listeners={{}}
                transform={null}
                transition={null}
                isDragging={false}
              />
            ))}
          </div>
        </div>
      )}

      <div className='card-search-container'>
        <input
          type='text'
          placeholder='Search your cards'
          className='card-search-input'
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Card Selection Grid (NOT Virtualized) */}
      <div className='card-pool-container'>
        <div className='card-pool-grid'>
          {' '}
          {/* This is our CSS grid container */}
          {displayableCards.map(card => {
            const isSelected = selectedCards.some(c => c.id === card.id);
            return (
              <SelectionCardCell
                key={card.id} // Important for React lists
                card={card}
                isSelected={isSelected}
                handleCardSelection={handleCardSelection}
                // No style prop needed from a virtualized grid here
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CardSelectionScreen;
