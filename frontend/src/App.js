import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthProvider from './context/AuthContext';
import PostProvider from './context/PostContext';
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Forgot from './pages/Forgot'
import Contact from './pages/Contact'
import Help from './pages/Help'
function App() {
  return (
      <section className='main-screen'>
        <AuthProvider>
          <PostProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot" element={<Forgot />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/help" element={<Help />} />
                <Route path="/" element={<Home />} />

              </Routes>
            </Router>
          </PostProvider>
        </AuthProvider>
      </section>
  );
}

export default App;
