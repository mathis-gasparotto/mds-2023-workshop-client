document.addEventListener("DOMContentLoaded", function () {
  const elem = document.getElementById('btn')
  elem.addEventListener('click', () => window.electronAPI.generateVideo())
  window.electronAPI.videoGenerated((value) => {
    console.log('Video generated: ', value)
  })
})