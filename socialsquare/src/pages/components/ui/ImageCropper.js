import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog } from 'primereact/dialog';
import { Slider } from 'primereact/slider';

/**
 * Utility to create an image element from a URL
 */
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    if (!url.startsWith('data:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });

/**
 * Utility to get a cropped image as a Blob/File
 */
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg');
  });
}

const ImageCropper = ({ 
  image, 
  video, 
  onCropComplete, 
  onCancel, 
  visible, 
  initialAspect = 1,
  duration = 60,
  isNextImage = false
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(initialAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCropperLoaded, setIsCropperLoaded] = useState(false);
  const [imageAspect, setImageAspect] = useState(initialAspect);
  const [trimRange, setTrimRange] = useState([0, Math.min(duration, 60)]);

  useEffect(() => {
    if (visible) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAspect(initialAspect);
      setIsCropperLoaded(false);
      setTrimRange([0, Math.min(duration, 60)]);
    }
  }, [visible, image, video, initialAspect, duration]);

  const onCropChange = (crop) => setCrop(crop);
  const onZoomChange = (zoom) => setZoom(zoom);
  const onCropCompleteInternal = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onMediaLoaded = (mediaSize) => {
    const aspect = mediaSize.width / mediaSize.height;
    setImageAspect(aspect);
    setIsCropperLoaded(true);
  };

  const handleApplyCrop = async () => {
    setLoading(true);
    try {
      if (video) {
        onCropComplete({ video, crop, zoom, trimRange, croppedAreaPixels });
      } else {
        const croppedFile = await getCroppedImg(image, croppedAreaPixels);
        onCropComplete({ croppedFile, crop, zoom, croppedAreaPixels });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const aspectPresets = [
    { label: 'Square', value: 1 },
    { label: 'Portrait', value: 9 / 16 },
    { label: 'Landscape', value: 16 / 9 },
  ];

  return (
    <Dialog
      visible={visible}
      onHide={onCancel}
      showHeader={false}
      dismissableMask={true}
      modal
      baseZIndex={300000}
      appendTo={document.body}
      style={{ width: '95vw', maxWidth: '600px', border: 'none', zIndex: 300000 }}
      contentStyle={{ padding: 0, overflow: 'hidden', borderRadius: '16px', background: 'var(--surface-1)' }}
    >
      <div className="w-full flex flex-col bg-[var(--surface-1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <button onClick={onCancel} className="text-[var(--text-sub)] hover:text-[var(--text-main)] transition">
            <i className="pi pi-arrow-left text-lg"></i>
          </button>
          <h2 className="text-sm font-bold text-[var(--text-main)] m-0">{video ? 'Trim & Crop' : 'Crop'}</h2>
          <button
            onClick={handleApplyCrop}
            disabled={loading || !isCropperLoaded}
            className="text-[#808bf5] text-sm font-bold hover:text-[#a1a9f8] transition disabled:opacity-50"
          >
            {loading ? <i className="pi pi-spinner pi-spin mr-1"></i> : (isNextImage ? 'Next Image' : 'Next')}
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full h-[300px] sm:h-[400px] bg-black overflow-hidden">
          <Cropper
            image={image}
            video={video}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            onMediaLoaded={onMediaLoaded}
            showGrid={true}
            classes={{
              containerClassName: 'bg-black',
              cropAreaClassName: 'border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]'
            }}
          />
          {!isCropperLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <i className="pi pi-spin pi-spinner text-3xl text-[#808bf5]"></i>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-[var(--surface-1)]">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {aspectPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setAspect(preset.value)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${aspect === preset.value ? 'bg-[#808bf5] text-white border-[#808bf5]' : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border-color)] hover:border-[var(--text-sub)]'}`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => setAspect(imageAspect)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${aspect === imageAspect ? 'bg-[#808bf5] text-white border-[#808bf5]' : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border-color)] hover:border-[var(--text-sub)]'}`}
                >
                  Original
                </button>
              </div>

              <div className="flex items-center gap-3">
                <i className="pi pi-minus text-[8px] text-[var(--text-sub)]"></i>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-[var(--surface-2)] rounded-lg appearance-none cursor-pointer accent-[#808bf5]"
                />
                <i className="pi pi-plus text-[8px] text-[var(--text-sub)]"></i>
              </div>
            </div>

            {video && (
              <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border-color)]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#808bf5] uppercase tracking-wider">Video Trim (Max 60s)</span>
                  <span className="text-[10px] text-[var(--text-sub)] font-mono bg-[var(--surface-2)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                    {Math.floor(trimRange[0])}s - {Math.floor(trimRange[1])}s ({Math.floor(trimRange[1] - trimRange[0])}s)
                  </span>
                </div>
                <div className="px-2">
                  <Slider
                    value={trimRange}
                    onChange={(e) => {
                      const newRange = e.value;
                      const start = newRange[0];
                      const end = newRange[1];
                      if (end - start > 60) {
                        if (start !== trimRange[0]) {
                          setTrimRange([start, Math.min(duration, start + 60)]);
                        } else {
                          setTrimRange([Math.max(0, end - 60), end]);
                        }
                      } else {
                        setTrimRange(newRange);
                      }
                    }}
                    range
                    min={0}
                    max={duration || 60}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <p className="text-[9px] text-[var(--text-sub)] italic text-center m-0 opacity-60">
                  Tip: The selected segment will be shared. Max 60 seconds allowed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ImageCropper;
