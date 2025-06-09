import React, { useMemo, useEffect as _useEffect } from 'react';
import '../styles/CardWallBackground.css';

// Constants for card dimensions and gap (adjust as needed)
const CARD_WIDTH_PX = 100; // <<< Change from 110
const CARD_HEIGHT_PX = 185.55; // <<< Change from calculated value
const GAP_PX = 15;

function CardWallBackground({ ownedCards = [], serverUrl }) {
  // Remove debug console logs - only keep essential functionality
  
  const cardRows = useMemo(() => {
    // Estimate viewport dimensions (fallback)
    const viewportWidth = window.innerWidth || 1200;
    const viewportHeight = window.innerHeight || 800;

    // Calculate how many cards fit horizontally and vertically + buffer
    const cardsPerRow = Math.ceil(viewportWidth / (CARD_WIDTH_PX + GAP_PX)) + 4;
    const numRows = Math.ceil(viewportHeight / (CARD_HEIGHT_PX + GAP_PX)) + 2;

    const rows = [];
    let cardIndex = 0;

    const usePlaceholders = !ownedCards || ownedCards.length === 0;

    for (let r = 0; r < numRows; r++) {
      const rowCards = [];
      for (let c = 0; c < cardsPerRow; c++) {
        if (usePlaceholders) {
          rowCards.push({
            id: `${r}-${c}-placeholder`,
            isPlaceholder: true,
          });
        } else {
          const relativeImageUrl = ownedCards[cardIndex % ownedCards.length];
          const fullImageUrl =
            serverUrl && relativeImageUrl
              ? `${serverUrl}${relativeImageUrl.startsWith('/') ? '' : '/'}${relativeImageUrl}`
              : '';

          rowCards.push({
            id: `${r}-${c}-${cardIndex}`,
            imageUrl: fullImageUrl,
            isPlaceholder: false,
          });
        }
        cardIndex++; // Increment regardless of placeholder or real card
      }
      rows.push(rowCards);
    }
    return rows;
  }, [ownedCards, serverUrl]);

  return (
    <div className='card-wall-background'>
      {cardRows.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className={`card-row ${rowIndex % 2 === 0 ? 'scroll-left' : 'scroll-right'}`}
          style={{
            '--card-width': `${CARD_WIDTH_PX}px`,
            '--card-height': `${CARD_HEIGHT_PX}px`,
            '--gap': `${GAP_PX}px`,
          }}
        >
          {[...row, ...row].map((card, cardIndex) => (
            <div key={card.id + '-' + cardIndex} className='card-tile'>
              {card.isPlaceholder ? (
                <div className='card-placeholder'></div> /* Render placeholder div */
              ) : (
                <img src={card.imageUrl} alt='' loading='lazy' /> /* Render image */
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default React.memo(CardWallBackground); // Memoize for performance
