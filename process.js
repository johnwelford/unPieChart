const debug = true;

const ksize = {width : 7, height : 7}; // blurring kernel size
const sigma = [0, 0]; // gaussian kernal standard deviation [x, y]
const param1 = 10; // a number forwarded to the Canny edge detector (applied to a grayscale image) that represents the threshold1 passed to Canny(...). Canny uses that number to guide edge detection
const segStep = 3; // degrees
const thresh = [5, 80, 18]; // bound either side of hls colour to search (0-255 values for each)
const view = document.getElementById('dropZoneView');

function dropZone() { // adapted from https://observablehq.com/@j-f1/drop-zone
  const area = document.getElementById('dropZone');
  area.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  area.ondrop = e => { e.preventDefault(); getImage(e.dataTransfer.items, area); };
  area.onpaste = e => getImage(e.clipboardData.items, area);
}

function getImage(items, area) {
  var image = document.getElementById('image');
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
    fr.onload = async function process() {
      // load image
      image.src = fr.result;
      await new Promise((resolve) => { image.onload = resolve; });
      let src = loadImage();

      // // find pie chart
      // let circle = findPie(src);
      // var totalMask = buildMask(circle, src);
      // drawDetect(circle, src);
      // if (debug) console.log('circle', circle);
      //
      // // segment pie
      // var segPxls = await segmentPxls(circle, totalMask, src);
      // if (debug) console.log('segPxls', segPxls);
      // var values = findSegments(segPxls);
      // if (debug) console.log('values', values);
      // var pieMask = removePie(circle, src);
      //
      // // find legend
      // var blobs = findLegend(values, circle, pieMask, src);
      // if (debug) console.log('blobs', blobs);
      // values = await extractText(values, blobs);
      // if (debug) console.log('values with legend', values);
      //
      // // temporary save of values
      // localStorage.setItem('values', JSON.stringify(values));
      // localStorage.setItem('circle', JSON.stringify(circle));

      // teporary load of values
      var values = JSON.parse(localStorage.getItem('values'));
      var circle = JSON.parse(localStorage.getItem('circle'));

      // draw pie
      drawPie(values, src, circle);

      // draw table
      buildHtmlTable(values);
    }
    fr.readAsDataURL(value);
    setTimeout(() => view.dispatchEvent(new CustomEvent('input')), 100);
    area.blur();
  } else {
    area.classList.add('invalid');
    setTimeout(() => area.classList.remove('invalid'), 2000);
  }
}


function onOpenCvReady() {
  updateProgress({status: 'Libraries loaded', progress: 1}, 'loadLibraries')
  if (debug) console.log('OpenCV loaded.');
  dropZone(); // only allow droping/pasting after load
}

function updateProgress(progress, progressSection) {
  return Promise.resolve()
  .then(function() {
    setTimeout(function() {
      const progressBar = document.getElementById(progressSection);
      progressBar.querySelector("td").innerText = progress.status;
      progressBar.querySelector("progress").value = progress.progress;
    }, 0);
  });
}
