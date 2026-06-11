// Recommendation engine: suggests the next certifications a learner should take
// on the path to becoming a security engineer.
//
// Transparent and rule-based (not a black box): we define an ordered roadmap of
// recommended slugs, then surface the next not-yet-owned steps with a "why".
// Easy to extend per specialization track later.

const ROADMAP = [
  { slug: 'isc2-cc',       stage: 'Foundation',     why: 'A free first credential to lock in core security principles.' },
  { slug: 'security-plus', stage: 'Foundation',     why: 'The industry-standard baseline most engineer roles expect.' },
  { slug: 'cysa-plus',     stage: 'Blue-team core', why: 'Proves analyst-level detection and incident-response skill.' },
  { slug: 'sc-200',        stage: 'Specialize',     why: 'Operations on the Microsoft stack — high demand for SOC/engineer roles.' },
];

// Lightweight tier ordering so we can rank "reach" suggestions sensibly.
const TIER_RANK = { entry: 0, mid: 1, adv: 2 };

export function recommendPath({ allCourses, ownedSlugs, completedSlugs }) {
  const bySlug = Object.fromEntries(allCourses.map(c => [c.slug, c]));

  // 1) Next steps along the defined roadmap that the learner doesn't own yet.
  const nextSteps = [];
  for (const step of ROADMAP) {
    if (ownedSlugs.has(step.slug)) continue;        // already enrolled/owned
    const course = bySlug[step.slug];
    if (!course) continue;                          // not in catalog (yet)
    nextSteps.push({
      slug: course.slug, title: course.title, body: course.body,
      tier: course.tier, isFree: course.is_free, priceCents: course.price_cents,
      stage: step.stage, why: step.why,
      reason: 'roadmap',
    });
    if (nextSteps.length >= 3) break;               // keep it focused (ADHD-friendly)
  }

  // 2) If the learner is cruising (completed >= 2), add one "stretch" cert a tier up.
  const stretch = [];
  if (completedSlugs.size >= 2) {
    const candidates = allCourses
      .filter(c => !ownedSlugs.has(c.slug) && !nextSteps.find(n => n.slug === c.slug))
      .sort((a, b) => (TIER_RANK[b.tier] ?? 1) - (TIER_RANK[a.tier] ?? 1));
    if (candidates[0]) {
      const c = candidates[0];
      stretch.push({
        slug: c.slug, title: c.title, body: c.body, tier: c.tier,
        isFree: c.is_free, priceCents: c.price_cents,
        stage: 'Stretch goal', why: 'You are moving fast — this pushes you toward a more senior track.',
        reason: 'stretch',
      });
    }
  }

  // Progress framing so the UI can show "X of N roadmap steps done".
  const roadmapDone = ROADMAP.filter(s => completedSlugs.has(s.slug)).length;

  return {
    headline: roadmapDone >= ROADMAP.length
      ? 'You have completed the core engineer roadmap — explore a specialization track.'
      : `You're ${roadmapDone} of ${ROADMAP.length} steps into the security-engineer roadmap.`,
    roadmapTotal: ROADMAP.length,
    roadmapDone,
    nextSteps,
    stretch,
  };
}
