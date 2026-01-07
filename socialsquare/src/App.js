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
import Landing from './pages/Landing';

import { PrimeReactProvider } from 'primereact/api';

import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import rootReducer from './store';
import { thunk } from 'redux-thunk';

const store = createStore(rootReducer, applyMiddleware(thunk)); // Apply middleware

function App() {
  return (
    <>
      <Provider store={store}>
        <PrimeReactProvider>
          <Router>
            <Routes>
              <Route path="/landing" element={<Landing />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot" element={<Forgot />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/help" element={<Help />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </Router>
        </PrimeReactProvider>
      </Provider>
    </>

  );
}

export default App;
