import gsap from 'gsap';
import confetti from 'canvas-confetti';

/**
 * Fires smooth balloons from the bottom that burst into confetti at the top.
 */
export const fireSleekBalloons = () => {
    // 1. Create a temporary container for our DOM balloons
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.pointerEvents = 'none'; // Let users click through
    container.style.zIndex = '9999';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);

    // Sleek, modern balloon color palette
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FFD3B6', '#FFAAA5'];
    const balloonCount = 10;

    for (let i = 0; i < balloonCount; i++) {
        const color = colors[i % colors.length];

        // 2. Create the Balloon Element (Using a clean SVG)
        const balloonWrap = document.createElement('div');
        balloonWrap.style.position = 'absolute';
        balloonWrap.style.width = '80px';
        balloonWrap.style.height = '100px';
        // Sleek SVG balloon with a modern highlight
        balloonWrap.innerHTML = `
            <svg viewBox="0 0 100 140" style="width: 100%; height: 100%; overflow: visible;">
                <path d="M50,0 C20,0 0,25 0,60 C0,100 40,120 50,140 C60,120 100,100 100,60 C100,25 80,0 50,0 Z" fill="${color}" />
                <path d="M70,15 C80,25 85,40 85,55 C85,50 75,25 60,15 C65,15 67.5,15 70,15 Z" fill="rgba(255,255,255,0.4)" />
                <path d="M50,140 L50,180" stroke="rgba(255,255,255,0.5)" stroke-width="2" fill="none" />
            </svg>
        `;
        container.appendChild(balloonWrap);

        // 3. Setup Animation Variables
        const startX = Math.random() * window.innerWidth;
        const driftX = startX + (Math.random() * 200 - 100); // Gentle horizontal drift
        const burstY = window.innerHeight * 0.1 + (Math.random() * 150); // Burst near the top 10%
        const duration = 3 + Math.random() * 1.5; // Smooth 3 to 4.5 seconds

        // 4. GSAP Animation
        gsap.fromTo(balloonWrap,
            {
                y: window.innerHeight + 100, // Start below screen
                x: startX,
                scale: 0.5,
                opacity: 0,
                rotation: -10
            },
            {
                y: burstY,
                x: driftX,
                scale: 1 + Math.random() * 0.2, // Slight size variation
                opacity: 1,
                rotation: 10,
                duration: duration,
                ease: "power1.inOut", // Smooth acceleration and deceleration
                delay: Math.random() * 1.5, // Stagger them naturally
                onComplete: () => {
                    // 5. The Burst! 
                    // Calculate exact coordinates of the balloon to trigger confetti
                    const rect = balloonWrap.getBoundingClientRect();
                    const originX = (rect.left + rect.width / 2) / window.innerWidth;
                    const originY = (rect.top + rect.height / 2) / window.innerHeight;

                    // Hide balloon immediately
                    balloonWrap.style.display = 'none';

                    // Fire canvas-confetti from that exact spot
                    confetti({
                        particleCount: 30,
                        spread: 70,
                        origin: { x: originX, y: originY },
                        colors: [color, '#ffffff', '#ffd700'],
                        startVelocity: 20,
                        scalar: 0.8,
                        disableForReducedMotion: true
                    });

                    // Clean up individual balloon node
                    balloonWrap.remove();
                }
            }
        );
    }

    // 6. Cleanup the container after all animations finish (~6 seconds total)
    setTimeout(() => {
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }, 6000);
};