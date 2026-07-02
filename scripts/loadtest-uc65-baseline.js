#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1/api';
const HOST_HEADER = process.env.HOST_HEADER || 'tms.pbos.gov.pk';
const ORIGIN = process.env.ORIGIN || 'https://tms.pbos.gov.pk';

const USERS = Number(process.env.USERS || 500);
const ITERATIONS = Number(process.env.ITERATIONS || 1);
const CONCURRENCY = Number(process.env.CONCURRENCY || 50);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10000);
const RETRIES = Number(process.env.RETRIES || 1);
const MAX_FAILED = Number(process.env.MAX_FAILED || 0);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@acme.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Test@1234';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function rawRequest({ method = 'GET', path, token, body, name }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();

  const headers = {
    Host: HOST_HEADER,
    Origin: ORIGIN,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    const ms = Date.now() - started;

    return {
      name,
      ok: res.ok,
      status: res.status,
      ms,
      bytes: text.length,
      error: res.ok ? null : text.slice(0, 300),
    };
  } catch (err) {
    const ms = Date.now() - started;

    return {
      name,
      ok: false,
      status: 0,
      ms,
      bytes: 0,
      error: err?.cause?.code || err?.code || err?.name || err?.message || 'FETCH_ERROR',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(task) {
  let last;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    last = await rawRequest(task);

    if (last.ok) {
      return last;
    }

    const shouldRetry = last.status === 0 || last.status >= 500;

    if (!shouldRetry || attempt === RETRIES) {
      return last;
    }

    await sleep(100 + attempt * 100);
  }

  return last;
}

async function login() {
  const result = await rawRequest({
    name: 'login',
    method: 'POST',
    path: '/auth/login',
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  if (!result.ok) {
    console.error(JSON.stringify({ success: false, stage: 'login', result }, null, 2));
    process.exit(1);
  }

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      Host: HOST_HEADER,
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  const json = await res.json();

  const token = json?.data?.tokens?.accessToken;

  if (!token) {
    console.error(JSON.stringify({ success: false, stage: 'login-token', json }, null, 2));
    process.exit(1);
  }

  return token;
}

async function chooseSearchPath(token) {
  const encodedJql = encodeURIComponent('project:PM');
  const candidates = [
    `/search/jql?jql=${encodedJql}&limit=10`,
    `/search/jql?q=${encodedJql}&limit=10`,
    `/search?type=issues&q=PM&limit=10`,
    `/search/issues?q=PM&limit=10`,
  ];

  for (const path of candidates) {
    const result = await rawRequest({
      name: 'search-probe',
      path,
      token,
    });

    if (result.ok) {
      return path;
    }
  }

  return '/search?type=issues&q=PM&limit=10';
}

async function main() {
  const token = await login();
  const searchPath = await chooseSearchPath(token);

  const tasks = [];

  for (let user = 0; user < USERS; user += 1) {
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      tasks.push({
        name: 'health',
        method: 'GET',
        path: '/health',
      });

      tasks.push({
        name: 'projects',
        method: 'GET',
        path: '/projects',
        token,
      });

      tasks.push({
        name: 'search',
        method: 'GET',
        path: searchPath,
        token,
      });
    }
  }

  const started = Date.now();
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;

      const result = await requestWithRetry(tasks[index]);
      results.push(result);
    }
  }

  const workerCount = Math.min(CONCURRENCY, tasks.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  const totalMs = Date.now() - started;
  const failed = results.filter((r) => !r.ok);
  const durations = results.map((r) => r.ms);
  const byEndpoint = {};

  for (const result of results) {
    if (!byEndpoint[result.name]) {
      byEndpoint[result.name] = {
        total: 0,
        failed: 0,
        p95Ms: 0,
        avgMs: 0,
        statuses: {},
      };
    }

    byEndpoint[result.name].total += 1;

    if (!result.ok) {
      byEndpoint[result.name].failed += 1;
    }

    const key = result.status || result.error || 'UNKNOWN';
    byEndpoint[result.name].statuses[key] = (byEndpoint[result.name].statuses[key] || 0) + 1;
  }

  for (const [name, group] of Object.entries(byEndpoint)) {
    const groupDurations = results.filter((r) => r.name === name).map((r) => r.ms);
    group.p95Ms = percentile(groupDurations, 95);
    group.avgMs = Math.round(groupDurations.reduce((a, b) => a + b, 0) / Math.max(1, groupDurations.length));
  }

  const errors = {};

  for (const result of failed) {
    const key = `${result.name}:${result.status || result.error}`;
    errors[key] = (errors[key] || 0) + 1;
  }

  const summary = {
    success: failed.length <= MAX_FAILED,
    virtualUsers: USERS,
    iterations: ITERATIONS,
    concurrency: workerCount,
    requests: results.length,
    failed: failed.length,
    maxFailedAllowed: MAX_FAILED,
    p95Ms: percentile(durations, 95),
    avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length)),
    totalMs,
    requestsPerSecond: Number((results.length / Math.max(1, totalMs / 1000)).toFixed(2)),
    searchPath,
    byEndpoint,
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.success) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
