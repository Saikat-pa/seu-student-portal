export function normalizeAuthError(err) {
  if (!err) return null;

  const msg = err.message || String(err);

  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Network request failed') ||
    msg.includes('Load failed')
  ) {
    if (window.location.protocol === 'file:') {
      return 'সাইট file:// দিয়ে খোলা হয়েছে। টার্মিনালে npx serve . চালিয়ে http://localhost দিয়ে খুলুন।';
    }
    return 'ইন্টারনেট বা Supabase-এ সংযোগ ব্যর্থ। ইন্টারনেট চেক করুন, তারপর পেজ রিফ্রেশ করুন।';
  }

  if (msg.includes('Invalid login credentials')) {
    return 'ইমেইল বা পাসওয়ার্ড ভুল।';
  }

  if (msg.includes('Email not confirmed')) {
    return 'ইমেইল verify করুন, অথবা Supabase-এ Confirm email বন্ধ করুন।';
  }

  if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('over_email_send_rate_limit')) {
    return 'Supabase email limit পূর্ণ। ১ ঘণ্টা অপেক্ষা করুন, অথবা Dashboard-এ Confirm email বন্ধ করে আবার Register করুন।';
  }

  return msg;
}

export async function wrapAuthCall(fn) {
  try {
    return await fn();
  } catch (err) {
    return { data: null, error: { message: normalizeAuthError(err) } };
  }
}
