module.exports = {
  apps: [{
    name: "kanle-frontend",
    script: "./node_modules/next/dist/bin/next",
    args: "start -p 3003 -H 127.0.0.1",
    cwd: "/www/wwwroot/kanle/frontend",
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "300M",
    env: { NODE_ENV: "production" },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/www/wwwroot/kanle/frontend/logs/err.log",
    out_file: "/www/wwwroot/kanle/frontend/logs/out.log",
    merge_logs: true,
    kill_timeout: 5000
  }]
};
