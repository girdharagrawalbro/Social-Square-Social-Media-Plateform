import { useEffect, useRef } from 'react';

const useTabTitle = () => {
    const originalTitle = useRef(document.title);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                originalTitle.current = document.title;
                document.title = "Hey! Come back 👋";
            } else {
                document.title = originalTitle.current;
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (document.title === "Hey! Come back 👋") {
                document.title = originalTitle.current;
            }
        };
    }, []);
};

export default useTabTitle;
