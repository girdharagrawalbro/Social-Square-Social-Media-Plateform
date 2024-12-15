import React from 'react';
import Bg from './components/Bg';

const Contact = () => {
  return (
    <Bg>
      <h3>Contact Us</h3>
      <p>
        <strong>Address:</strong> 123 Main Street, Anytown, CA 12345
      </p>
      <p>
        <strong>Phone:</strong> (123) 456-7890
      </p>
      <p>
        <strong>Email:</strong> contact@example.com
      </p>
      <p>
        <strong>Social Media:</strong>
        <a href="https://www.facebook.com/example" target="_blank" rel="noopener noreferrer">
          Facebook
        </a>
        {' | '}
        <a href="https://www.twitter.com/example" target="_blank" rel="noopener noreferrer">
          Twitter
        </a>
        {' | '}
        <a href="https://www.instagram.com/example" target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
      </p>
    </Bg>
  );
};

export default Contact;