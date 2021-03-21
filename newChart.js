var chart = document.getElementById('chart');
var width = 300, height = 200;

function drawPie(pie, original, circle) {
  var startAng = (360 + pie[0].startAng) * Math.PI/180; // Addition of 360 here is causing problems
  var endAng = -2*Math.PI + startAng + 0.0001;
  var radius = circle[0].radius, barHeight = original.rows*0.2;
  var circum = 2*radius*Math.PI;

  arcTween = (sAng, fAng, inRad, rad) => {
    return (d) => {
      let interpAng = d3.interpolate(sAng, fAng);
      let interpRad = d3.interpolate(inRad, rad);
      return (t) => {
        let sA = d.startAngle + interpAng(t); // start angle
        let eA = d.endAngle + interpAng(t); // end angle
        let tA = 3*Math.PI/2; // transition angle
        if (sA>=tA) // arc only
          return 'M' + radius*Math.cos(sA) + ',' + radius*Math.sin(sA) + // move to outer arc start angle
            'A' + radius + ',' + radius + ',0,' + (eA-sA>Math.PI ? 1 : 0) + ',1,' + radius*Math.cos(eA) + ',' + radius*Math.sin(eA) + // outer arc rx ry x-axis-rotation large-arc-flag sweep-flag x y
            'L' + interpRad(t)*Math.cos(eA) + ',' + interpRad(t)*Math.sin(eA) + // line to inner arc
            'A' + interpRad(t) + ',' + interpRad(t) + ',0,' + (eA-sA>Math.PI ? 1 : 0) + ',0,' + interpRad(t)*Math.cos(sA) + ',' + interpRad(t)*Math.sin(sA) + // inner arc rx ry x-axis-rotation large-arc-flag sweep-flag x y
            'Z'; // close area with line to start of angle
        else if (eA>=tA) // arc plus bar
          return 'M' + 0 + ',' + -interpRad(t) + // move to inner arc angle
            'L' + circum*(sA-tA)/(2*Math.PI) + ',' + -interpRad(t) + // move to bar end bottom
            'L' + circum*(sA-tA)/(2*Math.PI) + ',' + -radius + // move to bar end top
            'L' + 0 + ',' + -radius + // line to outer arc start angle
            'A' + radius + ',' + radius + ',0,' + (eA-tA>Math.PI ? 1 : 0) + ',1,' + radius*Math.cos(eA) + ',' + radius*Math.sin(eA) + // outer arc rx ry x-axis-rotation large-arc-flag sweep-flag x y
            'L' + interpRad(t)*Math.cos(eA) + ',' + interpRad(t)*Math.sin(eA) + // line to inner arc
            'A' + interpRad(t) + ',' + interpRad(t) + ',0,' + (eA-tA>Math.PI ? 1 : 0) + ',0,' + interpRad(t)*Math.cos(tA) + ',' + interpRad(t)*Math.sin(tA) + // inner arc rx ry x-axis-rotation large-arc-flag sweep-flag x y
            'Z'; // close area with line to start of angle
        else // bar only
          return 'M' + circum*(eA-tA)/(2*Math.PI) + ',' + -interpRad(t) + // bar start
            'L' + circum*(sA-tA)/(2*Math.PI) + ',' + -interpRad(t) + // move to bar end bottom
            'L' + circum*(sA-tA)/(2*Math.PI) + ',' + -radius + // move to bar end top
            'L' + circum*(eA-tA)/(2*Math.PI) + ',' + -radius + // line to outer arc start angle
            'Z'; // close area with line to start of angle
      }
    }
  }

  chart.innerHTML = ''; // remove any previous svg 
  svg = d3.select(chart)
    .append("svg")
      .attr("viewBox", '0 0 '+original.cols+' '+original.rows)
      .attr("preserveAspectRatio", 'xMinYMin');

  const g = svg.append('g')
  	.attr('transform', 'translate('+circle[0].x+','+circle[0].y+')');

  let arc = g.selectAll('.arc')
  	.data(d3.pie().value(d => d.fraction).sort(null)(pie))
    .enter()
    .append('path')
  	.attr('d', d => arcTween(startAng, 0, 0, 0)(d)(0))
  	.attr('fill', d => makeColour(d.data.colour));

  d3.select("#start").on("click", function() {
  	arc.transition().duration(1500)
      .attrTween("d", arcTween(startAng, endAng, 0, radius-barHeight));
    g.transition().duration(1500)
      .attr('transform', `translate(${circum}, ${radius})`);
  });

  d3.select("#reset").on("click", function() {
  	arc.transition().duration(1500)
  	  .attrTween('d', arcTween(endAng, startAng, radius-barHeight, 0));
    g.transition().duration(1500)
      .attr('transform', `translate(${circle[0].x}, ${circle[0].y})`);
  });
};

function makeColour(col) {
  return d3.rgb(col.r, col.g, col.b, col.opacity);
}
