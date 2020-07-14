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
        var circle = findPie();
        if (debug) console.log('circle', circle);
        var segPxls = segmentPxls(circle);
        if (debug) console.log('segPxls', segPxls);
        var values = findSegments(segPxls);
        if (debug) console.log('values', values);
        removePie(circle);
        blobs = findLegend(values, circle);
        if (debug) console.log('blobs', blobs);
        values = await extractText(values, blobs);
        if (debug) console.log('values with legend', values);
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
