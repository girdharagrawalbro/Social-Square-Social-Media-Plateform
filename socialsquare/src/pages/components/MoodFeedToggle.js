import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMoodFeed } from '../../store/slices/postsSlice';

const MOODS = [
    { key: 'happy',         emoji: '😊', label: 'Happy' },
    { key: 'excited',       emoji: '🤩', label: 'Excited' },
    { key: 'funny',         emoji: '😂', label: 'Funny' },
    { key: 'romantic',      emoji: '❤️', label: 'Romantic' },
    { key: 'inspirational', emoji: '💪', label: 'Inspire' },
    { key: 'calm',          emoji: '😌', label: 'Calm' },
    { key: 'nostalgic',     emoji: '🥹', label: 'Nostalgia' },
    { key: 'sad',           emoji: '😢', label: 'Sad' },
];

const MoodFeedToggle = ({ onMoodSelect, activeMood, onClear }) => {
    const [expanded, setExpanded] = useState(false);
    const { loading } = useSelector(state => state.posts);
    const { loggeduser } = useSelector(state => state.users);
    const dispatch = useDispatch();

    const handleMoodClick = (moodKey) => {
        if (activeMood === moodKey) { onClear(); return; }
        if (!loggeduser?._id) return;
        dispatch(fetchMoodFeed({ mood: moodKey, userId: loggeduser._id }));
        onMoodSelect(moodKey);
    };

    const activeMoodData = MOODS.find(m => m.key === activeMood);

    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '12px 14px', marginBottom: '8px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>✨</span>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                        {activeMoodData
                            ? <>{activeMoodData.emoji} Showing <span style={{ color: '#808bf5' }}>{activeMoodData.label}</span> posts</>
                            : 'Mood-based feed'
                        }
                    </p>
                    {loading.moodFeed && (
                        <div style={{ width: 14, height: 14, border: '2px solid #e5e7eb', borderTopColor: '#808bf5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeMood && (
                        <button onClick={onClear}
                            style={{ fontSize: '11px', color: '#6b7280', background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                            ✕ Clear
                        </button>
                    )}
                    <button onClick={() => setExpanded(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        {expanded ? 'Hide' : 'Pick mood'} <span>{expanded ? '▲' : '▼'}</span>
                    </button>
                </div>
            </div>

            {/* Mood pills */}
            {expanded && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {MOODS.map(mood => (
                        <button key={mood.key} onClick={() => handleMoodClick(mood.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '6px 12px', borderRadius: '20px', border: 'none',
                                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                transition: 'all 0.15s',
                                background: activeMood === mood.key ? '#808bf5' : '#f3f4f6',
                                color: activeMood === mood.key ? '#fff' : '#374151',
                                transform: activeMood === mood.key ? 'scale(1.05)' : 'scale(1)',
                            }}>
                            <span style={{ fontSize: '14px' }}>{mood.emoji}</span>
                            {mood.label}
                        </button>
                    ))}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default MoodFeedToggle;