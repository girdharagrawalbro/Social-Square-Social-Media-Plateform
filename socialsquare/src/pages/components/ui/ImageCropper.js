import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';

/**
 * Utility to create an image element from a URL
 */
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues on CodeSandbox
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

const ImageCropper = ({ image, onCropComplete, onCancel, visible }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1); // 1 for Square
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);

  const onCropChange = (crop) => setCrop(crop);
  const onZoomChange = (zoom) => setZoom(zoom);
  const onCropCompleteInternal = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    setLoading(true);
    try {
      const croppedFile = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedFile);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const aspectPresets = [
    { label: 'Square (1:1)', value: 1 },
    { label: 'Portrait (4:5)', value: 4 / 5 },
    { label: 'Landscape (16:9)', value: 16 / 9 },
  ];

  return (
    <Dialog 
      header="Crop Image" 
      visible={visible} 
      onHide={onCancel} 
      style={{ width: '90vw', maxWidth: '600px' }}
      modal
      footer={
        <div className="flex justify-between items-center w-full">
          <div className="flex gap-2">
            {aspectPresets.map((preset) => (
              <Button 
                key={preset.label}
                label={preset.label} 
                onClick={() => setAspect(preset.value)}
                className={`p-button-text p-button-sm ${aspect === preset.value ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500'}`}
                style={{ fontSize: '10px' }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button label="Cancel" onClick={onCancel} className="p-button-text text-gray-500" />
            <Button label="Apply" onClick={handleApplyCrop} loading={loading} className="bg-indigo-600 text-white border-0" />
          </div>
        </div>
      }
    >
      <div className="relative w-full h-80 bg-gray-900 rounded-lg overflow-hidden">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={onCropChange}
          onCropComplete={onCropCompleteInternal}
          onZoomChange={onZoomChange}
        />
      </div>
      <div className="mt-4 px-2">
        <label className="text-xs text-gray-400 block mb-2 font-semibold uppercase tracking-wider">Zoom Level</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          aria-labelledby="Zoom"
          onChange={(e) => setZoom(e.target.value)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
      </div>
    </Dialog>
  );
};

export default ImageCropper;
