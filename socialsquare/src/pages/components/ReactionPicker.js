import React from 'react';

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '🔥', '🙌', '💯'];

const ReactionPicker = ({ onSelect, onClose }) => {
    return (
        <div 
            className="absolute bottom-full mb-[-8px]  left-0 z-[100] bg-[var(--surface-1)] border border-[var(--border-color)] rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex gap-1 p-1.5 items-center animate-in fade-in slide-in-from-bottom-2 duration-300 backdrop-blur-md bg-opacity-90"
            onMouseLeave={onClose}
        >
            {EMOJIS.map(emoji => (
                <button
                    key={emoji}
                    onClick={(e) => { 
                        e.stopPropagation();
                        onSelect(emoji); 
                        if (onClose) onClose(); 
                    }}
                    className="w-9 h-9 flex items-center justify-center text-xl hover:scale-135 transition-transform cursor-pointer border-0 bg-transparent rounded-full hover:bg-[var(--surface-2)] active:scale-95"
                    title={emoji}
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
};

export default ReactionPicker;
