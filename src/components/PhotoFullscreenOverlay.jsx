export default function PhotoFullscreenOverlay({ photoUrl, onClose }) {
  if (!photoUrl) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'zoom-out',
        padding: '16px',
      }}
    >
      <img
        src={photoUrl}
        alt=""
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      />
    </div>
  )
}
