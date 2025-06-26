import { CSS } from '@dnd-kit/utilities'; // Needed for transform
import { SERVER_BASE_URL } from '../config';
import { useEffect, useRef, useState } from 'react';

// Renamed from SortableDeckItem
function DeckItem({
  _id,
  name,
  cardCount,
  _onSelect,
  isSelected,
  cardForPreview,
  onSelectDeck,
  onDeleteDeck: _onDeleteDeck,
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
  };

  // Use card ID for transition key if cardForPreview exists
  const transitionKey = cardForPreview ? cardForPreview.id : 'no-card';

  // Dynamic text sizing - individual per deck
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(12);

  useEffect(() => {
    const adjustFontSize = () => {
      if (!textRef.current || !containerRef.current || !name) {return;}
      
      const container = containerRef.current;
      const textElement = textRef.current;
      
      // Get container width minus padding
      const containerWidth = container.offsetWidth;
      const maxWidth = containerWidth - 12; // Account for padding
      
      // Start with font size based on container width and name length
      const startFontSize = Math.min(14, Math.max(8, containerWidth / name.length * 0.8));
      let currentFontSize = startFontSize;
      
      textElement.style.fontSize = `${currentFontSize}px`;
      
      // Reduce font size until text fits, with minimum of 6px for very long names
      while (textElement.scrollWidth > maxWidth && currentFontSize > 6) {
        currentFontSize -= 0.25;
        textElement.style.fontSize = `${currentFontSize}px`;
      }
      
      // Ensure minimum readability
      if (currentFontSize < 8) {
        currentFontSize = 8;
        textElement.style.fontSize = `${currentFontSize}px`;
      }
      
      setFontSize(currentFontSize);
    };

    // Adjust immediately and on resize
    const timeoutId = setTimeout(adjustFontSize, 100);
    
    // Re-adjust on window resize for responsiveness
    const handleResize = () => {
      adjustFontSize();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [name, _id]); // Include _id to ensure each deck calculates independently

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
        style={{ touchAction: 'none', justifyContent: 'center', alignItems: 'center' }} // Center content
      >
        <span // Container for dynamic text
          ref={containerRef}
          className='deck-name'
          style={{
            fontWeight: 'bold',
            color: '#ffffff',
            display: 'block',
            visibility: 'visible',
            opacity: 1,
            padding: '4px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            overflow: 'visible', // Show full text without truncation
            width: '95%', // Use almost full width
            minHeight: '18px',
            lineHeight: '1.2',
            textShadow: '2px 2px 4px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,1)', // Strong shadow for readability
            zIndex: 10,
            boxSizing: 'border-box',
            textAlign: 'center',
            maxWidth: '90%', // Use most of the available width since no delete button
          }}
        >
          <span 
            ref={textRef}
            style={{ 
              fontSize: `${fontSize}px`,
              display: 'inline-block',
              width: 'auto',
            }}
          >
            {name}
          </span>
        </span>
      </div>

      {/* Image Preview section */}
      {cardForPreview ? (
        <div className='deck-preview-image-container'>
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
        <div className='deck-preview-placeholder'>
          No Cards
        </div>
      )}
    </div>
  );
}

export default DeckItem;
