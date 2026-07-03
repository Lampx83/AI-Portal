/**
 * Chạy Next.js standalone (server.js) theo Node cluster nhiều worker.
 * Next standalone là 1 process đơn — trên server nhiều core, 1 process nghẽn cứng ở 1 core
 * khi tải cao (SSR + proxy + gzip đều trên 1 event loop). Cluster fork N worker cùng
 * lắng nghe cổng 3000 (kernel round-robin), nhân thông lượng theo số worker.
 *
 * Số worker: env WEB_CONCURRENCY (prod đặt trong docker-compose), mặc định min(4, số core).
 */
const cluster = require("node:cluster")
const os = require("node:os")

const workers =
  Math.max(1, parseInt(process.env.WEB_CONCURRENCY || "", 10) || Math.min(4, os.cpus().length))

if (cluster.isPrimary && workers > 1) {
  console.log(`[cluster] primary ${process.pid}: khởi động ${workers} worker`)
  for (let i = 0; i < workers; i++) cluster.fork()
  cluster.on("exit", (worker, code, signal) => {
    // Worker chết (OOM/crash) → fork thay thế ngay, site không gián đoạn
    console.error(`[cluster] worker ${worker.process.pid} thoát (code=${code}, signal=${signal}) — fork lại`)
    cluster.fork()
  })
  let shuttingDown = false
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      shuttingDown = true
      for (const id in cluster.workers) cluster.workers[id]?.kill(sig)
      // Cho worker 10s đóng kết nối rồi thoát hẳn
      setTimeout(() => process.exit(0), 10_000).unref()
    })
  }
  cluster.on("exit", () => {
    if (shuttingDown && Object.keys(cluster.workers ?? {}).length === 0) process.exit(0)
  })
} else {
  // Worker (hoặc WEB_CONCURRENCY=1): chạy server Next standalone như cũ
  import("./server.js")
}
