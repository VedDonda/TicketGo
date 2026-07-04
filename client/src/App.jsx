import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getToken } from './services/authService';
import Navbar       from './components/Navbar';
import Login        from './pages/Login';
import Signup       from './pages/Signup';
import Home         from './pages/Home';
import CreateEvent  from './pages/CreateEvent';
import EventDetail  from './pages/EventDetail';
import BookingPage  from './pages/BookingPage';
import ProfilePage  from './pages/ProfilePage';
import OrganizerDashboard from './pages/OrganizerDashboard';

// Guard: redirect to /login if not authenticated
function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

// Guard: redirect to / if already logged in
function GuestRoute({ children }) {
  return !getToken() ? children : <Navigate to="/" replace />;
}

function AppContent() {
  const location = useLocation();
  const hideNavbar = ['/login', '/signup'].includes(location.pathname);
  
  return (
    <>
      {!hideNavbar && <Navbar />}
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
        <Route path="/events/create" element={
          <PrivateRoute><CreateEvent /></PrivateRoute>
        } />
        <Route path="/events/:id" element={
          <PrivateRoute><EventDetail /></PrivateRoute>
        } />
        <Route path="/events/:id/dashboard" element={
          <PrivateRoute><OrganizerDashboard /></PrivateRoute>
        } />
        <Route path="/events/:id/book" element={
          <PrivateRoute><BookingPage /></PrivateRoute>
        } />
        <Route path="/profile" element={
          <PrivateRoute><ProfilePage /></PrivateRoute>
        } />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
