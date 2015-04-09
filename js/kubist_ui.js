(function() {

  var resetTimeout = -1;

  var svg = {
    width: 500,
    height: 500,
    element: d3.select("#svg").append("svg"),
    polygons: null,
    circles: null,
    vertices: [],
    dots: document.querySelector("#dots")
  }

  var config = {
    points: 300,
    radius: 3,
    stroke: 1,
    rearrange: false
  }

  var img = {
    preview: document.querySelector("#preview"),
    canvas: document.createElement("canvas")
  }

  var sample = null;
  var dotCount = 0;

  reset();

  function reset() {
    svg.element.html = "";
    svg.element.attr("width", svg.width).attr("height", svg.height );
    svg.polygons = svg.element.append("g").attr("id", "polygons").selectAll("polygon");
    svg.circles = svg.element.append("g").attr("id", "circles");
    svg.dots.innerHTML = "";

    sample = bestCandidateSampler(svg.width, svg.height, 10, config.points);

    generate();
  }



  window.onresize = function(evt) {
    clearTimeout( resetTimeout );
    svg.width = window.innerWidth;
    svg.height = window.innerHeight;

    resetTimeout = setTimeout( function() {
      reset();
    }, 500);
  };



  // UI and listeners
  var pointsInput = document.querySelector("#pointsInput");
  pointsInput.addEventListener("input", function(evt) {
    config.points = Math.max( 0, parseInt( evt.target.value ) || 0 );
    console.log( config )
  });

  var rearrangeInput = document.querySelector("#rearrangeInput");
  rearrangeInput.addEventListener("change", function(evt) {
    config.rearrange = evt.target.checked;
    console.log( config )
  });

  var circleRadiusInput = document.querySelector("#circleRadiusInput");
  circleRadiusInput.addEventListener("input", function(evt) {
    config.radius = Math.max( 0, parseInt( evt.target.value ) || 0 );
    console.log( config )
  });

  var lineStrokeInput = document.querySelector("#lineStrokeInput");
    lineStrokeInput.addEventListener("input", function(evt) {
    config.stroke =  Math.max( 0, parseInt( evt.target.value ) || 0 );
    console.log( config )
  });

  var fileInput = document.querySelector("#fileInput");
  fileInput.addEventListener("change", readImage, false );


  function readImage() {
    if ( this.files && this.files[0] ) {
      var FR= new FileReader();
      FR.onload = function(e) {
        img.preview.onload = function() {
          img.canvas.width = img.preview.width * 2;
          img.canvas.height = img.preview.height * 2;
          img.canvas.getContext('2d').drawImage(img.preview, 0, 0, img.preview.width, img.preview.height );
          reset();
        };
        img.preview.setAttribute("src", e.target.result );
      };
      FR.readAsDataURL( this.files[0] );
    }
  }



  function redraw() {
    svg.vertices = svg.circles.selectAll("circle")[0].map( function(d) {
      return [d.cx.baseVal.value, d.cy.baseVal.value];
    });

    var path = svg.polygons;
    var str = "";

    path = path.data(d3.geom.delaunay(svg.vertices).map(function(d) { return d.join(","); }));
    path.exit().remove();
    path.enter().append("polygon")
        .attr("points", function(d) { return d; } )
        .attr("style", function (d, i) {
//          if (this && imageUrl) {
//            var box = this.getBBox();
//
//            var sx = Math.floor( canvas.width * (box.x + box.width/2) / width )
//            var sy = Math.floor( canvas.height * (box.y + box.height/2) / height )
//            var px = canvas.getContext('2d').getImageData(sx, sy, 1, 1).data
//            var fill = "rgb("+px[0]+","+px[1]+","+px[2]+")"
//          } else {
            var f = "CDE"[Math.floor( i%3 )];
            var fill = "#"+f+f+f
//          }

          var stroke = (config.stroke > 0) ? "stroke:#fff;" : '';

          return "fill:"+fill+";"+stroke;

        }
    )
  }


  function generate() {
    d3.timer( function() {

      for (var i = 0; i < 10; ++i) {
        var s = sample();
        if (!s) return true;

//        var dot = new Dot();
//        dot.style.left= s[0]+"px";
//        dot.style.top= s[1]+"px";
//        dot.setAttribute("id", "dot"+dotCount);
//        container.appendChild( dot );

//        var cfill = (circle_fill) ? "fill:#"+circle_fill : '';
//        var cstroke = (circle_stroke) ? "stroke:#"+circle_stroke : '';

        svg.circles.append("circle")
            .attr("cx", s[0])
            .attr("cy", s[1])
            .attr("r", config.radius )
            .attr("style", "fill:#fff")
            .attr("id", "dot"+dotCount+"c");


        dotCount++;
      }
      redraw();

    });
  }



  // Best candidate sampling
  function bestCandidateSampler(width, height, numCandidates, numSamplesMax) {
    var numSamples = 0;

    var quadtree = d3.geom.quadtree()
        .extent([[0, 0], [width, height]])
        ([[Math.random() * width, Math.random() * height]]);

    return function() {
      if (++numSamples > numSamplesMax) return;
      var bestCandidate, bestDistance = 0;
      for (var i = 0; i < numCandidates; ++i) {
        var c = [Math.random() * width, Math.random() * height],
            d = distance(search(c[0], c[1]), c);
        if (d > bestDistance) {
          bestDistance = d;
          bestCandidate = c;
        }
      }
      quadtree.add(bestCandidate);
      return bestCandidate;
    };

    function distance(a, b) {
      var dx = a[0] - b[0],
          dy = a[1] - b[1];
      return dx * dx + dy * dy;
    };

    // Find the closest node to the specified point.
    function search(x, y) {
      var x0 = 0,
          y0 = 0,
          x3 = width,
          y3 = width,
          minDistance2 = Infinity,
          closestPoint;

      (function find(node, x1, y1, x2, y2) {
        var point;

        // stop searching if this cell canÃ¢â‚¬â„¢t contain a closer node
        if (x1 > x3 || y1 > y3 || x2 < x0 || y2 < y0) return;

        // visit this point
        if (point = node.point) {
          var dx = x - point[0],
              dy = y - point[1],
              distance2 = dx * dx + dy * dy;
          if (distance2 < minDistance2) {
            var distance = Math.sqrt(minDistance2 = distance2);
            x0 = x - distance, y0 = y - distance;
            x3 = x + distance, y3 = y + distance;
            closestPoint = point;
          }
        }

        // bisect the current node
        var children = node.nodes,
            xm = (x1 + x2) * .5,
            ym = (y1 + y2) * .5,
            right = x > xm,
            below = y > ym;

        // visit closest cell first
        if (node = children[below << 1 | right]) find(node, right ? xm : x1, below ? ym : y1, right ? x2 : xm, below ? y2 : ym);
        if (node = children[below << 1 | !right]) find(node, right ? x1 : xm, below ? ym : y1, right ? xm : x2, below ? y2 : ym);
        if (node = children[!below << 1 | right]) find(node, right ? xm : x1, below ? y1 : ym, right ? x2 : xm, below ? ym : y2);
        if (node = children[!below << 1 | !right]) find(node, right ? x1 : xm, below ? y1 : ym, right ? xm : x2, below ? ym : y2);
      })(quadtree, x0, y0, x3, y3);

      return closestPoint;
    }
  }

})();