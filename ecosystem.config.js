module.exports = {
  apps: [{
    name: 'groupdeedo',
    script: 'src/server.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      SESSION_SECRET: 'groupdeedo-dev-secret'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      SESSION_SECRET: 'groupdeedo-production-secret-change-me'
    },
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    
    // Auto-restart settings
    watch: false, // Disable in production
    max_memory_restart: '512M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Health monitoring
    health_check_grace_period: 5000,
    health_check_fatal_exceptions: true
  }]
};