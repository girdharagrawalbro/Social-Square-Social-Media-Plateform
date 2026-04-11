import React, { useState } from 'react';
import { useGroups, useCreateGroup, useJoinGroup, useLeaveGroup } from '../../hooks/queries/useAuthQueries';
import useAuthStore from '../../store/zustand/useAuthStore';
import { Dialog } from 'primereact/dialog';
import toast from 'react-hot-toast';

const Groups = () => {
    const user = useAuthStore(s => s.user);
    const { data: groups, isLoading } = useGroups();
    const createGroupMutation = useCreateGroup();
    const joinMutation = useJoinGroup();
    const leaveMutation = useLeaveGroup();

    const [showCreate, setShowCreate] = useState(false);
    const [newGroup, setNewGroup] = useState({ name: '', description: '', isPrivate: false });
    const [search, setSearch] = useState('');

    const handleCreate = async () => {
        if (!newGroup.name.trim()) return toast.error('Group name is required');
        if (navigator.vibrate) navigator.vibrate(20);
        try {
            await createGroupMutation.mutateAsync(newGroup);
            toast.success('Group created!');
            setShowCreate(false);
            setNewGroup({ name: '', description: '', isPrivate: false });
        } catch { toast.error('Failed to create group'); }
    };

    const handleJoin = async (groupId) => {
        if (navigator.vibrate) navigator.vibrate(10);
        try {
            await joinMutation.mutateAsync({ groupId });
            toast.success('Joined group!');
        } catch { toast.error('Failed to join'); }
    };

    const handleLeave = async (groupId) => {
        if (navigator.vibrate) navigator.vibrate(5);
        try {
            await leaveMutation.mutateAsync({ groupId });
            toast.success('Left group');
        } catch { toast.error('Failed to leave'); }
    };

    if (isLoading) return <div className="p-4 flex flex-col gap-4 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[var(--surface-2)] rounded-3xl" />)}
    </div>;

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
                            <GroupItem key={group._id} group={group} onLeave={() => handleLeave(group._id)} isMember />
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-widest mb-3 px-1">Discover Communities</h3>
                <div className="grid grid-cols-1 gap-3">
                    {otherGroups?.map(group => (
                        <GroupItem key={group._id} group={group} onJoin={() => handleJoin(group._id)} />
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
                    </div>

                    <button
                        onClick={handleCreate}
                        className="w-full bg-[#808bf5] text-white py-2 rounded-3xl font-black cursor-pointer hover:opacity-95 transition"
                    >
                        Create Community
                    </button>
                </div>
            </Dialog>
        </div>
    );
};

const GroupItem = ({ group, onJoin, onLeave, isMember }) => {
    return (
        <div className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-3xl p-4 flex items-center gap-4 hover:shadow-lg transition-all duration-300 group">
            <div className="w-14 h-14 bg-[var(--surface-3)] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-inner">
                {group.cover_picture ? <img src={group.cover_picture} alt="" className="w-full h-full object-cover rounded-2xl" /> : '👥'}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="m-0 text-sm font-bold text-[var(--text-main)] truncate">{group.name}</h4>
                <p className="m-0 text-[11px] text-[var(--text-sub)] truncate mb-1 opacity-80">{group.description || 'No description provided.'}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#808bf5] bg-[#808bf5]/10 px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-sm">{group.members?.length || 0} Members</span>
                    {group.isPrivate && <i className="pi pi-lock text-[10px] text-amber-500" />}
                </div>
            </div>
            <button
                onClick={isMember ? onLeave : onJoin}
                className={`flex-shrink-0 px-5 py-2 rounded-xl text-[10px] font-bold border-0 cursor-pointer transition shadow-sm ${isMember ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-[#808bf5] text-white hover:opacity-90 active:scale-95'}`}
            >
                {isMember ? 'Leave' : 'Join'}
            </button>
        </div>
    );
};

export default Groups;
