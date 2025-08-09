import React, { useEffect, useRef, useState } from 'react'

export default function App() {
  // Refs
  const videoRef = useRef(null)
  const workRef = useRef(null)
  const stripRef = useRef(null)
  const shotRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]

  // State
  const [countdown, setCountdown] = useState(null)
  const [flash, setFlash] = useState(false)
  const [busy, setBusy] = useState(false)
  const [canRetake, setCanRetake] = useState(false)
  const [canDownload, setCanDownload] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(null)

  useEffect(() => {
    // Setup camera
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (e) {
        alert('Could not access your camera. Please allow camera permissions and reload.')
        console.error(e)
      }
    })()
    return () => {
      // Stop tracks on unmount
      const v = videoRef.current
      const stream = v?.srcObject
      if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  function grayscaleImageData(imageData) {
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      data[i] = data[i + 1] = data[i + 2] = lum
    }
    return imageData
  }

  function drawFrameToCanvas(destCanvas) {
    const work = workRef.current
    const video = videoRef.current
    if (!work || !video) return false

    const wctx = work.getContext('2d')
    const dctx = destCanvas.getContext('2d')

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return false

    const W = work.width
    const H = work.height

    // cover-fit crop
    const videoAspect = vw / vh
    const canvasAspect = W / H
    let sx, sy, sw, sh
    if (videoAspect > canvasAspect) {
      sh = vh
      sw = Math.floor(vh * canvasAspect)
      sx = Math.floor((vw - sw) / 2)
      sy = 0
    } else {
      sw = vw
      sh = Math.floor(vw / canvasAspect)
      sx = 0
      sy = Math.floor((vh - sh) / 2)
    }

    wctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H)

    const imgData = wctx.getImageData(0, 0, W, H)
    const bw = grayscaleImageData(imgData)
    wctx.putImageData(bw, 0, 0)

    const margin = 16
    dctx.save()
    dctx.fillStyle = '#fff'
    dctx.fillRect(0, 0, destCanvas.width, destCanvas.height)
    dctx.drawImage(work, margin, margin, destCanvas.width - margin * 2, destCanvas.height - margin * 2)
    dctx.restore()

    return true
  }

  function sleep(ms) {
    return new Promise(res => setTimeout(res, ms))
  }

  async function runCountdown(n = 3) {
    for (let i = n; i >= 1; i--) {
      setCountdown(i)
      await sleep(800)
    }
    setCountdown('✔')
    setFlash(true)
    await sleep(250)
    setFlash(false)
    setCountdown(null)
  }

  async function takeFourShots() {
    for (let i = 0; i < shotRefs.length; i++) {
      await runCountdown(3)
      const canvas = shotRefs[i].current
      drawFrameToCanvas(canvas)
      await sleep(250)
    }
  }

  function composeStrip() {
    const strip = stripRef.current
    const ctx = strip.getContext('2d')
    const W = strip.width
    const H = strip.height

    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = '#f6f3ee'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 12
    ctx.strokeRect(6, 6, W - 12, H - 12)

    ctx.fillStyle = '#000'
    ctx.font = 'bold 28px ui-sans-serif, system-ui, -apple-system'
    ctx.textAlign = 'center'
    ctx.fillText('PHOTO BOOTH', W / 2, 48)

    const pad = 30
    const frameW = W - pad * 2
    const frameH = Math.floor((H - pad * 2 - 3 * 24 - 80) / 4)
    const spacing = 24
    let y = 80

    for (let i = 0; i < shotRefs.length; i++) {
      const x = pad
      const r = 18
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + frameW - r, y)
      ctx.quadraticCurveTo(x + frameW, y, x + frameW, y + r)
      ctx.lineTo(x + frameW, y + frameH - r)
      ctx.quadraticCurveTo(x + frameW, y + frameH, x + frameW - r, y + frameH)
      ctx.lineTo(x + r, y + frameH)
      ctx.quadraticCurveTo(x, y + frameH, x, y + frameH - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()

      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#000'
      ctx.stroke()

      const inner = 16
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + frameW - r, y)
      ctx.quadraticCurveTo(x + frameW, y, x + frameW, y + r)
      ctx.lineTo(x + frameW, y + frameH - r)
      ctx.quadraticCurveTo(x + frameW, y + frameH, x + frameW - r, y + frameH)
      ctx.lineTo(x + r, y + frameH)
      ctx.quadraticCurveTo(x, y + frameH, x, y + frameH - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.clip()

      const shot = shotRefs[i].current
      ctx.drawImage(shot, x + inner, y + inner, frameW - inner * 2, frameH - inner * 2)
      ctx.restore()

      ctx.restore()
      y += frameH + spacing
    }

    // download
    const url = strip.toDataURL('image/png')
    setDownloadUrl(url)
    setCanDownload(true)
  }

  function animateStripEject() {
    const strip = stripRef.current
    if (!strip) return
    strip.classList.remove('eject')
    // force reflow
    void strip.offsetWidth
    strip.classList.add('eject')
  }

  async function startBooth() {
    setBusy(true)
    setCanRetake(false)
    setCanDownload(false)
    setDownloadUrl(null)

    // clear previous
    shotRefs.forEach(ref => {
      const c = ref.current
      c.getContext('2d').clearRect(0, 0, c.width, c.height)
    })

    await takeFourShots()
    composeStrip()
    animateStripEject()
    setBusy(false)
    setCanRetake(true)
  }

  return (
    <div className="app">
      <header>
        <h1>📸 Photo Booth</h1>
        <p>Take four photos and get a black &amp; white photo strip. Built with React + Vite.</p>
      </header>

      <main>
        <section className="preview">
          <div className="camera">
            <div className="camera-body">
              <video ref={videoRef} autoPlay playsInline />
              <div className="lens-gloss"></div>
              <div className="slot"></div>
              <canvas ref={stripRef} width="600" height="2200" className="strip"></canvas>
            </div>
            <div className="camera-foot"></div>
          </div>

          <div className="controls">
            <button onClick={startBooth} disabled={busy}>Start Booth</button>
            <button onClick={startBooth} disabled={!canRetake}>Retake</button>
            <a className={`btn ${canDownload ? '' : 'disabled'}`} href={downloadUrl || '#'} download="photobooth-strip.png">Download Strip</a>
          </div>

          <div className={`countdown ${countdown ? '' : 'hidden'}`}>
            {countdown}
          </div>
          <div className={`flash ${flash ? 'blink' : ''}`}></div>
        </section>

        <section className="captures">
          <h2>Shots</h2>
          <div className="grid">
            <canvas ref={shotRefs[0]} width="480" height="640"></canvas>
            <canvas ref={shotRefs[1]} width="480" height="640"></canvas>
            <canvas ref={shotRefs[2]} width="480" height="640"></canvas>
            <canvas ref={shotRefs[3]} width="480" height="640"></canvas>
          </div>
        </section>

        <canvas ref={workRef} width="480" height="640" className="hidden"></canvas>
      </main>

      <footer>
        <small>Made with ❤️ — works best in Chrome/Firefox/Safari.</small>
      </footer>
    </div>
  )
}
