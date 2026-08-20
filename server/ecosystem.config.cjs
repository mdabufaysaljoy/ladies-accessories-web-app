/**
 * PM2 process config.
 *
 * `instances: 1` / fork mode is deliberate, not a default left unconfigured —
 * cluster mode spawns one Node process per CPU core, and on a 1 vCPU / 1 GB
 * VPS a second process is pure overhead with nothing to parallelise onto.
 *
 * `max_memory_restart` is a safety net: if a leak or a heavy request pushes
 * the process past this, PM2 restarts it cleanly instead of the kernel OOM
 * killer picking a victim on the whole box (which can just as easily be
 * mongod or sshd).
 */
module.exports = {
  apps: [
    {
      name: 'gbs-api',
      cwd: __dirname,
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'production',
      },
      out_file: '/var/log/gbs-api/out.log',
      error_file: '/var/log/gbs-api/error.log',
      time: true,
    },
  ],
}
