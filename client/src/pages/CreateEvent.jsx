import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, clearSession } from '../services/authService';
import { createEventRequest, uploadImageRequest } from '../services/eventService';

// ─── Icons ────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
  </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['MUSIC', 'SPORTS', 'COMEDY', 'THEATRE', 'CONFERENCE', 'OTHER'];

const S = {
  // Layout
  page:    { minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#0d0d0f', color: '#f0f0f5' },
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: 64,
             background: 'rgba(13,13,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #2a2a35',
             position: 'sticky', top: 0, zIndex: 50 },
  body:    { maxWidth: 960, margin: '0 auto', padding: '48px 24px 80px' },

  // Form
  card:    { background: '#161619', border: '1px solid #2a2a35', borderRadius: 16, padding: 28, marginBottom: 20 },
  sectionTitle: { margin: '0 0 20px', fontSize: '0.9rem', fontWeight: 700, color: '#8084e8',
                  textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid #2a2a35', paddingBottom: 12 },
  label:   { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#8888a0',
             textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 },
  input:   { width: '100%', background: '#1e1e24', border: '1px solid #2a2a35', borderRadius: 8,
             color: '#f0f0f5', fontSize: '0.9rem', padding: '11px 14px', outline: 'none',
             fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  textarea:{ width: '100%', background: '#1e1e24', border: '1px solid #2a2a35', borderRadius: 8,
             color: '#f0f0f5', fontSize: '0.9rem', padding: '11px 14px', outline: 'none',
             fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', resize: 'vertical',
             minHeight: 100, transition: 'border-color 0.2s' },
  select:  { width: '100%', background: '#1e1e24', border: '1px solid #2a2a35', borderRadius: 8,
             color: '#f0f0f5', fontSize: '0.9rem', padding: '11px 14px', outline: 'none',
             fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', cursor: 'pointer',
             appearance: 'none', transition: 'border-color 0.2s' },
  err:     { fontSize: '0.76rem', color: '#e05c6a', marginTop: 5 },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  row3:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  typeBtn: (active) => ({
    flex: 1, padding: '16px 12px', border: active ? '2px solid #5b5fc7' : '1.5px solid #2a2a35',
    borderRadius: 12, background: active ? 'rgba(91,95,199,0.12)' : 'transparent',
    color: active ? '#8084e8' : '#8888a0', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
    fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.15s', textAlign: 'center',
  }),
  configRow: { background: '#0d0d0f', border: '1px solid #2a2a35', borderRadius: 10, padding: '14px 16px',
               marginBottom: 10, display: 'grid', gap: 10 },
  addBtn:  { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
             background: 'rgba(91,95,199,0.1)', border: '1px dashed rgba(91,95,199,0.3)',
             borderRadius: 8, color: '#8084e8', cursor: 'pointer', fontSize: '0.82rem',
             fontWeight: 600, fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', marginTop: 6 },
  delBtn:  { padding: '6px 10px', background: 'rgba(224,92,106,0.1)', border: '1px solid rgba(224,92,106,0.2)',
             borderRadius: 6, color: '#e05c6a', cursor: 'pointer', display: 'flex', alignItems: 'center',
             justifyContent: 'center', transition: 'all 0.15s' },
  submitBtn: (loading) => ({
    width: '100%', padding: '16px', background: loading ? '#3a3d7a' : '#5b5fc7', border: 'none',
    borderRadius: 12, color: '#fff', fontSize: '1.1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', marginTop: 8,
    opacity: loading ? 0.75 : 1, pointerEvents: loading ? 'none' : 'auto'
  }),
  alert: (type) => ({
    padding: '12px 18px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 500, marginBottom: 20,
    background: type === 'err' ? 'rgba(224,92,106,0.1)' : 'rgba(78,202,139,0.1)',
    border: type === 'err' ? '1px solid rgba(224,92,106,0.25)' : '1px solid rgba(78,202,139,0.25)',
    color: type === 'err' ? '#e05c6a' : '#4eca8b',
  }),
};

const fld = (id, label, el, props, err) => (
  <div style={{ marginBottom: 18 }}>
    <label htmlFor={id} style={S.label}>{label}</label>
    {el === 'input'    && <input    id={id} style={S.input}    {...props} />}
    {el === 'textarea' && <textarea id={id} style={S.textarea} {...props} />}
    {el === 'select'   && <select   id={id} style={S.select}   {...props} />}
    {err && <p style={S.err}>{err}</p>}
  </div>
);

const EMPTY_SEAT_SECTION  = () => ({ section: '', rows: '', seatsPerRow: '', price: '' });
const EMPTY_ZONE          = () => ({ zoneName: '', totalSeats: '', price: '' });

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateEvent() {
  const navigate = useNavigate();
  const user     = getCurrentUser();

  const isSubmitting = useRef(false);

  // Core fields
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState('');
  const [date,        setDate]        = useState('');
  const [imageUrl,    setImageUrl]    = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [status,      setStatus]      = useState('PUBLISHED');

  // Venue
  const [venueName,     setVenueName]     = useState('');
  const [venueCity,     setVenueCity]     = useState('');
  const [venueAddress,  setVenueAddress]  = useState('');
  const [venueCapacity, setVenueCapacity] = useState('');

  // Event type + configs
  const [eventType,      setEventType]      = useState('RESERVED_SEATING');
  const [seatingConfig,  setSeatingConfig]  = useState([EMPTY_SEAT_SECTION()]);
  const [zoningConfig,   setZoningConfig]   = useState([EMPTY_ZONE()]);

  const [errors,  setErrors]  = useState({});
  const [alert,   setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Seating config helpers ───────────────────────────────────────────────
  const updateSection = (i, field, val) => {
    setSeatingConfig(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
    const errorKey = field === 'section' ? `sec_${i}_section` :
                     field === 'rows' ? `sec_${i}_rows` :
                     field === 'seatsPerRow' ? `sec_${i}_spr` :
                     field === 'price' ? `sec_${i}_price` : null;
    if (errorKey && errors[errorKey]) {
      if ((field === 'section' && val.trim()) || (field === 'rows' && +val >= 1) || (field === 'seatsPerRow' && +val >= 1) || (field === 'price' && +val >= 0 && val !== '')) {
        setErrors(prev => ({ ...prev, [errorKey]: null }));
      }
    }
    if (alert) setAlert(null);
  };
  const addSection    = () => setSeatingConfig(prev => [...prev, EMPTY_SEAT_SECTION()]);
  const removeSection = (i) => setSeatingConfig(prev => prev.filter((_, idx) => idx !== i));

  // ── Zoning config helpers ────────────────────────────────────────────────
  const updateZone = (i, field, val) => {
    setZoningConfig(prev => prev.map((z, idx) => idx === i ? { ...z, [field]: val } : z));
    const errorKey = field === 'zoneName' ? `zone_${i}_name` :
                     field === 'totalSeats' ? `zone_${i}_seats` :
                     field === 'price' ? `zone_${i}_price` : null;
    if (errorKey && errors[errorKey]) {
      if ((field === 'zoneName' && val.trim()) || (field === 'totalSeats' && +val >= 1) || (field === 'price' && +val >= 0 && val !== '')) {
        setErrors(prev => ({ ...prev, [errorKey]: null }));
      }
    }
    if (alert) setAlert(null);
  };
  const addZone       = () => setZoningConfig(prev => [...prev, EMPTY_ZONE()]);
  const removeZone    = (i) => setZoningConfig(prev => prev.filter((_, idx) => idx !== i));

  // ── Image Upload ─────────────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageUploading(true);
    setAlert(null);
    try {
      const { ok, data } = await uploadImageRequest(file);
      if (ok && data.success) {
        setImageUrl(data.data.url);
        if (errors.image) setErrors(prev => ({ ...prev, image: null }));
      } else {
        setAlert({ msg: data.message || 'Image upload failed', type: 'err' });
      }
    } catch {
      setAlert({ msg: 'Network error during image upload.', type: 'err' });
    } finally {
      setImageUploading(false);
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!title.trim())         e.title       = 'Title is required';
    if (!description.trim())   e.description = 'Description is required';
    if (!category)             e.category    = 'Category is required';
    if (!date)                 e.date        = 'Date is required';
    else if (new Date(date) <= new Date()) e.date = 'Date must be in the future';
    if (!venueName.trim())     e.venueName   = 'Venue name is required';
    if (!venueCity.trim())     e.venueCity   = 'City is required';
    if (!venueAddress.trim())  e.venueAddress= 'Address is required';
    if (!venueCapacity || isNaN(venueCapacity) || +venueCapacity < 1)
      e.venueCapacity = 'Total capacity must be at least 1';
    if (!imageUrl) e.image = 'An event cover image is required';

    if (eventType === 'RESERVED_SEATING') {
      seatingConfig.forEach((s, i) => {
        if (!s.section.trim())            e[`sec_${i}_section`]     = 'Section name required';
        if (!s.rows || +s.rows < 1)       e[`sec_${i}_rows`]        = 'Rows ≥ 1';
        if (!s.seatsPerRow || +s.seatsPerRow < 1) e[`sec_${i}_spr`] = 'Seats/row ≥ 1';
        if (!s.price || +s.price < 0)     e[`sec_${i}_price`]       = 'Price ≥ 0';
      });
    } else {
      zoningConfig.forEach((z, i) => {
        if (!z.zoneName.trim())            e[`zone_${i}_name`]  = 'Zone name required';
        if (!z.totalSeats || +z.totalSeats < 1) e[`zone_${i}_seats`] = 'Seats ≥ 1';
        if (!z.price || +z.price < 0)      e[`zone_${i}_price`] = 'Price ≥ 0';
      });
    }
    return e;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    setAlert(null);
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    isSubmitting.current = true;
    setLoading(true);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      date: new Date(date).toISOString(),
      imageUrl: imageUrl.trim() || undefined,
      status,
      venue: {
        name: venueName.trim(),
        city: venueCity.trim(),
        address: venueAddress.trim(),
        totalCapacity: +venueCapacity,
      },
      eventType,
      ...(eventType === 'RESERVED_SEATING' && {
        seatingConfig: seatingConfig.map(s => ({
          section:     s.section.trim(),
          rows:        +s.rows,
          seatsPerRow: +s.seatsPerRow,
          price:       +s.price,
        })),
      }),
      ...(eventType === 'ZONED_CAPACITY' && {
        zoningConfig: zoningConfig.map(z => ({
          zoneName:   z.zoneName.trim(),
          totalSeats: +z.totalSeats,
          price:      +z.price,
        })),
      }),
    };

    try {
      const { ok, data } = await createEventRequest(payload);
      if (!ok) {
        setAlert({ msg: data.message || 'Failed to create event', type: 'err' });
        setLoading(false);
        isSubmitting.current = false;
        return;
      }
      setAlert({ msg: 'Event created successfully! Redirecting...', type: 'ok' });
      setTimeout(() => navigate('/'), 1800);
    } catch {
      setAlert({ msg: 'Network error. Make sure the backend server is running.', type: 'err' });
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleLogout = () => { clearSession(); navigate('/login'); };

  const focusStyle = (e) => { e.target.style.borderColor = '#5b5fc7'; };
  const blurStyle  = (e) => { e.target.style.borderColor = '#2a2a35'; };

  return (
    <div style={S.page}>


      {/* ── Page body ───────────────────────────────────── */}
      <div style={S.body}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link to="/" style={{ fontSize: '0.8rem', color: '#55556a', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
            ← Back to Home
          </Link>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
            Create New Event
          </h1>
          <p style={{ margin: 0, color: '#55556a', fontSize: '0.875rem' }}>
            Fill in the details below. Seats will be generated automatically in the background.
          </p>
        </div>

        {alert && <div style={S.alert(alert.type)}>{alert.msg}</div>}

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Basic Info ──────────────────────────────── */}
          <div style={S.card}>
            <p style={S.sectionTitle}>Basic Information</p>

            {fld('ev-title', 'Event Title *', 'input', {
              type: 'text', placeholder: 'e.g. Coldplay World Tour 2025',
              value: title, onChange: e => {
                const val = e.target.value;
                setTitle(val);
                if (errors.title && val.trim()) setErrors(prev => ({ ...prev, title: null }));
                if (alert) setAlert(null);
              },
              onFocus: focusStyle, onBlur: blurStyle,
            }, errors.title)}

            {fld('ev-desc', 'Description *', 'textarea', {
              placeholder: 'Describe your event — performers, highlights, rules…',
              value: description, onChange: e => {
                const val = e.target.value;
                setDescription(val);
                if (errors.description && val.trim()) setErrors(prev => ({ ...prev, description: null }));
                if (alert) setAlert(null);
              },
              onFocus: focusStyle, onBlur: blurStyle,
            }, errors.description)}

            <div style={S.row2}>
              <div>
                <label htmlFor="ev-category" style={S.label}>Category *</label>
                <select id="ev-category" style={S.select}
                  value={category} onChange={e => {
                    const val = e.target.value;
                    setCategory(val);
                    if (errors.category && val) setErrors(prev => ({ ...prev, category: null }));
                    if (alert) setAlert(null);
                  }}
                  onFocus={focusStyle} onBlur={blurStyle}>
                  <option value="">— Select category —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p style={S.err}>{errors.category}</p>}
              </div>
              <div>
                {fld('ev-date', 'Event Date & Time *', 'input', {
                  type: 'datetime-local',
                  value: date, onChange: e => {
                    const val = e.target.value;
                    setDate(val);
                    if (errors.date && new Date(val) > new Date()) setErrors(prev => ({ ...prev, date: null }));
                    if (alert) setAlert(null);
                  },
                  onFocus: focusStyle, onBlur: blurStyle,
                }, errors.date)}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>Event Cover Image *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={imageUploading}
                  style={{ ...S.input, flex: 1, padding: '10px 14px' }} />
                {imageUrl && <span style={{ color: '#4eca8b', fontSize: '0.85rem', fontWeight: 600 }}>✓ Uploaded</span>}
              </div>
              {imageUploading && <p style={{ fontSize: '0.76rem', color: '#8084e8', marginTop: 5 }}>Uploading...</p>}
              {errors.image && <p style={S.err}>{errors.image}</p>}
            </div>
          </div>

          {/* ── Venue ───────────────────────────────────── */}
          <div style={S.card}>
            <p style={S.sectionTitle}>Venue Details</p>
            <div style={S.row2}>
              {fld('ev-vname', 'Venue Name *', 'input', {
                type: 'text', placeholder: 'e.g. Wembley Stadium',
                value: venueName, onChange: e => {
                  const val = e.target.value;
                  setVenueName(val);
                  if (errors.venueName && val.trim()) setErrors(prev => ({ ...prev, venueName: null }));
                  if (alert) setAlert(null);
                },
                onFocus: focusStyle, onBlur: blurStyle,
              }, errors.venueName)}
              {fld('ev-vcity', 'City *', 'input', {
                type: 'text', placeholder: 'e.g. Mumbai',
                value: venueCity, onChange: e => {
                  const val = e.target.value;
                  setVenueCity(val);
                  if (errors.venueCity && val.trim()) setErrors(prev => ({ ...prev, venueCity: null }));
                  if (alert) setAlert(null);
                },
                onFocus: focusStyle, onBlur: blurStyle,
              }, errors.venueCity)}
            </div>
            <div style={S.row2}>
              {fld('ev-vaddress', 'Address *', 'input', {
                type: 'text', placeholder: 'Full street address',
                value: venueAddress, onChange: e => {
                  const val = e.target.value;
                  setVenueAddress(val);
                  if (errors.venueAddress && val.trim()) setErrors(prev => ({ ...prev, venueAddress: null }));
                  if (alert) setAlert(null);
                },
                onFocus: focusStyle, onBlur: blurStyle,
              }, errors.venueAddress)}
              {fld('ev-vcap', 'Total Capacity *', 'input', {
                type: 'number', min: 1, placeholder: '50000',
                value: venueCapacity, onChange: e => {
                  const val = e.target.value;
                  setVenueCapacity(val);
                  if (errors.venueCapacity && !isNaN(val) && +val >= 1) setErrors(prev => ({ ...prev, venueCapacity: null }));
                  if (alert) setAlert(null);
                },
                onFocus: focusStyle, onBlur: blurStyle,
              }, errors.venueCapacity)}
            </div>
          </div>

          {/* ── Event Type ──────────────────────────────── */}
          <div style={S.card}>
            <p style={S.sectionTitle}>Ticket Type *</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button type="button" id="type-reserved" style={S.typeBtn(eventType === 'RESERVED_SEATING')}
                onClick={() => setEventType('RESERVED_SEATING')}>

                <div>Reserved Seating</div>
                <div style={{ fontSize: '0.73rem', fontWeight: 400, marginTop: 4, color: '#55556a' }}>
                  Specific row & seat number per ticket
                </div>
              </button>
              <button type="button" id="type-zoned" style={S.typeBtn(eventType === 'ZONED_CAPACITY')}
                onClick={() => setEventType('ZONED_CAPACITY')}>

                <div>Zoned (General Admission)</div>
                <div style={{ fontSize: '0.73rem', fontWeight: 400, marginTop: 4, color: '#55556a' }}>
                  Named zones with a capacity pool
                </div>
              </button>
            </div>

            {/* ── Reserved Seating Config ─────────────── */}
            {eventType === 'RESERVED_SEATING' && (
              <div>
                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#8888a0' }}>
                  Add one or more sections. The worker will bulk-generate all seats automatically.
                </p>
                {seatingConfig.map((sec, i) => (
                  <div key={i} style={S.configRow}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8084e8' }}>
                        Section {i + 1}
                      </span>
                      {seatingConfig.length > 1 && (
                        <button type="button" style={S.delBtn} onClick={() => removeSection(i)}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                    <div style={S.row3}>
                      <div>
                        <label style={S.label}>Section Name</label>
                        <input id={`sec-${i}-name`} style={S.input} placeholder="e.g. VIP"
                          value={sec.section} onChange={e => updateSection(i, 'section', e.target.value)}
                          onFocus={focusStyle} onBlur={blurStyle} />
                        {errors[`sec_${i}_section`] && <p style={S.err}>{errors[`sec_${i}_section`]}</p>}
                      </div>
                      <div>
                        <label style={S.label}>Rows</label>
                        <input id={`sec-${i}-rows`} style={S.input} type="number" min={1} max={100} placeholder="10"
                          value={sec.rows} onChange={e => updateSection(i, 'rows', e.target.value)}
                          onFocus={focusStyle} onBlur={blurStyle} />
                        {errors[`sec_${i}_rows`] && <p style={S.err}>{errors[`sec_${i}_rows`]}</p>}
                      </div>
                      <div>
                        <label style={S.label}>Seats / Row</label>
                        <input id={`sec-${i}-spr`} style={S.input} type="number" min={1} max={100} placeholder="20"
                          value={sec.seatsPerRow} onChange={e => updateSection(i, 'seatsPerRow', e.target.value)}
                          onFocus={focusStyle} onBlur={blurStyle} />
                        {errors[`sec_${i}_spr`] && <p style={S.err}>{errors[`sec_${i}_spr`]}</p>}
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Price per Seat (₹)</label>
                      <input id={`sec-${i}-price`} style={{ ...S.input, width: '33%' }} type="number" min={0} placeholder="500"
                        value={sec.price} onChange={e => updateSection(i, 'price', e.target.value)}
                        onFocus={focusStyle} onBlur={blurStyle} />
                      {errors[`sec_${i}_price`] && <p style={S.err}>{errors[`sec_${i}_price`]}</p>}
                    </div>
                  </div>
                ))}
                <button type="button" style={S.addBtn} onClick={addSection}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(91,95,199,0.2)'; e.currentTarget.style.borderStyle = 'solid'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(91,95,199,0.1)'; e.currentTarget.style.borderStyle = 'dashed'; }}>
                  <PlusIcon /> Add Section
                </button>
              </div>
            )}

            {/* ── Zoned Capacity Config ───────────────── */}
            {eventType === 'ZONED_CAPACITY' && (
              <div>
                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#8888a0' }}>
                  Add zones (e.g. Floor, Balcony, VIP). Each zone tracks its own seat pool.
                </p>
                {zoningConfig.map((zone, i) => (
                  <div key={i} style={S.configRow}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8084e8' }}>
                        Zone {i + 1}
                      </span>
                      {zoningConfig.length > 1 && (
                        <button type="button" style={S.delBtn} onClick={() => removeZone(i)}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                    <div style={S.row3}>
                      <div>
                        <label style={S.label}>Zone Name</label>
                        <input id={`zone-${i}-name`} style={S.input} placeholder="e.g. Floor GA"
                          value={zone.zoneName} onChange={e => updateZone(i, 'zoneName', e.target.value)}
                          onFocus={focusStyle} onBlur={blurStyle} />
                        {errors[`zone_${i}_name`] && <p style={S.err}>{errors[`zone_${i}_name`]}</p>}
                      </div>
                      <div>
                        <label style={S.label}>Total Seats</label>
                        <input id={`zone-${i}-seats`} style={S.input} type="number" min={1} placeholder="5000"
                          value={zone.totalSeats} onChange={e => updateZone(i, 'totalSeats', e.target.value)}
                          onFocus={focusStyle} onBlur={blurStyle} />
                        {errors[`zone_${i}_seats`] && <p style={S.err}>{errors[`zone_${i}_seats`]}</p>}
                      </div>
                      <div>
                        <label style={S.label}>Price (₹)</label>
                        <input id={`zone-${i}-price`} style={S.input} type="number" min={0} placeholder="999"
                          value={zone.price} onChange={e => updateZone(i, 'price', e.target.value)}
                          onFocus={focusStyle} onBlur={blurStyle} />
                        {errors[`zone_${i}_price`] && <p style={S.err}>{errors[`zone_${i}_price`]}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" style={S.addBtn} onClick={addZone}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(91,95,199,0.2)'; e.currentTarget.style.borderStyle = 'solid'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(91,95,199,0.1)'; e.currentTarget.style.borderStyle = 'dashed'; }}>
                  <PlusIcon /> Add Zone
                </button>
              </div>
            )}
          </div>

          {/* ── Summary preview ─────────────────────────── */}
          {(title || venueName) && (
            <div style={{ ...S.card, border: '1px solid rgba(91,95,199,0.25)', background: 'rgba(91,95,199,0.04)' }}>
              <p style={{ ...S.sectionTitle, color: '#5b5fc7', borderColor: 'rgba(91,95,199,0.2)' }}>Preview</p>
              <div style={{ fontSize: '0.875rem', color: '#8888a0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {title      && <span><strong style={{ color: '#f0f0f5' }}>{title}</strong></span>}
                {category   && <span>Category: {category}</span>}
                {date       && <span>Date: {new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                {venueName  && <span>Venue: {venueName}{venueCity ? `, ${venueCity}` : ''}</span>}
                {eventType === 'RESERVED_SEATING' && seatingConfig[0]?.section && (
                  <span>Sections: {seatingConfig.length} section(s) · {seatingConfig.reduce((t, s) => t + (+s.rows||0)*(+s.seatsPerRow||0), 0).toLocaleString()} seats total</span>
                )}
                {eventType === 'ZONED_CAPACITY' && zoningConfig[0]?.zoneName && (
                  <span>Zones: {zoningConfig.length} zone(s) · {zoningConfig.reduce((t, z) => t + (+z.totalSeats||0), 0).toLocaleString()} seats total</span>
                )}
              </div>
            </div>
          )}

          {/* ── Status ──────────────────────────────────── */}
          <div style={S.card}>
            <p style={S.sectionTitle}>Publish Status</p>
            <div style={{ maxWidth: 300 }}>
              <label htmlFor="ev-status" style={S.label}>Visibility *</label>
              <select id="ev-status" style={S.select} value={status} onChange={e => setStatus(e.target.value)} onFocus={focusStyle} onBlur={blurStyle}>
                <option value="PUBLISHED">Publish (Visible to everyone)</option>
                <option value="DRAFT">Draft (Hidden, you can publish later)</option>
              </select>
            </div>
          </div>

          <button id="submit-event" type="submit" disabled={loading || imageUploading} style={S.submitBtn(loading || imageUploading)}>
            {loading ? 'Creating Event...' : status === 'DRAFT' ? 'Save as Draft' : 'Create & Publish Event'}
          </button>
        </form>
      </div>
    </div>
  );
}
