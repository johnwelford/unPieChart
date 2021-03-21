function loadImage() {  // load source
  if (debug) console.log('Image loaded.');
  src = cv.imread('image');
  if (debug) console.log('image width: ' + src.cols + '\n' +
              'image height: ' + src.rows + '\n' +
              'image size: ' + src.size().width + '*' + src.size().height + '\n' +
              'image depth: ' + src.depth() + '\n' +
              'image channels ' + src.channels() + '\n' +
              'image type: ' + src.type() + '\n');
  return src;
}

function findPie(src) {
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

  return circle;
}

function buildMask(circle, src) {
  // build mask
  const pieCentre = 0.2; // remove 20% of radius in the centre
  var totalMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8U); // setup mask
  circle.forEach( d => {
      cv.circle(totalMask, {x: d.x, y: d.y}, d.radius, [255, 255, 255, 255], -1, 8, 0); // make mask
      cv.circle(totalMask, {x: d.x, y: d.y}, d.radius*pieCentre, [0, 0, 0, 0], -1, 8, 0); // remove centre of mask
  })
  return totalMask;
}

function drawDetect(circle, src) {
  // draw detected circles
  var detect = src.clone(); // setup detection image - for display only
  circle.forEach( d => {
      cv.circle(detect, {x: d.x, y: d.y}, d.radius, [255, 0, 0, 255], 1, 8, 0); // outline
      cv.circle(detect, {x: d.x, y: d.y}, 1, [0, 255, 0, 255], -1, 8, 0); // centre dot
  })
  cv.imshow('output', detect);
}

function segmentPxls(circle, totalMask, src) {
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
  // let seg = segStep;
  // (function getSeg() {
  //   console.log(seg)
    circle.forEach( d => {
        cv.ellipse(segMask, {x: d.x, y: d.y}, {width: d.radius, height: d.radius}, 0, 0, seg, [255, 255, 255, 255], -1, 8, 0); // draw segment mask
    } )
    cv.bitwise_and(totalMask, segMask, segCropCombine); // combine mask with segment mask
    cv.subtract(totalMask, segMask, totalMask); // apply mask to segment mask
    segCrop = cv.Mat.zeros(src.rows, src.cols, cv.CV_8U); // clear segment cropped image
    src.copyTo(segCrop, segCropCombine); // apply segment mask to source
    cv.imshow('segment', segCrop);

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
    // seg = seg + segStep;
    // if (seg <= 360) {
    //   setTimeout(getSeg, 0);
    }
  // })();
  return segPxls;
}

function removePie(circle, src){
  // remove pie from image
  var pieMask = new cv.Mat(src.rows, src.cols, cv.CV_8U,[255,255,255,255]); // setup mask
  const inflatePie = src.cols*0.01; // pixels to increase pie size by to ensure it is fully removed
  circle.forEach( d => {
      cv.circle(pieMask, {x: d.x, y: d.y}, d.radius+inflatePie, [0,0,0,0], -1, 8, 0); // make mask
  })
  cv.imshow('pieless', pieMask);
  return pieMask;
}

function findLegend(values, circle, pieMask, src){
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
  return blobs;
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
