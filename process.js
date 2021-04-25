const debug = true;
const ksize = {width : 7, height : 7}; // blurring kernel size
const sigma = [0, 0]; // gaussian kernal standard deviation [x, y]
const param1 = 10; // a number forwarded to the Canny edge detector (applied to a grayscale image) that represents the threshold1 passed to Canny(...). Canny uses that number to guide edge detection
const segStep = 3; // degrees
const thresh = [5, 80, 18]; // bound either side of hls colour to search (0-255 values for each)
const view = document.getElementById('dropZoneView');
const intro = document.getElementById('intro');
const notify = document.getElementById('notification');
const image = document.getElementById('image');

var notifyTimeout;
function updateProgress(progress, remove=false) {
  clearTimeout(notifyTimeout);
  notify.style.visibility = 'visible';
  notify.getElementsByClassName('notifyText')[0].innerText = progress;
  if (remove) notifyTimeout = setTimeout(() => { notify.style.visibility = 'hidden'; }, 350);
}
updateProgress('Loading libraries...');

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
  select.dispatchEvent(new Event('change'));
};

function dropZone() { // adapted from https://observablehq.com/@j-f1/drop-zone
  const area = document.getElementById('dropZone');
  area.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  area.ondrop = e => { e.preventDefault(); getDropPasteImage(e.dataTransfer.items, area); };
  area.onpaste = e => getDropPasteImage(e.clipboardData.items, area);
  area.onfocus= () => updateProgress('Paste a pie chart image');
  area.onblur= () => updateProgress('Paste a pie chart image',true);
}

function getDropPasteImage(items, area) {
  const value = (() => {
    for (const item of items) {
      if (item.kind === 'file' && item.type.match(/^image\/(png|jpeg|gif)$/)) {
        return item.getAsFile();
      }
    }
  })();
  if (value) {
    view.value = value;
    var fr = new FileReader();
    fr.onload = async function process() {
      // clear selectId
      document.getElementById('processingDisplay').length = 0;

      // load image
      updateProgress('Loading image...');
      image.src = fr.result; // add to hidden actual size image
      document.getElementById('orig').src = fr.result; // add to visible resized image
      await new Promise((resolve) => { image.onload = resolve; });
      processing();
    }
    fr.readAsDataURL(value);
    setTimeout(() => view.dispatchEvent(new CustomEvent('input')), 100);
    area.blur();
  } else {
    updateProgress('That’s not an image');
    notifyTimeout = setTimeout(() => { updateProgress('That’s not an image',true); }, 650);
  }
}

// document.getElementById('imgURL').addEventListener('input', (event) => {
//   if (event.target.matches(':valid')) {
//     console.log(event.target.value);
//     // clear selectId
//     document.getElementById('processingDisplay').length = 0;
//
//     // load image
//     updateProgress('Loading image...');
//     const proxyUrl = 'https://jw-cors.herokuapp.com/';
//     image.src = getBase64(proxyUrl + event.target.value); // add to hidden actual size image
//     document.getElementById('orig').src = getBase64(proxyUrl + event.target.value); // add to visible resized image
//     // await new Promise((resolve) => { image.onload = resolve; });
//     // processing();
//   }
// });

async function processing() { // main processing loop
  intro.style.visibility = 'hidden';
  let src;
  await breakable(() => { src = loadImage(); });
  updateProgress('Image loaded',true);
  setSelect('processingDisplay','orig','Original');

  if (src.rows*src.cols>500000 && (confirm('This is a pretty big image so it might take a few minutes and a bit of processing power. Do you want to continue?')==false)) {
    return;
  }

  // find pie chart
  let circle;
  updateProgress('Finding pie...');
  await breakable(() => { circle = findPie(src); });
  setSelect('processingDisplay','greyscale','Greyscale');
  setSelect('processingDisplay','blur','Blur');
  var totalMask;
  await breakable(() => { totalMask = buildMask(circle, src); });
  setSelect('processingDisplay','edges','Edges');
  await breakable(() => { drawDetect(circle, src); });
  updateProgress('Pie found', true);
  setSelect('processingDisplay','output','Detected circle');
  if (debug) console.log('circle', circle);

  // segment pie
  let segPxls;
  updateProgress('Slicing pie...');
  await breakable(() => { segPxls = segmentPxls(circle, totalMask, src); });
  setSelect('processingDisplay','crop','Cropped');
  if (debug) console.log('segPxls', segPxls);
  var values;
  await breakable(() => { values = findSegments(segPxls); });
  setSelect('processingDisplay','segment','Final segment');
  if (debug) console.log('values', values);
  var pieMask;
  await breakable(() => { pieMask = removePie(circle, src); });
  updateProgress('Pie sliced',true);
  setSelect('processingDisplay','pieless','Remove Pie');

  // find legend
  var blobs;
  updateProgress('Finding legend...');
  await breakable(() => { blobs = findLegend(values, circle, pieMask, src); });
  setSelect('processingDisplay','legend','Segment legend');
  if (debug) console.log('blobs', blobs);
  var values = await extractText(values, blobs);
  if (debug) console.log('values with legend', values);
  updateProgress('Legend found',true);

  // temporary save of values
  localStorage.setItem('values', JSON.stringify(values));
  localStorage.setItem('circle', JSON.stringify(circle));

  // // teporary load of values
  // var values = JSON.parse(localStorage.getItem('values'));
  // var circle = JSON.parse(localStorage.getItem('circle'));

  // draw pie
  await breakable(() => { drawPie(values, src, circle); });
  setSelect('processingDisplay','chart','Reproduce');

  // draw table
  await breakable(() => { buildHtmlTable(values); });
}

document.getElementById('processingDisplay').addEventListener('change', (event) => { // determine what processing image is shown
  Array.from(document.querySelectorAll('.pieImage.show')).forEach((el) => el.classList.remove('show')); // hide everything
  document.getElementById(event.target.value).classList.add('show'); // show the new thing
});

function onOpenCvReady() {
  updateProgress('Libraries loaded', true);
  if (debug) console.log('OpenCV loaded.');
  dropZone(); // only allow droping/pasting after load
}

const getBase64 = async(url)=>{
      try {
        let image = await axios.get(url, { responseType: 'arraybuffer' });
        let raw = Buffer.from(image.data).toString('base64');
        return "data:" + image.headers["content-type"] + ";base64,"+raw;
      } catch (error) {
          console.log(error)
      }
}

function convertImgToBase64URL(url, callback, outputFormat){
    var img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function(){
        var canvas = document.createElement('CANVAS'),
        ctx = canvas.getContext('2d'), dataURL;
        canvas.height = img.height;
        canvas.width = img.width;
        ctx.drawImage(img, 0, 0);
        dataURL = canvas.toDataURL(outputFormat);
        callback(dataURL);
        canvas = null;
    };
    img.src = url;
}
