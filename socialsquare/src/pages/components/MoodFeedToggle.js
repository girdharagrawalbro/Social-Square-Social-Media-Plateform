import React from 'react';

const MOODS = [
    { key: 'happy', emoji: '😊', label: 'Happy' },
    { key: 'excited', emoji: '🤩', label: 'Excited' },
    { key: 'funny', emoji: '😂', label: 'Funny' },
    { key: 'romantic', emoji: '❤️', label: 'Romantic' },
    { key: 'inspirational', emoji: '💪', label: 'Inspire' },
    { key: 'calm', emoji: '😌', label: 'Calm' },
    { key: 'nostalgic', emoji: '🥹', label: 'Nostalgia' },
    { key: 'sad', emoji: '😢', label: 'Sad' },
];

const MoodFeedToggle = ({ onMoodSelect, activeMood, onClear }) => {
    return (
        <div className="flex flex-col gap-2.5 mb-6 animate-in fade-in slide-in-from-top-3 duration-500">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 rotate-3">
                        <i className="pi pi-sparkles text-[10px]"></i>
                    </div>
                    <span className="text-[13px] font-black text-[var(--text-main)] tracking-tight">VIBE CHECK</span>
                </div>
                {activeMood && (
                    <button
                        onClick={onClear}
                        className="text-[9px] font-black text-indigo-500 bg-indigo-500/10 px-3 py-1.5 rounded-full border-0 cursor-pointer hover:bg-indigo-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <i className="pi pi-refresh text-[8px]"></i>
                        RESET
                    </button>
                )}
            </div>

            <div className="relative group">
                {/* Horizontal scroll container with fade effect */}
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1 px-0.5 mask-fade-edges">
                    {MOODS.map(mood => {
                        const isActive = activeMood === mood.key;
                        return (
                            <button
                                key={mood.key}
                                onClick={() => isActive ? onClear() : onMoodSelect(mood.key)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border-0 cursor-pointer transition-all duration-300 whitespace-nowrap active:scale-90 flex-shrink-0 shadow-sm ${isActive
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-500/30 scale-[1.05] z-10'
                                    : 'bg-[var(--surface-2)] text-[var(--text-main)] hover:bg-[var(--surface-1)] border border-[var(--border-color)] hover:border-indigo-500/30'
                                    }`}
                            >
                                <span className={`text-base transition-transform duration-300 ${isActive ? 'scale-125' : 'group-hover:scale-110'}`}>{mood.emoji}</span>
                                <span className={`text-[11px] font-bold tracking-tight ${isActive ? 'text-white' : 'text-[var(--text-sub)]'}`}>{mood.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <style>{`
                .mask-fade-edges {
                    mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default MoodFeedToggle;
