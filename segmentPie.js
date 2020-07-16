function findSegments(segPxls) {
  updateProgress({status: 'Clustering segment colours...', progress: 0}, 'segmentPie');
  var segValue = [];
  segPxls.forEach( (segment, i) => {
    let means = kmeans(segment, 5, null, 8, 10);
    segValue.push(means.centroids.reduce((prev, current) => (prev.points.length > current.points.length) ? prev : current)); // keep centroid with the most pixels
    updateProgress({status: 'Clustering segment colours...', progress: i/(360/segStep)}, 'segmentPie');
  })
  if (debug) console.log('segValue', segValue);

  // find values by looking for discontinuities
  const colDifThresh = 7;
  let values = [];
  let thisVal = {startAng: 0, endAng: segStep, colour: d3.rgb(segValue[0][0],segValue[0][1],segValue[0][2]), segColours: [d3.rgb(segValue[0][0],segValue[0][1],segValue[0][2])]};
  updateProgress({status: 'Group segment colours...', progress: 0}, 'segmentPie');
  for (let i = 1; i < segValue.length; i++) {
    if (LABdistance(segValue[i-1],segValue[i]) > colDifThresh) { // segment is a new value
      values.push(thisVal); // record last value
      thisVal = {startAng: segStep*i, endAng: segStep*(i+1), colour: d3.rgb(segValue[i][0],segValue[i][1],segValue[i][2]), segColours: [d3.rgb(segValue[i][0],segValue[i][1],segValue[i][2])]}; // start new value
    } else { // segment continues old value
      thisVal.endAng = thisVal.endAng + segStep; // increment value end point
      thisVal.segColours.push(d3.rgb(segValue[i][0],segValue[i][1],segValue[i][2])); // add in the colour of this segment
    }
    updateProgress({status: 'Group segment colours...', progress: i/segValue.length}, 'segmentPie');
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
  updateProgress({status: values.length+' segments found', progress: 1}, 'segmentPie');

  return values;
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
