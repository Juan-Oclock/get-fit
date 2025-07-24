import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, Dumbbell } from 'lucide-react';
import { CommunityFeedItem } from './community-feed-item';
import { ActiveUserCountLabel } from './active-user-count-label';

// Remove: import { supabase } from '@/lib/supabase';
// Add below inside each function or effect that uses supabase:

useEffect(() => {
  async function fetchOptIn() {
    if (!user?.id) return;
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase
      .from('users')
      .select('show_in_community')
      .eq('id', user.id)
      .single();
    if (!error && data) setOptedIn(!!data.show_in_community);
  }
  fetchOptIn();
}, [user]);

// Repeat this pattern for all other supabase usages in this file, replacing static imports with dynamic imports inside the relevant functions/effects.
import { useAuth } from '@/hooks/useAuth';

interface CommunityUserActivity {
  user_id: string;
  username: string;
  profile_image_url?: string | null;
  workout_name: string;
  exercise_names: string; // Comma-separated exercise names
  last_active: string; // ISO string
}

export default function CommunityDashboard() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<CommunityUserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [optedIn, setOptedIn] = useState(false);

  // Fetch opt-in status
  useEffect(() => {
    async function fetchOptIn() {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('users')
        .select('show_in_community')
        .eq('id', user.id)
        .single();
      if (!error && data) setOptedIn(!!data.show_in_community);
    }
    fetchOptIn();
  }, [user]);

  // Fetch and subscribe to presence
  useEffect(() => {
    let subscription: any;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    async function fetchActivities() {
      setLoading(true);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Show last 24 hours for testing
      const { data, error } = await supabase
        .from('community_presence')
        .select('*')
        .gte('last_active', since)
        .neq('workout_name', '') // Filter out heartbeat entries with empty workout names
        .order('last_active', { ascending: false });
      if (!error && data) setActivities(data);
      setLoading(false);
    }
    fetchActivities();
    // Subscribe to realtime changes
    subscription = supabase
      .channel('community_presence_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_presence' }, () => {
        fetchActivities();
      })
      .subscribe();

    // Heartbeat: update presence every 60s if opted in
    async function heartbeatPresence() {
      if (!user?.id || !optedIn) return;
      
      // Check if user already has workout data in community_presence
      const { data: existingPresence } = await supabase
        .from('community_presence')
        .select('workout_name, exercise_names')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Only update if there's no existing workout data, or if it's been more than 1 hour since last workout
      if (existingPresence && existingPresence.workout_name && existingPresence.exercise_names) {
        // Just update the timestamp, don't overwrite workout data
        await supabase
          .from('community_presence')
          .update({ last_active: new Date().toISOString() })
          .eq('user_id', user.id);
      } else {
        // No existing workout data, safe to upsert with empty values
        const { data: profile } = await supabase.from('users').select('username, profile_image_url').eq('id', user.id).maybeSingle();
        await supabase.from('community_presence').upsert({
          user_id: user.id,
          username: profile?.username || user.email,
          profile_image_url: profile?.profile_image_url || null,
          workout_name: '', // blank for heartbeat
          exercise_names: '', // blank for heartbeat
          last_active: new Date().toISOString(),
        });
      }
    }
    if (user?.id && optedIn) {
      heartbeatPresence(); // initial
      heartbeatInterval = setInterval(heartbeatPresence, 60000); // every 60s
    }
    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [user, optedIn]);

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <h1 className="text-3xl font-bold text-white mb-4">Community Dashboard</h1>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Community Feed</h2>
            <p className="text-slate-400 text-sm">See what others are working on in real time (opt-in required).</p>
          </div>
          <span className={`rounded px-3 py-1 text-xs font-bold ${optedIn ? 'bg-green-700 text-green-200' : 'bg-slate-700 text-slate-400'}`}>
            {optedIn ? 'Sharing Enabled' : 'Private'}
          </span>
        </CardContent>
      </Card>
      {/* Active users label */}
      <ActiveUserCountLabel />


      {!optedIn ? (
        <div className="text-center text-slate-400 py-12">
          Enable sharing in your Settings to join the live community feed!
        </div>
      ) : loading ? (
        <div className="text-center text-slate-400 py-12">Loading community activity...</div>
      ) : (
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No community activity yet. Be the first to finish a workout!
            </div>
          ) : (
            activities.map((activity) => (
  <CommunityFeedItem key={activity.user_id + activity.last_active} activity={activity} />
))
          )}
        </div>
      )}
    </div>
  );
}
