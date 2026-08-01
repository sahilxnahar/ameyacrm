#!/usr/bin/env bash
# Check a deployment is actually working. Run after any deploy or migration.
#   ./health-check.sh https://crm.ameyaheights.com
set -uo pipefail

URL="${1:-${APP_URL:-http://localhost:3000}}"
URL="${URL%/}"
FAIL=0

check() {
  local label="$1" path="$2" expect="$3"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL$path" || echo 000)"
  if [ "$code" = "$expect" ]; then
    printf '  OK    %-34s %s\n' "$label" "$code"
  else
    printf '  FAIL  %-34s got %s, expected %s\n' "$label" "$code" "$expect"
    FAIL=$((FAIL+1))
  fi
}

echo "Checking $URL"
echo

check "Home page responds"        "/"                       200
check "Sign-in page"              "/login"                  200
# An unauthenticated API call MUST be refused. A 200 here would mean the app is
# serving data to anyone who asks, which is far worse than being down.
check "API rejects anonymous"     "/api/v1/leads"           401
check "Cron rejects no secret"    "/api/cron/worker"        401
check "Unknown route 404s"        "/definitely-not-a-page"  404

echo
if [ "$FAIL" -eq 0 ]; then
  echo "All checks passed."
else
  echo "$FAIL check(s) failed — see PORTING/06-TROUBLESHOOTING.md"
fi
exit "$FAIL"
