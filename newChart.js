var chart = document.getElementById('chart');
var width = 300, height = 200;
var pie = [
  {
    "colour":"rgba(245,223,181,1)",
    "fraction":0.6666666666666666
  },{
    "colour":"rgba(205,148,205,1)",
    "fraction":0.175
  },{
    "colour":"rgba(255,99,69,1)",
    "fraction":0.058333333333333334
  },{
    "colour":"rgba(177,44,96,1)",
    "fraction":0.05
  },{
    "colour":"rgba(119,26,63,1)",
    "fraction":0.008333333333333333
  },{
    "colour":"rgba(144,189,144,1)",
    "fraction":0.041666666666666664
  }
];
var startAng = 270* Math.PI/180;
var endAng = -2*Math.PI + startAng + 0.0001;
var radius = 125, barHeight = 65;
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

svg = d3.select(chart)
  .append("svg")
  .attr("width", circum+20)
  .attr("height", radius*2);

const g = svg.append('g')
	.attr('transform', 'translate('+radius+','+radius+')');

let arc = g.selectAll('.arc')
	.data(d3.pie().value(d => d.fraction).sort(null)(pie))
  .enter()
  .append('path')
	.attr('d', d => arcTween(startAng, 0, 0, 0)(d)(0))
	.attr('fill', d => d.data.colour);

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
    .attr('transform', `translate(${radius}, ${radius})`);
});
