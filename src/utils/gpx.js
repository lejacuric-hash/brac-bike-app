// Shared by the GPX download buttons on GPX trail details, user route
// details, and the Plan New route summary — builds a minimal but valid
// GPX 1.1 track file from a list of {lat, lng, altitude?/ele?, timestamp?}
// points, and triggers a browser download for it.

export function generateGpx(route, trackPoints) {
  const name = route?.name || 'My Route'
  const points = trackPoints || []

  const trkpts = points.map((point) => {
    const ele = point.altitude || point.ele || 0
    const time = point.timestamp
      ? new Date(point.timestamp).toISOString()
      : new Date().toISOString()
    return `    <trkpt lat="${point.lat}" lon="${point.lng}">
      <ele>${ele}</ele>
      <time>${time}</time>
    </trkpt>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Brač Bike App"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1
    http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <desc>Recorded with Brač Bike App</desc>
    <time>${new Date().toISOString()}</time>
    <bounds
      minlat="${Math.min(...points.map((p) => p.lat))}"
      maxlat="${Math.max(...points.map((p) => p.lat))}"
      minlon="${Math.min(...points.map((p) => p.lng))}"
      maxlon="${Math.max(...points.map((p) => p.lng))}"
    />
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
}

// Triggers a browser download of already-generated file content (used for
// blob-based GPX downloads — generated routes, not the static GPX trail
// files, which download directly via their existing /tracks/ URL instead).
export function downloadGpxFile(gpxContent, filename) {
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
