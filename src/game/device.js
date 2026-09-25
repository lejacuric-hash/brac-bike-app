import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { parseGameLink } from './config'

const isCancel = (err) => /cancel/i.test(err?.message || String(err))

// Opens the camera directly (not the gallery). In a browser, Capacitor falls
// back to a file input. Returns a Blob, or null if the user backed out.
export async function capturePhoto() {
  try {
    const result = await Camera.takePhoto({
      quality: 85,
      targetWidth: 1600,
      targetHeight: 1600,
      correctOrientation: true,
      webUseInput: true,
    })
    if (!result?.webPath) return null
    const response = await fetch(result.webPath)
    return await response.blob()
  } catch (err) {
    if (isCancel(err)) return null
    throw err
  }
}

export class QrUnavailableError extends Error {}

// Google's code-scanner UI (no camera permission needed). Accepts either a
// full game link (https://<domain>/g/<code>) or a bare code. Returns the
// code, or null if the user backed out or scanned something else.
export async function scanQrCode() {
  if (!Capacitor.isNativePlatform()) throw new QrUnavailableError()
  const { supported } = await BarcodeScanner.isSupported()
  if (!supported) throw new QrUnavailableError()
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
  if (!available) {
    // Downloads in the background via Play Services; the first scan may
    // have to be retried once it has finished.
    await BarcodeScanner.installGoogleBarcodeScannerModule()
  }
  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })
    const raw = barcodes?.[0]?.rawValue?.trim()
    if (!raw) return null
    return parseGameLink(raw) || (/^[A-Za-z0-9]{6,}$/.test(raw) ? raw.toUpperCase() : null)
  } catch (err) {
    if (isCancel(err)) return null
    throw err
  }
}
