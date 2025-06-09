import { DndContext, DragOverlay, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { SortableCardItem, DroppableContainer } from './SortableCardItem';
import { SERVER_BASE_URL } from '../../config';

function CardCollectionDisplay({
  selectedDeckId,
  displayDeckItems,
  setDisplayDeckItems,
  displayAvailableItems,
  setDisplayAvailableItems,
  displayAllCards,
  draggingItemId,
  setDraggingItemId,
  myCards,
  deletingCardIds,
  isLoading,
  onDeleteCard,
  onInspectCard,
  onToggleCardInDeck,
  onReorderDeck,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  const findContainerId = itemId => {
    if (selectedDeckId) {
      if (displayDeckItems.some(item => item.id === itemId)) {
        return 'deck-cards';
      }
      if (displayAvailableItems.some(item => item.id === itemId)) {
        return 'available-cards';
      }
    } else {
      if (displayAllCards.some(item => item.id === itemId)) {
        return 'all-cards-container';
      }
    }

    if (itemId === 'deckCardsDroppable') {
      return 'deck-cards';
    }
    if (itemId === 'availableCardsDroppable') {
      return 'available-cards';
    }

    console.warn(`[findContainerId] Could not determine container for ID: ${itemId}`);
    return null;
  };

  function handleDragStart(event) {
    setDraggingItemId(event.active.id);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    const overId = over?.id;
    const activeId = active.id;

    if (!over || !active || activeId === overId) {
      return;
    }

    const activeContainer = active.data.current?.sortable?.containerId;
    const overContainer = over.data.current?.sortable?.containerId ?? over.id;

    if (!activeContainer || !overContainer) {
      return;
    }

    if (activeContainer === overContainer) {
      if (activeContainer === 'deckCardsDroppable') {
        setDisplayDeckItems(prevItems => {
          const oldIndex = prevItems.findIndex(item => item.id === activeId);
          const newIndexCandidate =
            overId === 'deckCardsDroppable'
              ? prevItems.length
              : prevItems.findIndex(item => item.id === overId);
          if (oldIndex === -1 || newIndexCandidate === -1) {
            return prevItems;
          }
          const newIndex = overId === 'deckCardsDroppable' ? prevItems.length : newIndexCandidate;
          const targetIndex =
            overId === 'deckCardsDroppable' && newIndex > oldIndex ? newIndex - 1 : newIndex;
          if (oldIndex !== targetIndex) {
            return arrayMove(prevItems, oldIndex, targetIndex);
          }
          return prevItems;
        });
      } else if (activeContainer === 'availableCardsDroppable') {
        setDisplayAvailableItems(prevItems => {
          const oldIndex = prevItems.findIndex(item => item.id === activeId);
          const newIndexCandidate =
            overId === 'availableCardsDroppable'
              ? prevItems.length
              : prevItems.findIndex(item => item.id === overId);
          if (oldIndex === -1 || newIndexCandidate === -1) {
            return prevItems;
          }
          const newIndex =
            overId === 'availableCardsDroppable' ? prevItems.length : newIndexCandidate;
          const targetIndex =
            overId === 'availableCardsDroppable' && newIndex > oldIndex ? newIndex - 1 : newIndex;
          if (oldIndex !== targetIndex) {
            return arrayMove(prevItems, oldIndex, targetIndex);
          }
          return prevItems;
        });
      }
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    setDraggingItemId(null);

    if (!over) {
      return;
    }

    const activeContainerId = findContainerId(active.id);
    const overContainerId = findContainerId(over.id);

    if (!activeContainerId || !overContainerId) {
      console.warn('[handleDragEnd] Could not determine active or over container.');
      return;
    }

    if (activeContainerId !== overContainerId) {
      const cardId = active.id;
      const deckId = selectedDeckId;

      if (!deckId) {
        console.error('[handleDragEnd] Cannot move card, no deck selected.');
        return;
      }

      if (overContainerId === 'deck-cards' && activeContainerId === 'available-cards') {
        onToggleCardInDeck(cardId, deckId, 'add');
      } else if (overContainerId === 'available-cards' && activeContainerId === 'deck-cards') {
        onToggleCardInDeck(cardId, deckId, 'remove');
      }
    } else if (activeContainerId === 'deck-cards' && overContainerId === 'deck-cards') {
      // Handle deck reordering
      const orderedCardIds = displayDeckItems.map(item => item.id);
      onReorderDeck(orderedCardIds);
    }
  }

  const draggedCardData = draggingItemId ? myCards.find(c => c.id === draggingItemId) : null;

  return (
    <div className={`card-collection-section`}>
      <h3 className='clickable-heading' onClick={() => {}}>
        Your Card Collection ({myCards.length})
      </h3>
      {isLoading && <p>Loading cards...</p>}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {selectedDeckId ? (
          <>
            <div className='deck-cards-section'>
              <h4>
                Deck Cards ({displayDeckItems.length}/50)
                <span className='deck-action-hint'>(Drag card out to remove)</span>
              </h4>
              {displayDeckItems.length === 0 && !isLoading && (
                <p>No cards in this deck. Drag cards from below to add them.</p>
              )}
              <SortableContext
                items={displayDeckItems.map(c => c.id)}
                strategy={rectSortingStrategy}
              >
                <DroppableContainer
                  id='deckCardsDroppable'
                  className='card-grid card-grid-droppable'
                >
                  {displayDeckItems.map(item => (
                    <SortableCardItem
                      key={item.id}
                      id={item.id}
                      card={item}
                      isSelectedDeck={true}
                      deckIsFull={false}
                      onDelete={onDeleteCard}
                      onInspectCard={onInspectCard}
                      isDeleting={deletingCardIds.has(item.id)}
                    />
                  ))}
                </DroppableContainer>
              </SortableContext>
            </div>

            <div className='available-cards-section'>
              <h4>
                Available Cards ({displayAvailableItems.length})
                <span className='deck-action-hint'>
                  {displayDeckItems.length >= 50 ? '(Deck Full)' : '(Drag card to deck to add)'}
                </span>
              </h4>
              {displayAvailableItems.length === 0 && !isLoading && (
                <p>No other cards available.</p>
              )}
              <SortableContext
                items={displayAvailableItems.map(c => c.id)}
                strategy={rectSortingStrategy}
              >
                <DroppableContainer
                  id='availableCardsDroppable'
                  className='card-grid card-grid-droppable'
                >
                  {displayAvailableItems.map(item => (
                    <SortableCardItem
                      key={item.id}
                      id={item.id}
                      card={item}
                      isSelectedDeck={false}
                      deckIsFull={displayDeckItems.length >= 50}
                      onDelete={onDeleteCard}
                      onInspectCard={onInspectCard}
                      isDeleting={deletingCardIds.has(item.id)}
                    />
                  ))}
                </DroppableContainer>
              </SortableContext>
            </div>
          </>
        ) : (
          <>
            {displayAllCards.length === 0 && !isLoading && <p>No cards found. Upload some!</p>}
            {displayAllCards.length > 0 && (
              <SortableContext
                items={displayAllCards.map(c => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className='card-grid'>
                  {displayAllCards.map(card => (
                    <SortableCardItem
                      key={card.id}
                      id={card.id}
                      card={card}
                      isSelectedDeck={false}
                      deckIsFull={false}
                      onDelete={onDeleteCard}
                      onInspectCard={onInspectCard}
                      isDeleting={deletingCardIds.has(card.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </>
        )}

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {draggingItemId && draggedCardData ? (
            <div
              className='card-item-wrapper is-dragging-overlay'
              style={{ width: '110px', height: `calc(110px * 16 / 9)` }}
            >
              <div className='card-item'>
                <img
                  src={`${SERVER_BASE_URL}${draggedCardData.imagePath}`}
                  alt={draggedCardData.fileName || 'Dragging card'}
                />
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default CardCollectionDisplay; 