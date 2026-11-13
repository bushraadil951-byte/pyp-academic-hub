// PM2 process file for the VPS: `pm2 start ecosystem.config.cjs`. Secrets stay in eps-portal-backend/.env.
module.exports = {
  apps: [{
    name: 'pyp-academic-hub',
    cwd: './eps-portal-backend',
    script: 'server.js',
    env: { NODE_ENV: 'production', PORT: 5000 },
    max_memory_restart: '400M',
  }],
};
