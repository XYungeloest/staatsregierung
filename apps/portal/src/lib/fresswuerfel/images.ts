import { imageSize } from 'image-size';

export const MAX_SKETCH_BYTES = 5 * 1024 * 1024;
export const MAX_SKETCH_PIXELS = 4_194_304;
const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
export async function validateSketch(bytes: Uint8Array, declaredType: string): Promise<string> {
  if (!bytes.length || bytes.length > MAX_SKETCH_BYTES) throw new Error('Bitte wählen Sie ein Bild bis 5 MB aus.');
  try {
    const info = imageSize(bytes);
    const mime = types[info.type ?? ''];
    if (!mime || mime !== declaredType) throw new Error();
    if (!info.width || !info.height || info.width > 4096 || info.height > 4096 || info.width * info.height > MAX_SKETCH_PIXELS) {
      throw new RangeError('Bitte verkleinern Sie Ihr Bild auf höchstens 4 Megapixel und 4.096 Pixel je Seite.');
    }
    // Erst die begrenzten Maße prüfen, danach tatsächlich decodieren. Dateiendung/MIME allein genügen nicht.
    const { PhotonImage } = await import('@cf-wasm/photon');
    const decoded = PhotonImage.new_from_byteslice(bytes);
    try {
      if (decoded.get_width() !== info.width || decoded.get_height() !== info.height) throw new Error();
    } finally { decoded.free(); }
    return mime;
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new Error('Das Bild ist ungültig. Bitte wählen Sie eine lesbare JPEG-, PNG- oder WebP-Datei.');
  }
}
