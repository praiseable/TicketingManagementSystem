#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"

STAMP="$(date +%s)"
EMAIL="qa-auth-${STAMP}@example.test"
PASS="Test@1234"
NEW_PASS="NewTest@1234"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pretty() {
  local file="$1"
  if [ ! -s "$file" ]; then
    echo "(empty body)"
    return 0
  fi
  python3 -m json.tool "$file" 2>/dev/null || cat "$file"
}

curl_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local out="$4"
  local auth="${5:-}"

  local args=(
    -sS
    -o "$out"
    -w "%{http_code}"
    -X "$method"
    "$BASE_URL$path"
    -H "Host: $HOST_HEADER"
    -H "Origin: $ORIGIN"
  )

  if [ -n "$auth" ]; then
    args+=(-H "Authorization: Bearer $auth")
  fi

  if [ "$method" != "GET" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi

  curl "${args[@]}"
}

assert_http_ok() {
  local code="$1"
  local label="$2"

  case "$code" in
    200|201|204)
      return 0
      ;;
    *)
      echo "ERROR: $label failed with HTTP $code" >&2
      exit 1
      ;;
  esac
}

assert_json_success() {
  local file="$1"
  local label="$2"

  python3 - "$file" "$label" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
label = sys.argv[2]
text = path.read_text().strip()

if not text:
    raise SystemExit(f"{label}: expected JSON body but got empty body")

j = json.loads(text)

if j.get("success") is not True:
    raise SystemExit(f"{label}: expected success=true, got {j}")

print(f"{label}=true")
PY
}

expect_invalid_refresh() {
  local file="$1"
  local label="$2"

  python3 - "$file" "$label" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
label = sys.argv[2]
j = json.loads(path.read_text())

assert j.get("success") is False, j
assert j.get("error", {}).get("code") in {
    "INVALID_REFRESH_TOKEN",
    "UNAUTHORIZED",
    "INVALID_TOKEN"
}, j

print(f"{label}=true")
PY
}

extract_json_value() {
  local file="$1"
  local expr="$2"

  python3 - "$file" "$expr" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
expr = sys.argv[2]
text = path.read_text().strip()

if not text:
    print("")
    raise SystemExit(0)

j = json.loads(text)

if expr == "access":
    print(j.get("data", {}).get("tokens", {}).get("accessToken") or j.get("data", {}).get("accessToken") or "")
elif expr == "refresh":
    print(j.get("data", {}).get("tokens", {}).get("refreshToken") or j.get("data", {}).get("refreshToken") or "")
elif expr == "verifyToken":
    print(j.get("data", {}).get("verification", {}).get("devToken") or "")
elif expr == "resetToken":
    data = j.get("data") or {}
    print(
        data.get("devToken")
        or data.get("resetToken")
        or data.get("token")
        or data.get("reset", {}).get("devToken")
        or data.get("reset", {}).get("token")
        or ""
    )
else:
    print("")
PY
}

echo "UC-02 health"
HEALTH_CODE="$(curl_json GET /health "" "$TMP/health.json")"
assert_http_ok "$HEALTH_CODE" "health"
pretty "$TMP/health.json"
assert_json_success "$TMP/health.json" "health"

echo
echo "UC-01 register $EMAIL"
REGISTER_BODY="{\"name\":\"QA Auth\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"orgName\":\"QA Org $STAMP\"}"
REGISTER_CODE="$(curl_json POST /auth/register "$REGISTER_BODY" "$TMP/register.json")"
assert_http_ok "$REGISTER_CODE" "register"
pretty "$TMP/register.json"
assert_json_success "$TMP/register.json" "register"

VERIFY_TOKEN="$(extract_json_value "$TMP/register.json" verifyToken)"

if [ -z "$VERIFY_TOKEN" ]; then
  echo "No devToken in register response; reading verification token from PostgreSQL"
  VERIFY_TOKEN="$(
    cd "$ROOT/apps/pm-platform-db" &&
    EMAIL="$EMAIL" timeout 20s pnpm tsx -r dotenv/config -e '
      import { prisma } from "./src/client.ts";
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: process.env.EMAIL! }
      });
      const row = await prisma.emailVerification.findFirstOrThrow({
        where: { userId: user.id },
        orderBy: { expiresAt: "desc" }
      });
      console.log(row.token);
      await prisma.$disconnect();
    '
  )"
fi

if [ -z "$VERIFY_TOKEN" ]; then
  echo "ERROR: could not obtain email verification token" >&2
  exit 1
fi

echo
echo "UC-01 verify email token for $EMAIL"
VERIFY_CODE="$(curl_json POST /auth/verify-email "{\"token\":\"$VERIFY_TOKEN\"}" "$TMP/verify.json")"
echo "verify_http_code=$VERIFY_CODE"
assert_http_ok "$VERIFY_CODE" "verify-email"
pretty "$TMP/verify.json"

echo
echo "UC-02 login $EMAIL"
LOGIN_BODY="{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
LOGIN_CODE="$(curl_json POST /auth/login "$LOGIN_BODY" "$TMP/login.json")"
assert_http_ok "$LOGIN_CODE" "login"
pretty "$TMP/login.json"
assert_json_success "$TMP/login.json" "login"

ACCESS_TOKEN="$(extract_json_value "$TMP/login.json" access)"
REFRESH_TOKEN="$(extract_json_value "$TMP/login.json" refresh)"

if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ]; then
  echo "ERROR: missing access or refresh token after login" >&2
  exit 1
fi

echo
echo "UC-02 /auth/me"
ME_CODE="$(curl_json GET /auth/me "" "$TMP/me.json" "$ACCESS_TOKEN")"
assert_http_ok "$ME_CODE" "auth-me"
pretty "$TMP/me.json"
assert_json_success "$TMP/me.json" "auth-me"

echo
echo "UC-03 refresh token rotation"
REFRESH_CODE="$(curl_json POST /auth/refresh "{\"refreshToken\":\"$REFRESH_TOKEN\"}" "$TMP/refresh.json")"
assert_http_ok "$REFRESH_CODE" "refresh"
pretty "$TMP/refresh.json"
assert_json_success "$TMP/refresh.json" "refresh"

ACCESS_TOKEN_2="$(extract_json_value "$TMP/refresh.json" access)"
REFRESH_TOKEN_2="$(extract_json_value "$TMP/refresh.json" refresh)"

if [ -z "$ACCESS_TOKEN_2" ] || [ -z "$REFRESH_TOKEN_2" ]; then
  echo "ERROR: refresh endpoint did not return rotated tokens" >&2
  exit 1
fi

if [ "$REFRESH_TOKEN_2" = "$REFRESH_TOKEN" ]; then
  echo "ERROR: refresh token was not rotated" >&2
  exit 1
fi

echo
echo "UC-03 old refresh token must fail after rotation"
OLD_ROTATED_CODE="$(curl_json POST /auth/refresh "{\"refreshToken\":\"$REFRESH_TOKEN\"}" "$TMP/old-rotated-refresh.json")"
pretty "$TMP/old-rotated-refresh.json"
expect_invalid_refresh "$TMP/old-rotated-refresh.json" "old_refresh_revoked_by_rotation"

echo
echo "UC-02 logout"
LOGOUT_CODE="$(curl_json POST /auth/logout "{\"refreshToken\":\"$REFRESH_TOKEN_2\"}" "$TMP/logout.json")"
echo "logout_http_code=$LOGOUT_CODE"
assert_http_ok "$LOGOUT_CODE" "logout"
pretty "$TMP/logout.json"

echo
echo "UC-02 refresh token must fail after logout"
LOGGED_OUT_CODE="$(curl_json POST /auth/refresh "{\"refreshToken\":\"$REFRESH_TOKEN_2\"}" "$TMP/logged-out-refresh.json")"
pretty "$TMP/logged-out-refresh.json"
expect_invalid_refresh "$TMP/logged-out-refresh.json" "refresh_revoked_by_logout"

echo
echo "UC-01 forgot password"
FORGOT_CODE="$(curl_json POST /auth/forgot-password "{\"email\":\"$EMAIL\"}" "$TMP/forgot.json")"
echo "forgot_http_code=$FORGOT_CODE"
assert_http_ok "$FORGOT_CODE" "forgot-password"
pretty "$TMP/forgot.json"

RESET_TOKEN="$(extract_json_value "$TMP/forgot.json" resetToken)"

if [ -z "$RESET_TOKEN" ]; then
  echo "No reset devToken in forgot response; reading reset token from PostgreSQL via docker psql"
  RESET_TOKEN="$(
    docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform -v email="$EMAIL" -At <<'SQL'
SELECT pr.token
FROM "PasswordReset" pr
JOIN "User" u ON u.id = pr."userId"
WHERE u.email = :'email'
  AND pr.used = false
ORDER BY pr."expiresAt" DESC
LIMIT 1;
SQL
  )"
fi


if [ -z "$RESET_TOKEN" ]; then
  echo "No reset devToken in forgot response; reading reset token from PostgreSQL"
  RESET_TOKEN="$(
    cd "$ROOT/apps/pm-platform-db" &&
    EMAIL="$EMAIL" timeout 20s pnpm tsx -r dotenv/config -e '
      import { prisma } from "./src/client.ts";
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: process.env.EMAIL! }
      });
      const row = await prisma.passwordReset.findFirstOrThrow({
        where: { userId: user.id, used: false },
        orderBy: { expiresAt: "desc" }
      });
      console.log(row.token);
      await prisma.$disconnect();
    '
  )"
fi

if [ -z "$RESET_TOKEN" ]; then
  echo "ERROR: could not obtain password reset token" >&2
  exit 1
fi

echo
echo "UC-01 reset password"
RESET_CODE="$(curl_json POST /auth/reset-password "{\"token\":\"$RESET_TOKEN\",\"password\":\"$NEW_PASS\"}" "$TMP/reset.json")"
echo "reset_http_code=$RESET_CODE"
assert_http_ok "$RESET_CODE" "reset-password"
pretty "$TMP/reset.json"

echo
echo "UC-02 login with new password"
NEW_LOGIN_BODY="{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASS\"}"
NEW_LOGIN_CODE="$(curl_json POST /auth/login "$NEW_LOGIN_BODY" "$TMP/new-login.json")"
assert_http_ok "$NEW_LOGIN_CODE" "login-new-password"
pretty "$TMP/new-login.json"
assert_json_success "$TMP/new-login.json" "login_new_password"

echo
echo "Auth UC-01 to UC-03 smoke test passed"
