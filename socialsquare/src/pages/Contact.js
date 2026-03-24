import React from 'react';
import Bg from './components/Bg';

const Contact = () => {
  return (
    <>
      <Bg>
        <div className="w-full max-w-3xl mx-auto text-left">
          <div className="rounded-2xl border border-gray-200 p-4 sm:p-6 md:p-8 bg-white/95">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Contact Us</h1>
            <p className="text-sm sm:text-base text-gray-600 mb-5 sm:mb-6">
              We would love to hear from you. Reach out through any channel below and we will get back to you as soon as possible.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-6">
              <a
                href="mailto:girdharagarawalbro@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="border rounded-xl p-3 sm:p-4 hover:shadow-sm transition"
              >
                <p className="text-sm text-gray-500 mb-1">Email</p>
                <p className="font-semibold text-themeStart break-all">girdharagarawalbro@gmail.com</p>
              </a>

              <a
                href="https://instagram.com/codewithgirdhar"
                target="_blank"
                rel="noopener noreferrer"
                className="border rounded-xl p-3 sm:p-4 hover:shadow-sm transition"
              >
                <p className="text-sm text-gray-500 mb-1">Instagram</p>
                <p className="font-semibold text-themeStart">@codewithgirdhar</p>
              </a>

              <a
                href="https://linkedin.com/in/girdhar-agrawal"
                target="_blank"
                rel="noopener noreferrer"
                className="border rounded-xl p-3 sm:p-4 hover:shadow-sm transition sm:col-span-2"
              >
                <p className="text-sm text-gray-500 mb-1">LinkedIn</p>
                <p className="font-semibold text-themeStart">Girdhar Agrawal</p>
              </a>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
              <h2 className="text-lg sm:text-xl font-semibold mb-2">Collaborate With Us</h2>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                We are always excited to welcome new collaborators. If you want to contribute ideas or code, check the repository and share your contribution.
              </p>
              <a
                href="https://github.com/your-repo-link"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-themeStart font-semibold underline break-words"
              >
                Social Square - Social Media Plateform
              </a>
            </div>
          </div>
        </div>
      </Bg>
    </>
  );
};

export default Contact;
