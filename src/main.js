const { app, BrowserWindow, ipcMain } = require('electron')
const ffmpegPath = require('ffmpeg-static')
  .replace('app.asar', 'app.asar.unpacked')
const ffprobePath = require('ffprobe-static').path
  .replace('app.asar', 'app.asar.unpacked')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('node:path')
const log = require('electron-log')

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const durationPerImage = 4
const videoWidth = 1920
const videoHeight = 1080
const compressionPreset = 'fast' // 'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium' (default), 'slow', 'slower', 'veryslow', 'placebo'
const audioBitrate = '128k' // '32k', '64k', '96k', '128k', '192k', '256k', '320k'
const fps = 25

const videos = [
  // 'test.mov',
  'test.mp4',
  // 'test2.mp4'
]

const images = [
  'image.png',
  'image1.jpg',
  'image2.jpg',
  'image3.png',
  'image4.png',
  // 'image5.png',
  // 'image6.png',
  // 'image7.jpg',
  // 'image8.jpg',
  // 'image9.png',
  // 'image10.png',
  // 'image11.jpg',
  // 'image12.png',
  // 'image13.jpg',
  // 'image14.jpg',
  // 'image15.jpg',
  // 'image16.png',
  // 'image17.png',
  // 'image18.jpg',
  // 'image19.png',
  // 'image20.jpg',
  // 'image21.jpg',
  // 'image22.jpg',
  // 'image23.png'
]

fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true })
fs.mkdirSync(path.join(__dirname, '../tmp/images'), { recursive: true })
fs.mkdirSync(path.join(__dirname, '../tmp/main'), { recursive: true })
fs.mkdirSync(path.join(__dirname, '../tmp/downloads'), { recursive: true })
fs.mkdirSync(path.join(__dirname, '../tmp/videos'), { recursive: true })
fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true })
  
function cleanTmp() {
  fs.readdirSync(path.join(__dirname, '../tmp/main')).forEach((file) => {
    fs.unlinkSync(path.join(__dirname, '../tmp/main/' + file))
  })
  fs.readdirSync(path.join(__dirname, '../tmp/images')).forEach((file) => {
    fs.unlinkSync(path.join(__dirname, '../tmp/images/' + file))
  })
  fs.readdirSync(path.join(__dirname, '../tmp/downloads')).forEach((file) => {
    fs.unlinkSync(path.join(__dirname, '../tmp/downloads/' + file))
  })
  fs.readdirSync(path.join(__dirname, '../tmp/videos')).forEach((file) => {
    fs.unlinkSync(path.join(__dirname, '../tmp/videos/' + file))
  })
}

function shuffleArray(array) {
  array.sort(() => Math.random() - 0.5)
}


const createWindow = () => {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  function sendStatusToWindow(text, type = 'info') {
    log[type](text)
    win.webContents.send('message', { text, type })
  }

  function generateSingleImageVideo(image) {
    return new Promise((resolve, reject) => {
      const imageNameWithExt = image.includes('/') ? image.split('/').pop() : image.split('\\').pop()
      const imageName = imageNameWithExt.split('.').slice(0, -1).join('.')
      const dst = path.join(__dirname, '../tmp/images/' + imageName + '.mp4')
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
            options: videoWidth + ':-1',
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
            options: { x: '(' + videoWidth + '-overlay_w)/2', y: 0 },
            inputs: ['blurred_bg', 'main_scaled'],
            outputs: 'output'
          }
        ], 'output')
        .fps(fps)
        .videoCodec('libx264')
        // .size(videoWidth + 'x' + videoHeight)
        // .outputOption('-preset ' + compressionPreset)
        .on('start', () => {
          sendStatusToWindow('Rendering image video for ' + imageNameWithExt + '...', 'info')
        })
        .on('error', (err) => {
          sendStatusToWindow('Error while rendering image video for ' + imageNameWithExt + ': ' + err, 'error')
          reject(new Error('Error rendering image video for ' + imageNameWithExt))
        })
        .on('end', () => {
          sendStatusToWindow('Image video for ' + imageNameWithExt + ' rendered', 'info')
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
      const dst = path.join(__dirname, '../tmp/videos/' + video)
      ffmpeg()
        .input(path.join(__dirname, './assets/' + video))
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
            options: videoWidth + ':-1',
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
            options: { x: '(' + videoWidth + '-overlay_w)/2', y: 0 },
            inputs: ['blurred_bg', 'main_scaled'],
            outputs: 'output'
          }
        ], 'output')
        .outputOption('-preset ' + compressionPreset)
        .fps(fps)
        .videoCodec('libx264')
        .outputFormat('mp4')
        .on('start', () => {
          sendStatusToWindow('Rendering video ' + video + '...', 'info')
        })
        .on('end', () => {
          sendStatusToWindow('Video ' + video + ' rendered', 'info')
          resolve(dst)
        })
        .on('error', (err) => {
          sendStatusToWindow('Error while rendering video ' + video + ': '+ err, 'error')
          reject(new Error('Error rendering video ' + video))
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
    //   command.input(content).inputFormat(content.split('.').pop())
    // })
  
    // let videosDuration = 0
    // for (video of videoList) {
    //   const dur = await new Promise((resolve, reject) => {
    //     ffmpeg.ffprobe(video, (err, metadata) => {
    //       if (err) {
    //         sendStatusToWindow('Error while getting video duration of ' + video + ':' + err, 'error')
    //         reject(new Error('Error getting video duration: ' + video))
    //       } else {
    //         resolve(metadata.format.duration)
    //       }
    //     })
    //   })
    //   videosDuration += dur
    // }
  
    // I don't know why, but the concat filter doesn't work with the input method, so I have to creating a file with the list of files to be concatenated...
    const listFilePath = path.join(__dirname, '../tmp/main/content_list.txt')
    const fileContent = contentList.map(filePath => `file '${filePath}'`).join('\n')
    fs.writeFileSync(listFilePath, fileContent)
  
    return new Promise((resolve, reject) => {
      const dst = path.join(__dirname, '../tmp/main/main_without_audio.mp4')
      command
        .input(listFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputFormat('mp4')
        .outputOptions('-c:a', 'copy')
        // .duration((imgList.length * durationPerImage) + videosDuration)
        .fps(fps)
        .outputOption('-preset ' + compressionPreset)
        .on('start', () => {
          sendStatusToWindow('Rendering main video without audio...', 'info')
        })
        .on('end', () => {
          resolve(dst)
          sendStatusToWindow('Main video without audio rendered', 'info')
        })
        .on('error', (err) => {
          sendStatusToWindow('Error rendering main video without audio: ' + err, 'error')
          reject(new Error('Error rendering main video without audio'))
        })
        // .concat(dst)
        .saveToFile(dst)
    })
  }
  
  async function addAudioToVideo(videoPath, dst) {
    const audioList = fs.readdirSync(path.join(__dirname, 'assets/audio')).map((audio) => {
      return path.join(__dirname, 'assets/audio/' + audio)
    })
    shuffleArray(audioList)
  
    const videoDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          sendStatusToWindow('Error getting video whitout audio duration: ' + err, 'error')
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
            sendStatusToWindow('Error getting audio duration: ' + err, 'error')
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
    for (i=0; i < numberOfRepetitions; i++) {
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
          sendStatusToWindow('Rendering video with audio...', 'info')
        })
        .on('end', () => {
          resolve()
          sendStatusToWindow('Video with audio rendered', 'info')
        })
        .on('error', (err) => {
          sendStatusToWindow('Error rendering video with audio: ' + err, 'error')
          reject(new Error('Error rendering video with audio'))
        })
        .saveToFile(dst)
    })
  }
  
  async function createVideo() {
    sendStatusToWindow('Creating video...', 'info')
    const imageList = images.map((image) => path.join(__dirname, './assets/' + image))
    const imageVideos = await generateImagesVideos(imageList)
    const videosResized = await resizeAllVideos(videos)
    const muteVideo = await generateMainVideoWithoutSound(imageVideos, videosResized)
    const dst = path.join(__dirname, '../tmp/output.mp4')
    await addAudioToVideo(muteVideo, dst)
    cleanTmp()
  
    return dst
  }


  ipcMain.on('generate-video', (event, params) => {
    createVideo().then((dst) => {
      log.info('Video generated: ' + dst)
      win.webContents.send('video-generated', dst)
    }).catch((err) => {
      cleanTmp()
    })
  })

  log.transports.file.resolvePathFn = () => {
    return path.join(__dirname, '../logs/main.log')
  }

  win.webContents.openDevTools()

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