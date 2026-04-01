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
        <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-2 p-2">
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto items-center">
            {aspectPresets.map((preset) => (
              <Button
                key={preset.label}
                label={preset.label.split(' ')[0]}
                onClick={() => setAspect(preset.value)}
                className={`p-button-text p-button-sm whitespace-nowrap ${aspect === preset.value ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500'}`}
                style={{ fontSize: '11px', padding: '6px 10px' }}
              />
            ))}
            <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block"></div>
            <Button 
                label="No Crop" 
                onClick={async () => {
                   const response = await fetch(image);
                   const blob = await response.blob();
                   const file = new File([blob], 'original-image.jpg', { type: blob.type });
                   onCropComplete(file);
                }} 
                className="p-button-text p-button-sm text-indigo-600 font-bold whitespace-nowrap" 
                style={{ fontSize: '11px', padding: '6px 10px' }}
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button label="Cancel" onClick={onCancel} className="p-button-text text-gray-500 flex-1 sm:flex-none font-bold" />
            <Button label="Apply Crop" onClick={handleApplyCrop} loading={loading} className="bg-indigo-600 text-white border-0 flex-1 sm:flex-none font-bold px-6 py-2 rounded-xl shadow-lg shadow-indigo-100" />
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
