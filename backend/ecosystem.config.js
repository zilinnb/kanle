module.exports = {
  apps: [{
    name: "kanle-backend",
    script: "./dist/index.js",
    cwd: "/www/wwwroot/kanle/backend",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "300M",
    env: { NODE_ENV: "production" },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/www/wwwroot/kanle/backend/logs/err.log",
    out_file: "/www/wwwroot/kanle/backend/logs/out.log",
    merge_logs: true
  }]
};
