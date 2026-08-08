// Shared between GPX trail details (community photos) and user route details
// (own ride photos) — returns null when empty, per design: no empty gallery UI.
export default function PhotoGallery({ photos = [], onPhotoClick, title = 'Photos' }) {
  if (!photos || photos.length === 0) return null

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ color: '#ffffff', margin: '0 0 8px', fontSize: '1rem', fontWeight: 600 }}>{title}</h4>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {photos.map((url, index) => (
          <img
            key={`${url}-${index}`}
            src={url}
            alt=""
            onClick={() => onPhotoClick?.(url)}
            style={{
              width: '90px',
              height: '90px',
              objectFit: 'cover',
              borderRadius: '10px',
              flexShrink: 0,
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
