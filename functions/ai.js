const os = require('os');
  const ort = detectONNXRuntime();
  const axios = require('axios');
  const fs = require('fs');
  const { performance } = require('perf_hooks');
  const { createCanvas, loadImage } = require('canvas');
  const sharp = require('sharp');
  const path = require('path');
 


  let session = null;

  function detectONNXRuntime() {
    try {
      console.log('Trying ONNX Runtime: GPU version...');
      const runtime = require('onnxruntime-node-gpu');
      console.log('Using ONNX Runtime: GPU (onnxruntime-node-gpu)');
      return runtime;
    } catch (gpuError) {
      console.warn(
        'ONNX Runtime GPU not available, falling back to native runtime.'
      );

      const platform = os.platform();
      try {
        if (platform === 'win32' || platform === 'linux') {
          console.log('Using ONNX Runtime: Native (onnxruntime-node)');
          return require('onnxruntime-web');
        } else if (platform === 'darwin') {
          console.log('Using ONNX Runtime: Web (onnxruntime-web)');
          return require('onnxruntime-web');
        }
      } catch (nativeError) {
        console.warn('No suitable ONNX Runtime found, falling back to CPU.');
        console.log('Using ONNX Runtime: CPU (onnxruntime-node)');
        return require('onnxruntime-node'); // Final fallback
      }
    }
  }


  const sessionOptions = {
    executionProviders:
      os.platform() === 'win32'
        ? ['dml', 'cpu']
        : os.platform() === 'linux'
          ? ['cuda', 'cpu']
          : ['webgl', 'wasm'],
  };

  function loadPokemonNames(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const pokemonNames = JSON.parse(data);
      if (!Array.isArray(pokemonNames))
        throw new Error('Invalid Pokémon list format.');
      return pokemonNames;
    } catch (error) {
      console.error(`Error loading Pokémon names: ${error.message}`);
      return null;
    }
  }
  // A more accurate preprocessing function
  async function preprocessImage(imageSource, size = 224, isURL = true) {
    try {
      let imageBuffer;
      if (isURL) {
        const response = await axios.get(imageSource, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data);
      } else {
        imageBuffer = fs.readFileSync(imageSource);
      }

      const processedImage = await sharp(imageBuffer)
        .resize(size, size, { fit: 'fill' }) // Use 'fill' to match Keras resize behavior
        .toFormat('png')
        .removeAlpha()
        .toBuffer();

      const { data } = await sharp(processedImage)
        .raw()
        .toBuffer({ resolveWithObject: true });

      // The Keras model expects a shape of [1, height, width, channels]
      const imgArray = new Float32Array(size * size * 3);
      for (let i = 0; i < data.length; i++) {
        imgArray[i] = data[i] / 255.0; // Normalize just like in the Python script
      }
        
      // Reshape to the expected format
      return new ort.Tensor('float32', imgArray, [1, size, size, 3]);
    } catch (error) {
      console.error(`Image preprocessing error: ${error.message}`);
      return null;
    }
  }
  const ort_runtime = detectONNXRuntime();




  async function preprocessImageCanvas(imageSource, size = 224, isURL = true) {
    try {
      let imageBuffer;
      if (isURL) {
        const response = await axios.get(imageSource, {
          responseType: 'arraybuffer',
        });
        imageBuffer = Buffer.from(response.data);
      } else {
        imageBuffer = fs.readFileSync(imageSource);
      }
      imageBuffer = await sharp(imageBuffer).toFormat('png').toBuffer();
      const img = await loadImage(imageBuffer);
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size).data;
      const imgArray = new Float32Array(size * size * 3);
      for (let i = 0, j = 0; i < imageData.length; i += 4, j += 3) {
        imgArray[j] = imageData[i] / 255.0;
        imgArray[j + 1] = imageData[i + 1] / 255.0;
        imgArray[j + 2] = imageData[i + 2] / 255.0;
      }
      return new ort.Tensor('float32', imgArray, [1, size, size, 3]);
    } catch (error) {
      console.error(`Image preprocessing error (Canvas): ${error.message}`);
      return null;
    }
  }

  async function loadModel() {
    if (!session) {
      try {
        session = await ort.InferenceSession.create('data/model/model.onnx');
        console.log(
          'Model successfully loaded with:',
          sessionOptions.executionProviders
        );
      } catch (error) {
        console.error('Error loading ONNX model:', error.message);
        session = null;
      }
    }
  }



  // This is the new function to be integrated
  async function detectPalafinFinizen(imageBuffer) {
    try {
      // Load the image from a buffer instead of a path
      const img = await loadImage(imageBuffer);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { width, height } = img;
      const imageData = ctx.getImageData(0, 0, width, height).data;

      const eyeCandidates = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = imageData[idx];
          const g = imageData[idx + 1];
          const b = imageData[idx + 2];
          const isEyeCandidate =
            r > 90 &&
            b > 90 &&
            g < 180 &&
            r - g > 10 &&
            b - g > 10 &&
            Math.abs(r - b) < 100;
          if (isEyeCandidate) {
            eyeCandidates.push({ x, y });
          }
        }
      }

      if (eyeCandidates.length === 0) {
        return {
          name: 'Finizen',
          confidence: '0.00',
          details: 'No eye detected by secondary check',
        };
      }

      const scored = eyeCandidates.map((p) => ({
        ...p,
        score: -p.x * 0.5 - p.y * 1.5,
      }));
      scored.sort((a, b) => b.score - a.score);
      const eyeX = scored[0].x;
      const eyeY = scored[0].y;

      const pinkPixelThreshold = 20;
      let pinkCount = 0;
      const headRadius = 50;
      const offsetY = 10;

      for (let y = eyeY + offsetY; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - eyeX;
          const dy = y - eyeY;
          const dist = Math.hypot(dx, dy);
          if (dist < headRadius) continue;
          const idx = (y * width + x) * 4;
          const r = imageData[idx];
          const g = imageData[idx + 1];
          const b = imageData[idx + 2];
          const isPink =
            r > 150 && g < 120 && b < 150 && r > g + 10 && r > b + 10;
          if (isPink) {
            pinkCount++;
          }
        }
      }

      const isPalafin = pinkCount > pinkPixelThreshold;
      const label = isPalafin ? 'Palafin' : 'Finizen';
      //  const confidence = pinkCount / (width * height); // A simple, non-rigorous confidence score
      const confidence = 1.0;

      return {
        name: label,
        confidence: confidence.toFixed(2),
        details: `Pink pixels: ${pinkCount}`,
      };
    } catch (error) {
      console.error(`Palafin/Finizen re-check error: ${error.message}`);
      return null;
    }
  }
  


// --- START OF SQUAWKABILLY RE-CHECK CODE ---
  // Convert RGB -> HSV
  function rgbToHsv(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;

    if (d !== 0) {
      switch (max) {
        case rn: h = ((gn - bn) / d) % 6; break;
        case gn: h = (bn - rn) / d + 2; break;
        case bn: h = (rn - gn) / d + 4; break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return { h, s, v };
  }

  // Classify color into labels
  function classifyColor(r, g, b) {
    const { h, s, v } = rgbToHsv(r, g, b);
    
    // Check for specific plumage colors
    // Green is the "normal" form, so check for it first
    if (h >= 80 && h <= 160 && s > 0.30 && v > 0.25) return 'green';
    if (h >= 190 && h <= 255 && s > 0.30 && v > 0.25) return 'blue';
    if (h >= 40 && h <= 70 && s > 0.35 && v > 0.45) return 'yellow';
    if (s < 0.20 && v > 0.50) return 'white';
    
    return 'unknown';
  }

  // Sample color near a pixel
  function sampleNeighborhoodColor(imageData, width, height, cx, cy, radius) {
    let rs = 0, gs = 0, bs = 0, n = 0;
    const x0 = Math.max(0, cx - radius);
    const y0 = Math.max(0, cy - radius);
    const x1 = Math.min(width - 1, cx + radius);
    const y1 = Math.min(height - 1, cy + radius);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = (y * width + x) * 4;
        rs += imageData[idx];
        gs += imageData[idx + 1];
        bs += imageData[idx + 2];
        n++;
      }
    }
    return { r: Math.round(rs / n), g: Math.round(gs / n), b: Math.round(bs / n) };
  }

  // New re-check function for Squawkabilly
  async function detectSquawkabillyPlumage(imageBuffer) {
    try {
      const img = await loadImage(imageBuffer);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const { width, height } = img;
      const pixels = ctx.getImageData(0, 0, width, height).data;

      const featherPixels = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const isFeatherPixel = (r > 230 && g > 230 && b > 230);
          if (isFeatherPixel) featherPixels.push({ x, y });
        }
      }

      let detected = "unknown";
      const featherPixelThreshold = (width * height) * 0.0025; 

      if (featherPixels.length > featherPixelThreshold) {
        const fx = Math.round(featherPixels.reduce((s, p) => s + p.x, 0) / featherPixels.length);
        const fy = Math.round(featherPixels.reduce((s, p) => s + p.y, 0) / featherPixels.length);
        const samplingRadius = Math.floor(Math.max(width, height) * 0.02);

        const { r, g, b } = sampleNeighborhoodColor(pixels, width, height, fx, fy, samplingRadius);
        detected = classifyColor(r, g, b);
      }

      const confidence = detected !== 'unknown' ? '1.00' : '0.00';
      
      let detectedName;
      if (detected === 'green') {
        detectedName = 'Squawkabilly'; // The "normal" form
      } else if (detected !== 'unknown') {
        detectedName = detected.charAt(0).toUpperCase() + detected.slice(1) + ' Plumage Squawkabilly';
      } else {
        detectedName = 'Unknown Plumage Squawkabilly';
      }

      return {
        name: detectedName,
        confidence: confidence,
        details: `Plumage: ${detected}`
      };

    } catch (error) {
      console.error(`Squawkabilly plumage re-check error: ${error.message}`);
      return null;
    }
  }
  async function detectFlabebeFlowerColor(imageBuffer) {
  try {
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const { width, height } = img;
    const imageData = ctx.getImageData(0, 0, width, height).data;

    const flowerPixels = [];

    // Focus on central-lower region (where flower usually is)
    const yStart = Math.floor(height * 0.4);
    const yEnd = Math.floor(height * 0.9);
    const xStart = Math.floor(width * 0.2);
    const xEnd = Math.floor(width * 0.8);

    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * width + x) * 4;
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];

        const brightness = r + g + b;
        const isFlowerCandidate =
          brightness > 300 &&
          !(g > r && g > b) &&
          !(r < 100 && g < 100 && b < 100);

        if (isFlowerCandidate) {
          flowerPixels.push({ r, g, b });
        }
      }
    }

    if (flowerPixels.length === 0) {
      return {
        name: 'Unknown Flabébé',
        confidence: '0.00',
        details: 'No flower pixels detected',
      };
    }

    const avg = flowerPixels.reduce(
      (acc, p) => {
        acc.r += p.r;
        acc.g += p.g;
        acc.b += p.b;
        return acc;
      },
      { r: 0, g: 0, b: 0 }
    );

    const n = flowerPixels.length;
    const avgR = Math.round(avg.r / n);
    const avgG = Math.round(avg.g / n);
    const avgB = Math.round(avg.b / n);

    const { h, s, v } = rgbToHsv(avgR, avgG, avgB);

    let variant = 'Flabébé';

    if (h >= 0 && h <= 20 && s > 0.35) {
      variant = 'Red Flower Flabébé';
    } else if (h > 20 && h <= 40 && s > 0.35) {
      variant = 'Orange Flower Flabébé';
    } else if (h >= 45 && h <= 65 && s > 0.35) {
      variant = 'Yellow Flower Flabébé';
    } else if (h >= 200 && h <= 250 && s > 0.35) {
      variant = 'Blue Flower Flabébé';
    } else if (s < 0.25 && v > 0.85) {
      variant = 'White Flower Flabébé';
    }

    return {
      name: variant,
      confidence: '1.00',
      details: `Avg RGB: (${avgR}, ${avgG}, ${avgB}) → HSV: (${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(v * 100)}%)`,
    };
  } catch (error) {
    console.error(`Flabébé flower detection error: ${error.message}`);
    return null;
  }
}

// --- END OF SQUAWKABILLY RE-CHECK CODE ---

  async function predict(imageSource, isURL = true) {
    await loadModel();
    if (!session) return null;
    const classNames = loadPokemonNames('data/model/pokemons.json');
    if (!classNames) return null;

    let imgArray = await preprocessImageCanvas(imageSource, 224, isURL);


    if (!imgArray) return null;

    try {
      const startTime = performance.now();
      const outputs = await session.run({ [session.inputNames[0]]: imgArray });
      const predictions = outputs[session.outputNames[0]].data;
      const predictedIndex = predictions.indexOf(Math.max(...predictions));
      const confidence = predictions[predictedIndex];
      const elapsedTime = performance.now() - startTime;
      const predictedName = classNames[predictedIndex];

      let result = {
        name: predictedName,
        confidence: confidence.toFixed(2),
        time: elapsedTime.toFixed(2),
        image: imageSource, // Return the image source
      };

      // Existing Palafin/Finizen re-check logic
      if (predictedName === 'Finizen' || predictedName === 'Palafin') {
        console.log(
          `Initial prediction is ${predictedName}, performing secondary check...`
        );
        let imageBuffer;
        if (isURL) {
          const response = await axios.get(imageSource, {
            responseType: 'arraybuffer',
          });
          imageBuffer = Buffer.from(response.data);
        } else {
          imageBuffer = fs.readFileSync(imageSource);
        }

        const recheckResult = await detectPalafinFinizen(imageBuffer);
        if (recheckResult) {
          console.log(
            `Secondary check result: ${recheckResult.name} (Confidence: ${recheckResult.confidence})`
          );
          result.name = recheckResult.name;
          result.confidence = recheckResult.confidence;
          result.rechecked = true; // Add a flag to indicate a re-check occurred
        }
      }

      // New Squawkabilly re-check logic
      const squawkabillyNames = [
        'Squawkabilly',
        'Blue Plumage Squawkabilly',
        'Yellow Plumage Squawkabilly',
        'White Plumage Squawkabilly'
      ];
    if (
  predictedName === 'Squawkabilly' ||
  predictedName === 'Blue Plumage Squawkabilly' ||
  predictedName === 'Green Plumage Squawkabilly' ||
  predictedName === 'Yellow Plumage Squawkabilly' ||
  predictedName === 'White Plumage Squawkabilly'
    ) {
        console.log(`Initial prediction is ${predictedName}, performing secondary check for plumage...`);
        let imageBuffer;
        if (isURL) {
          const response = await axios.get(imageSource, {
            responseType: 'arraybuffer',
          });
          imageBuffer = Buffer.from(response.data);
        } else {
          imageBuffer = fs.readFileSync(imageSource);
        }

        const recheckResult = await detectSquawkabillyPlumage(imageBuffer);
        // Only update if the re-check provides a definitive classification
        if (recheckResult && recheckResult.name !== 'Unknown Plumage Squawkabilly') {
          console.log(`Secondary check result: ${recheckResult.name} (Confidence: ${recheckResult.confidence})`);
          result.name = recheckResult.name;
          result.confidence = recheckResult.confidence;
          result.rechecked = true;
        } else {
          console.log(`Secondary check failed, keeping original prediction: ${predictedName}`);
        }
      }
 
  
  
const normalizedName = predictedName.normalize('NFC');

if (
  normalizedName === 'Flabébé' ||
  normalizedName === 'Red Flower Flabébé' ||
  normalizedName === 'Orange Flower Flabébé' ||
  normalizedName === 'White Flower Flabébé' ||
  normalizedName === 'Blue Flower Flabébé'
)
 {
  console.log(`Initial prediction is ${predictedName}, performing flower color check...`);
  let imageBuffer;
  try {
    if (isURL) {
      const response = await axios.get(imageSource, {
        responseType: 'arraybuffer',
      });
      imageBuffer = Buffer.from(response.data);
    } else {
      imageBuffer = fs.readFileSync(imageSource);
    }

    const recheckResult = await detectFlabebeFlowerColor(imageBuffer);

    if (recheckResult && recheckResult.name && !recheckResult.name.toLowerCase().includes('unknown')) {
      result.name = recheckResult.name;
      result.confidence = recheckResult.confidence;
      result.rechecked = true;
      console.log(`Flower color check result: ${result.name} (Confidence: ${result.confidence})`);
    } else {
      result.name = 'Flabébé';
      result.rechecked = true;
      console.log(`Flower color check inconclusive or unknown, defaulting to Flabébé`);
    }
  } catch (err) {
    result.name = 'Flabébé';
    result.rechecked = true;
    console.log(`Flower color check failed due to error, defaulting to Flabébé`);
  }
}



      return result;
    } catch (error) {
      console.error('Prediction error:', error.message);
      return null;
    }
  }

  module.exports = { predict };
  