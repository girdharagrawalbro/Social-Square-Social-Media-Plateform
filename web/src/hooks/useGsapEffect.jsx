import { useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * A custom hook mimicking @gsap/react useGSAP to automatically clean up GSAP context.
 * 
 * @param {Function} callback - The GSAP animation logic.
 * @param {Array|Object} dependencies - Dependencies array or config object { dependencies: [], scope: ref }
 */
export function useGsapEffect(callback, dependencies = []) {
    let deps = dependencies;
    let scope = null;

    if (!Array.isArray(dependencies)) {
        deps = dependencies.dependencies || [];
        scope = dependencies.scope || null;
    }

    useIsomorphicLayoutEffect(() => {
        const ctx = gsap.context(callback, scope);
        return () => ctx.revert();
    }, deps);
}
