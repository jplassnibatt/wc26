import * as Sentry from '@sentry/react';

function FallbackUI() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '24px',
      textAlign: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <span style={{ fontSize: 48, marginBottom: 16 }}>😵</span>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Algo correu mal
      </h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 24, maxWidth: 300 }}>
        Ocorreu um erro inesperado. Tenta recarregar a página.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '12px 24px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #006341, #00A86B)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Recarregar
      </button>
    </div>
  );
}

export default function ErrorBoundary({ children }) {
  return (
    <Sentry.ErrorBoundary fallback={<FallbackUI />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
