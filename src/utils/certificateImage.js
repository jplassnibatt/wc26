// Exports the group-stage champion certificate by snapshotting the *actual*
// styled card from the DOM, so the shared image / printed PDF look identical to
// the on-screen version — no parallel hand-drawn design to drift out of sync.
//
// We clone the live card, force a print-friendly light palette (via the
// `cert--export` class, which redefines the theme custom properties), drop the
// action buttons, and rasterise it with html-to-image onto an opaque white
// background — which is what fixes the "transparent background" exports.

import { toBlob, getFontEmbedCSS } from 'html-to-image';

// Wait for the document's web fonts so the captured title isn't a fallback face.
async function ensureFonts() {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are best-effort; system fallback is fine */
  }
}

// Embedding the web fonts (fetching the Google Fonts CSS + each font file and
// base64-ing them) is by far the slowest part of a capture. It never changes
// between exports, so compute it once and reuse — turning the second+ export
// (and the print path) from seconds into near-instant.
let fontEmbedCSSCache;
async function embeddedFontCSS(node) {
  if (fontEmbedCSSCache === undefined) {
    try {
      fontEmbedCSSCache = await getFontEmbedCSS(node);
    } catch {
      fontEmbedCSSCache = '';
    }
  }
  return fontEmbedCSSCache;
}

// Kick off the (one-time) font embedding ahead of time — e.g. when the
// certificate modal opens — so the first export click is already fast.
export function prewarmCertificateExport(node) {
  if (node) embeddedFontCSS(node);
}

// Resolve once every <img> in the clone has settled (loaded or errored), so the
// snapshot isn't taken before the avatar paints. Capped so a stuck remote photo
// can't hang the export.
function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'));
  return Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 2000);
      });
    })
  );
}

// Snapshots the live certificate card to an opaque PNG Blob.
export async function renderCertificateBlob(cardEl) {
  if (!cardEl) throw new Error('certificate card element missing');
  await ensureFonts();

  // Clone so we never disturb the visible modal while preparing the snapshot.
  const clone = cardEl.cloneNode(true);
  clone.classList.add('cert--export');
  clone.querySelectorAll('.cert__actions, .cert__close').forEach((n) => n.remove());

  // Render off-screen at its natural (full, un-clipped) height.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed; left:-10000px; top:0; pointer-events:none;';
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone);
    const fontEmbedCSS = await embeddedFontCSS(clone);
    const blob = await toBlob(clone, {
      // 512px card × 3 → ~1536×2126 px ≈ 300 dpi at 13×18 cm photo paper.
      pixelRatio: 3,
      backgroundColor: '#ffffff', // opaque paper — no transparent corners
      fontEmbedCSS, // reuse the cached font CSS instead of re-fetching it
    });
    if (!blob) throw new Error('toBlob returned null');
    return blob;
  } finally {
    host.remove();
  }
}

function slug(name) {
  return (
    String(name || 'oraculo')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'oraculo'
  );
}

function nicknameFrom(cardEl) {
  return cardEl?.querySelector('.cert__name')?.textContent?.trim() || '';
}

// Generates the image and shares it (mobile) or downloads it (desktop).
// Returns 'shared' | 'downloaded' | 'cancelled'.
export async function shareCertificate(cardEl, t) {
  const blob = await renderCertificateBlob(cardEl);
  const filename = `oraculo-${slug(nicknameFrom(cardEl))}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t('certShareCaption'), text: t('certShareCaption') });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // fall through to download on any other share failure
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

// "Save as PDF" via native print. We add a rasterised image of the card to a
// print-only layer in the page and call window.print() directly (no iframe —
// iframe.print() is a silent no-op in several browsers). The gold background is
// baked into the image pixels, so it prints reliably regardless of the browser's
// "background graphics" setting. The @media-print rules (App.css) hide everything
// except .cert-print-layer.
export async function printCertificate(cardEl) {
  const blob = await renderCertificateBlob(cardEl);
  const url = URL.createObjectURL(blob);

  const layer = document.createElement('div');
  layer.className = 'cert-print-layer';
  const img = document.createElement('img');
  img.alt = '';
  img.src = url;
  layer.appendChild(img);
  document.body.appendChild(layer);

  const cleanup = () => {
    layer.remove();
    URL.revokeObjectURL(url);
    window.removeEventListener('afterprint', cleanup);
  };

  // Wait for the image to decode before printing, or the page prints blank.
  await new Promise((resolve) => {
    if (img.complete) return resolve();
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 2000);
  });

  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  // Fallback cleanup for browsers that don't fire afterprint.
  setTimeout(cleanup, 60000);
}
