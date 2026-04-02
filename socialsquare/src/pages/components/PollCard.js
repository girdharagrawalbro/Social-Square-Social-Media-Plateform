import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useVotePoll } from '../../hooks/queries/usePostQueries';
import toast from 'react-hot-toast';

const PollCard = ({ poll: initialPoll, postId }) => {
    const user = useAuthStore(s => s.user);
    const voteMutation = useVotePoll();
    const [poll, setPoll] = useState(initialPoll);

    // Sync with initialPoll changes (e.g. from feed update)
    useEffect(() => {
        setPoll(initialPoll);
    }, [initialPoll]);

    if (!poll || !poll.options) return null;

    const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
    const userVotedOptionIndex = poll.options.findIndex(opt => opt.votes?.some(v => (v._id || v) === user?._id));
    const hasVoted = userVotedOptionIndex !== -1;
    const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);

    const handleVote = async (idx) => {
        if (hasVoted || isExpired || voteMutation.isPending) return;
        try {
            await voteMutation.mutateAsync({ postId, optionIndex: idx });
            toast.success(poll.correctOptionIndex !== null ? 'Answer submitted!' : 'Vote recorded!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to vote');
        }
    };

    return (
        <div className="poll-card rounded-2xl py-2 px-4 mt-2">
            {poll.question && (
                <h4 className="text-sm font-bold text-[var(--text-main)] mb-2 leading-relaxed">
                    {poll.question}
                </h4>
            )}

            <div className="flex gap-2">
                {poll.options.map((opt, idx) => {
                    const voteCount = opt.votes?.length || 0;
                    const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const isCorrect = poll.correctOptionIndex === idx;
                    const isUserChoice = userVotedOptionIndex === idx;

                    let bgClass = 'bg-[var(--surface-1)]';
                    let borderClass = 'border-[var(--border-color)]';

                    if (hasVoted) {
                        if (poll.correctOptionIndex !== null) {
                            // Quiz Mode
                            if (isCorrect) {
                                bgClass = 'bg-green-100 dark:bg-green-900/30';
                                borderClass = 'border-green-300 dark:border-green-800';
                            } else if (isUserChoice) {
                                bgClass = 'bg-red-100 dark:bg-red-900/30';
                                borderClass = 'border-red-300 dark:border-red-800';
                            }
                        } else if (isUserChoice) {
                            // Regular Poll Mode
                            bgClass = 'bg-indigo-50 dark:bg-indigo-900/20';
                            borderClass = 'border-[#808bf5]/40';
                        }
                    }

                    return (
                        <button
                            key={idx}
                            disabled={hasVoted || isExpired}
                            onClick={() => handleVote(idx)}
                            className={`relative overflow-hidden w-[50%] text-left py-2 px-3 rounded-xl border transition-all ${borderClass} ${bgClass} ${!hasVoted && !isExpired ? 'hover:border-[#808bf5] cursor-pointer' : 'cursor-default'}`}
                        >
                            {/* Progress bar background */}
                            {hasVoted && (
                                <div 
                                    className="absolute left-0 top-0 bottom-0 bg-[#808bf5]/10 transition-all duration-1000" 
                                    style={{ width: `${percent}%` }}
                                />
                            )}

                            <div className="relative flex justify-between items-center z-10">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[var(--text-main)]">{opt.text}</span>
                                    {hasVoted && isCorrect && <i className="pi pi-check-circle text-green-500 text-xs" />}
                                    {hasVoted && isUserChoice && !isCorrect && poll.correctOptionIndex !== null && <i className="pi pi-times-circle text-red-500 text-xs" />}
                                </div>
                                {hasVoted && (
                                    <span className="text-xs font-bold text-[var(--text-sub)]">{percent}%</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex justify-between items-center mt-4 px-1">
                <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-widest">
                    {totalVotes} {totalVotes === 1 ? 'Vote' : 'Votes'} • {isExpired ? 'Final Results' : 'Active'}
                </span>
                {poll.correctOptionIndex !== null && hasVoted && (
                    <span className={`text-[10px] font-bold uppercase ${userVotedOptionIndex === poll.correctOptionIndex ? 'text-green-500' : 'text-red-500'}`}>
                        {userVotedOptionIndex === poll.correctOptionIndex ? 'Correct!' : 'Incorrect'}
                    </span>
                )}
            </div>
        </div>
    );
};

export default PollCard;
