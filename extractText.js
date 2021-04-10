// Builds the HTML Table
function buildHtmlTable(arr) {
  var table = document.getElementById('resultTable');
  var roundArrFractionSort = largestRemainderRound(arr.map(a => a.fraction*100)).sort((a, b) => b - a);

  // remove old rows
  while (table.hasChildNodes()) {
    table.removeChild(table.lastChild);
  }

  // add new rows
  arr.sort((a, b) => b.fraction - a.fraction).forEach((row, i) => {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    var div = document.createElement('div');
    div.classList.add('segmentKey');
    div.style.backgroundColor = d3.hsl(makeColour(row.colour));
    td.appendChild(div);
    tr.appendChild(td);
    var td = document.createElement('td');
    td.appendChild(document.createTextNode(row.name || ''));
    tr.appendChild(td);
    var td = document.createElement('td');
    td.appendChild(document.createTextNode(roundArrFractionSort[i]+'%' || ''));
    tr.appendChild(td);
    table.appendChild(tr);
  });
}

async function extractText(values, blobs) {
  const worker = Tesseract.createWorker()
  let textImg = document.createElement('img');
  textImg.src = document.getElementById('legend').toDataURL();
  var result = await (async () => {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(textImg);
    return data;
    // await worker.terminate();
  })();
  console.log(result);
  return await values.map( (d, i) => {
    d.name = blobs[i].length>0 ? findLegendText(blobs[i][0].location, result.words) : '';
    return d;
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

function largestRemainderRound(numbers) { // round whilst still achieving a desired total (https://gist.github.com/scwood/e58380174bd5a94174c9f08ac921994f)
  const desiredTotal = Math.round(numbers.reduce((a, b) => a + b, 0));
  var result = numbers.map((number, index) => {
    return {
      floor: Math.floor(number),
      remainder: number - Math.floor(number),
      index: index,
    };
  }).sort((a, b) => b.remainder - a.remainder);
  var lowerSum = result.reduce((sum, current) => sum + current.floor, 0);
  var delta = desiredTotal - lowerSum;
  for (var i = 0; i < delta; i++) result[i].floor++;
  return result.sort((a, b) => a.index - b.index).map((result) => result.floor);
}
