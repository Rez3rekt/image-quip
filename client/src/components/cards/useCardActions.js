import { SERVER_BASE_URL } from '../../config';

function useCardActions({
  myCards,
  setMyCards,
  clientId,
  selectedDeckId,
  displayDeckItems,
  displayAvailableItems,
  displayAllCards,
  _deletingCardIds,
  setDeletingCardIds,
  setInspectedCardData,
  setError,
  setIsProcessing,
  fetchCardsAndDecks,
}) {

  const handleDeleteCard = async cardIdToDelete => {
    if (!window.confirm('Delete this card?')) {
      return;
    }

    setDeletingCardIds(prev => new Set([...prev, cardIdToDelete]));
    const originalCards = [...myCards];
    setMyCards(prevCards => prevCards.filter(card => card.id !== cardIdToDelete));
    setError(null);

    const token = localStorage.getItem('token');
    let deleteUrl = '';
    try {
      if (token) {
        deleteUrl = `${SERVER_BASE_URL}/api/cards/${cardIdToDelete}`;
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Delete failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || 'Server reported delete failure.');
        }
      } else {
        deleteUrl = `${SERVER_BASE_URL}/api/guest-cards/${clientId}/${cardIdToDelete}`;
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Delete failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || 'Server reported delete failure.');
        }
      }
    } catch (err) {
      console.error('Error deleting card:', err);
      setError(`Delete failed: ${String(err.message || 'Unknown error')}`);
      setMyCards(originalCards);
    } finally {
      setDeletingCardIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardIdToDelete);
        return newSet;
      });
    }
  };

  const handleInspectCard = cardId => {
    let sourceArray = [];
    let indexInSource = -1;
    const cardToInspect = myCards.find(c => c.id === cardId);

    if (!cardToInspect) {
      setError('Could not find card details to inspect.');
      return;
    }

    if (selectedDeckId) {
      const isInDeck = displayDeckItems.some(item => item.id === cardId);
      if (isInDeck) {
        sourceArray = displayDeckItems;
        indexInSource = displayDeckItems.findIndex(item => item.id === cardId);
      } else {
        sourceArray = displayAvailableItems;
        indexInSource = displayAvailableItems.findIndex(item => item.id === cardId);
      }
    } else {
      sourceArray = displayAllCards;
      indexInSource = displayAllCards.findIndex(item => item.id === cardId);
    }

    if (indexInSource !== -1) {
      setInspectedCardData({
        card: cardToInspect,
        index: indexInSource,
        source: sourceArray,
      });
    } else {
      console.error(
        '[Inspect Card] Card found in myCards but not in its display list. This indicates a state inconsistency.',
      );
      setError('Could not determine the card\'s position for inspection.');
    }
  };

  const handleGoToPreviousCard = () => {
    setInspectedCardData(prevData => {
      if (!prevData) {return prevData;}
      
      const { index, source } = prevData;
      if (index > 0) {
        const prevCard = source[index - 1];
        return {
          card: prevCard,
          index: index - 1,
          source: source,
        };
      }
      return prevData;
    });
  };

  const handleGoToNextCard = () => {
    setInspectedCardData(prevData => {
      if (!prevData) {return prevData;}
      
      const { index, source } = prevData;
      if (index < source.length - 1) {
        const nextCard = source[index + 1];
        return {
          card: nextCard,
          index: index + 1,
          source: source,
        };
      }
      return prevData;
    });
  };

  const handleSaveCardDetails = async (cardId, updatedDetails) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required to save card details.');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch(`${SERVER_BASE_URL}/api/cards/${cardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedDetails),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Save failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchCardsAndDecks(true);
        setError(null);
      } else {
        throw new Error(result.message || 'Server reported save failure.');
      }
    } catch (err) {
      console.error('Error saving card details:', err);
      setError(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCardInDeck = async (cardId, deckId, action) => {
    if (!deckId) {
      setError('Please select a deck first.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[handleToggleCardInDeck] No token found.');
      setError('Authentication error. Please log in again.');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Get current deck state
      const currentDeck = await fetch(`${SERVER_BASE_URL}/api/decks/${deckId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!currentDeck.ok) {
        throw new Error('Failed to fetch current deck state');
      }
      
      const deckData = await currentDeck.json();
      const updatedCardIds = [...(deckData.deck.cardIds || [])];
      const cardIndex = updatedCardIds.indexOf(cardId);

      if (action === 'add') {
        if (cardIndex !== -1) {
          return; // Card already in deck
        }
        if (updatedCardIds.length >= 50) {
          setError('Deck cannot exceed 50 cards.');
          return;
        }
        updatedCardIds.push(cardId);
      } else if (action === 'remove') {
        if (cardIndex === -1) {
          return; // Card not in deck
        }
        updatedCardIds.splice(cardIndex, 1);
      } else {
        console.error(`[handleToggleCardInDeck] Invalid action: ${action}`);
        return;
      }

      const response = await fetch(`${SERVER_BASE_URL}/api/decks/${deckId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardIds: updatedCardIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to ${action} card. Status: ${response.statusText}`);
      }

      const responseData = await response.json();
      if (!responseData.success) {
        throw new Error(responseData.message || `Failed to ${action} card in deck.`);
      }

      await fetchCardsAndDecks(true);
      setError(null);
    } catch (error) {
      console.error(`[handleToggleCardInDeck] Error during ${action} card API call:`, error);
      setError(`Error: ${error.message || `Could not ${action} card in deck.`}`);
      await fetchCardsAndDecks(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReorderDeck = async orderedCardIds => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required. Please log in.');
      return;
    }
    if (!selectedDeckId) {
      setError('No deck selected to reorder.');
      return;
    }

    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/decks/${selectedDeckId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cardIds: orderedCardIds }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      console.error('Error reordering deck cards:', err);
      setError(`Reorder failed: ${err.message}`);
      await fetchCardsAndDecks(true);
    }
  };

  return {
    handleDeleteCard,
    handleInspectCard,
    handleGoToPreviousCard,
    handleGoToNextCard,
    handleSaveCardDetails,
    handleToggleCardInDeck,
    handleReorderDeck,
  };
}

export default useCardActions; 