import { useState } from 'react';
import { DndContext, useSensors, useSensor, PointerSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { LoadingButton } from '../common';
import { SortableDeckItem } from './SortableDeckItem';
import { SERVER_BASE_URL } from '../../config';

function DeckManagement({
  decks,
  setDecks,
  selectedDeckId,
  setSelectedDeckId,
  isDeckLoading,
  setIsDeckLoading,
  deletingDeckIds,
  setDeletingDeckIds,
  myCards,
  deckPreviewIndices,
  setError,
}) {
  const [newDeckName, setNewDeckName] = useState('');

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      setError('Please enter a name for the new deck.');
      return;
    }
    setError(null);
    setIsDeckLoading(true);
    const token = localStorage.getItem('token');

    try {
      if (token) {
        const response = await fetch(`${SERVER_BASE_URL}/api/decks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: newDeckName.trim(), cardIds: [] }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to create deck on server.');
        }
        const newDeck = data.deck;
        setDecks(prev => [...prev, newDeck]);
        setSelectedDeckId(newDeck.id);
        setNewDeckName('');
      } else {
        setError('Deck creation is only available for logged-in users currently.');
      }
    } catch (err) {
      console.error('Error creating deck:', err);
      setError(err.message || 'Failed to create deck.');
    } finally {
      setIsDeckLoading(false);
    }
  };

  const handleSelectDeck = deckId => {
    setSelectedDeckId(prevSelectedId => (prevSelectedId === deckId ? null : deckId));
  };

  const handleDeleteDeck = async deckIdToDelete => {
    if (!window.confirm('Delete this deck? This action cannot be undone.')) {
      return;
    }

    setDeletingDeckIds(prev => new Set([...prev, deckIdToDelete]));
    const originalDecks = [...decks];
    setDecks(prevDecks => prevDecks.filter(deck => deck.id !== deckIdToDelete));

    if (selectedDeckId === deckIdToDelete) {
      setSelectedDeckId(null);
    }

    const token = localStorage.getItem('token');
    try {
      if (token) {
        const response = await fetch(`${SERVER_BASE_URL}/api/decks/${deckIdToDelete}`, {
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
        setError('Deck deletion is only available for logged-in users.');
        setDecks(originalDecks);
      }
    } catch (err) {
      console.error('Error deleting deck:', err);
      setError(`Delete failed: ${err.message || 'Unknown error'}`);
      setDecks(originalDecks);
    } finally {
      setDeletingDeckIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(deckIdToDelete);
        return newSet;
      });
    }
  };

  const handleDeckReorderEnd = event => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setDecks(prevDecks => {
      const oldIndex = prevDecks.findIndex(deck => deck.id === active.id);
      const newIndex = prevDecks.findIndex(deck => deck.id === over.id);
      return arrayMove(prevDecks, oldIndex, newIndex);
    });
  };

  return (
    <div className='decks-section'>
      <h3>Your Decks</h3>
      {isDeckLoading && <p>Loading decks...</p>}
      
      <DndContext
        sensors={useSensors(useSensor(PointerSensor))}
        collisionDetection={closestCenter}
        onDragEnd={handleDeckReorderEnd}
      >
        <SortableContext items={decks.map(d => d.id)} strategy={horizontalListSortingStrategy}>
          <div className='deck-list'>
            {decks.map(deck => {
              const previewIndex = deckPreviewIndices[deck.id] || 0;
              const cardIdForPreview = deck.cardIds?.[previewIndex];
              const cardForPreview = cardIdForPreview
                ? myCards.find(c => c.id === cardIdForPreview)
                : null;

              return (
                <SortableDeckItem
                  key={deck.id}
                  id={deck.id}
                  deck={deck}
                  isSelected={selectedDeckId === deck.id}
                  cardForPreview={cardForPreview}
                  onSelectDeck={handleSelectDeck}
                  onDeleteDeck={handleDeleteDeck}
                  isDeleting={deletingDeckIds.has(deck.id)}
                />
              );
            })}
            {!isDeckLoading && decks.length === 0 && <p>No decks created yet.</p>}
          </div>
        </SortableContext>
      </DndContext>

      <div className='create-deck-form'>
        <input
          type='text'
          placeholder='New deck name...'
          value={newDeckName}
          onChange={e => setNewDeckName(e.target.value)}
          maxLength={30}
        />
        <LoadingButton
          onClick={handleCreateDeck}
          disabled={!newDeckName.trim()}
          isLoading={isDeckLoading}
          loadingText='Creating...'
          variant='primary'
        >
          Create Deck
        </LoadingButton>
      </div>
    </div>
  );
}

export default DeckManagement; 