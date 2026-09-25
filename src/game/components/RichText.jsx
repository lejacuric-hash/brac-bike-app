import PropTypes from 'prop-types'

// Renders the markdown emphasis kept in the content files:
// ***bold italic***, **bold**, *italic*.
export default function RichText({ text }) {
  const parts = String(text ?? '').split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('***') && part.endsWith('***')) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

RichText.propTypes = { text: PropTypes.string }
