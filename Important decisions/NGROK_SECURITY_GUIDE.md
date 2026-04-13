# ngrok Security Configuration for Alexa Integration

## Quick Start (1-Hour Session)

### Prerequisites
1. Install ngrok: https://ngrok.com/download
2. Set authtoken: `ngrok authtoken YOUR_TOKEN`
3. Start backend: `npm run start` (port 3000)

### Command with Security

```powershell
ngrok http 3000 --bind-tls=true --auth="devuser:StrongPassword123" --inspect=false
```

**Explanation:**
- `http 3000` — tunnel local port 3000
- `--bind-tls=true` — force HTTPS (required by Alexa)
- `--auth` — HTTP Basic auth (username:password)
- `--inspect=false` — disable public inspection panel

**Output example:**
```
Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        us-central (xx.x.x.x)
Latency                       xx ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abcd1234.ngrok.io -> http://localhost:3000
```

Copy the HTTPS URL → Add to Alexa Developer Console

---

## Security Checklist

### Local Setup
- [ ] ngrok authtoken configured in `~/.ngrok2/ngrok.yml`
- [ ] Backend running on port 3000
- [ ] TLS enabled (`--bind-tls=true`)
- [ ] HTTP Basic auth set (`--auth=user:pass`)
- [ ] Inspection disabled (`--inspect=false`)

### Alexa Configuration
- [ ] Skill endpoint URL updated in Developer Console
- [ ] HTTPS URL from ngrok copied exactly
- [ ] Endpoint includes path if applicable (e.g., `/alexa`)
- [ ] Test skill invocation in Console

### Signature Verification
- [ ] Request signature validation enabled (see backend/src/index.js)
- [ ] Certificate chain URL checked
- [ ] Timestamp freshness validated (±150 seconds)

### Session Management
- [ ] Start script: `backend/scripts/start_ngrok.ps1`
- [ ] Session set to auto-close after testing (avoid leaks)
- [ ] ngrok process killed after session ends
- [ ] No sensitive credentials in logs

---

## Session Lifecycle

### Before Session
```bash
# Terminal 1: Start backend
cd backend
npm run start

# Terminal 2: Start ngrok (1-hour session)
ngrok http 3000 --bind-tls=true --auth="devuser:Pass123" --inspect=false
```

### During Session
- Copy HTTPS URL to Alexa Developer Console
- Test interactions in Console
- Monitor logs: `http://localhost:4040` (optional, if inspection enabled)

### After Session
```bash
# Close ngrok (Ctrl+C in terminal)
# Verify backend stays running
# Update Alexa endpoint if using new tunnel
```

---

## Troubleshooting

### "connection refused"
- Verify backend is running: `lsof -i :3000`
- Restart backend if needed

### Alexa reads SSML literally
- Check response type is `"SSML"` not `"PlainText"`
- Verify tags are wrapped in `<speak>...</speak>`
- See: `backend/src/index.js` → `alexaResponse()` function

### ngrok URL not accessible
- Confirm `--bind-tls=true` is set
- Test manually: `curl -u devuser:Pass123 https://URL/`
- Check firewall / router rules

### "Invalid signature" from Alexa
- Verify request signature validation is implemented
- Check certificate chain is valid
- Ensure timestamp is within ±150 seconds

---

## Advanced Options

### Reserved Domain (Paid Plan)
For stability across sessions:
```bash
ngrok http 3000 --domain=my-alexa-skill.ngrok.io --auth="user:pass" --inspect=false
```

### Enable Inspection for Debugging
```bash
# Enable web inspection panel (not recommended for production)
ngrok http 3000 --auth="user:pass" --inspect=true
# Access at http://127.0.0.1:4040
```

### Multiple Skill Versions
```bash
# Skill A (port 3000)
ngrok http 3000 --subdomain=skill-a --auth="user:pass"

# Skill B (port 3001)
ngrok http 3001 --subdomain=skill-b --auth="user:pass"
```

---

## References

- [ngrok CLI Documentation](https://ngrok.com/docs/ngrok-agent/cli/)
- [Alexa Custom Skill Hosting](https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html)
- [SSML Reference](https://developer.amazon.com/en-US/docs/alexa/custom-skills/speech-synthesis-markup-language-ssml-reference.html)
