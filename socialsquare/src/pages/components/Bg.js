import { useDarkMode } from '../../context/DarkModeContext';

const Bg = ({ children }) => {
    const { isDark } = useDarkMode();
    
    return (
        <div className={`relative w-full flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
            
            {/* Pure CSS Background Graphics */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                {/* Angled Purple Background */}
                <div 
                    className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#808bf5] to-[#606cf0]"
                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 65%, 0 45%)' }}
                ></div>

                {/* Floating Shapes - Right (inside purple) */}
                <div className="absolute top-[35%] right-[5%] sm:right-[10%] w-24 h-6 bg-white/20 -rotate-12 rounded-sm backdrop-blur-sm"></div>
                <div className="absolute top-[42%] right-[10%] sm:right-[15%] w-16 h-3 bg-white/20 -rotate-12 rounded-sm backdrop-blur-sm"></div>
                
                {/* Floating Shapes - Left (inside white/dark area) */}
                <div className="absolute bottom-[35%] left-[5%] sm:left-[10%] w-20 h-5 bg-[#808bf5]/20 -rotate-12 rounded-sm backdrop-blur-sm"></div>
                <div className="absolute bottom-[30%] left-[3%] sm:left-[8%] w-10 h-2 bg-[#808bf5]/20 -rotate-12 rounded-sm backdrop-blur-sm"></div>
            </div>

            {/* Content Container */}
            <div className={`relative z-10 flex max-h-full overflow-y-auto custom-scrollbar rounded-xl shadow-2xl mx-auto transition-colors duration-200 ${isDark ? 'bg-[#121212] text-white shadow-white/5 border border-white/10' : 'bg-white text-gray-800 border border-gray-100'}`}>
                {children}
            </div>
        </div>
    );
}

export default Bg;
