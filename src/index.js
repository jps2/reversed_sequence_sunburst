
import * as dscc from '@google/dscc'

import { scaleOrdinal } from "d3-scale";
import * as fmt from "d3-format";
import { partition, hierarchy } from "d3-hierarchy";
import { arc } from "d3-shape";
import { transition } from "d3-transition";
import * as arr from "d3-array";
import { rgb } from "d3-color";
import { select, selectAll } from 'd3-selection';
import {
  schemeSet1,
  schemeAccent,
  schemeDark2,
  schemePaired
} from "d3-scale-chromatic";

const d3 = Object.assign(
  {},
  {
    scaleOrdinal,
    select,
    selectAll,
    rgb,
    arc,
    partition,
    hierarchy,
    transition,
    schemeSet1,
    schemeDark2,
    schemeAccent,
    schemePaired
  },
  fmt,
  arr
)

var margin = { top: 10, right: 10, bottom: 10, left: 10 }
var width, height, radius, sidebar_width;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
  w: 200, h: 30, s: 8, t: 5
};

// Dimensions of legend item: width, height, spacing, radius of rounded rect.
var li = {
  w: 65, h: 20, s: 3, r: 3
};

var totalSize = 0; // total of primary goal
var path_size = 0; // total of goal in segment
var tot_cvalue = 0;
var path_value = 0;
var cats = []; // unique categories
var goal_name; // get primary goal name from the fields
var goal_name_secondary; // secondary goal 
var valuekiloFormat = d3.format(".3s")
var valueFormat = d3.format(".0f")
var percFormat = d3.format(".2%")
var base_font, base_font_color, base_font_size;
var bc_font_size, bc_font_color, color_scheme;
var gds_height, gds_width, rect_base
var myColor
var show_legend, hideEndpoint, sequence_levels, sequence_separator

function drawViz(data) {

  var dataByConfigId = data.tables.DEFAULT;
  var fieldsByConfigId = data.fields;
  var styleByConfigId = data.style;
  //console.log(JSON.stringify(dataByConfigId, null, 2))
  //console.log(JSON.stringify(styleByConfigId, null, 2))
  goal_name = fieldsByConfigId.goals[0].name.toLowerCase() // primary goal
  // if two goals add it
  goal_name_secondary = fieldsByConfigId.goals.length == 2 ? fieldsByConfigId.goals[1].name.toLowerCase() : undefined;

  // style settings
  base_font = styleByConfigId.base_font.value !== undefined ? styleByConfigId.base_font.value : styleByConfigId.base_font.defaultValue
  base_font_size = styleByConfigId.base_font_size.value !== undefined ? styleByConfigId.base_font_size.value : styleByConfigId.base_font_size.defaultValue
  base_font_color = styleByConfigId.base_font_color.value.color !== undefined ? styleByConfigId.base_font_color.value.color : "#000000"
  bc_font_size = styleByConfigId.bc_font_size.value !== undefined ? styleByConfigId.bc_font_size.value : styleByConfigId.bc_font_size.defaultValue
  bc_font_color = styleByConfigId.bc_font_color.value.color !== undefined ? styleByConfigId.bc_font_color.value.color : "#000000"
  color_scheme = styleByConfigId.color_scheme.value !== undefined ? styleByConfigId.color_scheme.value : 'schemeSet1'
  //show_legend = styleByConfigId.show_legend.value !== undefined ? styleByConfigId.show_legend.value : styleByConfigId.show_legend.defaultValue
  hideEndpoint = styleByConfigId.hide_endpoint.value !== undefined ? styleByConfigId.hide_endpoint.value : styleByConfigId.hide_endpoint.defaultValue
  // setup the number of sequences to be show

  // read data
  var parsedData = dataByConfigId.map(function (d) {
    return {
      path_sequence: d['sequences'][0],
      goal1: +d.goals[0], // primary
      goal2: +d.goals[1] // secondary goal
    };
  });
  tot_cvalue = 0; // have to reset, if metrics changed
  var seq_hierarchy = buildHierarchy(parsedData); // data to hierarchy
  cats = [...new Set(cats.map(item => item))]; // reduce to unique categories

  // obtain the height and width to scale your visualization appropriately
  gds_height = dscc.getHeight() // whole viz height and width
  gds_width = dscc.getWidth()

  // for the sunburst rect
  sidebar_width = Math.floor(Math.max(200, 0.3*gds_width));

  height = gds_height - margin.top - margin.bottom; // subtract breadcrumb height
  width = gds_width - margin.right - margin.left - sidebar_width; // subtract left sidebar width
  radius = Math.min(width, height) / 2;
  rect_base = Math.min(width, height);
  


  d3.select('body')
    .selectAll('svg')
    .remove();

  d3.select('body')
    .selectAll('#explanation')
    .remove();

  d3.select('body')
    .selectAll('div')
    .remove();

  var main_dat = [
    { "id": "m", "height": (height + margin.top + margin.bottom), "width": gds_width }
  ]  
  var div_data = [
    { "id": "left_sidebar", "height": (height + margin.top + margin.bottom), "width": (sidebar_width-1) },
    { "id": "chart", "height": (height + margin.top + margin.bottom), "width": (rect_base+margin.left+margin.right) }
  ]

  var main_grid = d3.select('body') 
    .selectAll('div') 
    .data(div_data).enter()
    .append('div')
    .attr('id', function (d) { return d.id })
    .attr('style', function (d) { return 'height: ' + d.height + 'px; width: ' + d.width + 'px;' })



  createVisualization(seq_hierarchy);
}

function getScheme(scheme) {
  var selected_scheme
  switch (scheme) {
    case "schemeSet1":
      selected_scheme = d3.schemeSet1;
      break;
    case "schemePaired":
      selected_scheme = d3.schemePaired;
      break;
    case "schemeAccent":
      selected_scheme = d3.schemeAccent;
      break;
    case "schemeDark2":
      selected_scheme = d3.schemeDark2;
      break;
    default:
      selected_scheme = d3.schemeSet1;
  }
  return selected_scheme
}

function createVisualization(json) {

  myColor = d3.scaleOrdinal()
    .domain(cats)
    .range(getScheme(color_scheme));

  var vis = d3.select("#chart")
    .append("svg:svg")
    .attr("width", (rect_base + margin.left))
    .attr("height", (rect_base + margin.top))
    .append("svg:g")
    .attr("id", "container")
    .attr("transform", "translate(" + (rect_base + margin.left) / 2 + "," + (rect_base + margin.top) / 2 + ")");

  var partition = d3.partition()
    .size([2 * Math.PI, radius]);

  var arc = d3.arc()
    .startAngle(function (d) { return d.x0; })
    .endAngle(function (d) { return d.x1; })
    .innerRadius(function (d) { return radius - d.y1; })
    .outerRadius(function (d) { return radius - d.y0; });

  initializeBreadcrumbTrail();

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  vis.append("svg:circle")
    .attr("r", radius)
    .style("opacity", 0);

  // Turn the data into a d3 hierarchy and calculate the sums.
  var root = d3.hierarchy(json)
    .sum(function (d) { return d.size; })
    .sort(function (a, b) { return b.value - a.value; });

  // For efficiency, filter nodes to keep only those large enough to see.
  var nodes = partition(root).descendants()
    .filter(function (d) {
      return (d.x1 - d.x0 > 0.005); // 0.005 radians = 0.29 degrees
    });

  var path = vis.data([json]).selectAll("path")
    .data(nodes)
    .enter().append("svg:path")
    .attr("display", function (d) { return d.depth ? null : "none"; })
    .attr("d", arc)
    .attr("fill-rule", "evenodd")
    .style("fill", function (d) { return myColor(d.data.name); })
    .style("opacity", function (d) { return endarcOpacity(d.data.name, 1, 0) })
    .on("mouseenter", (i, d) => mouseover(i, d));

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", () => mouseleave() );

  // Get total size of the tree = value of root node from partition.
  totalSize = path.datum().value;
  if (show_legend) {
    drawLegend();
  }
  drawText({
    select: ".pct",
    o_class: "pct",
    fontsize: base_font_size * 4 + 'px',
    text: valuekiloFormat(totalSize),
    y_corr: 2
  });
  drawText({
    select: ".exp",
    o_class: "exp",
    fontsize: base_font_size * 1 + 'px',
    text: goal_name + ' in all paths',
    y_corr: 1.8
  });
  if (goal_name_secondary !== undefined) {
    drawText({
      select: ".exp",
      o_class: "exp",
      fontsize: base_font_size * 1 + 'px',
      text: valuekiloFormat(tot_cvalue) + ' €',
      y_corr: 1.7
    });
  }

  function mouseover(obj, d) {
    function arraySum(obj) {
      var all_sum = 0;
      if (Array.isArray(obj.children)) {
        for (let i = 0; i < obj.children.length; i++) {
          all_sum += arraySum(obj.children[i])
        }
      } else if (typeof obj.cvalue === 'number') {
        all_sum += obj.cvalue;
      }
      return all_sum;
    }

    var percentage = d.value / totalSize;
    var percentageString = percFormat(percentage);
    if (percentage < 0.001) {
      percentageString = "< 0.1%";
    }

    path_value = valuekiloFormat(arraySum(d.data));
    path_size = d.value > 1000 ? valuekiloFormat(d.value) : valueFormat(d.value)

    d3.selectAll('.pct')
      .remove()

    d3.selectAll('.exp')
      .remove()

    drawText({
      select: ".pct",
      o_class: "pct",
      fontsize: base_font_size * 4 + 'px',
      text: path_size,
      y_corr: 2
    });

    var valp_string = goal_name_secondary !== undefined ? ', ' + path_value + ' €' : ''
    drawText({
      select: ".exp",
      o_class: "exp",
      fontsize: base_font_size * 1 + 'px',
      text: percentageString + ' of ' + goal_name + valp_string,
      y_corr: 1.8
    });
    drawText({
      select: ".exp",
      o_class: "exp",
      fontsize: base_font_size * 1 + 'px',
      text: 'in this path sequence',
      y_corr: 1.7
    })

    var sequenceArray = d.ancestors().reverse();
    sequenceArray.shift(); // remove root node from the array
    updateBreadcrumbs(sequenceArray, path_size + " " + goal_name);

    // Fade all the segments.
    d3.selectAll("path")
      .style("opacity", function (d) { return endarcOpacity(d.data.name, 0.3, 0) });

    // Then highlight only those that are an ancestor of the current segment.
    vis.selectAll("path")
      .filter(function (node) {
        return (sequenceArray.indexOf(node) >= 0);
      })
      .style("opacity", function (d) { return endarcOpacity(d.data.name, 1, 0.05) });
  }

  // Restore everything to full opacity when moving off the visualization.
  function mouseleave(d) {
    // Hide the breadcrumb trail
    d3.select("#trail")
      .style("visibility", "hidden");

    // Deactivate all segments during transition.
    d3.selectAll("path").on("mouseenter", null);
    d3.selectAll('.pct')
      .remove()
    d3.selectAll('.exp')
      .remove()

    drawText({
      select: ".pct",
      o_class: "pct",
      fontsize: base_font_size * 4 + 'px',
      text: valuekiloFormat(totalSize),
      y_corr: 2
    });
    drawText({
      select: ".exp",
      o_class: "exp",
      fontsize: base_font_size * 1 + 'px',
      text: goal_name + ' in all paths',
      y_corr: 1.8
    });

    var val_string = goal_name_secondary !== undefined ? valuekiloFormat(tot_cvalue) + ' €' : ''

    drawText({
      select: ".exp",
      o_class: "exp",
      fontsize: base_font_size * 1 + 'px',
      text: val_string,
      y_corr: 1.7
    });

    // Transition each segment to full opacity and then reactivate it.
    d3.selectAll("path")
      .transition()
      .duration(1000)
      .style("opacity", function (d) { return endarcOpacity(d.data.name, 1, 0) })
      .on("end", function () {
        d3.select(this).on("mouseenter", (i, d) => mouseover(i, d));
      });

  }

  function initializeBreadcrumbTrail() {
    // Add the svg area.
    var trail = d3.select("#left_sidebar").append("svg:svg")
        .attr("width", sidebar_width-margin.left)
        .attr("height", height)
        .attr("id", "trail");
    // Add the label at the end, for the percentage.
    trail.append("svg:text")
      .attr("id", "endlabel")
      .style("fill", "#000");
      
  }

function breadcrumbPoints(d, i) {
  var points = [];
  points.push("0,0");
  points.push(15 + ",0");
  points.push(15 + "," + (b.h-2));
  points.push(b.w + "," + (b.h-2));
  points.push(b.w + "," + b.h);
  points.push("0," + b.h);
  if (i < 0) { // Leftmost breadcrumb; don't include 6th vertex.
    points.push(b.t + "," + (b.h / 2));
  }
   // debugger;
  return points.join(" ");
}

  // Update the breadcrumb trail to show the current sequence and percentage.
  function updateBreadcrumbs(nodeArray, percentageString) {
    // Data join; key function combines name and depth (= position in sequence).
    var trail = d3.select("#trail")
      .selectAll("g")
      //data.filter(function(d){return d.category == category;
      .data(nodeArray, function (d) { return d.data.name + d.depth; });

    // Remove existing nodes.
    trail.exit().remove();

    // Add breadcrumb and label for entering nodes.
    var entering = trail.enter().append("svg:g");

    entering.append("svg:polygon")
      .attr("points", breadcrumbPoints)
      .style("fill", function (d) { return myColor(d.data.name); })
      //.style("opacity", function (d) { return endarcOpacity(d.data.name, 1, 0.2)})

    entering.append("svg:text")
      //.attr("x", (b.w + b.t) / 2)
      .attr("x", 25)
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr('font-family', base_font)
      .attr("font-size", bc_font_size)
      .style('fill', bc_font_color)
      .text(function (d) { return d.data.name; });

    // Merge enter and update selections; set position for all nodes.
    entering.merge(trail).attr("transform", function (d, i) {
      return "translate(0, " + i * (b.h + b.s) + ")";
    });


    // Now move and update the percentage at the end.
    // if hide and in the end node length-1, end label opa 0
    // change string to ..end with this sequence tjsp
    //console.log(nodeArray[nodeArray.length-1])
    d3.select("#trail").select("#endlabel")
      .attr("y", function() {
        return (nodeArray.length + 0.5) * (b.h + b.s);
      })
      .attr("x", 10)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr('font-family', base_font)
      .attr("font-size", bc_font_size)
      .style('fill', base_font_color)
      .text(percentageString);

    // Make the breadcrumb trail visible, if it's hidden.
    d3.select("#trail")
      .style("visibility", "");

  };



};
    

function endarcOpacity(param, def_opa, end_opa) {
  var opac = def_opa
  if (hideEndpoint) {
    return param == 'end' ? end_opa : def_opa
  } else {
    return opac
  }
}

function drawText(params) {
  // function(d){return d3.rgb(d.color).darker(1);})
  d3.select("#chart > svg")
    .append('text')
    .attr('class', params.o_class)
    .attr("text-anchor", "middle")
    .attr('font-family', base_font)
    .attr('fill', base_font_color)
    .attr("font-size", params.fontsize)
    .text(params.text)
    .attr('x', (rect_base + margin.left) / 2)
    .attr('y', (rect_base + margin.top) / params.y_corr)  
}

/*
// Fade all but the current sequence, and show it in the breadcrumb trail.
function drawLegend() {
  // move end node to the last item in legend list
  var ro_cats = []
  for (var i = 0; i < cats.length - 1; i++) {
    if (cats[i] !== 'end') {
      ro_cats.push(cats[i]);
    }
  }
  ro_cats.push('end')
  var legend = d3.select("#legend")
    .append("svg:svg")
    .attr("width", li.w)
    .attr("height", (ro_cats.length * (li.h + li.s) + margin.top));

  var g = legend.selectAll("g")
    .data(ro_cats)
    .enter().append("svg:g")
    .attr("transform", function (d, i) {
      return "translate(" + (0) + ',' + (i * (li.h + li.s) + margin.top) + ")";
    });

  g.append("svg:rect")
    .attr("rx", li.r)
    .attr("ry", li.r)
    .attr("width", li.w)
    .attr("height", li.h)
    .style("fill", function (d) { return myColor(d); })
    .style("opacity", function (d) { return endarcOpacity(d, 1, 0.2)})

  g.append("svg:text")
    .attr("x", li.w / 2)
    .attr("y", li.h / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .attr('font-family', base_font)
    .attr("font-size", bc_font_size)
    .style('fill', bc_font_color)
    .text(function (d) { return d; });
}
*/

function buildHierarchy(parsedData) {
  var root = { "name": "root", "children": [] };
  for (var i = 0; i < parsedData.length; i++) {
    var sequence = parsedData[i]['path_sequence'];
    var regex = / [Ss]earch/gi; // shorten 'Paid Search' & 'Organic Search' labels
    sequence = sequence.replace(regex, '')
    var size = +parsedData[i]['goal1'];
    // add if secondary goal defined
    if (goal_name_secondary !== undefined) {
      var value_secondary = +parsedData[i]['goal2']
      tot_cvalue += value_secondary
    }
    var parts = sequence.split(" > ");
    parts.push("end")
    // push uniques to cats
    let un_cats = [...new Set(parts.map(item => item))];
    cats = cats.concat(un_cats)
    var currentNode = root;

    if (parts.length <= 7) {
      for (var j = 0; j < parts.length; j++) {
        var children = currentNode["children"];
        var nodeName = parts[j];
        var childNode;
        if (j + 1 < parts.length) {
          // Not yet at the end of the sequence; move down the tree.
          var foundChild = false;
          for (var k = 0; k < children.length; k++) {
            if (children[k]["name"] == nodeName) {
              childNode = children[k];
              foundChild = true;
              break;
            }
          }
          // If we don't already have a child node for this branch, create it. MOVE this above!!!
          if (!foundChild) {
            childNode = { "name": nodeName, "children": [] };
            //console.log(childNode)
            children.push(childNode);
          }
          currentNode = childNode;
        } else {
          // Reached the end of the sequence; create a leaf node.
          if (goal_name_secondary !== undefined) {
            childNode = { "name": nodeName, "size": size, "cvalue": value_secondary };
          } else {
            childNode = { "name": nodeName, "size": size };
          }
          children.push(childNode);
        }
      }
    }
  }
  //}
  return root;
};

// call drawViz every time Data Studio sends a new postMessage
dscc.subscribeToData(drawViz, { transform: dscc.objectTransform });