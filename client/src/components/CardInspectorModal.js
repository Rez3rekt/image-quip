import { useState, useEffect, useRef } from 'react';
import { SERVER_BASE_URL } from '../config';
import '../styles/CardInspectorModal.css';

function CardInspectorModal({
  card,
  onClose,
  onSave,
  // Navigation Props - Updated
  onPrevious,
  onNext,
  //currentIndex, // Removed - use currentIndexInSource
  //totalCards, // Removed - use sourceArray.length
  sourceArray = [], // Array of cards to navigate within
  currentIndexInSource = -1, // Index within the sourceArray
}) {
  // State for editable fields
  const [editedName, setEditedName] = useState('');
  const [editedTags, setEditedTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');

  // State and Ref for tilt effect - RE-ENABLED
  const [rotation, setRotation] = useState({ rotateX: 0, rotateY: 0 });
  const imageContainerRef = useRef(null); // Keep ref for click
  const lastMousePos = useRef({ x: 0, y: 0 });

  // State for flip status
  const [isFlipped, setIsFlipped] = useState(false);

  // State for hover status - RE-ENABLED
  const [isHovering, setIsHovering] = useState(false);

  // State for image loading status
  const [isLoadingImage, setIsLoadingImage] = useState(true);

  // Calculate canGoPrevious/canGoNext based on new props
  const canGoPrevious = currentIndexInSource > 0;
  const canGoNext = currentIndexInSource < sourceArray.length - 1;

  // Effect to initialize state when the card prop changes
  useEffect(() => {
    if (card) {
      setEditedName(card.name || '');
      setEditedTags(card.tags || []);
      setNewTagInput('');
      setRotation({ rotateX: 0, rotateY: 0 }); // Reset rotation on card change
      setIsFlipped(false); // Reset flip on card change
      setIsLoadingImage(!!card.imagePath);
    } else {
      setRotation({ rotateX: 0, rotateY: 0 });
      setIsFlipped(false);
      setIsLoadingImage(true); // Reset if no card
      setEditedName('');
      setEditedTags([]);
      setNewTagInput('');
    }
  }, [card]); // Depend on card object

  // Effect for adding tilt event listeners - RE-ENABLED
  useEffect(() => {
    const containerElement = imageContainerRef.current;
    if (!containerElement || isLoadingImage) {
      return;
    }

    const maxRotation = 12;

    const handleMouseMove = e => {
      const rect = containerElement.getBoundingClientRect();
      const width = containerElement.offsetWidth;
      const height = containerElement.offsetHeight;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      lastMousePos.current = { x: mouseX, y: mouseY };
      const offsetX = (mouseX - width / 2) / (width / 2);
      const offsetY = (mouseY - height / 2) / (height / 2);
      const rotateY = offsetX * maxRotation;
      const rotateX = -offsetY * maxRotation;
      setRotation({ rotateX, rotateY });
    };
    const handleMouseEnter = () => {
      setIsHovering(true);
    };
    const handleMouseLeave = () => {
      setIsHovering(false);
      if (!isFlipped) {
        setRotation({ rotateX: 0, rotateY: 0 });
      }
    };

    containerElement.addEventListener('mousemove', handleMouseMove);
    containerElement.addEventListener('mouseenter', handleMouseEnter);
    containerElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (containerElement) {
        containerElement.removeEventListener('mousemove', handleMouseMove);
        containerElement.removeEventListener('mouseenter', handleMouseEnter);
        containerElement.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [imageContainerRef, isLoadingImage, isFlipped]); // Dependencies are correct

  if (!card) {
    return null;
  }

  // --- Tag Handlers & Save Handler (remain the same) ---
  const handleAddTag = () => {
    const trimmedTag = newTagInput.trim();
    if (trimmedTag && !editedTags.includes(trimmedTag)) {
      setEditedTags([...editedTags, trimmedTag]);
      setNewTagInput('');
    }
  };
  const handleRemoveTag = tagToRemove => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };
  const handleTagInputChange = e => {
    setNewTagInput(e.target.value);
  };
  const handleTagInputKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };
  const handleSaveChanges = () => {
    const updatedDetails = {
      name: editedName.trim(),
      tags: editedTags,
    };
    onSave(card.id, updatedDetails);
    onClose();
  };

  // Flip handler
  const handleFlipCard = () => {
    console.log('Flip triggered');
    setIsFlipped(!isFlipped);
    setRotation({ rotateX: 0, rotateY: 0 }); // Keep rotation reset
  };

  // Combine tilt and flip transforms - RE-ENABLED
  const tiltTransform = isFlipped
    ? ''
    : `rotateX(${rotation.rotateX}deg) rotateY(${rotation.rotateY}deg)`;
  const flipTransform = `rotateY(${isFlipped ? 180 : 0}deg)`;
  const combinedTransform = `${tiltTransform} ${flipTransform}`;

  // Define transition speeds - RE-ENABLED
  const flipTransition = 'transform 0.6s ease-in-out';
  const fastHoverTransition = 'transform 0.05s linear';
  const slowResetTransition = 'transform 1s ease-out';

  // Determine current transition based on state - RE-ENABLED
  let currentTransition = flipTransition;
  if (!isFlipped) {
    currentTransition = isHovering ? fastHoverTransition : slowResetTransition;
  }
  const finalTransition = `opacity 0.3s ease-in-out, ${currentTransition}`;

  // Style for the inner flipping element
  const flipStyle = {
    transform: combinedTransform,
    transition: finalTransition,
  };

  // Style for the front image (opacity transition)
  const frontImageStyle = {
    opacity: isLoadingImage ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
  };

  // Calculate direct image URL
  const imageUrl = card.imagePath ? `${SERVER_BASE_URL}${card.imagePath}` : '';

  return (
    <div className='modal-overlay' onClick={onClose}>
      {/* Navigation Arrows (Updated logic) */}
      {sourceArray.length > 1 && (
        <>
          <button
            className='modal-nav-button prev'
            onClick={e => {
              e.stopPropagation();
              onPrevious();
            }}
            disabled={!canGoPrevious} // Use calculated state
            title='Previous Card'
          >
            &lt;
          </button>
          <button
            className='modal-nav-button next'
            onClick={e => {
              e.stopPropagation();
              onNext();
            }}
            disabled={!canGoNext} // Use calculated state
            title='Next Card'
          >
            &gt;
          </button>
        </>
      )}

      {/* Modal Content Box */}
      <div className='modal-content' onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button className='modal-close-button' onClick={onClose}>
          X
        </button>
        <h3>Card Inspector</h3>
        <div className='inspector-content'>
          <div
            className='inspector-image-container'
            ref={imageContainerRef}
            onClick={handleFlipCard}
          >
            <div className='flip-card-inner' style={flipStyle}>
              <div className='flip-card-front'>
                {isLoadingImage && !!imageUrl && (
                  <div className='loading-indicator'>Loading image...</div>
                )}
                {imageUrl && (
                  <img
                    key={imageUrl}
                    style={frontImageStyle}
                    src={imageUrl}
                    alt={card.fileName || 'Card image'}
                    className='inspector-image'
                    onLoad={() => setIsLoadingImage(false)}
                    onError={e => {
                      console.error('[onError] Image load error for URL:', imageUrl, e);
                      setIsLoadingImage(false); // Stop loading state on error
                    }}
                  />
                )}
              </div>
              <div className='flip-card-back'>
                <span className='card-back-logo'>Qwik Pik</span>
              </div>
            </div>
          </div>
          <div className='inspector-details'>
            <div className='detail-section'>
              <label htmlFor='card-name'>Name:</label>
              <input
                type='text'
                id='card-name'
                placeholder='Enter card name...'
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className='detail-section'>
              <label>Tags:</label>
              <div className='tags-display'>
                {editedTags.length > 0 ? (
                  editedTags.map(tag => (
                    <span key={tag} className='tag-item'>
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className='remove-tag-button'>
                        x
                      </button>
                    </span>
                  ))
                ) : (
                  <em>No tags yet.</em>
                )}
              </div>
              <div className='tags-input'>
                <input
                  type='text'
                  placeholder='Add a tag...'
                  value={newTagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagInputKeyDown}
                  maxLength={20}
                />
                <button onClick={handleAddTag}>Add</button>
              </div>
            </div>
            <div className='detail-section'>
              <label>Stats:</label>
              <p>Lifetime Votes: {card.lifetimeVotes !== undefined ? card.lifetimeVotes : 'N/A'}</p>
            </div>
            <button className='modal-save-button' onClick={handleSaveChanges}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardInspectorModal;
