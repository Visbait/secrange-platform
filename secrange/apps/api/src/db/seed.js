// Seeds the catalog with SecRange courses + modules.
// Free courses get an automatic free entitlement at enroll time; premium ones
// require a Stripe purchase (granted via webhook).
import { pool } from './pool.js';

const COURSES = [
  { slug:'security-plus', title:'CompTIA Security+', body:'CompTIA · SY0-701', category:'entry', tier:'entry',
    summary:'The industry-standard entry cert. Six SY0-701 domains, each drilled with a hands-on lab.',
    cost:'~$404', time:'1–3 mo', free:false, price:900,
    modules:[
      ['Core security concepts',['CIA triad & AAA','Threat actors & attack surfaces','Zero Trust & defense-in-depth'],'triage','Lab: triage real alerts'],
      ['Network attacks & defense',['Scanning, floods, MITM','Reading them in traffic','Segmentation & firewalls'],'packet','Lab: read packet captures'],
      ['Identity & access',['MFA & phishing-resistance','Account takeover & BEC','Session/token theft'],'incident','Lab: account-compromise IR'],
      ['Secure coding basics',['Injection, XSS, IDOR','Secrets handling','Input validation'],'securecode','Lab: fix vulnerable code'],
      ['Host & Linux hardening',['Least privilege & SUID','Logging & auth review','Service exposure'],'linux','Lab: Linux security'],
      ['Detection & monitoring',['Log sources & SIEM','Queries to find evidence','Alerting basics'],'siem','Lab: SIEM queries'],
    ]},
  { slug:'cysa-plus', title:'CompTIA CySA+', body:'CompTIA · CS0-003', category:'blue', tier:'mid',
    summary:'The blue-team analyst cert — behavioral analytics, detection, and incident response.',
    cost:'~$404', time:'3–6 mo', free:false, price:1200,
    modules:[
      ['Threat & vuln management',['Prioritizing by risk','Threat intel application','ATT&CK'],'triage','Lab: alert triage'],
      ['Network & traffic analysis',['Beaconing, exfil, tunneling','Capture analysis','Anomaly hunting'],'packet','Lab: packet analysis'],
      ['SIEM & log analysis',['Correlation & queries','IOCs','Reducing false positives'],'siem','Lab: SIEM queries'],
      ['Detection engineering',['Sigma structure','Thresholds & tuning','Coverage mapping'],'rulebuilder','Lab: build detections'],
      ['Incident response',['PICERL lifecycle','Containment vs eradication','Evidence handling'],'incident','Lab: full IR campaign'],
    ]},
  { slug:'sc-200', title:'Microsoft SC-200', body:'Microsoft · Security Operations Analyst', category:'blue', tier:'mid',
    summary:'Defender XDR, Entra ID Protection, and Sentinel/KQL — built around the M365 stack.',
    cost:'~$165', time:'2–4 mo', free:false, price:1200,
    modules:[
      ['Microsoft Defender XDR',['Incidents across workloads','Device/identity/email signals','Automated investigation'],'triage','Lab: triage alerts'],
      ['Entra ID Protection',['Risky sign-ins','Token theft & MFA fatigue','Conditional Access'],'incident','Lab: phishing/BEC IR'],
      ['KQL threat hunting',['KQL syntax','Hunting across tables','Time-bound queries'],'siem','Lab: write KQL'],
      ['Sentinel analytics rules',['Scheduled & threshold rules','Sigma to Sentinel','Tuning'],'translate','Lab: Sigma→EQL/KQL'],
      ['Investigation & response',['Scope a compromise','Contain & remediate','Document the incident'],'incident','Lab: IR + report'],
    ]},
  { slug:'isc2-cc', title:'ISC2 Certified in Cybersecurity', body:'ISC2', category:'entry', tier:'entry',
    summary:'Free entry-level cert from ISC2 — an excellent first credential.',
    cost:'Free', time:'1–2 mo', free:true, price:0,
    modules:[
      ['Security principles',['CIA & risk','Access control concepts','Governance basics'],'triage','Lab: triage'],
      ['Incident response & BC/DR',['IR lifecycle','Backups & recovery','BCP basics'],'incident','Lab: IR campaign'],
    ]},
];

async function run() {
  for (const c of COURSES) {
    const { rows } = await pool.query(
      `INSERT INTO courses (slug,title,body,category,tier,summary,cost_label,est_time,is_free,price_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary,
         price_cents=EXCLUDED.price_cents, is_free=EXCLUDED.is_free
       RETURNING id`,
      [c.slug, c.title, c.body, c.category, c.tier, c.summary, c.cost, c.time, c.free, c.price]);
    const courseId = rows[0].id;
    await pool.query('DELETE FROM modules WHERE course_id=$1', [courseId]);
    let pos = 1;
    for (const [title, points, lab_mode, lab_label] of c.modules) {
      await pool.query(
        `INSERT INTO modules (course_id, position, title, points, lab_mode, lab_label)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [courseId, pos++, title, JSON.stringify(points), lab_mode, lab_label]);
    }
    console.log('seeded', c.slug, `(${c.modules.length} modules)`);
  }
  await pool.end();
  console.log('seed complete');
}
run();
