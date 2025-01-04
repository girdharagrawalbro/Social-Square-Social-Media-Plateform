import React from 'react';
import Bg from './components/Bg';

const Contact = () => {
  return (
    <Bg>
      <div className="text-start">
        <h3 className="mb-3">Contact Us</h3>
        <p>
          We'd love to hear from you! Feel free to connect with us through any of the following channels:
        </p>
        <ul>
          <li>
            📧 <b>Email:</b> Reach us at  
            <a href="mailto:girdharagarawalbro@gmail.com" target="_blank" rel="noopener noreferrer">
               {" "}<u className='text-primary'> girdharagarawalbro@gmail.com</u>
            </a>
          </li>
          <li>
            📸 <b>Instagram:</b> Follow us and drop a message on our Instagram profile at  <a href=""><u className='text-primary'>codewithgirdhar</u></a>. 
          </li>
          <li>
            💼 <b>LinkedIn:</b> Connect with us on LinkedIn to stay updated with our journey at  <a href="" ><u className='text-primary'>Girdhar Agrawal</u></a>.
          </li>
        </ul>

        <h6 className="mt-4">Collaborate with Us</h6>
        <p>
          We're always excited to welcome new collaborators! If you're interested in contributing to this project, feel free to push your ideas and code on our GitHub repository 
          {" "}<a href="https://github.com/your-repo-link" target="_blank" rel="noopener noreferrer">
          <u className='text-primary'>
            Social Square - Social Media Plateform
            </u>
          </a>.
        </p>
        <p>
          Together, we can make this platform even better!
        </p>
      </div>
    </Bg>
  );
};

export default Contact;
