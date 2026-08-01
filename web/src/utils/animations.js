import gsap from 'gsap';

export const pageEntranceAnimation = (element, options = {}) => {
    return gsap.fromTo(element, 
        { opacity: 0, y: 15 },
        { 
            opacity: 1, 
            y: 0, 
            duration: 0.4, 
            ease: "power2.out", 
            ...options 
        }
    );
};

export const modalEntranceAnimation = (element, options = {}) => {
    return gsap.fromTo(element,
        { opacity: 0, scale: 0.8 },
        {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.5)",
            ...options
        }
    );
};

export const hoverButtonAnimation = (element) => {
    return gsap.to(element, { scale: 1.05, duration: 0.2, ease: "power1.out" });
};

export const hoverButtonReset = (element) => {
    return gsap.to(element, { scale: 1, duration: 0.2, ease: "power1.out" });
};

export const staggerFadeUp = (elements, options = {}) => {
    return gsap.fromTo(elements,
        { opacity: 0, y: 20 },
        {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out",
            ...options
        }
    );
};
