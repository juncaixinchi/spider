const fs = require('fs')
const URL = require('url')
const path = require('path')
const request = require('superagent')
const Promise = require('bluebird')

require('superagent-proxy')(request)

/* use proxy */
const proxy = 'socks5://127.0.0.1:2333'

/* download File */
const downloadFile = (url, referer, fileName, filePath, callback) => {
  const stream = fs.createWriteStream(filePath)
  stream.on('error', callback)
  stream.on('finish', () => callback(null))
  let size = 0

  const handle = request
    .get(url)
    .set({
      Referer: referer,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36'
    })
    .proxy(proxy)
    .timeout({
      response: 10000,  // Wait 10 seconds for the server to start sending,
      deadline: 5 * 60 * 1000 // but allow 5 minute for the file to finish loading.
    })
    .on('error', callback)
    .on('response', (res) => {
      res.on('data', (chunk) => {
        size += chunk.length
        process.stdout.clearLine()
        process.stdout.cursorTo(0)
        process.stdout.write(`Received ${size} bytes of data.`)
      })
      if (res.status !== 200 && res.status !== 206) {
        console.log('download http status code not 200', res)
        const e = new Error()
        e.message = res.error
        e.code = res.code
        e.status = res.status
        handle.abort()
        callback(e)
      }
    })

  handle.pipe(stream)
}

const downloadAsync = Promise.promisify(downloadFile)

/*
  // need a video-archive.html to gel Urls
  const filePath = 'video-archive.html'
  const lines = fs.readFileSync(filePath).toString().split('\n').map(l => l.trim()).filter(l => /href/.test(l))
  lines[14].split(' ').filter(l => /href/.test(l)).map(l => l.split('"')[1])
*/

const Urls = []

const fire = async (urls) => {
  console.log('urls count:', urls.length)
  const finishedList = []
  const todoList = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const htmlName = path.parse(URL.parse(url).path).base
    const htmlPath = path.join(__dirname, 'html', htmlName)
    console.log('\nNo.', i + 1, url)
    try {
      await downloadAsync(url, url, htmlName, htmlPath)
      console.log('\ndownload html file success')
    } catch (e) {
      console.error('download html file error', e.code)
      todoList.push(url)
      continue
    }
    let fileUrl
    try {
      // fileUrl = fs.readFileSync(htmlPath).toString().split('\n').map(l => l.trim()).filter(l => /mp4/.test(l))[0].split('"')[1]
      fileUrl = fs.readFileSync(htmlPath).toString().split('\n').map(l => l.trim()).filter(l => /720.mp4/.test(l))[0].split('"')[3]
    } catch (e) {
      console.error('parse html file error', e.code)
      continue
    }
    if (!fileUrl) continue
    const fileName = path.parse(URL.parse(fileUrl).path).base
    const filePath = path.join(__dirname, 'video', fileName)
    try {
      await downloadAsync(fileUrl, url, fileName, filePath)
    } catch (e) {
      console.error('download error', e.code, fileUrl)
      todoList.push(url)
      continue
    }
    console.log('\nfinished: ', fileUrl)
    finishedList.push(url)
  }
  console.log('\n<<<<<<<<<<<<<<<<<<<<<<')
  console.log('FinshiedList: ', finishedList.length)
  finishedList.forEach(v => console.log(v))
  console.log('\nTodoList: ', todoList.length)
  todoList.forEach(v => console.log(v))
  console.log('>>>>>>>>>>>>>>>>>>>>>>\n')
  if (todoList.length) fire(todoList)
}

fire(Urls).catch(e => console.log('fire error', e))