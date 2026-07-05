import { useState, useEffect } from 'react';
import { fetchPendingOrganizers, approveOrganizer, rejectOrganizer } from '../services/adminService';

export default function AdminDashboard() {
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    const { ok, data } = await fetchPendingOrganizers();
    if (ok) {
      setOrganizers(data.data || []);
    } else {
      setAlert({ type: 'err', msg: data.message || 'Failed to load organizers' });
    }
    setLoading(false);
  };

  const handleApprove = async (id) => {
    const { ok, data } = await approveOrganizer(id);
    if (ok) {
      setAlert({ type: 'ok', msg: data.message });
      setOrganizers(organizers.filter((org) => org._id !== id));
    } else {
      setAlert({ type: 'err', msg: data.message });
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject and delete this account?')) return;
    const { ok, data } = await rejectOrganizer(id);
    if (ok) {
      setAlert({ type: 'ok', msg: data.message });
      setOrganizers(organizers.filter((org) => org._id !== id));
    } else {
      setAlert({ type: 'err', msg: data.message });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', color: '#f0f0f5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '24px' }}>Admin Dashboard</h1>
        
        {alert && (
          <div style={{
            padding: '12px 18px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem',
            background: alert.type === 'err' ? 'rgba(224,92,106,0.1)' : 'rgba(78,202,139,0.1)',
            border: alert.type === 'err' ? '1px solid rgba(224,92,106,0.25)' : '1px solid rgba(78,202,139,0.25)',
            color: alert.type === 'err' ? '#e05c6a' : '#4eca8b',
          }}>
            {alert.msg}
          </div>
        )}

        <div style={{ background: '#161619', border: '1px solid #2a2a35', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: '#8084e8' }}>
            Pending Organizer Approvals
          </h2>
          
          {loading ? (
            <p style={{ color: '#8888a0' }}>Loading requests...</p>
          ) : organizers.length === 0 ? (
            <p style={{ color: '#8888a0' }}>No pending approvals at the moment.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {organizers.map((org) => (
                <div key={org._id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#1e1e24', border: '1px solid #2a2a35', borderRadius: '8px', padding: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f0f0f5' }}>{org.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#8888a0', marginTop: '4px' }}>{org.email}</div>
                    <div style={{ fontSize: '0.75rem', color: '#55556a', marginTop: '4px' }}>
                      Registered: {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleApprove(org._id)} style={{
                      padding: '8px 16px', background: '#4eca8b', color: '#0d0d0f', border: 'none',
                      borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }} onMouseEnter={e=>e.target.style.opacity=0.8} onMouseLeave={e=>e.target.style.opacity=1}>
                      Approve
                    </button>
                    <button onClick={() => handleReject(org._id)} style={{
                      padding: '8px 16px', background: 'transparent', color: '#e05c6a',
                      border: '1px solid #e05c6a', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem',
                      cursor: 'pointer', transition: 'background 0.2s'
                    }} onMouseEnter={e=>e.target.style.background='rgba(224,92,106,0.1)'} onMouseLeave={e=>e.target.style.background='transparent'}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
