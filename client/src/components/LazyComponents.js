import { lazy } from 'react';

// Lazy load heavy components that aren't needed immediately
export const LazyMyCardsScreen = lazy(() => import('./MyCardsScreen'));
export const LazyAccountScreen = lazy(() => import('./AccountScreen'));
export const LazyGame = lazy(() => import('./Game'));
export const LazyLoginScreen = lazy(() => import('./LoginScreen'));
export const LazyRegisterScreen = lazy(() => import('./RegisterScreen'));

// Lazy load display components (used less frequently)
export const LazyDisplayVotingScreen = lazy(() => import('./DisplayVotingScreen'));
export const LazyDisplayVoteRevealScreen = lazy(() => import('./DisplayVoteRevealScreen'));
export const LazyDisplayFinalResultsScreen = lazy(() => import('./DisplayFinalResultsScreen'));

// Lazy load card management components
export const LazyCardInspectorModal = lazy(() => import('./CardInspectorModal'));

// Lazy load game phase components
export const LazyVotingScreen = lazy(() => import('./VotingScreen'));
export const LazyVoteRevealScreen = lazy(() => import('./VoteRevealScreen'));
export const LazyFinalResultsScreen = lazy(() => import('./FinalResultsScreen'));
export const LazyPromptScreen = lazy(() => import('./PromptScreen'));
export const LazyCardSelectionScreen = lazy(() => import('./CardSelectionScreen'));

// Export a loading fallback component
export const ComponentLoadingFallback = ({ message = 'Loading...' }) => (
  <div className="component-loading">
    <div className="loading-spinner"></div>
    <p>{message}</p>
  </div>
); 