import React from 'react';

const getStrength = (password) => {
  let score = 0;
  if (!password) return { score: 0, label: '', color: '' };
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good', color: '#3b82f6' };
  return { score, label: 'Strong', color: '#22c55e' };
};

const getHints = (password) => {
  const hints = [];
  if (password.length < 8) hints.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) hints.push('One uppercase letter');
  if (!/[0-9]/.test(password)) hints.push('One number');
  if (!/[^A-Za-z0-9]/.test(password)) hints.push('One special character (!@#$...)');
  return hints;
};

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const { score, label, color } = getStrength(password);
  const hints = getHints(password);
  const maxScore = 5;

  return (
    <div style={{ marginTop: '4px', marginBottom: '8px' }}>
      {/* Bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {Array.from({ length: maxScore }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: i < score ? color : '#e5e7eb',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color, fontWeight: 600 }}>{label}</span>
      </div>

      {/* Hints */}
      {hints.length > 0 && score < 4 && (
        <ul style={{ margin: '4px 0 0', padding: '0 0 0 16px', fontSize: '11px', color: '#9ca3af' }}>
          {hints.map((hint, i) => <li key={i}>{hint}</li>)}
        </ul>
      )}
    </div>
  );
}