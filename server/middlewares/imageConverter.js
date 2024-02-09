import React, { useState } from 'react';
import Tesseract from 'tesseract.js';

const ImageConverter = () => {
  const [imageText, setImageText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e) => {
    setLoading(true);
    const file = e.target.files[0];

    Tesseract.recognize(
      file,
      'eng', // Language for OCR (e.g., English)
      { logger: (m) => console.log(m) } // Optional logger
    ).then(({ data: { text } }) => {
      setImageText(text);
      setLoading(false);
    });
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <h2>Converted Text:</h2>
          <p>{imageText}</p>
        </div>
      )}
    </div>
  );
};

export default ImageConverter;
