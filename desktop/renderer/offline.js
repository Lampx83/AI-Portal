// Trang báo lỗi kết nối (file://). Không có quyền gì đặc biệt — chỉ điều hướng lại tới địa chỉ hệ thống.
;(function () {
  var q = new URLSearchParams(location.search)
  var url = q.get("url") || ""
  var en = q.get("lang") === "en"
  if (en) {
    document.documentElement.lang = "en"
    document.getElementById("title").textContent = "Cannot reach the server"
    document.getElementById("detail").textContent = "Check your network connection and try again."
    document.getElementById("retry").textContent = "Try again"
  }
  var err = q.get("error")
  document.getElementById("url").textContent = url + (err ? " — " + err : "")
  document.getElementById("retry").addEventListener("click", function () {
    if (/^https?:\/\//i.test(url)) location.href = url
  })
})()
