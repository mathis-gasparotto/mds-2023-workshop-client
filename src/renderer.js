document.addEventListener("DOMContentLoaded", function () {
  const elem = document.getElementById('btn')
  elem.addEventListener('click', () => window.electronAPI.generateVideo())
  window.electronAPI.videoCreated((value) => {
      console.log('Video created: ', value)
  })
})