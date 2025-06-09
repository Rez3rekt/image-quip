import { useState, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../utils/cropImage';
import { SERVER_BASE_URL } from '../../config';

function CardUploadSection({ 
  clientId, 
  onCardAdded, 
  isProcessing, 
  setIsProcessing, 
  error, 
  setError, 
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imgSrc, setImgSrc] = useState('');
  const [gifPreviewSrc, setGifPreviewSrc] = useState(null);
  const [isGif, setIsGif] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspect] = useState(9 / 16);

  const cropWrapperRef = useRef(null);

  // Wheel zoom effect
  useEffect(() => {
    const cropperWrapper = cropWrapperRef.current;
    if (!(imgSrc && !isGif && cropperWrapper)) {
      return;
    }

    const handleWheel = event => {
      event.preventDefault();
      const delta = event.deltaY * -0.001;
      setZoom(prevZoom => {
        const newZoom = prevZoom + delta;
        return Math.min(Math.max(newZoom, 1), 3);
      });
    };

    cropperWrapper.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      cropperWrapper.removeEventListener('wheel', handleWheel);
    };
  }, [imgSrc, isGif, zoom]);

  const handleFileChange = event => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setGifPreviewSrc(null);
      setIsGif(file.type === 'image/gif');

      if (file.type === 'image/gif') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setGifPreviewSrc(reader.result);
          setImgSrc('');
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImgSrc(reader.result);
          setGifPreviewSrc(null);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const resetUploadState = () => {
    setSelectedFile(null);
    setImgSrc('');
    setGifPreviewSrc(null);
    setIsGif(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    setIsProcessing(false);
    
    // Clear the file input value
    const fileInput = document.getElementById('card-upload-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSaveCard = async () => {
    if (!imgSrc || !croppedAreaPixels) {
      setError('Image source or crop data is missing. Please select an image and crop it.');
      return;
    }

    const token = localStorage.getItem('token');
    console.log('Token check:', { hasToken: !!token, tokenLength: token?.length });

    setIsProcessing(true);
    setError(null);

    try {
      const croppedImageBlob = await getCroppedImg(imgSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append('image', croppedImageBlob, selectedFile?.name || 'cropped-image.jpg');

      let uploadUrl = '';
      const headers = {};

      if (token) {
        uploadUrl = `${SERVER_BASE_URL}/api/cards/upload`;
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        if (!clientId) {
          throw new Error('Cannot upload as guest without a client ID.');
        }
        uploadUrl = `${SERVER_BASE_URL}/api/guest-cards/upload`;
        formData.append('clientId', clientId);
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Upload failed with status:', response.status, 'Response:', errorData);
        throw new Error(errorData.message || `Upload failed: ${response.statusText} (${response.status})`);
      }

      const result = await response.json();
      console.log('Upload successful:', result.success, result.card?.id);
      if (result.success) {
        resetUploadState();
        onCardAdded?.(result.card);
      } else {
        console.error('Upload failed - server returned success: false', result.message || 'No error message');
        throw new Error(result.message || 'Upload failed.');
      }
    } catch (err) {
      console.error('Error uploading card:', err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveGif = async () => {
    if (!selectedFile || !isGif) {
      setError('Please select a GIF file.');
      return;
    }

    const token = localStorage.getItem('token');
    console.log('GIF Token check:', { hasToken: !!token, tokenLength: token?.length });

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      let uploadUrl = '';
      const headers = {};

      if (token) {
        uploadUrl = `${SERVER_BASE_URL}/api/cards/upload`;
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        if (!clientId) {
          throw new Error('Cannot upload as guest without a client ID.');
        }
        uploadUrl = `${SERVER_BASE_URL}/api/guest-cards/upload`;
        formData.append('clientId', clientId);
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('GIF upload failed with status:', response.status, 'Response:', errorData);
        throw new Error(errorData.message || `Upload failed: ${response.statusText} (${response.status})`);
      }

      const result = await response.json();
      console.log('GIF upload successful:', result.success, result.card?.id);
      if (result.success) {
        resetUploadState();
        onCardAdded?.(result.card);
      } else {
        console.error('GIF upload failed - server returned success: false', result.message || 'No error message');
        throw new Error(result.message || 'Upload failed.');
      }
    } catch (err) {
      console.error('Error uploading GIF:', err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='card-upload-section'>
      <h3>Create New Card</h3>

      <div className='mobile-upload-options'>
        <input
          type='file'
          id='card-upload-input'
          accept='image/*'
          onChange={handleFileChange}
          disabled={isProcessing}
          className='standard-file-input'
        />

        <button
          className='camera-capture-btn'
          onClick={() => {
            const input = document.getElementById('card-upload-input');
            if (input) {
              input.setAttribute('accept', 'image/*;capture=camera');
              input.click();
              setTimeout(() => {
                input.setAttribute('accept', 'image/*');
              }, 1000);
            }
          }}
          disabled={isProcessing}
        >
          📷 Take Photo
        </button>
      </div>

      {typeof error === 'string' && error && <p className='error-message'>{error}</p>}

      {isGif && gifPreviewSrc && (
        <div className='gif-preview-container'>
          <h4>GIF Preview</h4>
          <img src={gifPreviewSrc} alt='GIF Preview' className='gif-preview' />
          <button
            onClick={handleSaveGif}
            disabled={isProcessing}
            className='save-gif-button'
          >
            {isProcessing ? 'Uploading...' : 'Save GIF'}
          </button>
          <button onClick={resetUploadState} disabled={isProcessing}>
            Cancel
          </button>
        </div>
      )}

      {imgSrc && !isGif && (
        <div className='crop-container' ref={cropWrapperRef}>
          <h4>Crop Your Image</h4>
          <div className='cropper-wrapper'>
            <Cropper
              image={imgSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
            />
          </div>
          <div className='crop-controls'>
            <label>
              Zoom:
              <input
                type='range'
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={e => setZoom(Number(e.target.value))}
              />
            </label>
            <button
              onClick={handleSaveCard}
              disabled={isProcessing || !croppedAreaPixels}
              className='save-card-button'
            >
              {isProcessing ? 'Processing...' : 'Save Card'}
            </button>
            <button onClick={resetUploadState} disabled={isProcessing}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CardUploadSection; 