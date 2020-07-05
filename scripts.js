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
      fr.onload = function () {
        document.getElementById('image').src = fr.result;
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
  if (debug) console.log('Image loaded.')

  // load source
  var src = cv.imread('image');
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
  if (debug) console.log(circle);

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
  if (debug) console.log(segPxls);
  cv.imshow('segment', segCrop);
}
