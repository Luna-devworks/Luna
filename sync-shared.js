// Copies the master files in shared/ to every place that needs them. Run: node sync-shared.js
const fs = require('fs'), path = require('path');
const root = __dirname, shared = path.join(root, 'shared');
function cp(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.cpSync(src, dst, { recursive: true }); }
const targets = ['Website/shared', 'Client/app/shared', 'Server/web/shared'];
for (const t of targets) { fs.rmSync(path.join(root, t), { recursive: true, force: true }); cp(shared, path.join(root, t)); }
// Server needs data + filter modules beside server.js
cp(path.join(shared, 'luna-data.js'), path.join(root, 'Server/luna-data.js'));
cp(path.join(shared, 'luna-filter.js'), path.join(root, 'Server/luna-filter.js'));
// Client bundles its own copy of the server for "Host a server on this PC"
fs.rmSync(path.join(root, 'Client/server'), { recursive: true, force: true });
for (const f of ['server.js', 'store.js', 'luna-data.js', 'luna-filter.js', 'package.json']) cp(path.join(root, 'Server', f), path.join(root, 'Client/server', f));
// Website pages are also served by the Luna server
for (const f of ['index.html', 'account.html']) cp(path.join(root, 'Website', f), path.join(root, 'Server/web', f));
for (const d of ['play', 'studio']) cp(path.join(root, 'Website', d), path.join(root, 'Server/web', d));
console.log('Synced shared files.');
