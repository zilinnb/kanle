module.exports = {
  apps: [{
    name: "kanle-backend",
    script: "pnpm",
    args: "start",
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "300M",
    env: { NODE_ENV: "production" },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: __dirname + "/logs/err.log",
    out_file: __dirname + "/logs/out.log",
    merge_logs: true
  }]
};
