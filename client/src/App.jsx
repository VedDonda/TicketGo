import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './services/authService';
import Login  from './pages/Login';
import Signup from './pages/Signup';
import Home   from './pages/Home';

// Guard: redirect to /login if not authenticated
function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

// Guard: redirect to / if already logged in
function GuestRoute({ children }) {
  return !getToken() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <PrivateRoute><Home /></PrivateRoute>
        } />
        <Route path="/login" element={
          <GuestRoute><Login /></GuestRoute>
        } />
        <Route path="/signup" element={
          <GuestRoute><Signup /></GuestRoute>
        } />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
