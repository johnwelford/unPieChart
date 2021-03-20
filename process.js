const debug = true;

const ksize = {width : 7, height : 7}; // blurring kernel size
const sigma = [0, 0]; // gaussian kernal standard deviation [x, y]
const param1 = 10; // a number forwarded to the Canny edge detector (applied to a grayscale image) that represents the threshold1 passed to Canny(...). Canny uses that number to guide edge detection
const segStep = 3; // degrees
const thresh = [5, 80, 18]; // bound either side of hls colour to search (0-255 values for each)
const view = document.getElementById('dropZoneView');
const intro = document.getElementById('intro');

function breakable(calculate){ // allow a breakable calculation using requestAnimationFrame
  return new Promise(resolve => {
    requestAnimationFrame( () => {
      requestAnimationFrame(() => {
        calculate();
        resolve();
      });
    });
  });
};

function setSelect(selectId, selection, text) { // add an option to a selection, select it, trigger the change event
  var select = document.getElementById(selectId);
  select.add(new Option(text, selection, false, true));
  select.dispatchEvent(new Event("change"));
};

function dropZone() { // adapted from https://observablehq.com/@j-f1/drop-zone
  const area = document.getElementById('dropZone');
  area.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  area.ondrop = e => { e.preventDefault(); getImage(e.dataTransfer.items, area); };
  area.onpaste = e => getImage(e.clipboardData.items, area);
}

document.getElementById("processingDisplay").addEventListener("change", (event) => { // determine what processing image is shown
  Array.from(document.querySelectorAll('.pieImage.show')).forEach((el) => el.classList.remove('show')); // hide everything
  document.getElementById(event.target.value).classList.add("show"); // show the new thing
});

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
      intro.style.visibility = "hidden";
      let src;
      await breakable(() => { src = loadImage(); });
      setSelect('processingDisplay','image','Original');
      // find pie chart
      let circle;
      await breakable(() => { circle = findPie(src); });
      setSelect('processingDisplay','greyscale','Greyscale');
      setSelect('processingDisplay','blur','Blur');
      // find pie chart
      var totalMask;
      await breakable(() => { totalMask = buildMask(circle, src); });
      setSelect('processingDisplay','edges','Edges');
      await breakable(() => { drawDetect(circle, src); });
      setSelect('processingDisplay','output','Detected circle');
      if (debug) console.log('circle', circle);

      // segment pie
      let segPxls;
      await breakable(() => { segPxls = segmentPxls(circle, totalMask, src); });
      setSelect('processingDisplay','crop','Cropped');
      if (debug) console.log('segPxls', segPxls);
      var values;
      await breakable(() => { values = findSegments(segPxls); });
      setSelect('processingDisplay','segment','Final segment');
      if (debug) console.log('values', values);
      var pieMask;
      await breakable(() => { pieMask = removePie(circle, src); });
      setSelect('processingDisplay','pieless','Remove Pie');

      // find legend
      var blobs;
      await breakable(() => { blobs = findLegend(values, circle, pieMask, src); });
      setSelect('processingDisplay','legend','Segment legend');
      if (debug) console.log('blobs', blobs);
      var values2;
      values2 = extractText(values, blobs);
      values2.then(async (val) => {
        if (debug) console.log('values with legend', val);

        // // temporary save of values
        // localStorage.setItem('vals', JSON.stringify(values));
        // localStorage.setItem('circle', JSON.stringify(circle));

        // // teporary load of values
        // var values = JSON.parse(localStorage.getItem('values'));
        // var circle = JSON.parse(localStorage.getItem('circle'));

        // draw pie
        await breakable(() => { drawPie(val, src, circle); });
        setSelect('processingDisplay','chart','Reproduce');

        // draw table
        await breakable(() => { buildHtmlTable(val); });
      });
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
