import { useEffect, useState } from 'react';
import { CalendarDays, Store, Megaphone, Users, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/admin/StatCard';

interface DashboardStats {
  registeredCount: number;
  anonymousCount: number;
  exhibitionsCount: number;
  storesCount: number;
  announcementsCount: number;
}

interface ActivityItem {
  id: string;
  type: 'visitor_location' | 'announcement';
  title: string;
  subtitle: string;
  time: string;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    registeredCount: 0,
    anonymousCount: 0,
    exhibitionsCount: 0,
    storesCount: 0,
    announcementsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        
        // 1. Run anonymous user cleanup (older than 1 hour)
        try {
          await supabase.rpc('delete_expired_anonymous_profiles');
        } catch (rpcErr) {
          console.warn('Postgres function delete_expired_anonymous_profiles not installed yet. Make sure you run database/cleanup_anonymous_profiles.sql:', rpcErr);
        }

        // 2. Fetch counts separately
        const [registeredRes, anonymousRes, exhibitionsRes, storesRes, announcementsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_anonymous', false),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_anonymous', true),
          supabase.from('exhibitions').select('id', { count: 'exact', head: true }),
          supabase.from('stores').select('id', { count: 'exact', head: true }),
          supabase.from('announcements').select('id', { count: 'exact', head: true }),
        ]);

        const registeredCount = registeredRes.count ?? 0;
        const anonymousCount = anonymousRes.count ?? 0;
        const exhibitionsCount = exhibitionsRes.count ?? 0;
        const storesCount = storesRes.count ?? 0;
        const announcementsCount = announcementsRes.count ?? 0;

        setStats({
          registeredCount,
          anonymousCount,
          exhibitionsCount,
          storesCount,
          announcementsCount,
        });

        // 3. Fetch recent activity (e.g. latest active announcements & latest visitor profiles updates)
        const [recentAnnouncements, recentProfiles] = await Promise.all([
          supabase
            .from('announcements')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('profiles')
            .select('id, name, created_at, is_anonymous')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const items: ActivityItem[] = [];

        if (recentAnnouncements.data) {
          recentAnnouncements.data.forEach((ann) => {
            items.push({
              id: ann.id,
              type: 'announcement',
              title: `Announcement: ${ann.title}`,
              subtitle: 'New alert published',
              time: new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          });
        }

        if (recentProfiles.data) {
          recentProfiles.data.forEach((prof) => {
            items.push({
              id: prof.id,
              type: 'visitor_location',
              title: prof.name || 'Anonymous Visitor',
              subtitle: prof.is_anonymous ? 'Guest joined session' : 'Registered new account',
              time: new Date(prof.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          });
        }

        // Sort by time or just display combined
        setActivities(items.slice(0, 8));
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Real-time system overview and stats</p>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="stat-cards-grid">
        <StatCard
          label="Registered Accounts"
          value={stats.registeredCount}
          loading={loading}
          icon={<Users size={20} color="var(--color-primary-h)" />}
        />
        <StatCard
          label="Guest Sessions"
          value={stats.anonymousCount}
          loading={loading}
          icon={<Users size={20} color="var(--color-accent)" style={{ opacity: 0.8 }} />}
        />
        <StatCard
          label="Exhibitions"
          value={stats.exhibitionsCount}
          loading={loading}
          icon={<CalendarDays size={20} color="var(--color-accent)" />}
        />
        <StatCard
          label="Stores / Booths"
          value={stats.storesCount}
          loading={loading}
          icon={<Store size={20} color="var(--color-success)" />}
        />
        <StatCard
          label="Announcements"
          value={stats.announcementsCount}
          loading={loading}
          icon={<Megaphone size={20} color="var(--color-warning)" />}
        />
      </section>

      {/* Activity Section */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginTop: '1rem' }}>
        <div className="glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Activity size={18} color="var(--color-primary-h)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Recent Activities</h2>
          </div>

          <div className="activity-feed">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="activity-item">
                  <div className="skeleton" style={{ width: '100%', height: 20 }} />
                </div>
              ))
            ) : activities.length === 0 ? (
              <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>
                No recent activity recorded.
              </p>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="activity-item">
                  <div
                    className="activity-dot"
                    style={{
                      background:
                        act.type === 'announcement'
                          ? 'var(--color-warning)'
                          : 'var(--color-primary)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{act.title}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{act.subtitle}</p>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{act.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
