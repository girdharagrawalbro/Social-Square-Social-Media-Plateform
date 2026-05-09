/**
 * Utility to convert a native URI (from Capacitor Camera/Filesystem) 
 * into a standard Web File object that can be used with existing 
 * web-based upload and processing logic.
 */

/**
 * Converts a URL (including Capacitor webPath) to a File object.
 * 
 * @param {string} url - The URL to convert (blob:..., https:..., or Capacitor URI)
 * @param {string} fileName - The name to give the resulting file
 * @param {string} mimeType - The mime type of the file
 * @returns {Promise<File>}
 */
export const urlToFile = async (url, fileName = 'captured-media.jpg', mimeType = 'image/jpeg') => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], fileName, { type: mimeType });
  } catch (error) {
    console.error('Error converting URL to File:', error);
    throw error;
  }
};
