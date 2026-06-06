import React from 'react';

const MaintenancePage = () => {
    const handleRetry = () => {
        window.location.reload();
    };

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--surface-1)] z-[999999] px-6 text-center animate-in fade-in duration-500">
            {/* Ambient background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[#808bf5]/10 blur-[80px] pointer-events-none"></div>

            <div className="relative flex flex-col items-center max-w-md gap-6 z-10">
                {/* Visual Gear/Maintenance Icon with Pulse Effect */}
                <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-[var(--surface-2)] border border-[var(--border-color)] shadow-xl animate-bounce">
                    <span className="text-5xl">🛠️</span>
                    <div className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span>
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="font-pacifico text-3xl text-[var(--text-main)] m-0">
                        Social Square
                    </h1>
                    <h2 className="text-xl font-black text-[var(--text-main)] uppercase tracking-wider mt-2">
                        Under Maintenance
                    </h2>
                    <p className="text-sm text-[var(--text-sub)] leading-relaxed max-w-sm mx-auto">
                        We are currently performing scheduled system upgrades to bring you a better experience. We will be back online shortly!
                    </p>
                </div>

                {/* Try Again Button */}
                <button
                    onClick={handleRetry}
                    className="px-6 py-3 rounded-xl bg-[#808bf5] hover:bg-[#6c79e0] text-white border-0 font-bold text-xs uppercase tracking-widest cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#808bf5]/20 mt-4"
                >
                    🔄 Check Again
                </button>
            </div>

            <style>{`
                .font-pacifico { font-family: 'Pacifico', cursive; }
            `}</style>
        </div>
    );
};

export default MaintenancePage;
