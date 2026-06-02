process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";

const TOKEN_URL = "https://mvdapi-auth.montevideo.gub.uy/token";
const API_BASE = "https://api.montevideo.gub.uy/api/transportepublico";
const CLIENT_ID = "fea2a198";
const CLIENT_SECRET = "142bc1279f3891818935a350cb7b0062";

const body = new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
const tr = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
const { access_token } = await tr.json();
if (!access_token) { console.log("NO TOKEN"); process.exit(1); }
console.log("token OK");

const ver = await fetch(`${API_BASE}/buses/gtfs/static/latest/version.txt`, { headers: { Authorization: `Bearer ${access_token}` } });
console.log("GTFS version:", (await ver.text()).trim());

const r = await fetch(`${API_BASE}/buses/gtfs/static/latest/google_transit.zip`, { headers: { Authorization: `Bearer ${access_token}` } });
console.log("zip status:", r.status, "type:", r.headers.get("content-type"));
const buf = Buffer.from(await r.arrayBuffer());
fs.writeFileSync("d:/tmp/gtfs-official.zip", buf);
console.log("saved zip bytes:", buf.length);
