import '../styles/MyCardsScreen.css';
import CardInspectorModal from './CardInspectorModal';
import { 
  CardUploadSection, 
  DeckManagement, 
  CardCollectionDisplay,
  useMyCardsLogic, 
  useCardActions, 
} from './cards';

function MyCardsScreen({
  clientId,
  onNavigateBack,
  _onLoginNeeded,
  _loggedInUsername,
  _ownedCards,
  _onCardAdded,
  _deviceInfo,
}) {
  // Use the custom hook for state management
    const { 
    myCards,
    setMyCards,
    isLoading,
    error,
    setError,
    isProcessing,
    setIsProcessing,
    decks,
    setDecks,
    isDeckLoading,
    setIsDeckLoading,
    selectedDeckId,
    setSelectedDeckId,
    deletingCardIds,
    setDeletingCardIds,
    deletingDeckIds,
    setDeletingDeckIds,
    displayDeckItems,
    setDisplayDeckItems,
    displayAvailableItems,
    setDisplayAvailableItems,
    displayAllCards,
    draggingItemId,
    setDraggingItemId,
    deckPreviewIndices,
    inspectedCardData,
    setInspectedCardData,
    fetchCardsAndDecks,
  } = useMyCardsLogic({ clientId });

  // Use the custom hook for card actions
    const { 
    handleDeleteCard,
    handleInspectCard,
    handleGoToPreviousCard,
    handleGoToNextCard,
    handleSaveCardDetails,
    handleToggleCardInDeck,
    handleReorderDeck,
  } = useCardActions({
    myCards,
    setMyCards,
    clientId,
    selectedDeckId,
    displayDeckItems,
    displayAvailableItems,
    displayAllCards,
    deletingCardIds,
    setDeletingCardIds,
    setInspectedCardData,
    setError,
    setIsProcessing,
    fetchCardsAndDecks,
  });

  const handleCardAdded = newCard => {
    setMyCards(prevCards => [...prevCards, newCard]);
        setError(null);
  };

    return (
    <div className='my-cards-container card'>
            <h2>My Cards</h2>
      <button onClick={onNavigateBack} className='back-button'>
        Back to Title
                    </button>

      <CardUploadSection
        clientId={clientId}
        onCardAdded={handleCardAdded}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        error={error}
        setError={setError}
      />

      <DeckManagement
        decks={decks}
        setDecks={setDecks}
        selectedDeckId={selectedDeckId}
        setSelectedDeckId={setSelectedDeckId}
        isDeckLoading={isDeckLoading}
        setIsDeckLoading={setIsDeckLoading}
        deletingDeckIds={deletingDeckIds}
        setDeletingDeckIds={setDeletingDeckIds}
        myCards={myCards}
        deckPreviewIndices={deckPreviewIndices}
        setError={setError}
      />

      <CardCollectionDisplay
        selectedDeckId={selectedDeckId}
        displayDeckItems={displayDeckItems}
        setDisplayDeckItems={setDisplayDeckItems}
        displayAvailableItems={displayAvailableItems}
        setDisplayAvailableItems={setDisplayAvailableItems}
        displayAllCards={displayAllCards}
        draggingItemId={draggingItemId}
        setDraggingItemId={setDraggingItemId}
        myCards={myCards}
        deletingCardIds={deletingCardIds}
        isLoading={isLoading}
        onDeleteCard={handleDeleteCard}
                                                onInspectCard={handleInspectCard}
        onToggleCardInDeck={handleToggleCardInDeck}
        onReorderDeck={handleReorderDeck}
      />

      {/* Card Inspector Modal */}
            {inspectedCardData && (
                <CardInspectorModal 
          key={inspectedCardData.card.id}
                    card={inspectedCardData.card} 
                    onClose={() => setInspectedCardData(null)} 
                    onSave={handleSaveCardDetails} 
                    onPrevious={handleGoToPreviousCard}
                    onNext={handleGoToNextCard}
                    sourceArray={inspectedCardData.source}
                    currentIndexInSource={inspectedCardData.index}
                 />
            )}
        </div>
    );
}

export default MyCardsScreen; 