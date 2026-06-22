import React, { useState } from 'react';
import { useGroups, useCreateGroup, useJoinGroup, useLeaveGroup } from '../../hooks/queries/useAuthQueries';
import useAuthStore from '../../store/zustand/useAuthStore';
import { Dialog } from 'primereact/dialog';
import toast from 'react-hot-toast';
import SkeletonCommunities from './ui/SkeletonCommunities';
import AccountabilityDashboard from './AccountabilityDashboard';

const Groups = () => {
    const user = useAuthStore(s => s.user);
    const { data: groups, isLoading } = useGroups();
    const createGroupMutation = useCreateGroup();
    const joinMutation = useJoinGroup();
    const leaveMutation = useLeaveGroup();

    const [showCreate, setShowCreate] = useState(false);
    const [newGroup, setNewGroup] = useState({
        name: '',
        description: '',
        isPrivate: false,
        isAccountabilityCircle: false,
        maxMembers: 10
    });
    const [search, setSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);

    const handleCreate = async () => {
        if (!newGroup.name.trim()) return toast.error('Group name is required');
        if (newGroup.isAccountabilityCircle && (newGroup.maxMembers < 5 || newGroup.maxMembers > 10)) {
            return toast.error('Accountability Circle limit must be between 5 and 10 members');
        }
        if (navigator.vibrate) navigator.vibrate(20);
        try {
            await createGroupMutation.mutateAsync(newGroup);
            toast.success(newGroup.isAccountabilityCircle ? 'Accountability Circle created!' : 'Group created!');
            setShowCreate(false);
            setNewGroup({
                name: '',
                description: '',
                isPrivate: false,
                isAccountabilityCircle: false,
                maxMembers: 10
            });
        } catch { toast.error('Failed to create group'); }
    };

    const handleJoin = async (e, groupId) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(10);
        try {
            await joinMutation.mutateAsync({ groupId });
            toast.success('Joined group!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to join');
        }
    };

    const handleLeave = async (e, groupId) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(5);
        try {
            await leaveMutation.mutateAsync({ groupId });
            toast.success('Left group');
            if (selectedGroup?._id === groupId) {
                setSelectedGroup(null);
            }
        } catch { toast.error('Failed to leave'); }
    };

    if (isLoading) return <SkeletonCommunities />;

    const filteredGroups = groups?.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description.toLowerCase().includes(search.toLowerCase())
    );

    const myGroups = filteredGroups?.filter(g => g.members.some(m => (m._id || m) === user?._id));
    const otherGroups = filteredGroups?.filter(g => !g.members.some(m => (m._id || m) === user?._id));

    return (
        <div className="flex flex-col gap-6 p-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-[var(--text-main)] m-0">Communities</h2>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-[#808bf5] text-white px-4 py-2 rounded-2xl text-xs font-bold border-0 cursor-pointer hover:opacity-90 transition shadow-lg shadow-indigo-200/20"
                >
                    + Create Community
                </button>
            </div>

            <div className="relative">
                <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" />
                <input
                    type="text"
                    placeholder="Search communities..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-[var(--surface-2)] border-0 rounded-2xl py-3 pl-11 pr-4 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-[#808bf5]/20 transition"
                />
            </div>

            {myGroups?.length > 0 && (
                <section>
                    <h3 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-widest mb-3 px-1">My Communities</h3>
                    <div className="grid grid-cols-1 gap-3">
                        {myGroups.map(group => (
                            <GroupItem
                                key={group._id}
                                group={group}
                                onLeave={(e) => handleLeave(e, group._id)}
                                onClick={() => setSelectedGroup(group)}
                                isMember
                            />
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-widest mb-3 px-1">Discover Communities</h3>
                <div className="grid grid-cols-1 gap-3">
                    {otherGroups?.map(group => (
                        <GroupItem
                            key={group._id}
                            group={group}
                            onJoin={(e) => handleJoin(e, group._id)}
                            onClick={() => setSelectedGroup(group)}
                        />
                    ))}
                    {otherGroups?.length === 0 && (
                        <div className="text-center py-10 flex flex-col items-center gap-3">
                            <p className="text-sm text-[var(--text-sub)] m-0">
                                {myGroups?.length > 0
                                    ? "You've joined all available communities."
                                    : "No communities found to join."
                                }
                            </p>
                            <button
                                onClick={() => setShowCreate(true)}
                                className="bg-transparent border-2 border-[#808bf5]/30 text-[#808bf5] px-6 py-2.5 rounded-2xl text-xs font-bold cursor-pointer hover:bg-[#808bf5]/10 transition"
                            >
                                {myGroups?.length > 0 ? "Create a new community" : "Create your first community"}
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Create Group Dialog */}
            <Dialog
                header={"Create Community"}
                visible={showCreate}
                onHide={() => setShowCreate(false)}
                style={{ width: '95vw', maxWidth: '420px', borderRadius: '32px' }}
                className="dark:bg-[var(--surface-1)]"
            >
                <div className="py-4 px-3 flex flex-col gap-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-[var(--text-sub)] px-1 uppercase tracking-wider">Community Name</label>
                            <input
                                type="text"
                                value={newGroup.name}
                                onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))}
                                placeholder="Enter community name..."
                                className="bg-[var(--surface-2)] border-2 border-transparent focus:border-[#808bf5] rounded-2xl px-4 py-3 text-sm text-[var(--text-main)] outline-none transition"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-[var(--text-sub)] px-1 uppercase tracking-wider">Description</label>
                            <textarea
                                value={newGroup.description}
                                onChange={e => setNewGroup(p => ({ ...p, description: e.target.value }))}
                                placeholder="What is this community about?"
                                rows={3}
                                className="bg-[var(--surface-2)] border-2 border-transparent focus:border-[#808bf5] rounded-2xl px-4 py-3 text-sm text-[var(--text-main)] outline-none transition resize-none"
                            />
                        </div>

                        {/* Accountability Circle Toggle */}
                        <div className="bg-[var(--surface-2)] p-4 rounded-2xl flex flex-col gap-3 border border-[var(--border-color)]">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-[var(--text-main)]">Accountability Circle</span>
                                    <span className="text-[10px] text-[var(--text-sub)]">Private, 5-10 members weekly goals</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={newGroup.isAccountabilityCircle}
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setNewGroup(p => ({
                                            ...p,
                                            isAccountabilityCircle: checked,
                                            isPrivate: checked ? true : p.isPrivate
                                        }));
                                    }}
                                    className="w-4 h-4 accent-[#808bf5]"
                                />
                            </div>

                            {newGroup.isAccountabilityCircle && (
                                <div className="flex flex-col gap-1.5 mt-1 border-t border-[var(--border-color)]/50 pt-2">
                                    <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-wider">
                                        Member Cap: {newGroup.maxMembers}
                                    </label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="10"
                                        value={newGroup.maxMembers}
                                        onChange={e => setNewGroup(p => ({ ...p, maxMembers: parseInt(e.target.value) }))}
                                        className="w-full accent-[#808bf5]"
                                    />
                                    <span className="text-[9px] text-[var(--text-sub)] opacity-75">
                                        Circles must be limited to 5–10 peers.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Standard Private Toggle (hidden/disabled if Accountability Circle is true) */}
                        {!newGroup.isAccountabilityCircle && (
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-bold text-[var(--text-main)]">Private Community</span>
                                <input
                                    type="checkbox"
                                    checked={newGroup.isPrivate}
                                    onChange={e => setNewGroup(p => ({ ...p, isPrivate: e.target.checked }))}
                                    className="w-4 h-4 accent-[#808bf5]"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleCreate}
                        className="w-full bg-[#808bf5] text-white py-2.5 rounded-3xl font-black cursor-pointer hover:opacity-95 transition mt-2 border-0"
                    >
                        Create Community
                    </button>
                </div>
            </Dialog>

            {/* Group Detail View / Accountability Dashboard Dialog */}
            <Dialog
                header={selectedGroup?.isAccountabilityCircle ? "🎯 Accountability Circle" : "👥 Community Detail"}
                visible={!!selectedGroup}
                onHide={() => setSelectedGroup(null)}
                style={{ width: '95vw', maxWidth: '640px', borderRadius: '32px' }}
                className="dark:bg-[var(--surface-1)]"
            >
                {selectedGroup && (
                    selectedGroup.isAccountabilityCircle ? (
                        <AccountabilityDashboard group={selectedGroup} onClose={() => setSelectedGroup(null)} />
                    ) : (
                        <div className="py-4 px-3 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-[var(--surface-3)] rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl shadow-inner">
                                    {selectedGroup.cover_picture ? <img src={selectedGroup.cover_picture} alt="" className="w-full h-full object-cover rounded-2xl" /> : '👥'}
                                </div>
                                <div>
                                    <h3 className="m-0 text-lg font-black text-[var(--text-main)]">{selectedGroup.name}</h3>
                                    <p className="m-0 text-xs text-[var(--text-sub)] mt-1">{selectedGroup.description || 'No description provided.'}</p>
                                </div>
                            </div>
                            <div className="bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--border-color)]">
                                <h4 className="m-0 text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-2">Members ({selectedGroup.members?.length || 0})</h4>
                                <div className="flex flex-wrap gap-2">
                                    {selectedGroup.members?.map(m => (
                                        <div key={m._id || m} className="flex items-center gap-1.5 bg-[var(--surface-1)] border border-[var(--border-color)] px-2.5 py-1 rounded-full text-xs font-medium text-[var(--text-main)]">
                                            <img
                                                src={m.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'}
                                                alt=""
                                                className="w-4 h-4 rounded-full object-cover"
                                            />
                                            {m.fullname || 'Member'}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                )}
            </Dialog>
        </div>
    );
};

const GroupItem = ({ group, onJoin, onLeave, onClick, isMember }) => {
    const isCapped = group.isAccountabilityCircle && group.members?.length >= (group.maxMembers || 10);
    
    return (
        <div
            onClick={isMember ? onClick : undefined}
            className={`bg-[var(--surface-2)] border border-[var(--border-color)] rounded-3xl p-4 flex items-center gap-4 hover:shadow-lg transition-all duration-300 group ${isMember ? 'cursor-pointer' : ''}`}
        >
            <div className="w-14 h-14 bg-[var(--surface-3)] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-inner">
                {group.cover_picture ? <img src={group.cover_picture} alt="" className="w-full h-full object-cover rounded-2xl" /> : (group.isAccountabilityCircle ? '🎯' : '👥')}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="m-0 text-sm font-bold text-[var(--text-main)] truncate">{group.name}</h4>
                    {group.isAccountabilityCircle && (
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Circle
                        </span>
                    )}
                </div>
                <p className="m-0 text-[11px] text-[var(--text-sub)] truncate mb-1 opacity-80">{group.description || 'No description provided.'}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#808bf5] bg-[#808bf5]/10 px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-sm">
                        {group.members?.length || 0} Members
                        {group.isAccountabilityCircle && ` / Max ${group.maxMembers || 10}`}
                    </span>
                    {group.isPrivate && <i className="pi pi-lock text-[10px] text-amber-500" />}
                </div>
            </div>
            {isMember ? (
                <button
                    onClick={onLeave}
                    className="flex-shrink-0 px-5 py-2 rounded-xl text-[10px] font-bold border-0 cursor-pointer transition shadow-sm bg-red-500/10 text-red-500 hover:bg-red-500/20"
                >
                    Leave
                </button>
            ) : (
                <button
                    onClick={onJoin}
                    disabled={isCapped}
                    className={`flex-shrink-0 px-5 py-2 rounded-xl text-[10px] font-bold border-0 cursor-pointer transition shadow-sm ${isCapped ? 'bg-[var(--surface-3)] text-[var(--text-sub)] cursor-not-allowed opacity-60' : 'bg-[#808bf5] text-white hover:opacity-90 active:scale-95'}`}
                >
                    {isCapped ? 'Full' : 'Join'}
                </button>
            )}
        </div>
    );
};

export default Groups;
