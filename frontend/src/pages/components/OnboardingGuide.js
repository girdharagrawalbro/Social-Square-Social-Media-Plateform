import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import useWindowWidth from '../../hooks/useWindowWidth';

const OnboardingGuide = ({ visible, onHide, userName }) => {
    const [step, setStep] = useState(1);
    const totalSteps = 7;
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
        else onHide();
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    // Auto-scroll to top of dialog on step change
    useEffect(() => {
        const dialogContent = document.querySelector('.onboarding-dialog .p-dialog-content');
        if (dialogContent) dialogContent.scrollTop = 0;
    }, [step]);

    const renderArrow = () => {
        if (!visible) return null;

        // Step 4: Create Post (Sidebar or BottomNav)
        // Step 5: Chat (Sidebar or BottomNav)

        let positionClass = "";
        let arrowIcon = "";

        if (step === 4) { // Add Post
            if (isDesktop) {
                positionClass = "fixed left-20 top-[45%] -translate-y-1/2 z-[20001]";
                arrowIcon = "pi-arrow-left";
            } else {
                positionClass = "fixed bottom-20 left-1/2 -translate-x-1/2 z-[20001]";
                arrowIcon = "pi-arrow-down";
            }
        } else if (step === 5) { // Chat
            if (isDesktop) {
                positionClass = "fixed left-20 top-[60%] -translate-y-1/2 z-[20001]";
                arrowIcon = "pi-arrow-left";
            } else {
                positionClass = "fixed bottom-20 right-10 z-[20001]";
                arrowIcon = "pi-arrow-down";
            }
        } else {
            return null;
        }

        return (
            <div className={`${positionClass} flex flex-col items-center gap-2 animate-bounce`}>
                <div className="bg-[#6366f1] text-white p-3 rounded-full shadow-2xl border-4 border-white dark:border-neutral-900">
                    <i className={`pi ${arrowIcon} text-xl font-bold`}></i>
                </div>
                <div className="bg-[#6366f1] text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shadow-xl">
                    Look Here!
                </div>
            </div>
        );
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="flex flex-col items-center text-center p-6 gap-4 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-[#6366f1]/10 rounded-full flex items-center justify-center text-4xl text-[#6366f1] mb-2">
                            👋
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">Welcome to Social Square, {userName}!</h2>
                        <p className="text-[var(--text-sub)] leading-relaxed">
                            We're thrilled to have you here. Let's take a quick 1-minute tour to show you how to get the most out of your new favorite social space.
                        </p>
                    </div>
                );
            case 2:
                return (
                    <div className="flex flex-col items-center text-center p-6 gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="w-20 h-20 bg-pink-500/10 rounded-full flex items-center justify-center text-4xl text-pink-500 mb-2">
                            <i className="pi pi-video"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">The Smart Feed</h2>
                        <p className="text-[var(--text-sub)] leading-relaxed">
                            Your feed is alive! Videos play automatically as you scroll. Follow your favorite creators to personalize your experience.
                        </p>
                    </div>
                );
            case 3:
                return (
                    <div className="flex flex-col items-center text-center p-6 gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center text-4xl text-orange-500 mb-2">
                            <i className="pi pi-compass"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">Explore & Discover</h2>
                        <p className="text-[var(--text-sub)] leading-relaxed">
                            Find new trending topics in <b>Explore</b> or use the <b>Pulse</b> to see what's hot right now in the community.
                        </p>
                    </div>
                );
            case 4:
                return (
                    <div className="flex flex-col items-center text-center p-6 gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="w-20 h-20 bg-[#6366f1]/10 rounded-full flex items-center justify-center text-4xl text-[#6366f1] mb-2">
                            <i className="pi pi-sparkles"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">Create with AI Magic</h2>
                        <p className="text-[var(--text-sub)] leading-relaxed">
                            Tap the <b>Plus</b> icon to create a post. Use the <b>AI Magic Tools</b> to generate text captions or stunning images in seconds!
                        </p>
                        <div className="text-[11px] font-bold text-[#6366f1] bg-[#6366f1]/5 px-4 py-2 rounded-xl border border-[#6366f1]/20">
                            PRO TIP: Pointing to the Add button now!
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="flex flex-col items-center text-center p-6 gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center text-4xl text-cyan-500 mb-2">
                            <i className="pi pi-envelope"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">Real-time Conversations</h2>
                        <p className="text-[var(--text-sub)] leading-relaxed">
                            Chat with your friends in real-time. Share posts, send voice notes, and see who's online instantly in the <b>Conversations</b> tab.
                        </p>
                    </div>
                );
            case 6:
                return (
                    <div className="flex flex-col items-center text-center p-6 gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-4xl text-green-500 mb-2">
                            <i className="pi pi-chart-line"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">Level Up Your Profile</h2>
                        <p className="text-[var(--text-sub)] leading-relaxed">
                            Engagement earns you <b>XP</b>! Level up your profile, maintain daily <b>streaks</b>, and unlock special badges as you grow.
                        </p>
                    </div>
                );
            case 7:
                return (
                    <div className="flex flex-col items-center text-center p-6 gap-4 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-4xl text-green-500 mb-2">
                            <i className="pi pi-check-circle"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">You're All Set!</h2>
                        <p className="text-[var(--text-sub)] leading-relaxed">
                            Explore, connect, and enjoy the future of social media. We can't wait to see what you'll share!
                        </p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            {renderArrow()}
            <Dialog
                visible={visible}
                onHide={onHide}
                showHeader={false}
                modal
                dismissableMask={false}
                className="onboarding-dialog"
                style={{ width: '90vw', maxWidth: '450px' }}
                contentStyle={{ padding: 0, borderRadius: '24px', overflow: 'hidden', background: 'var(--surface-1)' }}
            >
                <div className="flex flex-col min-h-[400px]">
                    {/* Content */}
                    <div className="flex-1 flex items-center justify-center">
                        {renderStepContent()}
                    </div>

                    {/* Progress Bar */}
                    <div className="px-8 flex gap-1.5 mb-8">
                        {[...Array(totalSteps)].map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i + 1 <= step ? 'bg-[#6366f1]' : 'bg-[var(--border-color)]'}`}
                            />
                        ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-8 pb-8 flex items-center justify-between gap-4">
                        <button
                            onClick={prevStep}
                            className={`text-sm font-bold transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'}`}
                        >
                            Back
                        </button>
                        <button
                            onClick={nextStep}
                            className="bg-[#6366f1] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#4f46e5] transition-all transform active:scale-95 shadow-lg shadow-[#6366f1]/20"
                        >
                            {step === totalSteps ? "Let's Go!" : "Next"}
                        </button>
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export default OnboardingGuide;
