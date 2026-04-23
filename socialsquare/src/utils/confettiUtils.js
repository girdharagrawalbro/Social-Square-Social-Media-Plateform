import confetti from 'canvas-confetti';

/**
 * Fires a burst of flower emojis across the screen.
 */
export const fireFlowerConfetti = () => {
    const scalar = 3;
    
    // Fallback if shapeFromText is not available (older versions)
    // Most recent versions support it.
    let flowerShapes;
    try {
        flowerShapes = [
            confetti.shapeFromText({ text: '🌸', scalar }),
            confetti.shapeFromText({ text: '🌼', scalar }),
            confetti.shapeFromText({ text: '🌻', scalar }),
            confetti.shapeFromText({ text: '🌺', scalar }),
            confetti.shapeFromText({ text: '🌹', scalar }),
            confetti.shapeFromText({ text: '🌷', scalar }),
        ];
    } catch (e) {
        // Fallback to circles with flower colors if the function is missing
        flowerShapes = ['circle'];
    }

    const defaults = {
        spread: 360,
        ticks: 100,
        gravity: 0.6,
        decay: 0.95,
        startVelocity: 25,
        shapes: flowerShapes,
        scalar,
        colors: ['#ff69b4', '#ffd700', '#ff4500', '#ffffff', '#da70d6']
    };

    function shoot() {
        confetti({
            ...defaults,
            particleCount: 30,
            origin: { x: Math.random(), y: Math.random() - 0.1 }
        });
    }

    // Sequence of bursts for a "filling" effect
    for (let i = 0; i < 6; i++) {
        setTimeout(shoot, i * 200);
    }
};
