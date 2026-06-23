import React, { useEffect } from 'react';

const REACTIONS = [
    { emoji: '💡', label: 'Learned' },
    { emoji: '🤝', label: 'Respect' },
    { emoji: '🚀', label: 'Tried' },
    { emoji: '🔖', label: 'Saved' }
];

const ReactionPicker = ({ onSelect, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-label="Reaction picker"
            className="absolute bottom-5 left-0 z-[100] bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.25)] flex gap-1 p-1 items-center animate-in fade-in slide-in-from-bottom-2 duration-200 backdrop-blur-md bg-opacity-95"
            onMouseLeave={onClose}
        >
            {REACTIONS.map(({ emoji, label }) => (
                <button
                    key={emoji}
                    aria-label={`React with ${label}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(emoji);
                        if (onClose) onClose();
                    }}
                    className="flex flex-col items-center w-full justify-center p-1 rounded-xl hover:bg-[var(--surface-2)] active:scale-95 transition-all border-0 bg-transparent cursor-pointer group"
                    title={label}
                >
                    <span className="text-xl group-hover:scale-125 transition-transform">{emoji}</span>
                    <span className="text-[8px] font-bold text-[var(--text-sub)] mt-0.5">{label}</span>
                </button>
            ))}
        </div>
    );
};

export default ReactionPicker;
