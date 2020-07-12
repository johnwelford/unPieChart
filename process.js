const debug = true;

const ksize = {width : 7, height : 7}; // blurring kernel size
const sigma = [0, 0]; // gaussian kernal standard deviation [x, y]
const param1 = 10; // a number forwarded to the Canny edge detector (applied to a grayscale image) that represents the threshold1 passed to Canny(...). Canny uses that number to guide edge detection
segStep = 3; // degrees
const thresh = [5, 80, 18]; // bound either side of hls colour to search (0-255 values for each)


const view = document.getElementById('dropZoneView');
function dropZone() { // adapted from https://observablehq.com/@j-f1/drop-zone
  const area = document.getElementById('dropZone');

  area.ondragover = e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  function getImage(items) {
    const value = (() => {
      for (const item of items) {
        if (item.kind === 'file' && item.type.match(/^image\/(png|jpeg)$/)) {
          return item.getAsFile();
        }
      }
    })();
    if (value) {
      view.value = value;
      var fr = new FileReader();
      fr.onload = async function () {
        document.getElementById('image').src = fr.result;
        await new Promise((resolve) => { document.getElementById('image').onload = resolve; });
        imageLoaded();
      }
      fr.readAsDataURL(value);
      setTimeout(() => view.dispatchEvent(new CustomEvent('input')), 100);
      area.blur();
    } else {
      area.classList.add('invalid');
      setTimeout(() => area.classList.remove('invalid'), 2000);
    }
  }

  area.ondrop = e => {
    e.preventDefault();
    getImage(e.dataTransfer.items);
  };

  area.onpaste = e => {
    getImage(e.clipboardData.items);
  };
}

function onOpenCvReady() {
  if (debug) console.log('OpenCV loaded.');
  dropZone(); // only allow droping/pasting after load
}

function imageLoaded() {
  if (debug) console.log('Image loaded.');

  // load source
  var src = cv.imread('image');
  src = cv.imread('image'); // fails on first read?
  if (debug) console.log('image width: ' + src.cols + '\n' +
              'image height: ' + src.rows + '\n' +
              'image size: ' + src.size().width + '*' + src.size().height + '\n' +
              'image depth: ' + src.depth() + '\n' +
              'image channels ' + src.channels() + '\n' +
              'image type: ' + src.type() + '\n');

  // setup greyscale image
  var grey = src.clone();
  cv.cvtColor(src, grey, cv.COLOR_BGR2GRAY, 0);
  cv.imshow('greyscale', grey);

  // blur image
  const borderType = cv.BORDER_DEFAULT; // blur pixel extrapolation method
  var blur = src.clone(); // setup blurred image
  cv.GaussianBlur(grey, blur, ksize, sigma[0], sigma[1], borderType);
  cv.imshow('blur', blur);

  // perform edge detection (for display only, incorporated within HoughCircles algorithm already)
  var canny = src.clone(); // setup canny edge detected image - for display only
  cv.Canny(blur, canny, param1/2, param1, 3, false);
  cv.imshow('edges', canny);

  // find circles
  const dp = 1; // resolution of accumulator array set to find perfect circles
  const minDist = Math.max(src.rows, src.cols); // distance from one circle to another is the largest dimension of the image - forcing only a single detection
  const param2 = 1; // low accumulator threshold for the cv2.HOUGH_GRADIENT method meaning more detection
  const pieImageLimits = [0.05, 0.98]; // pie should be between 5% and 98% of the minimum image dimension
  const minRadius = pieImageLimits[0]*Math.min(src.rows, src.cols)/2;
  const maxRadius = pieImageLimits[1]*Math.min(src.rows, src.cols)/2;
  const circlesMat = new cv.Mat(); // setup circles vector
  cv.HoughCircles(blur, circlesMat, cv.HOUGH_GRADIENT, dp, minDist, param1, param2, minRadius, maxRadius);

  // draw circles
  let circle = []; // store circle details
  var detect = src.clone(); // setup detection image - for display only
  for (let i = 0; i < circlesMat.cols; ++i) {
      let x = circlesMat.data32F[i * 3];
      let y = circlesMat.data32F[i * 3 + 1];
      let radius = circlesMat.data32F[i * 3 + 2];
      circle.push({x: x, y: y, radius: radius});
  }
  if (debug) console.log('circle', circle);

  // draw circles and build mask
  var totalMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8U); // setup mask
  const pieCentre = 0.2; // remove 20% of radius in the centre
  var detect = src.clone(); // setup detection image - for display only
  circle.forEach( d => {
      cv.circle(detect, {x: d.x, y: d.y}, d.radius, [255, 0, 0, 255], 1, 8, 0); // outline
      cv.circle(detect, {x: d.x, y: d.y}, 1, [0, 255, 0, 255], -1, 8, 0); // centre dot
      cv.circle(totalMask, {x: d.x, y: d.y}, d.radius, [255, 255, 255, 255], -1, 8, 0); // make mask
      cv.circle(totalMask, {x: d.x, y: d.y}, d.radius*pieCentre, [0, 0, 0, 0], -1, 8, 0); // remove centre of mask
  })
  cv.imshow('output', detect);

  // crop image - for display only
  var crop = new cv.Mat(src.rows, src.cols, cv.CV_8U); // setup cropped image
  src.copyTo(crop, totalMask);
  cv.imshow('crop', totalMask);

  // Segment
  var segMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8U); // mask for increasing segment from start point
  var segCrop = new cv.Mat(src.rows, src.cols, cv.CV_8U); // setup segment cropped image
  var segCropCombine = new cv.Mat(src.rows, src.cols, cv.CV_8U); // setup segment cropped image
  var segPxls = []; // store details for each segment
  for (let seg = segStep; seg <= 360; seg = seg + segStep) {
    circle.forEach( d => {
        cv.ellipse(segMask, {x: d.x, y: d.y}, {width: d.radius, height: d.radius}, 0, 0, seg, [255, 255, 255, 255], -1, 8, 0); // draw segment mask
    } )
    cv.bitwise_and(totalMask, segMask, segCropCombine); // combine mask with segment mask
    cv.subtract(totalMask, segMask, totalMask); // apply mask to segment mask
    segCrop = cv.Mat.zeros(src.rows, src.cols, cv.CV_8U); // clear segment cropped image
    src.copyTo(segCrop, segCropCombine); // apply segment mask to source

    // get segment pixels
    var segPix = [];
    for (let i = 0; i < src.data.length/4; i++) {
        if (segCropCombine.data[i]>0) segPix.push([
          src.data[i*4],
          src.data[i*4 + 1],
          src.data[i*4 + 2],
        ]);
    }
    segPxls.push(segPix); // store segment pixels
  }
  if (debug) console.log('segPxls', segPxls);
  cv.imshow('segment', segCrop);

  var segValue = [];
  segPxls.forEach( segment => {
    let means = kmeans(segment, 5, null, 8, 10);
    segValue.push(means.centroids.reduce((prev, current) => (prev.points.length > current.points.length) ? prev : current)); // keep centroid with the most pixels
  })
  if (debug) console.log('segValue', segValue);

  // find values by looking for discontinuities
  const colDifThresh = 7;
  let values = [];
  let thisVal = {startAng: 0, endAng: segStep, colour: d3.rgb(segValue[0][0],segValue[0][1],segValue[0][2]), segColours: [d3.rgb(segValue[0][0],segValue[0][1],segValue[0][2])]};
  for (let i = 1; i < segValue.length; i++) {
    if (LABdistance(segValue[i-1],segValue[i]) > colDifThresh) { // segment is a new value
      values.push(thisVal); // record last value
      thisVal = {startAng: segStep*i, endAng: segStep*(i+1), colour: d3.rgb(segValue[i][0],segValue[i][1],segValue[i][2]), segColours: [d3.rgb(segValue[i][0],segValue[i][1],segValue[i][2])]}; // start new value
    } else { // segment continues old value
      thisVal.endAng = thisVal.endAng + segStep; // increment value end point
      thisVal.segColours.push(d3.rgb(segValue[i][0],segValue[i][1],segValue[i][2])); // add in the colour of this segment
    }
  }
  // wrap around from end to start?
  if (LABdistance(segValue[0],segValue[segValue.length-1]) > colDifThresh) { // start is different from end
    values.push(thisVal); // record last value
  } else { // start continues from end, so merge
    values[0].startAng = thisVal.startAng;
    values[0].segColours = thisVal.segColours.concat(values[0].segColours);
  }

  // calculate percentages
  values.map( d => {d.fraction = d.segColours.length*segStep/360; return d;});
  if (debug) console.log('values', values);

  // remove pie from image
  var pieMask = new cv.Mat(src.rows, src.cols, cv.CV_8U,[255,255,255,255]); // setup mask
  const inflatePie = src.cols*0.01; // pixels to increase pie size by to ensure it is fully removed
  circle.forEach( d => {
      cv.circle(pieMask, {x: d.x, y: d.y}, d.radius+inflatePie, [0,0,0,0], -1, 8, 0); // make mask
  })
  cv.imshow('pieless', pieMask);

  // find legend blobs
  params = {
    minArea: 25, // 5x5 pixels min
    maxArea: 0.125 * Math.PI*circle[0].radius*circle[0].radius, // 1/8 of the whole pie area
    minInertiaRatio: 0.33, // 3 times length to width
    maxInertiaRatio: 1, // ideally 1
    minConvexity: 0.6, // guess
    maxConvexity: 1, // ideally 1
  };
  const inflateLegMask = 2; // extra pixels to add to the mask around legends
  var pieLess = new cv.Mat(src.rows, src.cols, cv.CV_8U,[255,255,255,255]); // set up a new image
  src.copyTo(pieLess, pieMask); // remove pie from image
  var pieLegMask = new cv.Mat(src.rows, src.cols, cv.CV_8U,[255,255,255,255]); // setup mask
  pieMask.copyTo(pieLegMask); // apply segment mask to source
  var hls = pieLess.clone(); // setup hls image
  cv.cvtColor(pieLess, hls, cv.COLOR_RGB2HLS, 0);
  let segmentFilter = new cv.Mat(src.rows, src.cols, cv.CV_8U,[255,255,255,255]);
  let blobs = [];
  values.forEach( seg => {
    let segHsl = [0.5*d3.hsl(seg.colour).h, 255*d3.hsl(seg.colour).l, 255*d3.hsl(seg.colour).s]; // convert d3 hsl to opencv 8-bit hls
    let low = new cv.Mat(src.rows, src.cols, hls.type(), segHsl.map((d,i) => d-thresh[i]).concat([0]) );
    let high = new cv.Mat(src.rows, src.cols, hls.type(), segHsl.map((d,i) => d+thresh[i]).concat([255]) );
    cv.inRange(hls, low, high, segmentFilter); // filter image for legend colour
    let segBlobs = findBlobs(segmentFilter, params);
    blobs.push(segBlobs);
    if (segBlobs.length>0) cv.rectangle(pieLegMask, {x: segBlobs[0].rect.x-inflateLegMask, y: segBlobs[0].rect.y-inflateLegMask}, {x: segBlobs[0].rect.x+segBlobs[0].rect.width+inflateLegMask, y: segBlobs[0].rect.y+segBlobs[0].rect.height+inflateLegMask}, [0,0,0,0], -1, 8, 0);
    // segBlobs.forEach( d =>
    // cv.rectangle(pieLegMask, {x: d.rect.x, y: d.rect.y}, {x: d.rect.x+d.rect.width, y: d.rect.y+d.rect.height}, [0,0,0,0], -1, 8, 0)); // add rect mask for segment legend
    // cv.subtract(pieLegMask, segmentFilter, pieLegMask); // apply mask to segment mask
  });
  // MAYBE SORT/DISCARD BLOBS WHEN THERE IS MORE THAN ONE PER SEGMENT?
  var pieLegLess = new cv.Mat(src.rows, src.cols, cv.CV_8U,[255,255,255,255]); // setup output image
  pieLess.copyTo(pieLegLess, pieLegMask); // remove pie and legend from image
  cv.imshow('legend', pieLegLess);
  if (debug) console.log('blobs', blobs);

  extractText(values, blobs);
}

function kmeans(points, k, centroids, maxIterations = 25, tolerance = 3) { // k-means clustering algorithm as implemented at https://observablehq.com/@romaklimenko/finding-palettes-of-dominant-colors-with-the-k-means-cluste
  if (!centroids) centroids = random(points, k)

  assign(centroids, points)

  let moved = true
  let iterations = 0

  while(moved && iterations < maxIterations) {
    iterations++
    moved = false

    for (let i = 0; i < centroids.length; i++) {
      const newCentroid = centroid(centroids[i].points)
      if (LABdistance(centroids[i], newCentroid) > Math.pow(tolerance, 2)) {
        moved = true
        centroids[i] = newCentroid
      }
    }

    if (moved) assign(centroids, points)
  }

  return {
    centroids: centroids,
    iterations: iterations
  }
}

function centroid(points) {
  return points.length === 0 ? [] : // part of k-means
  points
    .reduce((a, b) => b.map((p, i) => a[i] + p)) //  summs up each dimention
    .map(p => Math.floor(p / points.length)); // divides each dimention sum by the vector length
}

function random(points, k) { // part of k-means
  if(k < 0 || k > points.length) return
  const set = new Set();
  do {
    set.add(Math.floor(Math.random() * points.length))
  } while(set.size < k);
  return Array.from(set).map(i => points[i]);
}

function assign(centroids, points) { // part of k-means
  centroids.forEach(c => {
    c.points = [];
    c.variance = 0;
  })

  points.forEach((p, i) => {
    let min = {};
    centroids.forEach((c, j) => {
      if(j === 0) {
        min.centroid = c;
        min.distance = LABdistance(c, p);
      }
      const newDistance = LABdistance(c, p);
      if (min.distance > newDistance) {
        min.centroid = c;
        min.distance = newDistance;
      }
    })

    min.centroid.variance += min.distance;
    min.centroid.points.push(p);
  })

  centroids.forEach(c => c.variance /= c.points.length)
}

function LABdistance(a, b) { // convert to d3 colours to use CIELAB CIEDE2000 distance measure
  return distance(d3.rgb(a[0],a[1],a[2]), d3.rgb(b[0],b[1],b[2]));
}

function distance(color1, color2) { // distance between two colours, adapted from https://observablehq.com/@severo/color-distance
  const labColor1 = d3.lab(color1);
  const labColor2 = d3.lab(color2);
  const sin = x => Math.sin((x * Math.PI) / 180);
  const cos = x => Math.cos(x * Math.PI / 180);
  const atan2 = (y, x) => Math.atan2(y, x) * 180 / Math.PI;

  const L_1 = labColor1.l;
  const a_1 = labColor1.a;
  const b_1 = labColor1.b;
  const L_2 = labColor2.l;
  const a_2 = labColor2.a;
  const b_2 = labColor2.b;

  const k_L = 1;
  const k_H = 1;
  const k_C = 1;

  const C_1 = Math.sqrt(a_1 ** 2 + b_1 ** 2);
  const C_2 = Math.sqrt(a_2 ** 2 + b_2 ** 2);
  const ΔLp = L_2 - L_1;

  const L_ = (L_1 + L_2) / 2;
  const C_ = (C_1 + C_2) / 2;
  const ap_1 = a_1 + (a_1 / 2) * (1 - Math.sqrt(C_ ** 7 / (C_ ** 7 + 25 ** 7)));
  const ap_2 = a_2 + (a_2 / 2) * (1 - Math.sqrt(C_ ** 7 / (C_ ** 7 + 25 ** 7)));

  const Cp_1 = Math.sqrt(ap_1 ** 2 + b_1 ** 2);
  const Cp_2 = Math.sqrt(ap_2 ** 2 + b_2 ** 2);
  const Cp_ = (Cp_1 + Cp_2) / 2;
  const ΔCp = Cp_2 - Cp_1;

  const hp_1 = (atan2(b_1, ap_1) + 360) % 360;
  const hp_2 = (atan2(b_2, ap_2) + 360) % 360;
  const Δhp =
    Math.abs(hp_1 - hp_2) <= 180
      ? hp_2 - hp_1
      : hp_2 <= hp_1
      ? hp_2 - hp_1 + 360
      : hp_2 - hp_1 - 360;

  const ΔHp = 2 * Math.sqrt(Cp_1 * Cp_2) * sin(Δhp / 2);
  const Hp_ =
    Math.abs(hp_1 - hp_2) <= 180
      ? (hp_1 + hp_2) / 2
      : hp_1 + hp_2 < 360
      ? (hp_1 + hp_2 + 360) / 2
      : (hp_1 + hp_2 - 360) / 2;
  const T =
    1 -
    0.17 * cos(Hp_ - 30) +
    0.24 * cos(2 * Hp_) +
    0.32 * cos(3 * Hp_ + 6) -
    0.20 * cos(4 * Hp_ - 63);
  const S_L = 1 + (0.015 * (L_ - 50) ** 2) / Math.sqrt(20 + (L_ - 50) ** 2);
  const S_C = 1 + 0.045 * Cp_;
  const S_H = 1 + 0.015 * Cp_ * T;
  const R_T =
    -2 *
    Math.sqrt(Cp_ ** 7 / (Cp_ ** 7 + 25 ** 7)) *
    sin(60 * Math.exp(-(((Hp_ - 275) / 25) ** 2)));

  return Math.sqrt(
    (ΔLp / (k_L * S_L)) ** 2 +
      (ΔCp / (k_C * S_C)) ** 2 +
      (ΔHp / (k_H * S_H)) ** 2 +
      R_T * (ΔCp / (k_C * S_C)) * (ΔHp / (k_H * S_H))
  );
}

// From https://gist.github.com/janpaul123/8b9061d1d093ec0b36dac2230434d34a
// Port of https://github.com/opencv/opencv/blob/a50a355/modules/features2d/src/blobdetector.cpp
function findBlobs(binaryImage, params) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binaryImage, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_NONE);
  hierarchy.delete();

  const centers = [];
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);

    if (area == 0) continue;

    let moms = cv.moments(contour);
    let center = {
      location: { x: moms.m10 / moms.m00, y: moms.m01 / moms.m00 },
      area: area,
    };
    if (area < params.minArea || area >= params.maxArea) continue;

    const denominator = Math.sqrt(
      Math.pow(2 * moms.mu11, 2) + Math.pow(moms.mu20 - moms.mu02, 2)
    );
    if (denominator > 0.01) {
      const cosmin = (moms.mu20 - moms.mu02) / denominator;
      const sinmin = 2 * moms.mu11 / denominator;
      const cosmax = -cosmin;
      const sinmax = -sinmin;

      const imin =
            0.5 * (moms.mu20 + moms.mu02) -
            0.5 * (moms.mu20 - moms.mu02) * cosmin -
            moms.mu11 * sinmin;
      const imax =
            0.5 * (moms.mu20 + moms.mu02) -
            0.5 * (moms.mu20 - moms.mu02) * cosmax -
            moms.mu11 * sinmax;
      center.ratio = imin / imax;
    } else {
      center.ratio = 1;
    }
    if (center.ratio < params.minInertiaRatio || center.ratio > params.maxInertiaRatio) continue;

    const hull = new cv.Mat();
    cv.convexHull(contour, hull);
    const hullArea = cv.contourArea(hull);
    center.Convexity = area / hullArea;
    hull.delete();
    if (center.Convexity < params.minConvexity || center.Convexity > params.maxConvexity) continue;

    center.rect = cv.boundingRect(contour);
    centers.push(center);
  }
  return centers;
}



// Builds the HTML Table
function buildHtmlTable(arr) {
  var table = document.getElementById('resultTable');
  arr.forEach((row, i) => {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    var div = document.createElement('div');
    div.classList.add('segmentKey');
    div.style.backgroundColor = d3.hsl(row.colour);
    td.appendChild(div);
    tr.appendChild(td);
    var td = document.createElement('td');
    td.appendChild(document.createTextNode(row.name || ''));
    tr.appendChild(td);
    var td = document.createElement('td');
    td.appendChild(document.createTextNode((row.fraction*100).toFixed(0)+'%' || ''));
    tr.appendChild(td);
    table.appendChild(tr);
  });
}

function extractText(values, blobs) {
  const worker = new Tesseract.TesseractWorker();
  const progressBar = document.getElementById('progress');
  let textImg = document.createElement("img");
  textImg.src = document.getElementById('legend').toDataURL();
  worker
    .recognize(textImg)
    .progress(progress => {
      progressBar.querySelector("div").innerText = progress.status;
      progressBar.querySelector("progress").value = progress.progress;
    })
    .then(result => {
      progressBar.dispatchEvent(new CustomEvent("input"));
      values.map( (d, i) => {
        d.name = blobs[i].length>0 ? findLegendText(blobs[i][0].location, result.words) : '';
        return d;
      });
      buildHtmlTable(values);
      return result;
    });
}

function findLegendText(location, allText) { // function to match text found in the image to legend locations
  let text = allText.filter( d =>
                 (d.bbox.x0 > location.x) & // only consider text to the right of the legend item
                 (d.bbox.y0 < location.y) & (d.bbox.y1 > location.y) // find text with the legend items centre between the top and bottom
                );
  let lineText = text.length>0 ? text[0].line.text.slice(text[0].line.text.indexOf(text[0].text)) : ''; // return line text after the word
  return lineText;
}
