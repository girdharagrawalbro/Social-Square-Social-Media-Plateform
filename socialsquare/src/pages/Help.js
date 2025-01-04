import React from 'react';
import Bg from './components/Bg';

const Help = () => {
    return (
        <Bg>
            <div className='text-start'>
                <b>How to Use This Platform?</b>
                <br />

                <span>
                    Getting started is easy! Simply register by providing your email, full name, and a secure password.
                    Once registered, you can log in anytime to access your profile.
                </span>
                <br />
                <br />

                <span>
                 <b>   This platform offers a range of exciting features:</b>
                    <ul>
                        <li>✨ <b>Share Your Thoughts:</b> Post your daily musings with pictures and let others like and comment on them.</li>
                        <li>💬 <b>Engage with the Community:</b> Explore posts from other users and interact with their content.</li>
                        <li>📡 <b>Real-Time Communication:</b> Enjoy seamless live chats with friends and new connections.</li>
                        <li>🤝 <b>Find New Friends:</b> Expand your network by discovering and connecting with like-minded individuals.</li>
                        <li>🔔 <b>Stay Updated:</b> Receive notifications about likes, comments, and messages so you never miss a moment.</li>
                        <li>🔒 <b>Privacy & Security:</b> Your profile and posts are secured to ensure a safe experience.</li>
                    </ul>
                </span>

            </div>
        </Bg>
    );
}

export default Help;
