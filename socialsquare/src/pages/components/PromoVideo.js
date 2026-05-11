import React, { useState, useEffect, useRef } from 'react';
import './PromoVideo.css';

// Import images extracted from the HTML
import scene2Img from '../../assets/promo/scene_2.jpg';
import scene3Img from '../../assets/promo/scene_3.jpg';
import scene4Img from '../../assets/promo/scene_4.jpg';
import scene5Img from '../../assets/promo/scene_5.jpg';
import scene6Img from '../../assets/promo/scene_6.jpg';

const PromoVideo = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [particles, setParticles] = useState([]);
  const screenRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    // Initialize particles
    const newParticles = [];
    for (let i = 0; i < 24; i++) {
      newParticles.push({
        id: i,
        left: Math.random() * 100 + '%',
        duration: (9 + Math.random() * 9) + 's',
        delay: (-Math.random() * 18) + 's',
        opacity: 0.18 + Math.random() * 0.45,
        size: (2 + Math.random() * 3) + 'px'
      });
    }
    setParticles(newParticles);
  }, []);

  const togglePlayPause = () => {
    setIsPaused(!isPaused);
    if (audioCtxRef.current) {
      if (!isPaused) {
        audioCtxRef.current.suspend();
      } else {
        audioCtxRef.current.resume();
      }
    }
  };

  const handleReplay = () => {
    setIsAnimating(false);
    // Force reflow
    setTimeout(() => {
      setIsAnimating(true);
      setIsPaused(false);
      if (audioCtxRef.current) {
        audioCtxRef.current.resume();
      }
    }, 10);
  };

  const startAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AC();
      audioCtxRef.current = audioCtx;

      const master = audioCtx.createGain();
      master.gain.value = 0.034;
      master.connect(audioCtx.destination);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1050;
      filter.Q.value = 0.8;
      filter.connect(master);

      const tones = [[174, 0, 0.52], [220, 4, 0.28], [262, -3, 0.22], [349, 5, 0.16]];
      tones.forEach(([f, d, g]) => {
        const o = audioCtx.createOscillator();
        const gn = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.detune.value = d;
        gn.gain.value = 0;
        gn.gain.linearRampToValueAtTime(g, audioCtx.currentTime + 2.2);
        o.connect(gn);
        gn.connect(filter);
        o.start();
      });

      const lfo = audioCtx.createOscillator();
      const lfoG = audioCtx.createGain();
      lfo.frequency.value = 0.07;
      lfoG.gain.value = 260;
      lfo.connect(lfoG);
      lfoG.connect(filter.frequency);
      lfo.start();

      const breathe = audioCtx.createOscillator();
      const breatheG = audioCtx.createGain();
      breathe.frequency.value = 0.04;
      breatheG.gain.value = 0.007;
      breathe.connect(breatheG);
      breatheG.connect(master.gain);
      breathe.start();
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  };

  return (
    <div className="promo-video-container" onClick={startAudio}>
      <div className="promo-device">
        <div
          className={`promo-screen ${isPaused ? 'paused' : ''} ${isAnimating ? 'animate' : ''}`}
          ref={screenRef}
        >
          {/* Scene 1: Opening */}
          <div className="promo-scene scene-1">
            <div className="bg-shimmer"></div>
            <div className="particles">
              {particles.map(p => (
                <div
                  key={p.id}
                  className="particle"
                  style={{
                    left: p.left,
                    opacity: p.opacity,
                    width: p.size,
                    height: p.size,
                    '--d': p.duration,
                    animationDelay: p.delay
                  }}
                />
              ))}
            </div>
            <div className="center-content">
              <h1 className="s1-title">Tired of the same old social media?</h1>
            </div>
          </div>

          {/* Scene 2: App Intro */}
          <div className="promo-scene scene-2">
            <div className="scrim-top"></div>
            <img className="promo-media" src={scene2Img} alt="Scene 2" />
            <div className="top-content">
              <span className="badge">INTRODUCING</span>
              <h2>Social Square</h2>
              <p>Where every moment finds its home.</p>
            </div>
          </div>

          {/* Scene 3: Features */}
          <div className="promo-scene scene-3">
            <div className="scrim-all"></div>
            <img className="promo-media" src={scene3Img} alt="Scene 3" />
            <div className="feature f1"><span>✨ Interactive Stories</span></div>
            <div className="feature f2"><span>💬 Real-time Chat</span></div>
            <div className="feature f3"><span>🤝 Collaborative Groups</span></div>
          </div>

          {/* Scene 4: Moods */}
          <div className="promo-scene scene-4">
            <div className="zoom-wrap">
              <img className="promo-media zoomed" src={scene4Img} alt="Scene 4" />
            </div>
            <div className="scrim-bottom"></div>
            <div className="pulse-highlight"></div>
            <div className="vibe-text">Filter your feed by MOOD.</div>
          </div>

          {/* Scene 5: Social */}
          <div className="promo-scene scene-5">
            <div className="scrim-bottom-strong"></div>
            <img className="promo-media" src={scene5Img} alt="Scene 5" />
            <div className="heart-pop">
              <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div className="user-focus">@alex_vibe</div>
            <div className="social-text">Engage with your community like never before.</div>
          </div>

          {/* Scene 6: Explore */}
          <div className="promo-scene scene-6">
            <div className="scrim-center"></div>
            <img className="promo-media" src={scene6Img} alt="Scene 6" />
            <div className="cta-1">Discover your next obsession.</div>
            <div className="cta-2">Explore millions of posts.</div>
          </div>

          {/* End Card */}
          <div className="promo-scene scene-end">
            <div className="bg-shimmer"></div>
            <div className="end-content">
              <div className="logo-mark">S²</div>
              <h3>Social Square</h3>
              <button className="url-btn" onClick={() => window.location.href = '/signup'}>Get Started Now</button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="promo-progress">
            <div className="promo-progress-bar"></div>
          </div>

          <div className="promo-controls" style={{
            position: 'absolute',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '12px',
            zIndex: 100,
            opacity: 0.9,
            transition: 'all 0.3s ease',
            background: 'rgba(0,0,0,0.3)',
            padding: '8px 16px',
            borderRadius: '24px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px' }}>
              <i className={`pi ${isPaused ? 'pi-play' : 'pi-pause'}`} style={{ fontSize: '14px' }}></i>
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleReplay(); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px' }}>
              <i className="pi pi-refresh" style={{ fontSize: '14px' }}></i>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PromoVideo;
