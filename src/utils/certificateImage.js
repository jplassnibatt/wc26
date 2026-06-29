// Renders the group-stage champion certificate to a self-contained PNG, then
// shares it (Web Share API → WhatsApp/etc. on mobile) or downloads it (desktop).
//
// We draw on a <canvas> by hand instead of screenshotting the DOM: it keeps the
// output identical regardless of light/dark theme, dodges cross-origin canvas
// tainting from remote avatar photos, and produces a crisp portrait card sized
// for messaging apps — all with zero extra dependencies.

const W = 1080; // portrait card width; height is computed from content
const PAD = 84;
const CONTENT_W = W - PAD * 2;

const COLORS = {
  paper: '#FFFFFF',
  gold: '#C9A84C',
  goldSoft: 'rgba(201, 168, 76, 0.12)',
  goldText: '#8A6D1E',
  green: '#006341',
  dark: '#1A1A1A',
  gray: '#6B7280',
  white: '#FFFFFF',
};

const TITLE_FONT = "'Oswald', 'Arial Narrow', sans-serif";
const BODY_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// Make sure the fonts we draw with are actually loaded, otherwise the first
// render falls back to a system face and the title looks wrong.
async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`700 72px ${TITLE_FONT}`),
      document.fonts.load(`700 30px ${BODY_FONT}`),
      document.fonts.load(`400 30px ${BODY_FONT}`),
    ]);
  } catch {
    /* fonts are best-effort; system fallback is fine */
  }
}

function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Resolve the same avatar source chain the <Avatar> component uses, but only for
// same-origin or CORS-safe images. Returns null when we should draw a glyph.
function avatarImageSrc(winner) {
  const { avatar, avatarKind, customPhotoURL } = winner;
  if (typeof avatar === 'string' && avatar.startsWith('legend:')) {
    return `${import.meta.env.BASE_URL}avatars/legends/${avatar.slice(7)}.png`;
  }
  if (avatarKind === 'photo' && customPhotoURL) return customPhotoURL;
  return null;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// A single layout/paint pass. When `draw` is false it only measures, returning
// the total height so we can size the canvas before the real paint.
function paint(ctx, winner, t, avatarImg, draw) {
  let y = PAD;
  const cx = W / 2;

  const text = (str, font, color, size, lineH, maxW = CONTENT_W) => {
    ctx.font = `${font}`;
    const lines = wrapLines(ctx, str, maxW);
    for (const ln of lines) {
      if (draw) {
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(ln, cx, y + size);
      }
      y += lineH;
    }
    return lines;
  };

  // Seal 🔮
  if (draw) {
    ctx.font = '120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('🔮', cx, y + 110);
  }
  y += 140;

  // Badge pill
  {
    ctx.font = `700 24px ${BODY_FONT}`;
    const label = t('certBadge').toUpperCase();
    const tw = ctx.measureText(label).width;
    const pw = tw + 56;
    const ph = 54;
    if (draw) {
      roundRect(ctx, cx - pw / 2, y, pw, ph, ph / 2);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.goldText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, y + ph / 2 + 1);
    }
    y += ph + 36;
  }

  // Intro
  text(t('certIntro'), `400 30px ${BODY_FONT}`, COLORS.gray, 30, 42);
  y += 28;

  // Winner avatar circle
  {
    const r = 78;
    const acy = y + r;
    if (draw) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, acy, r, 0, Math.PI * 2);
      ctx.closePath();
      if (avatarImg) {
        ctx.clip();
        ctx.drawImage(avatarImg, cx - r, acy - r, r * 2, r * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = COLORS.green;
        ctx.fill();
        ctx.restore();
        const glyph =
          typeof winner.avatar === 'string' && !winner.avatar.startsWith('legend:')
            ? winner.avatar
            : (winner.nickname?.charAt(0).toUpperCase() || '?');
        ctx.font = `700 64px ${BODY_FONT}`;
        ctx.fillStyle = COLORS.white;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, cx, acy + 4);
      }
      // gold ring
      ctx.beginPath();
      ctx.arc(cx, acy, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    y += r * 2 + 24;
  }

  // Winner name
  text(winner.nickname || '', `700 40px ${BODY_FONT}`, COLORS.dark, 40, 50);
  y += 18;

  // Title
  text(t('certTitle'), `700 76px ${TITLE_FONT}`, COLORS.goldText, 76, 84);
  y += 8;

  // Phase
  text(t('certPhase').toUpperCase(), `600 26px ${BODY_FONT}`, COLORS.gray, 26, 38);
  y += 36;

  // Reasons (left-aligned bulleted list with 🔮)
  {
    const bulletGap = 46;
    const listW = CONTENT_W;
    const reasons = [t('certReason1'), t('certReason2'), t('certReason3')];
    ctx.font = `400 28px ${BODY_FONT}`;
    for (const reason of reasons) {
      const lines = wrapLines(ctx, reason, listW - bulletGap);
      if (draw) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '26px sans-serif';
        ctx.fillText('🔮', PAD, y + 28);
        ctx.font = `400 28px ${BODY_FONT}`;
        ctx.fillStyle = COLORS.dark;
        let ly = y;
        for (const ln of lines) {
          ctx.fillText(ln, PAD + bulletGap, ly + 28);
          ly += 40;
        }
      }
      y += lines.length * 40 + 18;
    }
    y += 14;
  }

  // Prize box (dashed gold)
  {
    ctx.font = `600 30px ${BODY_FONT}`;
    const valueLines = wrapLines(ctx, t('certPrize'), CONTENT_W - 56);
    const boxH = 36 + 38 + valueLines.length * 42 + 28;
    if (draw) {
      ctx.save();
      roundRect(ctx, PAD, y, CONTENT_W, boxH, 18);
      ctx.fillStyle = COLORS.goldSoft;
      ctx.fill();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 24px ${BODY_FONT}`;
      ctx.fillStyle = COLORS.goldText;
      ctx.fillText(t('certPrizeLabel').toUpperCase(), cx, y + 44);

      ctx.font = `600 30px ${BODY_FONT}`;
      ctx.fillStyle = COLORS.dark;
      let py = y + 44 + 44;
      for (const ln of valueLines) {
        ctx.fillText(ln, cx, py);
        py += 42;
      }
    }
    y += boxH + 32;
  }

  // Nostradamus footnote
  text(t('certNostradamus'), `italic 400 24px ${BODY_FONT}`, COLORS.gray, 24, 34);

  return y + PAD;
}

// Builds the certificate PNG and returns a Blob.
export async function renderCertificateBlob(winner, t) {
  await ensureFonts();

  const src = avatarImageSrc(winner);
  const avatarImg = src ? await loadImage(src) : null;

  // First pass: measure with a throwaway context.
  const measure = document.createElement('canvas').getContext('2d');
  const height = Math.ceil(paint(measure, winner, t, avatarImg, false));

  // Second pass: paint at 2× for crisp print/retina output.
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Paper + subtle gold glow at the top, then a gold frame.
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, W, height);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.9);
  glow.addColorStop(0, 'rgba(232, 201, 122, 0.18)');
  glow.addColorStop(1, 'rgba(232, 201, 122, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, height * 0.6);

  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 6;
  roundRect(ctx, 14, 14, W - 28, height - 28, 24);
  ctx.stroke();

  paint(ctx, winner, t, avatarImg, true);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/png', 0.95)
  );
  if (!blob) throw new Error('toBlob returned null');
  return blob;
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

// Generates the image and shares it (mobile) or downloads it (desktop).
// Returns 'shared' | 'downloaded' | 'cancelled'.
export async function shareCertificate(winner, t) {
  const blob = await renderCertificateBlob(winner, t);
  const filename = `oraculo-${slug(winner.nickname)}.png`;
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
