import './App.css';
import {
  BrowserRouter as Router,
  Routes, // Correctly imported Routes
  Route
} from "react-router-dom";
import AuthProvider from './context/AuthContext';
import PostProvider from './context/PostContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Forgot from './pages/Forgot';
import Contact from './pages/Contact';
import Help from './pages/Help';

function App() {
  return (
    <>
      {/* <ChakraProvider> */}
        <AuthProvider>
          <PostProvider>
            <Router>
              <Routes>
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot" element={<Forgot />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<Login />} />
                <Route path="/help" element={<Help />} />
                <Route path="/" element={<Home />} />
              </Routes>
            </Router>
          </PostProvider>
        </AuthProvider>
      {/* </ChakraProvider> */}
    </>
  );
}

export default App;
