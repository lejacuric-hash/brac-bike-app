import React from 'react'

export default function PlanNewView({ onStartRoute, onSaveRoute }) {
  return (
    <div className="plan-new-container" style={{ background: '#370063', color: '#fff', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>PLAN</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onSaveRoute} style={{ background: '#753cae', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>SAVE</button>
          <button onClick={onStartRoute} style={{ background: '#00e676', color: '#000', border: 'none', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>START RIDE</button>
        </div>
      </div>

      <div className="routing-fields-box" style={{ background: '#250046', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffb300' }}>A:</span>
          <input
            type="text"
            placeholder="CURRENT LOCATION"
            style={{ flex: 1, background: '#511b85', border: 'none', padding: '12px', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500' }}
          />
          <span style={{ cursor: 'pointer', fontSize: '18px', color: '#aaa' }}>☰</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00e676' }}>B:</span>
          <input
            type="text"
            placeholder="CHOOSE DESTINATION"
            style={{ flex: 1, background: '#511b85', border: 'none', padding: '12px', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500' }}
          />
          <span style={{ cursor: 'pointer', fontSize: '18px', color: '#aaa' }}>☰</span>
        </div>
      </div>

      <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', fontStyle: 'italic', marginTop: '10px' }}>
        💡 Or long-press anywhere directly on the map surface to set custom waypoints dynamically.
      </div>
    </div>
  )
}
