const params = new URLSearchParams(location.search)
document.getElementById("caption").textContent = params.get("caption")
document.getElementById("img").src = params.get("img")
if (params.get("popup")) {
  const shot = document.querySelector(".shot")
  shot.insertAdjacentHTML("beforeend", '<div class="dim"></div><div class="popup"><img alt=""></div>')
  shot.querySelector(".popup img").src = params.get("popup")
}
