const { app, BrowserWindow, ipcMain } = require('electron')
const ffmpegPath = require('ffmpeg-static')
  .replace('app.asar', 'app.asar.unpacked')
const ffprobePath = require('ffprobe-static').path
  .replace('app.asar', 'app.asar.unpacked')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const sharp = require('sharp')
const path = require('node:path')

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const durationPerImage = 4
const videoWidth = 1920
const videoHeight = 1080

const images = [
  'image.png',
  'image1.jpg',
  // 'image2.jpg',
  'image3.png'
  // 'image4.png',
  // 'image5.png',
  // 'image6.png',
  // // 'image7.jpg',
  // // 'image8.jpg',
  // 'image9.png',
  // 'image10.png',
  // 'image11.jpg',
  // 'image12.png',
  // 'image13.jpg',
  // // 'image14.jpg',
  // // 'image15.jpg',
  // 'image16.png',
  // 'image17.png',
  // // 'image18.jpg',
  // 'image19.png',
  // // 'image20.jpg',
  // // 'image21.jpg',
  // // 'image22.jpg',
  // 'image23.png'
]

async function resizeAllImages(imgList) {
  return Promise.all(
    imgList.map((image) => {
      return new Promise((resolve, reject) => {
        const dst = './tmp/images/' + image
        return sharp('./src/assets/' + image)
          .resize(videoWidth, videoHeight, {
            fit: sharp.fit.contain,
            position: 'center',
            background: { r: 0, g: 0, b: 0, alpha: 1 }
          })
          .toFile(dst, function (err, info) {
            if (err) {
              console.error(err)
              reject(new Error('Error resizing image ' + image))
            } else {
              console.log('Image ' + image + ' resized')
              resolve(dst)
            }
          })
      })
    })
  )
}

async function generateImagesVideos(imgList) {
  return Promise.all(
    imgList.map((image, index) => {
      return new Promise((resolve, reject) => {
        let imageName = image.split('/').pop()
        imageName = imageName.split('.').slice(0, -1).join('.')
        const dst = './tmp/images/' + imageName + '.mp4'
        ffmpeg()
          .input(image)
          .inputOptions(['-t ' + durationPerImage])
          .loop(1)
          // .outputOptions(['-movflags isml+frag_keyframe'])
          .outputFormat('mp4')
          .duration(4)
          .size(videoWidth + 'x' + videoHeight)
          .on('start', () => {
            console.log('Rendeging image ' + imageName + '...')
          })
          .on('error', (err) => {
            console.log(err)
            reject(new Error('Error rendering image ' + image.split('/').pop()))
          })
          .on('end', () => {
            console.log('Image ' + image.split('/').pop() + ' rendered')
            resolve(dst)
          })
          .saveToFile(dst)
      })
    })
  )
}

function cleanTmp() {
  fs.readdirSync('tmp/main').forEach((file) => {
    fs.unlinkSync('tmp/main/' + file)
  })
  fs.readdirSync('tmp/images').forEach((file) => {
    fs.unlinkSync('tmp/images/' + file)
  })
}

async function generateMainVideo(imgList) {
  const command = ffmpeg()

  imgList.forEach((image) => {
    command.input(image).inputFormat('mp4')
  })

  return new Promise((resolve, reject) => {
    const dst = './tmp/main/out.mp4'
    command
      .outputFormat('mp4')
      .duration(images.length * durationPerImage)
      .on('start', () => {
        console.log('Rendering main video...')
      })
      .on('end', () => {
        resolve(dst)
        console.log('Main video rendered')
      })
      .on('error', (err) => {
        console.log(err)
        reject(new Error('Error rendering main video'))
      })
      .concat(dst)
  })
}

async function addAudioToVideo(audioPath, videoPath, dst) {
  const videoDuration = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error(err)
        reject(new Error('Error getting video duration'))
      } else {
        resolve(metadata.format.duration)
      }
    })
  })
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(audioPath)
      // .loop(0)
      .addInput(videoPath)
      .duration(videoDuration)
      .on('start', () => {
        console.log('Rendering video with audio...')
      })
      .on('end', () => {
        resolve()
        console.log('Video with audio rendered')
      })
      .on('error', (err) => {
        console.log(err)
        reject(new Error('Error rendering video with audio'))
      })
      .saveToFile(dst)
  })
}

const createWindow = () => {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  
  async function createVideo() {
    const imagesResized = await resizeAllImages(images)
    const imageVideos = await generateImagesVideos(imagesResized)
    const muteVideo = await generateMainVideo(imageVideos)
    const dst = './out.mp4'
    await addAudioToVideo('src/assets/audio.mp3', muteVideo, dst)
    cleanTmp()

    win.webContents.send('video-created', path.join(__dirname, '.' + dst))

    console.log('YOOOUUH')
  }

  ipcMain.on('generate-video', (event, params) => {
    createVideo()
  })

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