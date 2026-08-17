// Strips diacritics (č,š,ž etc) via Unicode decomposition, then replaces
// anything else outside the URL-safe set so Supabase Storage never sees a
// path with a raw space/accent/paren in it.
export const sanitizeFileName = (filename) => {
  const withoutDiacritics = Array.from(filename.normalize('NFD'))
    .filter((ch) => {
      const code = ch.codePointAt(0)
      return code < 0x0300 || code > 0x036f
    })
    .join('')

  return withoutDiacritics
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase()
}
