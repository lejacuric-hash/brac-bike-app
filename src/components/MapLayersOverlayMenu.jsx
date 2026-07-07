import React, { useState } from 'react'

export default function MapLayersOverlayMenu({ onToggleLayer, activeLayers }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 500 }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: '#753cae', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
      >
        🗺️ Layers {isOpen ? '▲' : '▼'}
      </button>

      {isOpen && (
        <div style={{ position: 'absolute', top: '45px', right: '0', background: '#250046', padding: '12px', borderRadius: '12px', width: '200px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid #511b85', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold', marginBottom: '4px' }}>TOGGLE TRAIL POIS:</span>
          {[
            { id: 'viewpoint', label: '🏔 Viewpoints' },
            { id: 'beach', label: '🏖 Beaches & Coves' },
            { id: 'water', label: '🚰 Water Nodes' },
            { id: 'gastro', label: '🍷 Gastro / OPGs' },
          ].map((layer) => {
            const isToggled = activeLayers.includes(layer.id)
            return (
              <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  checked={isToggled}
                  onChange={() => onToggleLayer(layer.id)}
                  style={{ accentColor: '#00e676' }}
                />
                {layer.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
