import { useState } from 'react';
import { usePools } from '../hooks/usePools';
import { useLanguage } from '../i18n/LanguageContext';

export default function PoolSelector({ onManagePools }) {
  const { pools, activePool, selectPool } = usePools();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  if (pools.length <= 1) return null;

  return (
    <div className="pool-selector">
      <button className="pool-selector__trigger" onClick={() => setOpen(!open)}>
        <span className="pool-selector__name">{activePool?.name || t('selectPool')}</span>
        <span className={`pool-selector__arrow ${open ? 'pool-selector__arrow--open' : ''}`}>▾</span>
      </button>

      {open && (
        <>
          <div className="pool-selector__overlay" onClick={() => setOpen(false)} />
          <div className="pool-selector__dropdown">
            {pools.map((pool) => (
              <button
                key={pool.id}
                className={`pool-selector__option ${pool.id === activePool?.id ? 'pool-selector__option--active' : ''}`}
                onClick={() => { selectPool(pool.id); setOpen(false); }}
              >
                {pool.name}
                {pool.id === activePool?.id && <span>✓</span>}
              </button>
            ))}
            <button className="pool-selector__option pool-selector__option--manage" onClick={() => { setOpen(false); onManagePools(); }}>
              {t('poolManage')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
