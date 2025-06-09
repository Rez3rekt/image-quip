import { useState, useEffect, useCallback, useRef } from 'react';
import { SERVER_BASE_URL } from '../../config';

function useMyCardsLogic({ clientId }) {
  const [myCards, setMyCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [decks, setDecks] = useState([]);
  const [isDeckLoading, setIsDeckLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState(null);

  // Loading states for delete operations
  const [deletingCardIds, setDeletingCardIds] = useState(new Set());
  const [deletingDeckIds, setDeletingDeckIds] = useState(new Set());

  const [displayDeckItems, setDisplayDeckItems] = useState([]);
  const [displayAvailableItems, setDisplayAvailableItems] = useState([]);
  const [displayAllCards, setDisplayAllCards] = useState([]);

  const [draggingItemId, setDraggingItemId] = useState(null);
  const [deckPreviewIndices, setDeckPreviewIndices] = useState({});
  const [inspectedCardData, setInspectedCardData] = useState(null);

  const decksRef = useRef(decks);

  const fetchCardsAndDecks = useCallback(
    async (isRefetch = false) => {
      if (!isRefetch) {
        setIsLoading(true);
        setIsDeckLoading(true);
      }
      setError(null);
      const token = localStorage.getItem('token');

      let cards = [];
      let fetchedDecks = [];
      let fetchError = null;

      // Fetch cards
      try {
        let cardsUrl = '';
        const headers = {};
        if (token) {
          cardsUrl = `${SERVER_BASE_URL}/api/cards`;
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          if (!clientId) {
            throw new Error('Cannot fetch guest cards without a client ID.');
          }
          cardsUrl = `${SERVER_BASE_URL}/api/guest-cards/${clientId}`;
        }
        const response = await fetch(cardsUrl, { headers });
        if (!response.ok) {
          if (token && (response.status === 401 || response.status === 403)) {
            throw new Error(
              'Authentication failed fetching cards. Please log out and log back in.',
            );
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to fetch cards: ${response.statusText}`);
          }
        }
        const data = await response.json();
        if (data.success) {
          cards = data.cards || [];
        } else {
          throw new Error(data.message || 'Failed to parse card data.');
        }
      } catch (err) {
        let detailedErrorMessage = 'Could not load your cards.';
        if (err instanceof Error) {
          detailedErrorMessage = err.message || detailedErrorMessage;
          console.error('[fetchCardsAndDecks] Caught error:', err);
        } else {
          console.error('[fetchCardsAndDecks] Caught non-Error object:', err);
          detailedErrorMessage = String(err) || detailedErrorMessage;
        }
        fetchError = detailedErrorMessage;
        cards = [];
      }

      // Fetch decks
      try {
        if (token) {
          const headers = { Authorization: `Bearer ${token}` };
          const decksResponse = await fetch(`${SERVER_BASE_URL}/api/decks`, { headers });
          if (!decksResponse.ok) {
            const errorData = await decksResponse.json().catch(() => ({}));
            if (decksResponse.status === 401 || decksResponse.status === 403) {
              throw new Error(
                'Authentication failed fetching decks. Please log out and log back in.',
              );
            } else {
              throw new Error(
                errorData.message || `Failed to fetch decks: ${decksResponse.statusText}`,
              );
            }
          }
          const decksData = await decksResponse.json();
          if (decksData.success) {
            fetchedDecks = decksData.decks || [];
          } else {
            throw new Error(decksData.message || 'Failed to parse deck data.');
          }
        } else {
          fetchedDecks = [];
        }
      } catch (err) {
        console.error('[fetchCardsAndDecks] Error fetching decks:', err);
        fetchError = fetchError
          ? `${fetchError} | ${err.message || 'Could not load decks.'}`
          : err.message || 'Could not load decks.';
        fetchedDecks = [];
      }

      if (!isRefetch) {
        setIsLoading(false);
        setIsDeckLoading(false);
      }

      setMyCards(cards);
      setDecks(fetchedDecks);
      decksRef.current = fetchedDecks;
      if (fetchError) {
        setError(fetchError);
      }
    },
    [clientId],
  );

  // Update display items when cards/decks/selection changes
  useEffect(() => {
    const selectedDeck = decks.find(d => d.id === selectedDeckId);
    const deckCardIds = new Set(selectedDeck?.cardIds || []);

    if (selectedDeckId) {
      const deckItems = (selectedDeck?.cardIds ?? [])
        .map(id => {
          const card = myCards.find(c => c.id === id);
          return card ? { ...card, id: card.id, inDeck: true } : null;
        })
        .filter(Boolean);

      const availableItems = myCards
        .filter(card => !deckCardIds.has(card.id))
        .map(card => ({ ...card, id: card.id, inDeck: false }));

      setDisplayDeckItems(deckItems);
      setDisplayAvailableItems(availableItems);
      setDisplayAllCards([]);
    } else {
      const allItems = myCards.map(card => ({ ...card, id: card.id }));
      setDisplayAllCards(allItems);
      setDisplayDeckItems([]);
      setDisplayAvailableItems([]);
    }
  }, [myCards, decks, selectedDeckId]);

  // Initialize deck preview indices
  useEffect(() => {
    decksRef.current = decks;

    setDeckPreviewIndices(prevIndices => {
      const newIndices = { ...prevIndices };
      const existingDeckIds = new Set();

      decks.forEach(deck => {
        existingDeckIds.add(deck.id);
        if (!(deck.id in newIndices) && deck.cardIds?.length > 0) {
          newIndices[deck.id] = 0;
        }
      });

      Object.keys(newIndices).forEach(deckId => {
        if (!existingDeckIds.has(deckId)) {
          delete newIndices[deckId];
        }
      });
      return newIndices;
    });
  }, [decks]);

  // Deck preview cycling effect
  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentDecks = decksRef.current;
      setDeckPreviewIndices(prevIndices => {
        const nextIndices = { ...prevIndices };
        let changed = false;
        currentDecks.forEach(deck => {
          if (deck.id in nextIndices && deck.cardIds?.length > 1) {
            const currentIdx = nextIndices[deck.id];
            const nextIdx = (currentIdx + 1) % deck.cardIds.length;
            if (nextIdx !== currentIdx) {
              nextIndices[deck.id] = nextIdx;
              changed = true;
            }
          }
        });
        return changed ? nextIndices : prevIndices;
      });
    }, 7000);

    return () => clearInterval(intervalId);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCardsAndDecks(false);
  }, [fetchCardsAndDecks]);

  return {
    // State
    myCards,
    setMyCards,
    isLoading,
    error,
    setError,
    isProcessing,
    setIsProcessing,
    decks,
    setDecks,
    isDeckLoading,
    setIsDeckLoading,
    selectedDeckId,
    setSelectedDeckId,
    deletingCardIds,
    setDeletingCardIds,
    deletingDeckIds,
    setDeletingDeckIds,
    displayDeckItems,
    setDisplayDeckItems,
    displayAvailableItems,
    setDisplayAvailableItems,
    displayAllCards,
    draggingItemId,
    setDraggingItemId,
    deckPreviewIndices,
    setDeckPreviewIndices,
    inspectedCardData,
    setInspectedCardData,
    
    // Functions
    fetchCardsAndDecks,
    
    // Refs
    decksRef,
  };
}

export default useMyCardsLogic; 