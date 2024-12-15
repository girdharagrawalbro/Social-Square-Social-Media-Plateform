import './App.css';

        
import {
  BrowserRouter as Router,
  Routes, // Correctly imported Routes
  Route
} from "react-router-dom";

import "primereact/resources/themes/lara-light-cyan/theme.css";
import 'react-toastify/dist/ReactToastify.css';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Forgot from './pages/Forgot';
import Contact from './pages/Contact';
import Help from './pages/Help';
import { PrimeReactProvider } from 'primereact/api';
function App() {
  return (
    <>
      <PrimeReactProvider>
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
      </PrimeReactProvider>
    </>

  );
}

export default App;
