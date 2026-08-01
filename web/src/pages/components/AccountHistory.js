import React, { useState, useEffect } from 'react';
import { api } from '../../store/zustand/useAuthStore';
import toast from '../../utils/toast';

const AccountHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.get('/api/auth/account-history');
                setHistory(Array.isArray(res.data) ? res.data : []);
            } catch (error) {
                console.error('Failed to fetch account history', error);
                toast.error('Failed to load account history');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const getIconForAction = (action) => {
        switch (action) {
            case 'LOGIN': return { icon: 'pi-sign-in', color: 'text-blue-500', bg: 'bg-blue-100' };
            case 'PASSWORD_CHANGED': return { icon: 'pi-key', color: 'text-orange-500', bg: 'bg-orange-100' };
            case 'PASSWORD_RESET': return { icon: 'pi-unlock', color: 'text-red-500', bg: 'bg-red-100' };
            case '2FA_TOGGLED': return { icon: 'pi-shield', color: 'text-indigo-500', bg: 'bg-indigo-100' };
            case 'PROFILE_UPDATED': return { icon: 'pi-user-edit', color: 'text-emerald-500', bg: 'bg-emerald-100' };
            default: return { icon: 'pi-info-circle', color: 'text-gray-500', bg: 'bg-gray-100' };
        }
    };

    const formatActionName = (action) => {
        if (!action) return 'Unknown Action';
        return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 m-0 pb-2 border-b border-gray-100">Account History</h2>
            <p className="text-xs text-gray-500 mt-1 mb-6">A record of important security events and updates to your account.</p>

            {history.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
                    <i className="pi pi-history text-4xl text-gray-300 mb-3 block"></i>
                    <p className="text-sm text-gray-500 font-semibold m-0">No history found</p>
                </div>
            ) : (
                <div className="relative border-l-2 border-gray-100 ml-4 space-y-6 pb-4">
                    {history.map((item, index) => {
                        const style = getIconForAction(item.action);
                        return (
                            <div key={item._id || index} className="relative pl-8">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white ${style.bg} flex items-center justify-center`}>
                                    <i className={`pi ${style.icon} ${style.color} text-xs`}></i>
                                </div>
                                
                                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <h3 className="text-sm font-bold text-gray-900 m-0">{formatActionName(item.action)}</h3>
                                        <span className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">
                                            {new Date(item.createdAt).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600 m-0 leading-relaxed">{item.details}</p>
                                    {item.ipAddress && (
                                        <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-gray-400 bg-gray-50 inline-block px-2 py-1 rounded">
                                            <i className="pi pi-globe text-[9px]"></i> {item.ipAddress}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AccountHistory;
