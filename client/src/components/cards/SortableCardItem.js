import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LoadingButton } from '../common';
import { SERVER_BASE_URL } from '../../config';

// Droppable Container Component
export function DroppableContainer({ id, children, className }) {
  const { isOver: _isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const style = {};

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children}
    </div>
  );
}

// Helper to determine border class based on votes
const getBorderClass = votes => {
  if (votes >= 100) {
    return 'border-holographic';
  }
  if (votes >= 50) {
    return 'border-gold';
  }
  if (votes >= 25) {
    return 'border-silver';
  }
  if (votes >= 10) {
    return 'border-bronze';
  }
  return '';
};

// Draggable Card Item Component
export function SortableCardItem({
  id,
  card,
  deckIsFull,
  isSelectedDeck,
  _onToggle,
  onDelete,
  onInspectCard,
  isDeleting = false,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: id,
  });

  const lifetimeVotes = card?.lifetimeVotes || 0;
  const borderClass = getBorderClass(lifetimeVotes);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  const isInDeck = isSelectedDeck && card.inDeck;
  const isInspectable = !isDragging && !isDeleting;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-item-wrapper ${isInDeck ? 'in-deck' : ''} ${deckIsFull && !isInDeck ? 'deck-full' : ''} ${borderClass} ${isDeleting ? 'deleting' : ''}`}
      title={isInspectable ? 'Click to inspect card' : ''}
      onClick={isInspectable ? () => onInspectCard(id) : undefined}
    >
      <div className='card-item'>
        <img
          {...attributes}
          {...listeners}
          style={{ touchAction: 'none' }}
          src={`${SERVER_BASE_URL}${card.imagePath}`}
          alt={card.fileName || 'Uploaded card'}
        />
        <LoadingButton
          onClick={e => {
            e.stopPropagation();
            onDelete(id);
          }}
          className='delete-card-button'
          variant='danger'
          isLoading={isDeleting}
          loadingText='...'
          disabled={isDeleting}
          title={isDeleting ? 'Deleting...' : 'Delete Card Permanently'}
        >
          X
        </LoadingButton>
        {isSelectedDeck && (
          <div
            className={`deck-indicator ${isInDeck ? 'in-deck' : deckIsFull ? 'full' : 'not-in-deck'}`}
          >
            {isInDeck ? '✔' : deckIsFull ? '-' : '+'}
          </div>
        )}
      </div>
    </div>
  );
} 