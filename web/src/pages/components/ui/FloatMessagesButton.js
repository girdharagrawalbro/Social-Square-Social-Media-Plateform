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
        <Link
            to="/conversations"
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/95 dark:bg-[#18181b]/95 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-800 dark:text-white font-bold shadow-2xl border border-gray-200 dark:border-neutral-800 transition-all active:scale-95 duration-200"
            style={{
                boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                minWidth: '150px'
            }}
        >
            {/* Direct Message / Send Icon */}
            <svg
                width="20"
                height="20"
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

            <span className="text-[15px] tracking-wide">Messages</span>

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
    );
}
