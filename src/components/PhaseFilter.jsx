export default function PhaseFilter({ phases, active, onSelect }) {
  return (
    <div className="phase-filter">
      <div className="phase-filter__scroll">
        {phases.map((phase) => (
          <button
            key={phase.id}
            className={`phase-filter__chip ${active === phase.id ? 'phase-filter__chip--active' : ''}`}
            onClick={() => onSelect(phase.id)}
          >
            {phase.name}
          </button>
        ))}
      </div>
    </div>
  );
}
