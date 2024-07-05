document.addEventListener("DOMContentLoaded", function () {
  const elem = document.getElementById('btn')
  elem.addEventListener('click', () => window.electronAPI.generateVideo())
  window.electronAPI.videoGenerated((value) => {
    console.log('Video generated: ', value)
  })
  window.electronAPI.message((value) => {
    if (value.type === 'info') {
      console.log(value.text)
    } else if (value.type === 'error') {
      console.error(value.text)
    }
  })
})