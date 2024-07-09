document.addEventListener("DOMContentLoaded", function () {
  const stepMontage = document.getElementById('step-montage')
  const infoMontage = document.getElementById('info-montage')
  window.electronAPI.message((value) => {
    if (value.type === 'info') {
      // console.log('[' + value.currentStep + '/' + value.maxStep + '] ' + value.text)
      stepMontage.textContent = 'Étape : ' + value.currentStep + '/' + value.maxStep
      infoMontage.textContent = value.text
    } else if (value.type === 'error') {
      // console.error('[' + value.currentStep + '/' + value.maxStep + '] ' + value.text)
      stepMontage.textContent = 'Étape : ' + value.currentStep + '/' + value.maxStep
      infoMontage.textContent = 'Erreur : ' + value.text
    }
  })
})


async function fetchFolders() {
  const backBtn = document.getElementById('btn-back-to-home')
  const loaderContainer = document.getElementById('container-loader')
  const overlay = document.querySelector('.overlay')
  const foldersList = document.getElementById('folders')
  const btnLoadFolders = document.getElementById('btn-load-folders')
  foldersList.innerHTML = ''
  overlay.style.display = 'block'
  loaderContainer.style.display = 'block'

  try {
    const folders = await window.electronAPI.getFolders()

    folders.forEach(folder => {
      const listItem = document.createElement('li')
      const folderIcon = document.createElement('div')
      folderIcon.classList.add('folder')
      const span = document.createElement('span')
      span.textContent = folder.name
      span.style.display = 'block'
      span.style.textAlign = 'center'
      span.style.marginTop = '10px'
      listItem.appendChild(folderIcon)
      listItem.appendChild(span)
      listItem.dataset.folderId = folder.id
      listItem.onclick = () => {
        backBtn.style.display = 'none'
        fetchFiles(folder.id)
      }
      foldersList.appendChild(listItem)
    })
  } catch (error) {
    console.error(error)
  } finally {
    backBtn.style.display = 'block'
    backBtn.onclick = function () {
      btnLoadFolders.style.display = 'block'
      backBtn.style.display = 'none'
      foldersList.innerHTML = ''
    }
    overlay.style.display = 'none'
    loaderContainer.style.display = 'none'
    btnLoadFolders.style.display = 'none'
  }
}

async function fetchFiles(folderId) {
  const backBtn = document.getElementById('btn-back-to-folders')
  const loaderContainer = document.getElementById('container-loader')
  const overlay = document.querySelector('.overlay')
  const fileList = document.getElementById('photos')
  const btnSelect = document.getElementById('btn-select')
  const foldersList = document.getElementById('folders')
  const btnMontage = document.getElementById('btn-montage')

  foldersList.innerHTML = ''
  fileList.innerHTML = ''
  loaderContainer.style.display = 'flex'
  overlay.style.display = 'block'


  try {
    const files = await window.electronAPI.getFiles(folderId)
    
    btnSelect.style.display = 'block'

    files.forEach(file => {
      const listItem = document.createElement('li')
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.value = file.id
      checkbox.addEventListener('click', (event) => {
        event.stopPropagation()
      })

      const extension = file.name.split('.').pop()
      let type = ''
      if (extension === 'mp4' || extension === 'webm' || extension === 'ogg' || extension === 'mov') {
        type = 'video'
      } else if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') {
        type = 'image'
      }
      listItem.onclick = () => showModal(file, type)
      if (extension === 'mp4' || extension === 'webm' || extension === 'ogg' || extension === 'mov') {
        const iframe = document.createElement('iframe')
        // const video = document.createElement('video')
        // const source = document.createElement('source')
        iframe.src = `https://drive.google.com/file/d/${file.id}/preview`
        iframe.style.width = '200px'
        iframe.style.height = '200px'
        iframe.style.pointerEvents = 'none'
        listItem.style.cursor = 'pointer'
        listItem.appendChild(iframe)
        // video.appendChild(source)
        // video.controls = true
        // listItem.appendChild(video)
      } else if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') {
        const img = document.createElement('img')
        img.src = `https://drive.fife.usercontent.google.com/u/0/d/${file.id}=w200-h200-p-k-rw-v1-nu-iv1`
        // img.src = `https://drive.fife.usercontent.google.com/u/0/d/${file.id}`
        img.setAttribute('crossorigin', 'anonymous')
        img.alt = file.name
        listItem.appendChild(img)
      }

      listItem.appendChild(checkbox)

      fileList.appendChild(listItem)
    })

  } catch (error) {
    console.error(error)
  } finally {
    backBtn.style.display = 'block'
    backBtn.onclick = function () {
      backBtn.style.display = 'none'
      btnSelect.style.display = 'none'
      fileList.innerHTML = ''
      btnMontage.style.display = 'none'
      fetchFolders()
    }
    loaderContainer.style.display = 'none'
    overlay.style.display = 'none'
  }
}

async function downloadFiles() {
  const backToFoldersBtn = document.getElementById('btn-back-to-folders')
  const loaderContainer = document.getElementById('generation-container-loader')
  const overlay = document.querySelector('.overlay')
  const checkboxes = document.querySelectorAll('#photos input[type="checkbox"]:checked')
  const btnSelect = document.getElementById('btn-select')
  const btnLoadFolders = document.getElementById('btn-load-folders')
  const fileIds = Array.from(checkboxes).map(checkbox => checkbox.value)

  loaderContainer.style.display = 'flex'
  overlay.style.display = 'block'

  const dst = await window.electronAPI.generateVideo(fileIds)

  if (dst) {
    const fileList = document.getElementById('photos')
    fileList.innerHTML = ''
    const btnMontage = document.getElementById('btn-montage')
    btnMontage.style.display = 'none'
    loaderContainer.style.display = 'none'
    overlay.style.display = 'none'
    btnSelect.style.display = 'none'

    const view = document.getElementById('video-generated-view')
    view.style.display = 'flex'
    const btnTelechargerVideo = document.getElementById('btn-telecharger-video')
    const videoGeneratedPlayer = document.getElementById('video-generated-player')
    const btnBackToHome = document.getElementById('btn-back-home-after-download')
    videoGeneratedPlayer.src = dst
    btnTelechargerVideo.href = dst
    btnTelechargerVideo.download = dst.split('/').pop()
    backToFoldersBtn.style.display = 'none'

    btnBackToHome.onclick = function () {
      videoGeneratedPlayer.src = ''
      view.style.display = 'none'
      btnLoadFolders.style.display = 'block'
      window.electronAPI.clearOutputs()
    }
  }
}
function selectAll() {
  const checkboxes = document.querySelectorAll('#photos input[type="checkbox"]')
  checkboxes.forEach(checkbox => {
    checkbox.checked = true
  })

  updateMontageButtonVisibility()
}
function deselectAll() {
  const checkboxes = document.querySelectorAll('#photos input[type="checkbox"]')
  checkboxes.forEach(checkbox => {
    checkbox.checked = false
  })

  updateMontageButtonVisibility()
}

function showModal(file, type) {
  const modal = document.querySelector('.modal')
  const modalImg = document.getElementById('img01')
  // const modalVideo = document.getElementById('vid01')
  const modalVideo = document.getElementById('embedVideo')
  // const videoSource = document.getElementById('videoSource')
  const captionText = document.getElementById('caption')

  if (type === 'image') {
    modalImg.src = `https://drive.fife.usercontent.google.com/u/0/d/${file.id}=w1280-h720`
    modalImg.setAttribute('crossorigin', 'anonymous')
    modalImg.style.display = 'block'
    modalVideo.style.display = 'none'
  } else if (type === 'video') {
    modalVideo.src = `https://drive.google.com/file/d/${file.id}/preview`
    modalVideo.style.display = 'block'
    // modalVideo.load()
    modalImg.style.display = 'none'

    modalVideo.onclick = function () {
      window.open(`https://drive.google.com/file/d/${file.id}/preview`, '_blank')
    }
  }

  captionText.innerHTML = file.name
  modal.style.display = 'flex'

  const closeModal = document.querySelector('.close')
  closeModal.onclick = function () {
    const modal = document.getElementById('myModal')
    modal.style.display = 'none'
  }

  window.onclick = function (event) {
    const modal = document.getElementById('myModal')
    if (event.target == modal) {
      modal.style.display = 'none'
    }
  }
}

function updateMontageButtonVisibility() {
  const checkboxes = document.querySelectorAll('#photos input[type="checkbox"]:checked')
  const btnMontage = document.getElementById('btn-montage')
  const btnHeader = document.getElementById('btn-header')
  btnHeader.style.display = 'flex'
  btnHeader.style.justifyContent = 'space-between'
  if (checkboxes.length > 0) {
    btnMontage.style.display = 'block'
  } else {
    btnMontage.style.display = 'none'
    btnHeader.style.display = 'block'
  }
}

document.addEventListener('change', updateMontageButtonVisibility)