import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconBg?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon, iconBg = 'rgba(99,102,241,0.15)', loading = false }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      {loading ? (
        <span className="skeleton" style={{ width: '3rem', height: '2rem' }} />
      ) : (
        <div className="stat-card-value">{value}</div>
      )}
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
