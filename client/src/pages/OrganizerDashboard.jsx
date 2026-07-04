import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchEventById, fetchDashboardMetrics, publishEventRequest } from '../services/eventService';
import { getCurrentUser, clearSession } from '../services/authService';

const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export default function OrganizerDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const initial = user?.name?.[0]?.toUpperCase() ?? 'U';

  const [event, setEvent] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [eventRes, metricsRes] = await Promise.all([
          fetchEventById(id),
          fetchDashboardMetrics(id)
        ]);

        if (eventRes.ok && eventRes.data.success) {
          setEvent(eventRes.data.data.event);
        } else {
          setError('Failed to load event details.');
        }

        if (metricsRes.ok && metricsRes.data.success) {
          setMetrics(metricsRes.data.data);
        }
      } catch {
        setError('Network error loading dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish this event? It will become visible to the public.')) return;
    setPublishing(true);
    try {
      const { ok, data } = await publishEventRequest(id);
      if (ok && data.success) {
        setEvent(prev => ({ ...prev, status: 'PUBLISHED' }));
        alert('Event published successfully!');
      } else {
        alert(data.message || 'Failed to publish event');
      }
    } catch {
      alert('Network error during publishing.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0d', color: '#f0f0f5' }}>
        Loading dashboard...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0d', color: '#f87171' }}>
        {error || 'Event not found'}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#0a0a0d', color: '#f0f0f5', position: 'relative' }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 0%, rgba(91,95,199,0.15) 0%, transparent 60%)'
      }} />



      {/* Main Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <Link to="/profile" style={{ fontSize: '0.8rem', color: '#8888a0', textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>
              ← Back to Profile
            </Link>
            <h1 style={{ margin: '0 0 8px', fontSize: '2rem', fontWeight: 900 }}>
              {event.title}
            </h1>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{
                background: event.status === 'PUBLISHED' ? 'rgba(78,202,139,0.15)' : 'rgba(245,158,11,0.15)',
                border: event.status === 'PUBLISHED' ? '1px solid rgba(78,202,139,0.4)' : '1px solid rgba(245,158,11,0.4)',
                color: event.status === 'PUBLISHED' ? '#4eca8b' : '#fbbf24',
                borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {event.status}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#8888a0' }}>{event.category}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Link to={`/events/${event._id}`} style={{
              padding: '10px 20px', background: 'rgba(91,95,199,0.15)', border: '1px solid rgba(91,95,199,0.4)',
              color: '#8084e8', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none',
            }}>
              View Public Page
            </Link>
            {event.status === 'DRAFT' && (
              <button onClick={handlePublish} disabled={publishing} style={{
                padding: '10px 20px', background: 'linear-gradient(135deg,#5b5fc7,#8084e8)', border: 'none',
                color: '#fff', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: publishing ? 'not-allowed' : 'pointer',
              }}>
                {publishing ? 'Publishing...' : 'Publish Event'}
              </button>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        {metrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            
            <div style={{ background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: 16, padding: '24px' }}>
              <div style={{ fontSize: '0.8rem', color: '#8888a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Total Tickets Sold
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f0f0f5' }}>
                {metrics.ticketsSold.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: 16, padding: '24px' }}>
              <div style={{ fontSize: '0.8rem', color: '#8888a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Tickets Remaining
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f0f0f5' }}>
                {metrics.ticketsRemaining.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ background: 'rgba(17,17,22,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: 16, padding: '24px' }}>
              <div style={{ fontSize: '0.8rem', color: '#8888a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Total Revenue
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#22c55e' }}>
                {formatPrice(metrics.totalRevenue)}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
