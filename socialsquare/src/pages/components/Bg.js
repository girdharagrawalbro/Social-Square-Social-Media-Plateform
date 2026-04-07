import { useDarkMode } from '../../context/DarkModeContext';

const Bg = ({ children }) => {
    const { isDark } = useDarkMode();
    return (
        <>
            <div className="w-full min-h-screen flex items-center justify-center bg-cover bg-center px-3 py-6 sm:px-6" style={{ backgroundImage: "url('https://i.ibb.co/tKbHYTv/bg.jpg')" }}>
                <div className={`flex rounded-xl shadow-lg mx-auto transition-colors duration-200 ${isDark ? 'bg-[#121212] text-white' : 'bg-white text-gray-800'}`}>
                    {children}
                </div>
            </div>
        </>
    );
}

export default Bg;
