import { useState, useRef, useEffect } from 'react';
import './LazyImage.css';

const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholder = null,
  errorFallback = null,
  onLoad = () => {},
  onError = () => {},
  threshold = 0.1,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad(e);
  };

  const handleError = (e) => {
    setIsError(true);
    onError(e);
  };

  const showPlaceholder = !isInView || (!isLoaded && !isError);
  const showError = isError;
  const showImage = isInView && !isError;

  return (
    <div 
      ref={imgRef} 
      className={`lazy-image-container ${className}`}
      {...props}
    >
      {showPlaceholder && !showError && (
        <div className="lazy-image-placeholder">
          {placeholder || <div className="lazy-image-skeleton" />}
        </div>
      )}
      
      {showError && (
        <div className="lazy-image-error">
          {errorFallback || (
            <div className="lazy-image-error-content">
              <span>❌</span>
              <span>Failed to load</span>
            </div>
          )}
        </div>
      )}
      
      {showImage && (
        <img
          src={src}
          alt={alt}
          className={`lazy-image ${isLoaded ? 'lazy-image-loaded' : 'lazy-image-loading'}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
};

export default LazyImage; 