/** 
 * PM2 ecosystem file for Research Web App
 * 
 * ⚠️ Lưu ý:
 * - KHÔNG khai báo AZURE_AD_CLIENT_ID, DATABASE_URL, v.v. ở đây
 *   vì chúng sẽ được export từ GitHub Actions và inject bằng:
 *      pm2 startOrRestart ecosystem.config.js --update-env
 * - Chỉ giữ NODE_ENV hoặc các biến cố định khác
 */

module.exports = {
  apps: [
    {
      name: "research-web",              // tên process PM2
      script: "npm",                     // lệnh chạy app
      args: "start",                     // tương đương với: npm start
      cwd: "./",                         // chạy tại thư mục repo
      instances: 1,                      // hoặc "max" nếu muốn cluster
      exec_mode: "fork",                 // fork = 1 process (Next.js SSR)
      watch: false,                      // không auto-reload, CI/CD sẽ restart
      env: {
        NODE_ENV: "production"           // biến cố định duy nhất
      }
    }
  ]
}
