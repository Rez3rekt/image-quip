import { CSS } from '@dnd-kit/utilities'; // Needed for transform
import { SERVER_BASE_URL } from '../config';

// Renamed from SortableDeckItem
function DeckItem({
  _id,
  name,
  cardCount,
  _onSelect,
  isSelected,
  cardForPreview,
  onSelectDeck,
  onDeleteDeck,
  // DND Props passed in
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
}) {
  const style = {
    transform: CSS.Transform.toString(transform), // Use CSS utility
    transition,
    opacity: isDragging ? 0.5 : 1, // Make it slightly transparent when dragging
    // Ensure dragging item stays above others if needed
    // zIndex: isDragging ? 10 : 'auto',
  };

  // Use card ID for transition key if cardForPreview exists
  const transitionKey = cardForPreview ? cardForPreview.id : 'no-card';

  return (
    <div // Outermost div
      ref={setNodeRef} // DND ref attached here
      style={style}
      className={`deck-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelectDeck(_id)} // Handles selection click
    >
      <div // Header - THIS IS THE DRAG HANDLE
        className={`deck-item-header`}
        {...attributes} // DND attributes for handle
        {...listeners} // DND listeners for handle
        style={{ touchAction: 'none' }} // Prevent scroll on handle drag
      >
        <span // Just displays name
          className='deck-name'
        >
          <span className='deck-name-inner'>{name}</span>
        </span>
        <button // Delete button
          onClick={e => {
            e.stopPropagation();
            onDeleteDeck(_id);
          }} // Stop propagation crucial
          className='delete-deck-button'
        >
          X
        </button>
      </div>

      {/* Image Preview section */}
      {cardForPreview ? (
        <div // Image container
          className='deck-preview-image-container'
        >
          <div className='deck-image-transition-wrapper' key={transitionKey}>
            <img
              src={`${SERVER_BASE_URL}${cardForPreview.imagePath}`}
              alt={`${name} preview`}
              className='deck-preview-image'
            />
            <span className='deck-preview-count'>{cardCount}/50</span>
          </div>
        </div>
      ) : (
        <div // Placeholder
          className='deck-preview-placeholder'
        >
          No Cards
        </div>
      )}
    </div>
  );
}

export default DeckItem;
