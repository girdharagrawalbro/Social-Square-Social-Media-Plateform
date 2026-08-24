import React from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../../store/zustand/useAuthStore';
import { useConversations } from '../../../hooks/queries/useConversationQueries';
import { USER_DEFAULT_IMAGE } from '../../../utils/constantMediaVariable';

export default function FloatMessagesButton() {
    const user = useAuthStore(s => s.user);
    const { data: convoData } = useConversations(user?._id);

    // Extract the latest 3 active conversation avatars
    const avatars = React.useMemo(() => {
        if (!convoData?.pages) return [];
        const convs = convoData.pages.flatMap(page => page.conversations || []);

        return convs
            .map(c => {
                if (c.isGroup) {
                    return c.groupAvatar || USER_DEFAULT_IMAGE;
                }
                const other = c.participants?.find(p => p.userId?.toString() !== user?._id?.toString());
                return other?.profilePicture || USER_DEFAULT_IMAGE;
            })
            .slice(0, 3);
    }, [convoData, user?._id]);

    if (!user) return null;

    return (
        <div className="hidden md:block fixed bottom-6 right-[88px] z-[990] select-none">
            <Link
                to="/conversations"
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md hover:bg-white dark:hover:bg-neutral-800 text-gray-800 dark:text-white font-bold shadow-xl hover:shadow-2xl border border-gray-200/80 dark:border-neutral-700/80 transition-all hover:scale-[1.02] active:scale-95 duration-200"
                style={{
                    boxShadow: '0 10px 30px -5px rgba(0,0,0,0.18)',
                    minWidth: '140px'
                }}
            >
                {/* Direct Message / Send Icon */}
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transform -rotate-12"
                >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>

                <span className="text-[14px] tracking-wide font-semibold">Messages</span>

                {avatars.length > 0 && (
                    <div className="flex items-center -space-x-2 ml-1 shrink-0">
                        {avatars.map((url, index) => (
                            <img
                                key={index}
                                src={url}
                                alt=""
                                className="w-[24px] h-[24px] rounded-full border-2 border-white dark:border-[#18181b] object-cover shadow-md"
                                style={{ zIndex: 3 - index }}
                            />
                        ))}
                    </div>
                )}
            </Link>
        </div>
    );
}
