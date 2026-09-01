let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
const audioLinks = ['./crickets.mp3', './creepy_tomb.mp3'];
let buffers: (AudioBuffer | null)[] | null = null;
let curAudio = -1;
let curSource: AudioBufferSourceNode | null = null;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array<ArrayBuffer> | null = null;
let isVizActive = false;
let sampleRate = 48000;
let isPerfMode = false;
let lastDrawTime = 0;
let cachedR = 255, cachedG = 255, cachedB = 255;

const smoothHeights: number[] = [];

// Look-Up Table (LUT) for frequencies and scaling
const DEFAULT_BAR_COUNT = 80;
const PERF_BAR_COUNT = 40;

interface BarLUT {
  indices: Int32Array;
  scaleFactors: Float32Array;
}

let lutDefault: BarLUT | null = null;
let lutPerf: BarLUT | null = null;

function createLUT(barCount: number, binCount: number, sRate: number): BarLUT {
  const indices = new Int32Array(barCount);
  const scaleFactors = new Float32Array(barCount);
  const minFreq = 80;
  const maxFreq = 14000;
  const nyquist = sRate / 2;

  for (let i = 0; i < barCount; i++) {
    const freq = minFreq * Math.pow(maxFreq / minFreq, i / (barCount - 1));
    indices[i] = Math.min(binCount - 1, Math.floor((freq / nyquist) * binCount));
    scaleFactors[i] = 0.6 + (i / barCount) * 0.5;
  }
  return { indices, scaleFactors };
}

function updateCanvasDimensions() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = 200;
}

export function setVisualizerColor(r: number, g: number, b: number) {
  cachedR = r;
  cachedG = g;
  cachedB = b;
}

export function setVisualizerPerfMode(perf: boolean) {
  isPerfMode = perf;
}

export async function initAudio(): Promise<void> {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  audioCtx = new AudioContextClass();
  sampleRate = audioCtx.sampleRate;
  gainNode = audioCtx.createGain();
  gainNode.connect(audioCtx.destination);
  gainNode.gain.value = 0.2;

  try {
    const promises = audioLinks.map(async (url) => {
      try {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        return await audioCtx!.decodeAudioData(arrayBuf);
      } catch {
        return null;
      }
    });
    buffers = await Promise.all(promises);
  } catch {
    // 오디오 파일 로드 실패 시 무시
  }
}

export async function setAudio(newAudio: number): Promise<void> {
  if (curAudio === newAudio) return;
  if (curAudio !== -1 && curSource) {
    try {
      curSource.stop();
      curSource.disconnect();
    } catch {
      // ignore
    }
  }
  curAudio = newAudio;
  if (newAudio === -1 || !buffers || !buffers[newAudio] || !audioCtx || !gainNode) return;

  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const source = new AudioBufferSourceNode(audioCtx, {
      buffer: buffers[newAudio]!,
      loop: true,
    });
    source.connect(gainNode);
    source.start();
    curSource = source;
  } catch {
    // ignore
  }
}

export function initVisualizer(canvasEl: HTMLCanvasElement): void {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  updateCanvasDimensions();
  window.addEventListener('resize', updateCanvasDimensions);

  if (!audioCtx || !gainNode) return;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  gainNode.connect(analyser);
  dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

  lutDefault = createLUT(DEFAULT_BAR_COUNT, analyser.frequencyBinCount, sampleRate);
  lutPerf = createLUT(PERF_BAR_COUNT, analyser.frequencyBinCount, sampleRate);
}

export function startVisualizer(): void {
  if (isVizActive) return;
  isVizActive = true;
  requestAnimationFrame(drawViz);
}

export function stopVisualizer(): void {
  isVizActive = false;
}

function drawViz(now = performance.now()): void {
  if (!isVizActive || !canvas || !ctx || !analyser || !dataArray) return;
  requestAnimationFrame(drawViz);

  // 저사양 모드일 때는 30fps로 스로틀링 (약 32ms 주기)
  if (isPerfMode) {
    if (now - lastDrawTime < 32) {
      return;
    }
    lastDrawTime = now;
  }

  analyser.getByteFrequencyData(dataArray);
  const cWidth = canvas.width;
  const cHeight = canvas.height;
  ctx.clearRect(0, 0, cWidth, cHeight);

  const barCount = isPerfMode ? PERF_BAR_COUNT : DEFAULT_BAR_COUNT;
  const lut = isPerfMode ? lutPerf : lutDefault;
  if (!lut) return;

  const bw = cWidth / barCount;

  for (let i = 0; i < barCount; i++) {
    const dIdx = lut.indices[i];
    const raw = dataArray[dIdx] || 0;
    const target = (raw / 255) * cHeight * lut.scaleFactors[i];

    if (!smoothHeights[i]) smoothHeights[i] = 0;
    if (target > smoothHeights[i]) {
      smoothHeights[i] = target;
    } else {
      smoothHeights[i] *= isPerfMode ? 0.88 : 0.94;
    }

    const h = Math.min(smoothHeights[i], cHeight * 0.8);
    const alpha = Math.max(0.08, (raw / 255) * 0.4);
    ctx.fillStyle = `rgba(${cachedR}, ${cachedG}, ${cachedB}, ${alpha})`;
    ctx.fillRect(i * bw, cHeight - h, bw - 1, h);
  }
}
