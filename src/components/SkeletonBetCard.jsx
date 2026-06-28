// Placeholder shown while bets load — mirrors the BetCard silhouette so the
// layout doesn't jump when real cards arrive. The shimmer is purely cosmetic
// and is frozen by the global prefers-reduced-motion rule.
function SkeletonBetCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-line skeleton-line--date" />
      <div className="skeleton-teams">
        <div className="skeleton-team">
          <div className="skeleton-flag" />
          <div className="skeleton-line skeleton-line--name" />
        </div>
        <div className="skeleton-score" />
        <div className="skeleton-team skeleton-team--away">
          <div className="skeleton-line skeleton-line--name" />
          <div className="skeleton-flag" />
        </div>
      </div>
    </div>
  );
}

export default function SkeletonBetList({ count = 5 }) {
  return (
    <div className="bets__list" role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBetCard key={i} />
      ))}
    </div>
  );
}
