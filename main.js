const { app, BrowserWindow, ipcMain } = require('electron')
const ffmpegPath = require('ffmpeg-static')
  .replace('app.asar', 'app.asar.unpacked')
const ffprobePath = require('ffprobe-static').path
  .replace('app.asar', 'app.asar.unpacked')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('node:path')
const log = require('electron-log')
const { google } = require('googleapis')
const Os = require('os')
const googleCredentials = require('./google_credentials.json')

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const durationPerImage = 4
const videoWidth = 1920
const videoHeight = 1080
const compressionPreset = 'fast' // 'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium' (default), 'slow', 'slower', 'veryslow', 'placebo'
const audioBitrate = '128k' // '32k', '64k', '96k', '128k', '192k', '256k', '320k'
const fps = 25
const generationSteps = 5

const googleAuth = new google.auth.GoogleAuth({
  // keyFile: path.join(__dirname, './google_credentials.json'),
  credentials: googleCredentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
const drive = google.drive({ version: 'v3', auth: googleAuth, })
const folderId = '1MWxRUZ9O7aE7Q29KdWvS9If5al3ah3o0'

fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video'), { recursive: true })
fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp'), { recursive: true })
fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/images'), { recursive: true })
fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/main'), { recursive: true })
fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/downloads'), { recursive: true })
fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/videos'), { recursive: true })
fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video/outputs'), { recursive: true })
fs.mkdirSync(path.join(Os.tmpdir(), 'Montage Video/logs'), { recursive: true })

function cleanTmp() {
  fs.readdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/main')).forEach((file) => {
    fs.unlinkSync(path.join(Os.tmpdir(), 'Montage Video/tmp/main/' + file))
  })
  fs.readdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/images')).forEach((file) => {
    fs.unlinkSync(path.join(Os.tmpdir(), 'Montage Video/tmp/images/' + file))
  })
  fs.readdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/downloads')).forEach((file) => {
    fs.unlinkSync(path.join(Os.tmpdir(), 'Montage Video/tmp/downloads/' + file))
  })
  fs.readdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/videos')).forEach((file) => {
    fs.unlinkSync(path.join(Os.tmpdir(), 'Montage Video/tmp/videos/' + file))
  })
}

function cleanOutputs() {
  fs.readdirSync(path.join(Os.tmpdir(), 'Montage Video/outputs')).forEach((file) => {
    fs.unlinkSync(path.join(Os.tmpdir(), 'Montage Video/outputs/' + file))
  })
}

function shuffleArray(array) {
  array.sort(() => Math.random() - 0.5)
}

async function listFoldersInFolder(fId) {
  try {
    // If dossier existe
    const folderExists = await checkFolderExists(fId)
    if (!folderExists) {
      log.error(`Le dossier avec l'ID ${fId} n'existe pas.`)
      return []
    }

    // Liste des dossiers dans le dossier
    const res = await drive.files.list({
      q: `'${fId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    })

    const folders = res.data.files
    return folders.map(folder => ({ id: folder.id, name: folder.name }))
  } catch (err) {
    log.error('Error listing or downloading files: ', err)
    throw err
  }
}

async function listFilesInFolder(fId) {
  try {
    // If dossier existe
    const folderExists = await checkFolderExists(fId)
    if (!folderExists) {
      log.log(`Le dossier avec l'ID ${fId} n'existe pas.`)
      return []
    }

    // Liste des fichiers dans le dossier
    const res = await drive.files.list({
      q: `'${fId}' in parents and trashed=false`,
      fields: 'files(id, name)',
    })

    const files = res.data.files
    return files.map(file => ({ id: file.id, name: file.name }))
  } catch (err) {
    log.error('Error listing or downloading files: ', err)
    throw err
  }
}

async function getDriveFolders() {
  try {
    return await listFoldersInFolder(folderId)
  } catch (err) {
    log.error(err)
  }
}

async function checkFolderExists(fId) {
  try {
    await drive.files.get({
      fileId: fId,
      fields: 'id',
    })
    return true
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return false
    } else {
      throw err
    }
  }
}


const createWindow = () => {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, './src/preload.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  function sendStatusToWindow(text, step, type = 'info') {
    log[type]('[' + step + '/' + generationSteps + '] ' + text)
    win.webContents.send('message', { text, type, currentStep: step, maxStep: generationSteps })
  }

  function generateSingleImageVideo(image) {
    return new Promise((resolve, reject) => {
      const imageNameWithExt = path.basename(image)
      const imageName = path.basename(image, path.extname(image))
      const dst = path.join(Os.tmpdir(), 'Montage Video/tmp/images/' + imageName + '.mp4')
      ffmpeg()
        .input(image)
        .inputOptions(['-t ' + durationPerImage])
        .loop(1)
        .outputFormat('mp4')
        .duration(durationPerImage)
        .complexFilter([
          {
            filter: 'split',
            options: '2',
            outputs: ['main', 'blurred']
          },
          {
            filter: 'scale',
            options: videoWidth + ':' + videoHeight + ':force_original_aspect_ratio=decrease',
            inputs: 'main',
            outputs: 'main_scaled'
          },
          {
            filter: 'scale',
            options: videoWidth + ':' + videoHeight + ':force_original_aspect_ratio=increase',
            inputs: 'blurred',
            outputs: 'blurred_scaled'
          },
          {
            filter: 'crop',
            options: videoWidth + ':' + videoHeight,
            inputs: 'blurred_scaled',
            outputs: 'blurred_croped'
          },
          {
            filter: 'boxblur',
            options: '20:1',
            inputs: 'blurred_croped',
            outputs: 'blurred_bg'
          },
          {
            filter: 'overlay',
            // options: '(1920-overlay_w)/2:(1080-overlay_h)/2',
            options: { x: '(' + videoWidth + '-overlay_w)/2', y: '(1080-overlay_h)/2' },
            inputs: ['blurred_bg', 'main_scaled'],
            outputs: 'output'
          }
        ], 'output')
        .fps(fps)
        .videoCodec('libx264')
        // .size(videoWidth + 'x' + videoHeight)
        .outputOption('-preset ' + compressionPreset)
        .on('start', () => {
          sendStatusToWindow('Rendering image video for ' + imageNameWithExt + '...', 2, 'info')
        })
        .on('error', (err) => {
          sendStatusToWindow('Error while rendering image video for ' + imageNameWithExt + ': ' + err, 2, 'error')
          reject(new Error('Error rendering image video for ' + imageNameWithExt))
        })
        .on('end', () => {
          sendStatusToWindow('Image video for ' + imageNameWithExt + ' rendered', 2, 'info')
          resolve(dst)
        })
        .saveToFile(dst)
    })
  }

  async function generateImagesVideos(imgList) {
    const results = []
    for (const image of imgList) {
      const result = await generateSingleImageVideo(image)
      results.push(result)
    }
    return results
  }

  async function resizeSingleVideo(video) {
    return new Promise((resolve, reject) => {
      const videoName = path.basename(video, path.extname(video))
      const videoNameWithExt = path.basename(video)
      const dst = path.join(Os.tmpdir(), 'Montage Video/tmp/videos/' + videoName + '.mp4')
      ffmpeg()
        .input(video)
        .inputFormat(path.extname(video).slice(1))
        .complexFilter([
          {
            filter: 'split',
            options: '2',
            outputs: ['main', 'blurred']
          },
          {
            filter: 'scale',
            options: videoWidth + ':' + videoHeight + ':force_original_aspect_ratio=decrease',
            inputs: 'main',
            outputs: 'main_scaled'
          },
          {
            filter: 'scale',
            options: videoWidth + ':' + videoHeight + ':force_original_aspect_ratio=increase',
            inputs: 'blurred',
            outputs: 'blurred_scaled'
          },
          {
            filter: 'crop',
            options: videoWidth + ':' + videoHeight,
            inputs: 'blurred_scaled',
            outputs: 'blurred_croped'
          },
          {
            filter: 'boxblur',
            options: '20:1',
            inputs: 'blurred_croped',
            outputs: 'blurred_bg'
          },
          {
            filter: 'overlay',
            // options: '(1920-overlay_w)/2:(1080-overlay_h)/2',
            options: { x: '(' + videoWidth + '-overlay_w)/2', y: '(1080-overlay_h)/2' },
            inputs: ['blurred_bg', 'main_scaled'],
            outputs: 'output'
          }
        ], 'output')
        .outputOption('-preset ' + compressionPreset)
        .fps(fps)
        .videoCodec('libx264')
        .outputFormat('mp4')
        .on('start', () => {
          sendStatusToWindow('Resizing video ' + videoNameWithExt + '...', 3, 'info')
        })
        .on('end', () => {
          sendStatusToWindow('Video ' + videoNameWithExt + ' resized', 3, 'info')
          resolve(dst)
        })
        .on('error', (err) => {
          sendStatusToWindow('Error while resizing video ' + videoNameWithExt + ': ' + err, 3, 'error')
          reject(new Error('Error resizing video ' + videoNameWithExt))
        })
        .saveToFile(dst)
    })
  }

  async function resizeAllVideos(videoList) {
    const results = []
    for (const video of videoList) {
      const result = await resizeSingleVideo(video)
      results.push(result)
    }
    return results
  }

  async function generateMainVideoWithoutSound(imgList, videoList) {
    const command = ffmpeg()

    const contentList = imgList.concat(videoList)

    shuffleArray(contentList)

    // contentList.forEach((content) => {
    //   command.input(content).inputFormat(path.extname(content).slice(1))
    // })

    // let videosDuration = 0
    // for (video of videoList) {
    //   const dur = await new Promise((resolve, reject) => {
    //     ffmpeg.ffprobe(video, (err, metadata) => {
    //       if (err) {
    //         sendStatusToWindow('Error while getting video duration of ' + video + ':' + err, 4, 'error')
    //         reject(new Error('Error getting video duration: ' + video))
    //       } else {
    //         resolve(metadata.format.duration)
    //       }
    //     })
    //   })
    //   videosDuration += dur
    // }

    // I don't know why, but the concat filter doesn't work with the input method, so I have to creating a file with the list of files to be concatenated...
    const listFilePath = path.join(Os.tmpdir(), 'Montage Video/tmp/main/content_list.txt')
    const fileContent = contentList.map(filePath => `file '${filePath}'`).join('\n')
    fs.writeFileSync(listFilePath, fileContent)

    return new Promise((resolve, reject) => {
      const dst = path.join(Os.tmpdir(), 'Montage Video/tmp/main/main_without_audio.mp4')
      command
        .input(listFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputFormat('mp4')
        .outputOptions('-c:a', 'copy')
        // .duration((imgList.length * durationPerImage) + videosDuration)
        .fps(fps)
        .audioFilters('volume=0')
        .outputOption('-preset ' + compressionPreset)
        .on('start', () => {
          sendStatusToWindow('Rendering main video without audio...', 4, 'info')
        })
        .on('end', () => {
          resolve(dst)
          sendStatusToWindow('Main video without audio rendered', 4, 'info')
        })
        .on('error', (err) => {
          sendStatusToWindow('Error rendering main video without audio: ' + err, 4, 'error')
          reject(new Error('Error rendering main video without audio'))
        })
        // .concat(dst)
        .saveToFile(dst)
    })
  }

  async function addAudioToVideo(videoPath, dst) {
    const audioList = fs.readdirSync(path.join(__dirname, 'src/assets/audio').replace('app.asar\\', '')).map((audio) => {
      return path.join(__dirname, 'src/assets/audio/' + audio).replace('app.asar\\', '')
    })
    shuffleArray(audioList)

    const videoDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          sendStatusToWindow('Error getting video whitout audio duration: ' + err, 5, 'error')
          reject(new Error('Error getting video whitout audio duration'))
        } else {
          resolve(metadata.format.duration)
        }
      })
    })

    let audioListDuration = 0
    for (audio of audioList) {
      const dur = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audio, (err, metadata) => {
          if (err) {
            sendStatusToWindow('Error getting audio duration: ' + err, 5, 'error')
            reject(new Error('Error getting audio duration'))
          } else {
            resolve(metadata.format.duration)
          }
        })
      })
      audioListDuration += dur
    }

    const numberOfRepetitions = Math.ceil(videoDuration / audioListDuration)
    let newAudioList = []
    for (i = 0; i < numberOfRepetitions; i++) {
      newAudioList = newAudioList.concat(audioList)
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .addInput(videoPath)

      let complexFilter = ''
      newAudioList.forEach((audio, index) => {
        command.addInput(audio)
        complexFilter += ' [' + (index + 1) + ':0]'
      })
      complexFilter += ' concat=n=' + (newAudioList.length) + ':v=0:a=1 [audio]'

      command
        .complexFilter([complexFilter.trim()])
        .addOptions(['-map 0:v', '-map [audio]'])
        .outputFormat('mp4')
        .audioBitrate(audioBitrate)
        .duration(videoDuration)
        .fps(fps)
        .outputOption('-preset ' + compressionPreset)
        .on('start', () => {
          sendStatusToWindow('Rendering video with audio...', 5, 'info')
        })
        .on('end', () => {
          resolve()
          sendStatusToWindow('Video with audio rendered', 5, 'info')
        })
        .on('error', (err) => {
          sendStatusToWindow('Error rendering video with audio: ' + err, 5, 'error')
          reject(new Error('Error rendering video with audio'))
        })
        .saveToFile(dst)
    })
  }

  async function createVideo() {
    sendStatusToWindow('Generating video...', 2, 'info')
    const dst = path.join(Os.tmpdir(), 'Montage Video/outputs/' + Date.now() + '.mp4')

    const downloadContent = fs.readdirSync(path.join(Os.tmpdir(), 'Montage Video/tmp/downloads'))

    const downloadImages = downloadContent.filter((file) => {
      const extension = path.extname(file)
      return extension === '.png' || extension === '.jpg' || extension === '.jpeg'
    }).map((file) => path.join(Os.tmpdir(), 'Montage Video/tmp/downloads/' + file))

    const downloadVideos = downloadContent.filter((file) => {
      const extension = path.extname(file)
      return extension === '.mp4' || extension === '.webm' || extension === '.ogg' || extension === '.mov'
    }).map((file) => path.join(Os.tmpdir(), 'Montage Video/tmp/downloads/' + file))


    try {
      const imageVideos = await generateImagesVideos(downloadImages)
      const videosResized = await resizeAllVideos(downloadVideos)
      const muteVideo = await generateMainVideoWithoutSound(imageVideos, videosResized)
      await addAudioToVideo(muteVideo, dst)
    } catch (error) {
      throw error
    } finally {
      cleanTmp()
    }

    return dst
  }


  async function startCreatingVideo(fileIds) {
    try {
      const downloadDir = path.join(path.join(Os.tmpdir(), 'Montage Video/tmp/downloads'))
      sendStatusToWindow('Downloading contents...', 1, 'info')

      await Promise.all(fileIds.map(async fileId => {
        const file = await drive.files.get({
          fileId,
          fields: 'id, name',
        }).then(res => res.data).catch(err => {
          sendStatusToWindow(`Error fetching file ${fileId}. ${err.message}`, 1, 'error')
        })

        if (file) {
          const fileExtension = path.extname(file.name)
          const fileIdWithExtension = `${file.id}${fileExtension}`
          const filePath = path.join(downloadDir, fileIdWithExtension)
          await downloadFile(file.id, filePath)
        }
      }))

      return await createVideo()
    } catch (err) {
      log.error(err)
    }
  }

  async function downloadFile(fileId, filePath) {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })
    const dest = fs.createWriteStream(filePath)
    return new Promise((resolve, reject) => {
      res.data
        .on('end', () => {
          sendStatusToWindow(`Downloaded file ${fileId}`, 1, 'info')
          resolve()
        })
        .on('error', err => {
          sendStatusToWindow(`Error downloading file ${fileId}. ${err.message}`, 1, 'error')
          reject(err)
        })
        .pipe(dest)
    })
  }


  ipcMain.handle('dialog:generateVideo', (event, fileIds) => {
    return startCreatingVideo(fileIds).then((dst) => {
      log.info('Video generated: ' + dst)
      return dst
    }).catch((err) => {
      cleanTmp()
    })
  })

  ipcMain.handle('dialog:getFolders', getDriveFolders)
  ipcMain.handle('dialog:getFiles', (event, fId) => listFilesInFolder(fId))

  ipcMain.on('clearOutputs', () => {
    cleanOutputs()
  })

  log.transports.file.resolvePathFn = () => {
    return path.join(Os.tmpdir(), 'Montage Video/logs/main.log')
  }

  // win.webContents.openDevTools()

  win.loadFile('./src/index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})