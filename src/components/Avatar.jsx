// Renders a user's avatar with a consistent fallback chain:
//   legend photo ('avatar' = "legend:<file>") → uploaded photo → emoji → initial.
// `className` keeps each call site's existing styling (leaderboard__avatar,
// hamburger-menu__avatar, …); we only swap what's inside the circle.

// Bundled legend photos live in /public/avatars/legends/<file>.png.
const LEGEND_PREFIX = 'legend:';
function legendSrc(avatar) {
  if (typeof avatar !== 'string' || !avatar.startsWith(LEGEND_PREFIX)) return null;
  const file = avatar.slice(LEGEND_PREFIX.length);
  return `${import.meta.env.BASE_URL}avatars/legends/${file}.png`;
}

function imageAvatar(src, className) {
  return (
    <span className={className} style={{ padding: 0, overflow: 'hidden' }}>
      <img
        src={src}
        alt=""
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  );
}

export default function Avatar({ nickname, avatar, customPhotoURL, avatarKind, className }) {
  const initial = nickname?.charAt(0).toUpperCase() || '?';

  const legend = legendSrc(avatar);
  if (legend) return imageAvatar(legend, className);

  if (avatarKind === 'photo' && customPhotoURL) return imageAvatar(customPhotoURL, className);

  if (avatar) {
    return <span className={className} aria-hidden="true">{avatar}</span>;
  }

  return <span className={className}>{initial}</span>;
}
