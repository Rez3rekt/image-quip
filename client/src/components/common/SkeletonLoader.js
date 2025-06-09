import '../../styles/SkeletonLoader.css';

// Individual skeleton components
export const SkeletonText = ({ width = '100%', height = '1em', className = '' }) => (
  <div 
    className={`skeleton skeleton--text ${className}`}
    style={{ width, height }}
  />
);

export const SkeletonBox = ({ width = '100%', height = '200px', className = '' }) => (
  <div 
    className={`skeleton skeleton--box ${className}`}
    style={{ width, height }}
  />
);

export const SkeletonAvatar = ({ size = '40px', className = '' }) => (
  <div 
    className={`skeleton skeleton--avatar ${className}`}
    style={{ width: size, height: size }}
  />
);

export const SkeletonCard = ({ className = '' }) => (
  <div className={`skeleton-card ${className}`}>
    <SkeletonBox height="200px" className="skeleton-card__image" />
    <div className="skeleton-card__content">
      <SkeletonText width="80%" height="20px" />
      <SkeletonText width="60%" height="16px" />
    </div>
  </div>
);

// Pre-built skeleton layouts
export const SkeletonPlayerList = ({ count = 4, ..._props }) => (
  <div className="skeleton-player-list">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-player-item">
        <SkeletonAvatar />
        <SkeletonText width="120px" height="18px" />
        <SkeletonText width="60px" height="16px" />
      </div>
    ))}
  </div>
);

export const SkeletonGameState = () => (
  <div className="skeleton-game-state">
    <SkeletonText width="200px" height="24px" className="skeleton-game-state__title" />
    <SkeletonPlayerList count={4} />
    <div className="skeleton-game-state__content">
      <SkeletonBox height="300px" />
      <div className="skeleton-game-state__actions">
        <SkeletonBox width="120px" height="44px" />
        <SkeletonBox width="120px" height="44px" />
      </div>
    </div>
  </div>
);

export const SkeletonCardGrid = ({ count = 6 }) => (
  <div className="skeleton-card-grid">
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// Main SkeletonLoader component
const SkeletonLoader = ({ 
  type = 'text', 
  width, 
  height, 
  count = 1, 
  className = '',
  ..._props 
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'text':
        return <SkeletonText width={width} height={height} className={className} />;
      case 'box':
        return <SkeletonBox width={width} height={height} className={className} />;
      case 'avatar':
        return <SkeletonAvatar size={width || height} className={className} />;
      case 'card':
        return <SkeletonCard className={className} />;
      case 'player-list':
        return <SkeletonPlayerList count={count} />;
      case 'game-state':
        return <SkeletonGameState />;
      case 'card-grid':
        return <SkeletonCardGrid count={count} />;
      default:
        return <SkeletonText width={width} height={height} className={className} />;
    }
  };

  if (count === 1) {
    return renderSkeleton();
  }

  return (
    <div className="skeleton-group">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          {renderSkeleton()}
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoader; 