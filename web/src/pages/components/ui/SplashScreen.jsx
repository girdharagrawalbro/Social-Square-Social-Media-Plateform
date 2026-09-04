import React from 'react';

const SplashScreen = () => {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--surface-1)] z-[999999]">
            <div className="flex flex-col items-center gap-6 animate-fadeInScale">
                <div className="relative">
                    <img
                        src="/logo.jpg"
                        alt="Social Square Logo"
                        className="w-24 h-24 rounded-full shadow-2xl border-4 border-[#808bf5]/20 animate-pulse-slow"
                    />
                    <div className="absolute inset-0 rounded-full bg-[#808bf5]/10 animate-ping opacity-20"></div>
                </div>

                <div className="text-center">
                    <h1 className="font-pacifico text-5xl m-0 text-[var(--text-main)] drop-shadow-sm">
                        Social Square
                    </h1>
                    <div className="mt-4 flex gap-1.5 justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#808bf5] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#808bf5] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#808bf5] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeInScale {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-fadeInScale {
                    animation: fadeInScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes pulse-slow {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.05);
                    }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 3s ease-in-out infinite;
                }
                .font-pacifico {
                    font-family: 'Pacifico', cursive;
                }
            `}</style>
        </div>
    );
};

export default SplashScreen;
