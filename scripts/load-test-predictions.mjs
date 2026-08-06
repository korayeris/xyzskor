const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_TEST_JWT', 'TEST_MATCH_ID'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Eksik test değişkenleri: ${missing.join(', ')}`);
  console.error('Bu test yalnız staging projesi ve kilitlenmemiş bir test maçıyla çalıştırılmalıdır.');
  process.exit(2);
}

const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY;
const jwt = process.env.SUPABASE_TEST_JWT;
const matchId = process.env.TEST_MATCH_ID;
const virtualUsers = Math.max(1, Math.min(100, Number(process.env.VUS || 10)));
const totalRequests = Math.max(1, Math.min(5000, Number(process.env.REQUESTS || 100)));
const maxErrorRate = Math.max(0, Math.min(1, Number(process.env.MAX_ERROR_RATE || 0.01)));
const maxP95Ms = Math.max(50, Number(process.env.MAX_P95_MS || 1200));

function jwtSubject(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub || null;
  } catch (_) {
    return null;
  }
}

const userId = jwtSubject(jwt);
if (!userId) {
  console.error('SUPABASE_TEST_JWT içinde geçerli bir kullanıcı kimliği bulunamadı.');
  process.exit(2);
}

const latencies = [];
const errors = [];
let cursor = 0;

async function writePrediction(index) {
  const variants = [
    { pick:'1', score_home:2, score_away:1 },
    { pick:'X', score_home:1, score_away:1 },
    { pick:'2', score_home:0, score_away:1 }
  ];
  const started = performance.now();
  const response = await fetch(`${baseUrl}/rest/v1/predictions?on_conflict=match_id,user_id`, {
    method:'POST',
    headers:{
      apikey:anonKey,
      authorization:`Bearer ${jwt}`,
      'content-type':'application/json',
      prefer:'resolution=merge-duplicates,return=minimal'
    },
    body:JSON.stringify({ match_id:matchId, user_id:userId, ...variants[index % variants.length] })
  });
  latencies.push(performance.now() - started);
  if (!response.ok) errors.push({ status:response.status, body:(await response.text()).slice(0,240) });
}

async function worker() {
  while (cursor < totalRequests) {
    const index = cursor++;
    try { await writePrediction(index); }
    catch (error) { errors.push({ status:0, body:String(error && error.message || error) }); }
  }
}

await Promise.all(Array.from({ length:virtualUsers }, () => worker()));
latencies.sort((a,b) => a-b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] || 0;
const errorRate = errors.length / totalRequests;
const summary = {
  requests:totalRequests,
  virtualUsers,
  successful:totalRequests - errors.length,
  errors:errors.length,
  errorRate:Number((errorRate * 100).toFixed(2)),
  p50Ms:Number(percentile(0.50).toFixed(1)),
  p95Ms:Number(percentile(0.95).toFixed(1)),
  p99Ms:Number(percentile(0.99).toFixed(1))
};
console.log(JSON.stringify(summary, null, 2));
if (errors.length) console.error('İlk hatalar:', errors.slice(0,3));
if (errorRate > maxErrorRate || percentile(0.95) > maxP95Ms) process.exit(1);
