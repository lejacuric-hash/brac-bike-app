function renderStars(rating) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating || 0)))
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded)
}

function formatReviewDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Shared between GPX trail details and user route details so both show
// reviews identically — title is the only thing that differs between them.
export default function ReviewsSection({ reviews = [], title = 'Reviews' }) {
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length
    : null

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ color: '#ffffff', margin: '0 0 8px', fontSize: '1rem', fontWeight: 600 }}>{title}</h4>

      {averageRating != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ color: '#facc15', fontSize: '1.1rem', letterSpacing: '1px' }}>{renderStars(averageRating)}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
            {averageRating.toFixed(1)} / 5 · {reviews.length} review{reviews.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {reviews.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: 0 }}>No reviews yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reviews.map((review, index) => (
            <div
              key={review.id ?? `${review.route_id ?? 'review'}-${index}`}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px' }}>
                <span style={{ color: '#facc15', fontSize: '0.9rem', letterSpacing: '1px' }}>{renderStars(review.rating)}</span>
                {review.created_at && (
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {formatReviewDate(review.created_at)}
                  </span>
                )}
              </div>
              <div style={{ color: '#ffffff', fontSize: '0.85rem' }}>{review.comment || 'No comment'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
