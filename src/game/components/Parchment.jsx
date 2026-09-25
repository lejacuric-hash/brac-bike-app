import PropTypes from 'prop-types'
import RichText from './RichText'

const SIGNATURE_RE = /\s*— Loda$/

// Old paper card for Loda's texts. Letters that already end in "— Loda" have
// it pulled out and shown as the signature line.
export default function Parchment({ title, paragraphs, signature, children, className = '' }) {
  const paras = [...(paragraphs || [])]
  let sig = signature
  const last = paras[paras.length - 1] || ''
  if (SIGNATURE_RE.test(last)) {
    paras[paras.length - 1] = last.replace(SIGNATURE_RE, '')
    sig = '— Loda'
  }
  return (
    <article className={`parchment ${className}`}>
      {title && <p className="parchment-title">{title}</p>}
      {paras.map((p, i) => (
        <p key={i} className="parchment-text"><RichText text={p} /></p>
      ))}
      {children}
      {sig && <p className="parchment-sign">{sig}</p>}
    </article>
  )
}

Parchment.propTypes = {
  title: PropTypes.string,
  paragraphs: PropTypes.arrayOf(PropTypes.string),
  signature: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
}
