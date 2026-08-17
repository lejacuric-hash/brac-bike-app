// road_reports has no dedicated photo_urls column — ReportProblem.jsx embeds
// the uploaded photo's public URL as a "Photo: <url>" line inside the
// description text, so that's where a photo has to be recovered from. If a
// photo_urls array ever gets added to the table, prefer that instead.
const PHOTO_LINE_RE = /(?:^|\n)Photo:\s*(\S+)/i

export function extractReportPhoto(report) {
  if (Array.isArray(report?.photo_urls) && report.photo_urls.length > 0) {
    return { photoUrl: report.photo_urls[0], text: report?.description || '' }
  }

  const description = report?.description || ''
  const match = description.match(PHOTO_LINE_RE)
  if (!match) return { photoUrl: null, text: description }

  return { photoUrl: match[1], text: description.replace(match[0], '').trim() }
}
