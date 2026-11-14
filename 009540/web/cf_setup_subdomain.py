#!/usr/bin/env python3
"""
Fix the stable public URL analyses.minion.dpdns.org -> http://127.0.0.1:9120
for the token-managed Cloudflare tunnel on this host.

Needs a Cloudflare API token with:
  - Account > Cloudflare Tunnel: Edit
  - Zone > DNS: Edit   (zone minion.dpdns.org)

Usage:
  CLOUDFLARE_API_TOKEN=... python3 cf_setup_subdomain.sh
  (or pass the token as the first argument)

Idempotent: re-running only adds what is missing. It never touches other
ingress rules, and it aborts instead of inventing a catch-all.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

HOST = "analyses.minion.dpdns.org"
ORIGIN = "http://127.0.0.1:9120"
ZONE = "minion.dpdns.org"
API = "https://api.cloudflare.com/client/v4"

token = os.environ.get("CLOUDFLARE_API_TOKEN") or (sys.argv[1] if len(sys.argv) > 1 else "")
if not token:
    sys.exit("missing CLOUDFLARE_API_TOKEN (env or argv[1])")

# Tunnel token -> account + tunnel id (base64 JSON: a, t, s)
raw = open(os.path.expanduser("~/.cloudflared/token")).read().strip()
payload = raw.split(".")[0] if raw.count(".") == 2 else raw
payload += "=" * (-len(payload) % 4)
meta = json.loads(base64.urlsafe_b64decode(payload))
ACCOUNT, TUNNEL = meta["a"], meta["t"]
print(f"account {ACCOUNT}\ntunnel  {TUNNEL}")


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:600]
        sys.exit(f"API {method} {path} -> {e.code}\n{detail}")


# 1) ingress rule for the hostname, inserted before the catch-all
cfg = api("GET", f"/accounts/{ACCOUNT}/cfd_tunnel/{TUNNEL}/configurations")
ingress = ((cfg.get("result") or {}).get("config") or {}).get("ingress") or []
if not ingress:
    sys.exit("tunnel has no ingress config; refusing to invent a catch-all — add the public hostname in the dashboard")
names = [r.get("hostname") for r in ingress]
if HOST in names:
    print(f"ingress: {HOST} already present")
else:
    rule = {"hostname": HOST, "service": ORIGIN,
            "originRequest": {"connectTimeout": 30, "noHappyEyeballs": False}}
    ingress.insert(len(ingress) - 1, rule)  # keep the trailing catch-all last
    api("PUT", f"/accounts/{ACCOUNT}/cfd_tunnel/{TUNNEL}/configurations",
        {"config": {"ingress": ingress}})
    print(f"ingress: added {HOST} -> {ORIGIN}")

# 2) proxied CNAME in the zone
z = api("GET", f"/zones?name={ZONE}")
if not z.get("result"):
    sys.exit(f"zone {ZONE} not visible to this token")
zone_id = z["result"][0]["id"]
target = f"{TUNNEL}.cfargotunnel.com"
rec = api("GET", f"/zones/{zone_id}/dns_records?name={HOST}")
if rec.get("result"):
    rid = rec["result"][0]["id"]
    api("PATCH", f"/zones/{zone_id}/dns_records/{rid}",
        {"type": "CNAME", "name": HOST, "content": target, "proxied": True, "ttl": 1})
    print(f"dns: updated {HOST} -> {target} (proxied)")
else:
    api("POST", f"/zones/{zone_id}/dns_records",
        {"type": "CNAME", "name": HOST, "content": target, "proxied": True, "ttl": 1})
    print(f"dns: created {HOST} -> {target} (proxied)")

# 3) verify
url = f"https://{HOST}/analyses.json"
for i in range(12):
    time.sleep(5)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cf-setup/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode(errors="replace")
            loc = r.geturl()
        if r.status == 200 and "ADBE" in body:
            print(f"OK  {url} -> 200, index served ({len(body)} bytes)")
            break
        print(f"… {url} -> {r.status} at {loc}")
    except urllib.error.HTTPError as e:
        print(f"… {url} -> HTTP {e.code} (propagation or Cloudflare Access)")
    except Exception as e:
        print(f"… {url} -> {e}")
else:
    print("not verified yet: DNS/ingress can take a minute. If it returns the "
          "Cloudflare Access login, add a Bypass policy for this hostname.")
