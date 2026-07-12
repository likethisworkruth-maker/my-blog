import { createClient } from 'npm:@supabase/supabase-js@2';
import { requiredSecret } from './hmac.ts';

export function adminClient() {
  return createClient(requiredSecret('SUPABASE_URL'), requiredSecret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
