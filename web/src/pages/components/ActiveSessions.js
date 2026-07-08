import { useEffect, useState, useCallback } from "react";
import toast from '../../utils/toast.js';
import { confirmDialog } from "primereact/confirmdialog";
import { api } from "../../store/zustand/useAuthStore";
import SkeletonSessions from "./ui/SkeletonSessions";

const deviceIcon = (device = "") => {
  const d = device.toLowerCase();
  if (d.includes("mobile") || d.includes("android") || d.includes("iphone"))
    return "📱";
  if (d.includes("tablet") || d.includes("ipad")) return "📟";
  return "💻";
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/auth/sessions");
      setSessions(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Fetch sessions error:", error);
      toast.error("Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get("/api/auth/get");
      setTwoFaEnabled(!!res?.data?.twoFactorEnabled);
    } catch (error) {
      console.error("Fetch user error:", error);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchUser();
  }, [fetchSessions, fetchUser]);

  const revokeSession = async (sessionId, isCurrentSession = false) => {
    if (isCurrentSession) {
      toast.error("You cannot revoke your current active session");
      return;
    }

    try {
      setRevokingSessionId(sessionId);
      await api.delete(`/api/auth/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      toast.success("Session revoked");
    } catch (error) {
      console.error("Revoke session error:", error);
      toast.error("Failed to revoke session");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const toggle2FA = async () => {
    try {
      setToggling2FA(true);
      const res = await api.post("/api/auth/toggle-2fa", {});
      const enabled = !!res?.data?.twoFactorEnabled;
      setTwoFaEnabled(enabled);
      toast.success(`2FA ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("Toggle 2FA error:", error);
      toast.error("Failed to toggle 2FA");
    } finally {
      setToggling2FA(false);
    }
  };

  const revokeAllSessions = () => {
    confirmDialog({
      message:
        "This will log you out from all OTHER devices. Your current session will remain active. Continue?",
      header: "Revoke Other Sessions",
      icon: "pi pi-exclamation-triangle",
      acceptClassName: "p-button-danger",
      accept: async () => {
        try {
          setRevokingAll(true);
          await api.delete("/api/auth/sessions/all/revoke");
          toast.success("Other sessions revoked");
          fetchSessions();
        } catch (error) {
          console.error("Revoke all sessions error:", error);
          toast.error("Failed to revoke other sessions");
        } finally {
          setRevokingAll(false);
        }
      },
    });
  };

  const formatDate = (date) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleString();
  };

  const getLocationText = (location) => {
    if (!location) return "Unknown location";

    const city = location?.city || "Unknown city";
    const country = location?.country || "Unknown country";

    return `${city}, ${country}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="sticky top-0 z-20 p-3 bg-[var(--surface-1)]/80 backdrop-blur-lg border-b border-[var(--border-color)] mb-2">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="m-0 text-2xl font-black text-[var(--text-main)]">
            Active Sessions
          </h2>
        </div>
      </div>

      {/* 2FA Toggle */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 mx-3 flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold m-0">
            Two-Factor Authentication
          </h3>
          <p className="text-xs text-gray-500 mt-1 m-0">
            {twoFaEnabled
              ? "Enabled — OTP sent to your email on every login"
              : "Add an extra layer of security to your account"}
          </p>
        </div>

        <button
          onClick={toggle2FA}
          disabled={toggling2FA}
          className={`px-4 py-2 rounded-lg text-xs font-semibold border-0 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${twoFaEnabled
            ? "bg-red-100 text-red-500 hover:bg-red-200"
            : "bg-indigo-500 text-white hover:bg-indigo-600"
            }`}
        >
          {toggling2FA ? "Please wait..." : twoFaEnabled ? "Disable" : "Enable"}
        </button>
      </div>

      {/* Sessions header */}
      <div className="flex items-center justify-between mb-3 mx-3 mt-6">
        <h3 className="text-sm font-bold m-0">
          Active Sessions ({sessions.length})
        </h3>

        {sessions.length > 1 && (
          <button
            onClick={revokeAllSessions}
            disabled={revokingAll}
            className="btn btn-danger text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {revokingAll ? "Revoking..." : "Logout from other devices"}
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-auto py-2 pr-1 mx-2">
        {loading ? (
          <SkeletonSessions />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No active sessions found.
          </p>
        ) : (
          <div className="flex flex-col gap-1 sm:gap-3">
            {sessions.map((session) => {
              const isCurrentSession = !!session?.isCurrentSession;

              return (
                <div
                  key={session._id}
                  className="bg-white border border-gray-200 rounded-2xl p-2 sm:px-4 sm:py-3 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">
                      {deviceIcon(session.device)}
                    </span>

                    <div className="min-w-0">
                      <p className="m-0 text-sm font-semibold truncate">
                        {session.device || "Unknown Device"}
                        {isCurrentSession && (
                          <span className="ml-2 text-green-600 text-xs font-medium">
                            · This device
                          </span>
                        )}
                      </p>

                      <p className="m-0 text-xs text-gray-500 truncate">
                        {getLocationText(session.location)} ·{" "}
                        {session.ip || "Unknown IP"}
                      </p>

                      <p className="m-0 text-xs text-gray-400">
                        Last active: {formatDate(session.lastUsedAt)}
                        {session.isNewDevice && (
                          <span className="ml-2 text-yellow-500 font-semibold">
                            · New device
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      revokeSession(session._id, isCurrentSession)
                    }
                    disabled={isCurrentSession || revokingSessionId === session._id}
                    className="bg-red-100 text-red-500 border-0 rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {revokingSessionId === session._id ? "Revoking..." : "Revoke"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Toaster is provided in App.js; avoid local Toaster to prevent duplicates */}
    </div>
  );
};

export default ActiveSessions;
