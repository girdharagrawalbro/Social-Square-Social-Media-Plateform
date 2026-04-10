import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Dialog } from 'primereact/dialog';
import toast from 'react-hot-toast';

const VIDEO_POOL = [
  { id: 1, url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-1282-large.mp4', title: 'Neon Vibez', creator: 'Mixkit' },
  { id: 2, url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4', title: 'Nature Bloom', creator: 'Mixkit' },
  { id: 3, url: 'https://assets.mixkit.co/videos/preview/mixkit-glacier-ice-melting-1335-large.mp4', title: 'Arctic Flow', creator: 'Mixkit' },
  { id: 4, url: 'https://assets.mixkit.co/videos/preview/mixkit-mother-with-her-son-in-the-park-4022-large.mp4', title: 'Park Days', creator: 'Mixkit' },
  { id: 5, url: 'https://assets.mixkit.co/videos/preview/mixkit-city-at-night-with-car-traffic-lights-4424-large.mp4', title: 'City Motion', creator: 'Mixkit' },
  { id: 6, url: 'https://assets.mixkit.co/videos/preview/mixkit-portrait-of-a-woman-in-a-field-of-flowers-1172-large.mp4', title: 'Golden Hour', creator: 'Mixkit' },
  { id: 7, url: 'https://assets.mixkit.co/videos/preview/mixkit-ink-in-water-underwater-shot-1262-large.mp4', title: 'Ink Flow', creator: 'Mixkit' },
  { id: 8, url: 'https://assets.mixkit.co/videos/preview/mixkit-serving-fresh-orange-juice-4357-large.mp4', title: 'Sunday Sips', creator: 'Mixkit' },
  { id: 9, url: 'https://www.w3schools.com/html/mov_bbb.mp4', title: 'Classic Bunny', creator: 'OpenSource' },
];

const VideoCard = React.memo(({ vid, onClick, isPlaying, onVisible }) => {
  const videoRef = useRef(null);
  const { ref, inView } = useInView({ 
    threshold: 0.2, // Trigger earlier to start loading
    rootMargin: '100px 0px' 
  });

  useEffect(() => {
    if (inView) {
      onVisible(vid.id);
    }
  }, [inView, vid.id, onVisible]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div
      ref={ref}
      onMouseEnter={() => onVisible(vid.id)}
      className="relative rounded-2xl overflow-hidden bg-[#121212] cursor-pointer group transition-transform active:scale-95"
      style={{ aspectRatio: '9/16' }}
      onClick={onClick}
    >
      <video
        ref={videoRef}
        src={vid.url}
        muted
        loop
        playsInline
        preload="auto"
        className={`w-full h-full object-cover transition-all duration-1000 ${isPlaying ? 'grayscale-0 scale-105 opacity-100' : 'grayscale opacity-60 scale-100'}`}
      />
      
      {/* Dynamic Overlay Info */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute bottom-4 left-4 right-4 transform translate-y-0 transition-transform duration-500">
            <span className="text-[10px] uppercase font-bold text-[#808bf5] tracking-widest">{vid.creator}</span>
            <p className="m-0 text-white font-bold text-sm truncate mt-1">{vid.title}</p>
        </div>
      </div>

      {/* Play Indicator for Inactive */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <i className="pi pi-play text-white text-xl ml-1"></i>
            </div>
        </div>
      )}

      {/* Loading Shimmer (optional but good for 'no data' feel) */}
      <div className="absolute top-4 right-4">
          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`}></div>
      </div>
    </div>
  );
});

const Explore = () => {
  const [videos, setVideos] = useState([]);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [heartVisible, setHeartVisible] = useState(false);
  const lastTap = useRef(0);

  useEffect(() => {
    const shuffled = [...VIDEO_POOL].sort(() => Math.random() - 0.5);
    setVideos(shuffled);
    if (shuffled.length > 0) setCurrentlyPlayingId(shuffled[0].id);
  }, []);

  const handleVisible = React.useCallback((id) => {
    setCurrentlyPlayingId(id);
  }, []);

  const handleDoubleClick = () => {
    setHeartVisible(true);
    toast.success('Added to Liked Videos!');
    setTimeout(() => setHeartVisible(false), 800);
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) handleDoubleClick();
    lastTap.current = now;
  };

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 px-2 sm:px-4 py-4 bg-[var(--surface-1)] border-b border-[var(--border-color)] mb-6">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="m-0 text-xl font-pacifico text-[var(--theme-start)]">Explore</h2>
          <button
            onClick={() => {
                const shuffled = [...videos].sort(() => Math.random() - 0.5);
                setVideos(shuffled);
                if (shuffled.length > 0) setCurrentlyPlayingId(shuffled[0].id);
            }}
            className="bg-[var(--surface-2)] p-2 rounded-full text-xs font-bold text-[var(--text-sub)] cursor-pointer hover:bg-[var(--surface-1)] transition flex items-center justify-center gap-2"
          >
            <i className="pi pi-refresh"></i>
          </button>
        </div>
      </div>

      <div className="px-2 sm:px-4 pb-8 text-center">
        <div className="grid grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto gap-2 sm:gap-4">
          {videos.map((vid, idx) => (
            <VideoCard 
              key={vid.id} 
              vid={vid} 
              isPlaying={currentlyPlayingId === vid.id}
              onVisible={handleVisible}
              onClick={() => { setActiveIndex(idx); setVisible(true); }} 
            />
          ))}
        </div>
      </div>

      {/* REEL STYLE MODAL */}
      <Dialog
        visible={visible}
        onHide={() => setVisible(false)}
        style={{ width: '100vw', height: '100vh', maxWidth: '100vw', margin: 0, padding: 0 }}
        modal
        showHeader={false}
        className="explore-reels-dialog"
      >
        <div className="w-full h-full bg-black relative flex flex-col items-center justify-center overflow-hidden">
          {/* Close button */}
          <button
            onClick={() => setVisible(false)}
            className="absolute top-6 left-6 z-50 text-white bg-white/20 hover:bg-white/40 w-10 h-10 rounded-full border-0 cursor-pointer flex items-center justify-center backdrop-blur-md"
          >
            <i className="pi pi-arrow-left"></i>
          </button>

          {/* Mute toggle */}
          <button
            onClick={() => setMuted(!muted)}
            className="absolute top-6 right-6 z-50 text-white bg-white/20 hover:bg-white/40 w-10 h-10 rounded-full border-0 cursor-pointer flex items-center justify-center backdrop-blur-md"
          >
            <i className={`pi ${muted ? 'pi-volume-off' : 'pi-volume-up'}`}></i>
          </button>

          {/* Reels Container */}
          <div className="w-full h-full flex items-center justify-center relative">
            <video
              src={videos[activeIndex]?.url}
              autoPlay
              loop
              playsInline
              muted={muted}
              onDoubleClick={handleDoubleClick}
              onTouchEnd={handleTap}
              className="h-full w-auto max-w-full object-contain cursor-pointer"
            />

            {/* Overlay Actions */}
            <div className="absolute bottom-10 right-4 flex flex-col gap-6 items-center text-white z-40">
              <div className="flex flex-col items-center gap-1">
                <button className="bg-transparent border-0 text-white text-2xl p-0 cursor-pointer hover:scale-110 transition" onClick={handleDoubleClick}><i className="pi pi-heart-fill text-red-500"></i></button>
                <span className="text-[10px] font-bold">Liked</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button className="bg-transparent border-0 text-white text-2xl p-0 cursor-pointer hover:scale-110 transition"><i className="pi pi-comment"></i></button>
                <span className="text-[10px] font-bold">Share</span>
              </div>
            </div>

            {/* Bottom Details */}
            <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 z-40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-500 p-0.5">
                  <div className="w-full h-full bg-black rounded-full flex items-center justify-center text-xs font-bold text-white uppercase italic">{videos[activeIndex]?.creator?.[0]}</div>
                </div>
                <div>
                  <p className="m-0 text-white font-bold text-sm">@{videos[activeIndex]?.creator.toLowerCase()}</p>
                  <p className="m-0 text-white/70 text-[10px] uppercase font-bold tracking-widest leading-none mt-1">Suggested for you</p>
                </div>
              </div>
              <p className="m-0 text-white text-sm mt-2">{videos[activeIndex]?.title} #explore #reels #trending</p>
            </div>

            {/* Navigation Buttons for PC */}
            <button
              onClick={() => setActiveIndex(prev => (prev > 0 ? prev - 1 : videos.length - 1))}
              className="hidden md:flex absolute top-1/2 left-10 -translate-y-1/2 bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full border-0 cursor-pointer items-center justify-center text-white text-xl backdrop-blur-sm z-50 transition"
            >
              <i className="pi pi-chevron-left"></i>
            </button>
            <button
              onClick={() => setActiveIndex(prev => (prev < videos.length - 1 ? prev + 1 : 0))}
              className="hidden md:flex absolute top-1/2 right-40 -translate-y-1/2 bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full border-0 cursor-pointer items-center justify-center text-white text-xl backdrop-blur-sm z-50 transition"
            >
              <i className="pi pi-chevron-right"></i>
            </button>

            {/* Heart Burst Animation */}
            {heartVisible && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none animate-heartBurst opacity-0">
                <i className="pi pi-heart-fill text-9xl text-red-500" style={{ filter: 'drop-shadow(0 0 20px rgba(239,68,68,0.6))' }}></i>
              </div>
            )}
          </div>
        </div>

        <style>{`
            .explore-reels-dialog .p-dialog-content {
                padding: 0 !important;
                background: #000;
                overflow: hidden;
            }
            @keyframes reelHeartBurst {
                0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
                50% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
            }
            .animate-heartBurst {
                animation: reelHeartBurst 0.8s cubic-bezier(0.17, 0.89, 0.32, 1.49) forwards;
            }
        `}</style>
      </Dialog>
    </div>
  );
};

export default Explore;
