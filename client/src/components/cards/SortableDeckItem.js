import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LoadingButton } from '../common';
import { SERVER_BASE_URL } from '../../config';

// Sortable Deck Item Component
export function SortableDeckItem({ 
  id, 
  deck, 
  isSelected, 
  cardForPreview, 
  onSelectDeck, 
  onDeleteDeck, 
  isDeleting = false, 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const transitionKey = cardForPreview ? cardForPreview.id : 'no-card';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`deck-item ${isDragging ? 'dragging' : ''} deck-item-container ${isDeleting ? 'deleting' : ''}`}
      onClick={() => !isDragging && !isDeleting && onSelectDeck(deck.id)}
    >
      <LoadingButton
        onClick={e => {
          e.stopPropagation();
          onDeleteDeck(deck.id);
        }}
        className='delete-deck-button'
        variant='danger'
        isLoading={isDeleting}
        loadingText='...'
        disabled={isDeleting}
        title={isDeleting ? 'Deleting deck...' : 'Delete deck'}
      >
        X
      </LoadingButton>

      <div
        className={`deck-item-header ${isSelected ? 'selected' : ''}`}
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
      >
        <span className='deck-name'>
          <span className='deck-name-inner'>{deck.name}</span>
        </span>
      </div>

      {cardForPreview ? (
        <div className='deck-preview-image-container'>
          <div className='deck-image-transition-wrapper' key={transitionKey}>
            <img
              src={`${SERVER_BASE_URL}${cardForPreview.imagePath}`}
              alt={`${deck.name} preview`}
              className='deck-preview-image'
            />
            <span className='deck-preview-count'>{deck.cardIds?.length || 0}/50</span>
          </div>
        </div>
      ) : (
        <div className='deck-preview-placeholder'>No Cards</div>
      )}
    </div>
  );
} 