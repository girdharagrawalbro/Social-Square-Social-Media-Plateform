import React, { useState, useEffect, useRef } from 'react';
import './PromoVideo.css';

// ── Scene images ─────────────────────────────────────
import scene1Img from '../../assets/promo/scene_1.png';    // Landing page
import scene2Img from '../../assets/promo/scene_2.png';    // Home feed / vibe check
import scene3Img from '../../assets/promo/scene_3.png';    // Stories row
import scene4Img from '../../assets/promo/scene_4.png';    // Chat / DM
import scene5Img from '../../assets/promo/scene_5.png';    // Post create – AI tools
import scene7Img from '../../assets/promo/scene_7.png'; // Confessions tab  ← NEW
import scene8Img from '../../assets/promo/scene_8.png'; // Explore grid     ← NEW
import scene9Img from '../../assets/promo/scene_9.png';

const PromoVideo = () => {
  const [particles, setParticles] = useState([]);
  const screenRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const pts = [];
    for (let i = 0; i < 20; i++) {
      pts.push({
        id: i,
        left: Math.random() * 100 + '%',
        dur: (10 + Math.random() * 8) + 's',
        delay: (-Math.random() * 18) + 's',
        opacity: 0.2 + Math.random() * 0.4,
        size: (2 + Math.random() * 2.5) + 'px',
      });
    }
    setParticles(pts);
  }, []);

  const startAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC(); audioCtxRef.current = ctx;
      const master = ctx.createGain(); master.gain.value = 0.03; master.connect(ctx.destination);
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1100;
      filt.Q.value = 0.7; filt.connect(master);
      [[174, 0, .5], [220, 3, .26], [262, -2, .2], [349, 4, .14]].forEach(([f, d, g]) => {
        const o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f; o.detune.value = d; gn.gain.value = 0;
        gn.gain.linearRampToValueAtTime(g, ctx.currentTime + 2.5);
        o.connect(gn); gn.connect(filt); o.start();
      });
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 0.06; lg.gain.value = 240;
      lfo.connect(lg); lg.connect(filt.frequency); lfo.start();
    } catch (e) { }
  };

  return (
    <div className="pv-container" onClick={startAudio}>
      <div className="pv-device">
        <div className="pv-notch" />

        <div
          className={`pv-screen animate`}
          ref={screenRef}
        >

          {/* ══ S1 · Hook ══════════════════════════════════ */}
          <div className="pv-scene s1">
            <div className="s-shimmer" />
            <div className="s1-particles">
              {particles.map(p => (
                <span key={p.id} className="s1-pt" style={{
                  left: p.left, opacity: p.opacity,
                  width: p.size, height: p.size,
                  '--dur': p.dur, animationDelay: p.delay,
                }} />
              ))}
            </div>
            <div className="s1-body">
              <div className="logo-mark">S²</div>
              <h1 className="s1-headline">Tired of<br />the same old<br />social media?</h1>
              <p className="s1-sub">There's a better way to connect.</p>
            </div>
          </div>

          {/* ══ S2 · Landing Page ══════════════════════════ */}
          <div className="pv-scene s2">
            <img className="pv-bg" src={scene1Img} alt="" />
            <div className="scrim-top-strong" />
            <div className="s2-top">
              <span className="pill-badge">INTRODUCING</span>

            </div>
            {/* Pulse glow on "Get Started" button – ~51–58% from top */}
            <div className="s2-btn-glow" />
          </div>

          {/* ══ S3 · Vibe Check Feed ═══════════════════════ */}
          <div className="pv-scene s3">
            <img className="pv-bg" src={scene2Img} alt="" />
            <div className="scrim-bottom" />
            <div className="bottom-label">Filter your feed<br />by <strong>MOOD</strong></div>
          </div>

          {/* ══ S4 · Stories ═══════════════════════════════ */}
          <div className="pv-scene s4">
            <img className="pv-bg" src={scene3Img} alt="" />
            <div className="scrim-bottom" />
            {/* Stories row sits at ~7–24% from top */}
            <div className="hi-ring" style={{
              top: '8%', left: '0%', width: '100%', height: '92px',
              '--c': 'rgba(167,139,250,.85)', '--g': 'rgba(167,139,250,.5)'
            }} />
            <div className="bottom-label">Your story,<br />your <strong>moment</strong></div>
          </div>

          {/* ══ S5 · Real-time Chat ════════════════════════ */}
          <div className="pv-scene s5">
            <img className="pv-bg" src={scene4Img} alt="" />
            <div className="scrim-bottom" />
            <div className="bottom-label">DM friends &amp;<br />share <strong>moments</strong></div>
          </div>

          {/* ══ S6 · Confessions ══════════════════════════ NEW */}
          <div className="pv-scene s6">
            <img className="pv-bg" src={scene7Img} alt="" />
            <div className="scrim-top-mild" />
            <div className="scrim-bottom" />
            {/* Highlight the Anonymous Confessions banner ~15–23% from top */}
            <div className="hi-ring" style={{
              top: '16%', left: '1%', width: '98%', height: '56px',
              '--c': 'rgba(139,92,246,.9)', '--g': 'rgba(139,92,246,.55)'
            }} />
            <div className="bottom-label">Post freely.<br />All identities <strong>hidden</strong></div>
          </div>

          {/* ══ S7 · Explore ══════════════════════════════ NEW */}
          <div className="pv-scene s7">
            <img className="pv-bg" src={scene8Img} alt="" />
            <div className="scrim-top-mild" />
            <div className="scrim-bottom" />
            <div className="bottom-label">Discover millions<br />of <strong>posts &amp; reels</strong></div>
          </div>

          {/* ══ S8 · AI Magic Tools ═══════════════════════ */}
          <div className="pv-scene s8">
            <img className="pv-bg" src={scene5Img} alt="" />
            <div className="scrim-bottom" />
            {/* AI section is at ~68–85% from top in scene_6 */}
            <div className="hi-ring" style={{
              top: '73%', left: '0%', width: '100%', height: '157px',
              '--c': 'rgba(251,191,36,.85)', '--g': 'rgba(245,158,11,.5)'
            }} />
            <div className="bottom-label" style={{ top: '18%', height: '90px' }}>Generate captions<br />&amp; images <strong>instantly</strong></div>
          </div>

          {/* ══ S9 · Login ════════════════════════════════ */}
          <div className="pv-scene s9">
            <img className="pv-bg" src={scene9Img} alt="" />
            <div className="scrim-bottom" />
            <div className="feat-chip" style={{ top: '12%', left: '50%', transform: 'translateX(-50%)' }}>🔐 1-tap Google Sign-in</div>
            <div className="bottom-label">Join in <strong>seconds</strong></div>
          </div>

          {/* ══ End Card ══════════════════════════════════ */}
          <div className="pv-scene s-end">
            <div className="s-shimmer" />
            <div className="end-body">
              <div className="logo-mark">S²</div>
              <h3 className="end-name">Social Square</h3>
              <p className="end-sub">Your vibe. Your community.</p>
              <button
                className="end-cta"
                onClick={e => { e.stopPropagation(); window.location.href = '/signup'; }}
              >
                Get Started Free →
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PromoVideo;