import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../styles/PromptScreen.css';
import { SERVER_BASE_URL } from '../config';
import { LoadingState } from './common';

// Define server URL for images
// const SERVER_BASE_URL = 'http://localhost:3001';

// --- Correct Droppable Component ---
function Droppable({ id, children, className }) {
  const { _isOver, setNodeRef } = useDroppable({
    id: id,
  });
  // No extra style needed for now, class handles feedback
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

// --- NEW Sortable Card Item Component ---
function SortableCardItem({ id, imagePath, isDropped }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: id,
    data: { imagePath: imagePath }, // Pass imagePath in data
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1, // Set opacity to 0 when dragging
    cursor: isDragging ? 'grabbing' : isDropped ? 'not-allowed' : 'grab',
    zIndex: isDragging ? 10 : 'auto',
    touchAction: 'none', // Recommended by dnd-kit for compatibility
    display: isDropped ? 'none' : undefined, // <<< Hide the item if it has been dropped
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`image-card-wrapper ${isDropped ? 'dropped' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className='image-card'>
        <img src={`${SERVER_BASE_URL}${imagePath}`} alt={`Selectable answer: ${imagePath}`} />
      </div>
    </div>
  );
}

function PromptScreen({ gameState, socket, currentPlayerId }) {
  // State
  const [activeId, setActiveId] = useState(null); // <<< Restore activeId state
  const [droppedCardPath, setDroppedCardPath] = useState(null); // State for dropped card
  const [_isDraggingOver, _setIsDraggingOver] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false); // State for flip animation
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState('');

  // Use socket.id to find the current player
  // const currentPlayerId = socket?.id;

  // <<< Find player state OUTSIDE useMemo for clarity/dependency >>>
  const playerState = useMemo(
    () => gameState?.players?.find(p => p.id === currentPlayerId),
    [gameState?.players, currentPlayerId],
  );

  // Memoize derived state and prompt calculation
  const {
    currentPromptData: _currentPromptData,
    currentPromptIdentifier,
    allPromptsAnswered,
    isFlipTheScript,
    answeredIdentifiersCount,
    assignedPromptsCount,
    myHand,
  } = useMemo(() => {
    // <<< Log the ACTUAL playerState being used >>>
    // console.log("[PromptScreen useMemo] Running. Using playerState:", playerState);
    // console.log("[PromptScreen useMemo] Dependencies:", {
    //     settings: gameState?.settings,
    //     myAssignedPrompts: playerState?.myAssignedPrompts, // Use playerState
    //     myAnsweredPrompts: playerState?.myAnsweredPrompts, // Use playerState
    //     myHand: playerState?.myHand              // Use playerState
    // });

    const settings = gameState?.settings ?? {};
    const gameMode = settings.gameMode ?? 'Classic';
    const isFTS = gameMode === 'Flip the Script';

    // <<< Read from playerState >>>
    const assigned = playerState?.myAssignedPrompts || [];
    const answeredIds = new Set(playerState?.myAnsweredPrompts || []);
    const hand = playerState?.myHand || [];

    // console.log("[PromptScreen useMemo] Derived assigned:", assigned);
    // console.log("[PromptScreen useMemo] Derived answeredIds:", answeredIds);

    let currentData = null;
    let currentId = null;

    if (isFTS) {
      // <<< FIX: For FTS, the image path is in promptText as per server-side Game.js >>>
      currentData = assigned.find(p => p.promptText && !answeredIds.has(p.promptText));
      currentId = currentData?.promptText; // Use promptText here as well
    } else {
      currentData = assigned.find(p => p.promptText && !answeredIds.has(p.promptText));
      currentId = currentData?.promptText;
    }

    // console.log("[PromptScreen useMemo] Result of find:", { currentData, currentId });

    const allAnswered = assigned.length > 0 && !currentId;
    // const hand = playerState?.myHand || []; // Already got hand above

    const result = {
      currentPromptData: currentData,
      currentPromptIdentifier: currentId,
      allPromptsAnswered: allAnswered,
      isFlipTheScript: isFTS,
      answeredIdentifiersCount: answeredIds.size,
      assignedPromptsCount: assigned.length,
      myHand: hand, // Use derived hand
    };
    // console.log("[PromptScreen useMemo] Returning:", result);
    return result;
    // <<< Update Dependencies >>>
  }, [
    gameState?.settings,
    playerState?.myAssignedPrompts,
    playerState?.myAnsweredPrompts,
    playerState?.myHand,
  ]);

  const myRemainingDeckCount = gameState?.myRemainingDeckCount ?? 0;

  // --- dnd-kit Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the mouse to move by 10 pixels before activating
      // Useful for preventing drag activation on short clicks
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  // --- dnd-kit Event Handlers ---
  const handleDragStart = event => {
    // console.log("[DragStart] Event:", event);
    setActiveId(event.active.id); // <<< Restore setActiveId
    // Clear visual drop zone on new drag - keep droppedCardPath null until successful drop
    // We might not need to explicitly set droppedCardPath to null here if the drop logic handles it
    // setDroppedCardPath(null);
    setIsFlipping(false); // Ensure flip state is reset
  };

  const handleDragEnd = event => {
    // console.log("[Dnd HandleDragEnd]", event);
    const { active, over } = event;

    // Check if dropped over the correct zone
    if (over && over.id === 'prompt-drop-zone' && active.data.current?.imagePath) {
      const droppedImagePath = active.data.current.imagePath;
      // console.log(`[Dnd Drop] Dropped card: ${droppedImagePath} onto ${over.id}`);

      // Prevent dropping if already submitted/flipping
      if (droppedCardPath || isFlipping) {
        return;
      }

      if (!currentPromptIdentifier) {
        console.error('[Dnd Drop] Missing current prompt identifier.');
        setError('Drop failed. Cannot determine current prompt.');
        return;
      }
      setError('');

      // Set dropped card and trigger flip
      setDroppedCardPath(droppedImagePath);
      setIsFlipping(true);

      // Submission happens in handleFlipEnd triggered by onTransitionEnd
    }

    setActiveId(null); // <<< Restore setActiveId(null)
  };

  // --- Animation End Handler ---
  const handleFlipEnd = () => {
    // console.log("[FlipEnd] Animation ended.");
    // <<< ADD LOGGING >>>
    // console.log(`[FlipEnd Check] State before IF: isFlipping=${isFlipping}, droppedCardPath='${droppedCardPath}', currentPromptIdentifier='${currentPromptIdentifier}'`);
    // <<< END LOGGING >>>
    // Only submit if we were flipping and have the necessary data
    if (isFlipping && droppedCardPath && currentPromptIdentifier) {
      // console.log(`Submitting Post-Flip: Player ${currentPlayerId}, Identifier(Text) "${currentPromptIdentifier}", Image ${droppedCardPath}`);
      socket.emit(
        'submitAnswer',
        gameState.gameId,
        currentPlayerId,
        currentPromptIdentifier,
        droppedCardPath,
      );
      // console.log("[handleFlipEnd] socket.emit('submitAnswer') called.");
    }
    // We might not need to set isFlipping false if the state update moves us away
    // setIsFlipping(false);
  };

  // Reset state when prompt changes
  useEffect(() => {
    // setSelectedCard(null);
    setDroppedCardPath(null);
    setIsFlipping(false); // <<< Reset flip state on new prompt
    setResponseText('');
    setError('');
  }, [currentPromptIdentifier]);

  if (!gameState || !currentPlayerId) {
    return <LoadingState message='Loading Player Data...' size='small' />;
  }

  // Handle "All Prompts Answered" State
  if (allPromptsAnswered) {
    const playersArray = gameState.players || [];

    // <<< FIX: Determine total based ONLY on settings >>>
    const totalPromptsExpected = gameState?.settings?.promptsPerPlayer || 0;

    // Calculate waiting count based on answered count vs expected count
    const waitingCount = playersArray.filter(
      p => p.id !== currentPlayerId && (p.promptsAnsweredCount ?? 0) < totalPromptsExpected,
    ).length;

    return (
      <div className='prompt-screen-container card all-answered-container'>
        <h3 className='waiting-message'>All Your Prompts Answered!</h3>
        {waitingCount > 0 ? (
          <p className='waiting-message'>Waiting for {waitingCount} other player(s) to finish...</p>
        ) : (
          <p className='waiting-message'>All players have finished!</p>
        )}

        {/* --- Player Status Icons (Simplified) --- */}
        {playersArray.length > 0 && (
          <div className='player-status-icons-container'>
            <h4>Submission Status:</h4>
            <div className='player-status-icons'>
              {playersArray.map(player => {
                const totalPrompts = totalPromptsExpected;
                const answeredCount = player.promptsAnsweredCount ?? 0;
                const isComplete = answeredCount >= totalPrompts;
                const isCurrentUser = player.id === currentPlayerId;
                
                return (
                  <div
                    key={player.id}
                    className={`player-status-icon ${isComplete ? 'completed' : 'pending'} ${isCurrentUser ? 'current-user' : ''}`}
                    title={`${player.nickname}${isCurrentUser ? ' (You)' : ''}: ${answeredCount}/${totalPrompts} submitted`}
                  >
                    <span className='player-icon'>{player.icon || '😀'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading next prompt state
  if (!currentPromptIdentifier) {
    console.warn(
      '[PromptScreen Render] No current prompt identifier found, but not all prompts are answered yet.',
    );
    return <LoadingState message='Loading next prompt...' />;
  }

  // Determine progress text
  const progressText =
    assignedPromptsCount > 0 ? `(${answeredIdentifiersCount + 1} / ${assignedPromptsCount})` : '';

  // --- Main Render Logic ---
  return (
    // <<< Wrap in DndContext >>>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter} // Choose appropriate strategy
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className='prompt-screen-container card'>
        <h2 className='prompt-progress-text'>Your Prompt {progressText}:</h2>
        {error && <p className='prompt-error'>{error}</p>}

        {/* Original Prompt Display Area (NOT the drop zone anymore) */}
        <div className='prompt-display-area'>
          <div className={`current-prompt-box ${isFlipTheScript ? 'flip-script-mode' : ''}`}>
            {/* Show only the prompt here */}
            {isFlipTheScript ? (
              <img
                src={`${SERVER_BASE_URL}${currentPromptIdentifier}`}
                alt='Prompt Image'
                className='prompt-image'
                style={{
                  display: 'block',
                  width: '170px',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
                  margin: '0',
                }}
              />
            ) : (
              <p>{currentPromptIdentifier}</p>
            )}
            {/* Remove cue from here */}
            {/* {!droppedCardPath && !isFlipTheScript && ...} */}
          </div>
        </div>

        {/* Dedicated Drop Zone Area (Wrap with Droppable) */}
        {!isFlipTheScript && (
          <Droppable
            id='prompt-drop-zone'
            className={`card-drop-zone ${_isDraggingOver ? 'drag-over' : ''}`}
          >
            {/* <<< Wrap content in flip structure >>> */}
            <div className='flip-card'>
              <div
                className={`flip-card-inner ${isFlipping ? 'flipping' : ''}`}
                onTransitionEnd={handleFlipEnd} // <<< Use onTransitionEnd for CSS transitions
              >
                <div className='flip-card-front'>
                  {droppedCardPath ? (
                    <img
                      src={`${SERVER_BASE_URL}${droppedCardPath}`}
                      alt='Submitted Answer'
                      className='submitted-card-image'
                    />
                  ) : (
                    <div className='drop-zone-cue'>Drop Card Here</div>
                  )}
                </div>
                <div className='flip-card-back'>
                  <span className='card-back-logo'>QP</span>
                </div>
              </div>
            </div>
          </Droppable>
        )}

        {isFlipTheScript ? (
          <div className='response-input-area'>
            <h3 className='response-title'>Write Your Response:</h3>
            <textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder='Enter your witty response here...'
              rows={3}
              className='response-textarea'
            />
            <button
              onClick={() => {
                const trimmedResponse = responseText.trim();
                if (!trimmedResponse) {
                  setError('Please enter a response.');
                  return;
                }
                setError('');
                // console.log(`Submitting FTS: Player ${currentPlayerId}, Identifier(Img) "${currentPromptIdentifier}", Response "${trimmedResponse}"`);
                socket.emit(
                  'submitAnswer',
                  gameState.gameId,
                  currentPlayerId,
                  currentPromptIdentifier,
                  trimmedResponse,
                );
                setResponseText('');
              }}
              disabled={!responseText.trim()}
              className='submit-answer-button fts-submit' // Add specific class if needed
            >
              Submit Response
            </button>
          </div>
        ) : (
          <div className='hand-display-area'>
            <h3 className='hand-title'>Select Image for this Prompt:</h3>
            <p className='deck-count-indicator'>Cards remaining in deck: {myRemainingDeckCount}</p>
            {/* <<< Wrap hand items in SortableContext >>> */}
            <SortableContext
              items={myHand} // Use imagePath array as items
              strategy={rectSortingStrategy} // Or another strategy
            >
              <div className='hand-images-grid'>
                {myHand.map((imagePath, index) => {
                  const id = imagePath ?? `hand-card-${index}`; // Use imagePath as unique ID
                  if (imagePath === null || imagePath === undefined) {
                    console.error(
                      '[PromptScreen Hand Map] Found null/undefined imagePath at index:',
                      index,
                      'Hand:',
                      myHand,
                    );
                    return null;
                  }
                  const isDropped = droppedCardPath === imagePath;

                  return (
                    // <<< Render the SortableCardItem component >>>
                    <SortableCardItem
                      key={id}
                      id={id}
                      imagePath={imagePath}
                      isDropped={isDropped}
                    />
                    /* // Old rendering:
                                        <div key={id} style={{ opacity: activeId === id ? 0.5 : 1 }}>
                                            <div className={`image-card-wrapper ${isDropped ? 'dropped' : ''}`}>
                                                <div className="image-card">
                                                    <img 
                                                        src={`${SERVER_BASE_URL}${imagePath}`}
                                                        alt={`Selectable answer: ${imagePath}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        */
                  );
                })}
                {myHand.length === 0 && <p>No cards left in hand!</p>}
              </div>
            </SortableContext>
          </div>
        )}

        <div className='player-status-icons-container'>
          <h4>Submission Status:</h4>
          <div className='player-status-icons'>
            {(gameState.players || []).map(p => {
              const answeredCount = p.promptsAnsweredCount ?? 0;
              const assignedCount = p.promptsAssignedCount ?? 0;
              const isComplete = answeredCount >= assignedCount && assignedCount > 0;
              const isCurrentUser = p.id === currentPlayerId;
              
              return (
                <div
                  key={p.id}
                  className={`player-status-icon ${isComplete ? 'completed' : 'pending'} ${isCurrentUser ? 'current-user' : ''}`}
                  title={`${p.nickname}${isCurrentUser ? ' (You)' : ''}: ${answeredCount}/${assignedCount} submitted`}
                >
                  <span className='player-icon'>{p.icon}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* <<< Restore DragOverlay >>> */}
        <DragOverlay adjustScale={false} dropAnimation={null}>
          {activeId ? (
            // <<< Render SortableCardItem instead of plain img >>>
            <SortableCardItem
              id={activeId}
              imagePath={activeId}
              isDropped={false} // Overlay item is never considered dropped
            />
          ) : /*
                        <div className="drag-overlay-card"> 
                           <img src={`${SERVER_BASE_URL}${activeId}`} alt="Dragging card" />
                        </div>
                        */
          null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
export default PromptScreen;
