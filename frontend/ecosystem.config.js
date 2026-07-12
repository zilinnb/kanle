module.exports = {
  apps: [{
    name: "kanle-frontend",
    script: ".next/standalone/server.js",
    cwd: __dirname,
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "300M",
    env: {
      NODE_ENV: "production",
      PORT: "3000",
      HOSTNAME: "127.0.0.1"
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: __dirname + "/logs/err.log",
    out_file: __dirname + "/logs/out.log",
    merge_logs: true,
    kill_timeout: 5000
  }]
};
