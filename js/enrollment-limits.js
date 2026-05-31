/** Min/max credits per student — shared by local mode and Supabase API. */

export const DEFAULT_ENROLLMENT_LIMITS = {
  min_enrollment_credits: 0,
  max_enrollment_credits: 21,
};

export function normalizeEnrollmentLimits(raw) {
  const min = Number(raw?.min_enrollment_credits);
  const max = Number(raw?.max_enrollment_credits);
  let min_enrollment_credits = Number.isFinite(min) ? Math.round(min) : DEFAULT_ENROLLMENT_LIMITS.min_enrollment_credits;
  let max_enrollment_credits = Number.isFinite(max) ? Math.round(max) : DEFAULT_ENROLLMENT_LIMITS.max_enrollment_credits;
  min_enrollment_credits = Math.max(0, Math.min(60, min_enrollment_credits));
  max_enrollment_credits = Math.max(1, Math.min(60, max_enrollment_credits));
  if (min_enrollment_credits > max_enrollment_credits) {
    min_enrollment_credits = max_enrollment_credits;
  }
  return { min_enrollment_credits, max_enrollment_credits };
}

export function enrolledCredits(enrollments) {
  return (enrollments || [])
    .filter((e) => ['enrolled', 'completed'].includes(e.status))
    .reduce((sum, e) => sum + (e.course_catalog?.credits || 0), 0);
}

export function validateEnrollmentLimitsForm(minVal, maxVal) {
  const limits = normalizeEnrollmentLimits({
    min_enrollment_credits: minVal,
    max_enrollment_credits: maxVal,
  });
  const errors = {};
  const min = Number(minVal);
  const max = Number(maxVal);
  if (!Number.isInteger(min) || min < 0 || min > 60) {
    errors.min = 'Minimum must be a whole number from 0 to 60.';
  }
  if (!Number.isInteger(max) || max < 1 || max > 60) {
    errors.max = 'Maximum must be a whole number from 1 to 60.';
  }
  if (!errors.min && !errors.max && min > max) {
    errors.max = 'Maximum must be greater than or equal to minimum.';
  }
  return { errors, limits };
}

export function checkEnrollCredits(currentCredits, addCredits, limits) {
  const max = limits.max_enrollment_credits;
  if (currentCredits + addCredits > max) {
    return {
      ok: false,
      message: `Maximum ${max} credits allowed. You have ${currentCredits}; this course is ${addCredits} credits.`,
    };
  }
  return { ok: true };
}

export function checkDropCredits(currentCredits, removeCredits, limits) {
  const min = limits.min_enrollment_credits;
  if (min <= 0) return { ok: true };
  if (currentCredits - removeCredits < min) {
    return {
      ok: false,
      message: `Minimum ${min} credits required. You have ${currentCredits}; dropping this course would leave ${currentCredits - removeCredits}.`,
    };
  }
  return { ok: true };
}

export function formatCreditLimitSummary(currentCredits, limits) {
  const min = limits.min_enrollment_credits;
  const max = limits.max_enrollment_credits;
  let status = '';
  if (min > 0 && currentCredits < min) status = ' · below minimum';
  else if (currentCredits >= max) status = ' · at maximum';
  return `Selected ${currentCredits} credit(s) — minimum ${min}, maximum ${max}${status}`;
}
