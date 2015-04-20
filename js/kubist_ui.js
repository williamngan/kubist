(function() {

  if (document.readyState != 'loading'){
    kubist();
  } else {
    document.addEventListener('DOMContentLoaded', kubist);
  }

  function kubist() {

    var resetTimeout = -1;
    var uiTimeout = -1;

    var svg = {
      container: document.querySelector("#svg"),
      width: 500,
      height: 600,
      maxWidth: 500,
      maxHeight: 500,
      maxPoints: 1000,
      element: d3.select("#svg").append("svg").attr("shape-rendering", "geometricPrecision").attr("id", "svgElem"),
      polygons: null,
      circles: null,
      defs: null,
      vertices: [],
      dots: document.querySelector("#dots")
    }

    var config = {
      points:50,
      radius: 0,
      stroke: 0,
      gradient: false,
      type: "delaunay",
      feature: false
    }

    var img = {
      preview: document.querySelector("#preview"),
      canvas: document.createElement("canvas"),
      context: null,
      grayscale: null,
      loaded: false
    }

    document.querySelector("#canvas").appendChild( img.canvas );
    img.context = img.canvas.getContext("2d");

    // Dots
    var sample = null;
    var dots = document.querySelector("#dots");
    var dotSize = 8;
    var dotCount = 0;


    // Image loaded
    img.preview.onload = function() {

      var scale = Math.min( 150 / img.preview.width, 150 / img.preview.height );

      img.canvas.width = img.preview.width * scale;
      img.canvas.height = img.preview.height * scale;
      img.context.drawImage(img.preview, 0, 0, img.canvas.width, img.canvas.height );

      var image_data = img.context.getImageData(0, 0, img.canvas.width, img.canvas.height);
      img.grayscale = new jsfeat.matrix_t(img.canvas.width, img.canvas.height, jsfeat.U8_t | jsfeat.C1_t);
      jsfeat.imgproc.grayscale(image_data.data, img.canvas.width, img.canvas.height, img.grayscale);

      img.loaded = true;

      document.querySelector("#imageOnlyControl").style.display="block";
      reset();
    };

    // Window resize
    window.onresize = function(evt) {
      clearTimeout( resetTimeout );
      resetTimeout = setTimeout( function() {
        reset();
      }, 500);
    };

    // Init
    reset();


    // Reset and regenerate the points
    function reset( resizeOnly ) {

      var lastW = svg.width;
      var lastH = svg.height;

      svg.maxWidth = svg.container.offsetWidth;
      svg.maxHeight = svg.container.offsetHeight;

      var w = (img.loaded) ? img.canvas.width : svg.maxWidth;
      var h = (img.loaded) ? img.canvas.height : svg.maxHeight;
      var scale = Math.min( svg.maxWidth / w, svg.maxHeight / h );

      svg.width = w * scale;
      svg.height = h * scale;

      svg.element.selectAll("g, defs").remove()
      svg.element.attr("width", svg.width).attr("height", svg.height );
      svg.polygons = svg.element.append("g").attr("id", "polygons");
      svg.circles = svg.element.append("g").attr("id", "circles");
      svg.defs = svg.element.append("defs");

      sample = bestCandidateSampler(svg.width, svg.height, 5, config.points);

      var pos = document.querySelector("#svgElem").getBoundingClientRect();
      dots.style.left = pos.left+"px";
      dots.style.top = pos.top+"px";
      dots.style.width = pos.width+"px";
      dots.style.height = pos.height+"px";

      if (resizeOnly === true) {
        resize( lastW, lastH );
      } else {
        svg.dots.innerHTML = "";
        dotCount = 0;
        generate( scale );
      }
    }

    window.resetKubist = reset;


    // Generate points
    function generate( rescale ) {

      var ps = 0;
      if (config.feature && img.grayscale) {
        ps = analyze(rescale);
      }

      ps = Math.max( config.points - ps, config.points)

      for (var i = 0; i < ps; ++i) {
        var s = sample();
        if (!s) return true;
        createPoint(s, i);
        dotCount++;
      }

      redraw();

    }

    // Use JSFeat to analyze image
    function analyze( rescale ) {
      var threshold = 30;
      jsfeat.fast_corners.set_threshold(threshold);

      var corners = [];
      for(var i = 0; i < img.grayscale.cols*img.grayscale.rows; ++i) {
        corners[i] = new jsfeat.keypoint_t(0,0,0,0);
      }

      var count = Math.min( 500, jsfeat.fast_corners.detect(img.grayscale, corners, 3) );

      for (var i = 0; i < count; i++) {
        createPoint( [corners[i].x*rescale, corners[i].y*rescale], i);
        dotCount++;
      }

      return count;
    }


    function resize( lastW, lastH ) {
      var ds = dots.querySelectorAll(".dot");
      for (var i=0; i<ds.length; i++) {
        var x = parseFloat(ds[i].style.left) || ds[i].offsetLeft;
        var y = parseFloat(ds[i].style.top) || ds[i].offsetTop;
        x *= svg.width / lastW;
        y *= svg.height / lastH;
        ds[i].style.left = x + "px";
        ds[i].style.top = y + "px";

        svg.circles.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", config.radius )
            .attr("style", "fill:#fff")
            .attr("id", ds[i].getAttribute("id")+"c");
      }

      redraw();
    }

    function createPoint( p, i ) {
      var dot = document.createElement("div");
          dot.classList.add("dot");
          dot.style.left = p[0]+"px";
          dot.style.top = p[1]+"px";
          dot.setAttribute("id", "d"+i);
          movable( dot, dots );
          dots.appendChild(dot);

          svg.circles.append("circle")
              .attr("cx", p[0])
              .attr("cy", p[1])
              .attr("r", config.radius )
              .attr("style", "fill:#fff")
              .attr("id", "d"+i+"c");
    }

    // Draw tessellations
    function redraw() {

      svg.element.selectAll("defs").remove()
      svg.defs = svg.element.append("defs");

      var path = svg.polygons.selectAll("polygon");
      var count = 0;
      var gradientData = []

      svg.vertices = svg.circles.selectAll("circle")[0].map( function(d) {
        return [ Math.floor(d.cx.baseVal.value), Math.floor(d.cy.baseVal.value)];
      });


      if (config.type=="voronoi") {
        var viz = d3.geom.voronoi().clipExtent([[0, 0], [svg.width, svg.height]] );
        path = path.data( viz(svg.vertices).map(function(d) { return d.join(","); }));
      } else if (config.type=="delaunay") {
        path = path.data( d3.geom.delaunay(svg.vertices).map(function(d) { return d.join(","); }));
      }

      // Create polygons
      path.enter().append("polygon");

      path.attr("points", function(d) { return d; } )
          .attr("style", function (d, i) {
            var fill;

            // paint images
            if (this && img.loaded) {
              count++;
              var box = this.getBBox();

              if (config.gradient) {

                var p1, p2;
                if (config.type=="delaunay") {
                  p1 = this.points[0] || {x: box.x, y: box.y };
                  p2 = {x:(this.points[1].x + this.points[2].x)/2, y:(this.points[1].y + this.points[2].y)/2} || {x: box.x+box.width, y:box.y+box.height};
                } else {
                  p1 = {x: box.x, y: box.y };
                  p2 = {x: box.x+box.width, y:box.y+box.height};
                }

                var sx1 = Math.min( img.canvas.width-1, Math.max( 0, Math.floor( img.canvas.width * (p1.x) / svg.width ) ));
                var sy1 = Math.min( img.canvas.height-1, Math.max( 0, Math.floor( img.canvas.height * (p1.y ) / svg.height ) ));
                var sx2 = Math.min( img.canvas.width-1, Math.max( 0, Math.floor( img.canvas.width * (p2.x) / svg.width ) ));
                var sy2 = Math.min( img.canvas.height-1, Math.max( 0, Math.floor( img.canvas.height * (p2.y) / svg.height ) ));

                var px1 = img.context.getImageData(sx1, sy1, 1, 1).data;
                var px2 = img.context.getImageData(sx2, sy2, 1, 1).data;

                var gg = createGradientDef(count, px1, px2, box);
                gradientData.push(gg);

                fill = "url(#"+gg.id+")";

              // no gradient
              } else {
                var sx = Math.floor( img.canvas.width * (box.x + box.width/2) / svg.width );
                var sy = Math.floor( img.canvas.height * (box.y + box.height/2) / svg.height );
                var px = img.context.getImageData(sx, sy, 1, 1).data
                fill = "rgb("+px[0]+","+px[1]+","+px[2]+")"
              }

            // no image
            } else {
              var f = "CDE"[Math.floor( i%3 )];
              fill = "#"+f+f+f
            }

            var stroke = (config.stroke > 0) ? "stroke-width: "+config.stroke+"px;stroke:#f3f5f9;" : "stroke-width: 1px;stroke: "+fill+";";
            return "fill:"+fill+";"+"stroke-linejoin:bevel;"+stroke;
          }
      )

      path.exit().remove();

      updateGradient(gradientData);
    }


    // Create gradient definitions
    function updateGradient(gradientData) {

      var gradients = svg.defs.selectAll("linearGradient").data( gradientData, function(d) { return d.id; } );

      gradients.exit().remove();

      gradients.enter().append("linearGradient")
        .attr("id", function(d) { return d.id; } )
        .attr("gradientUnits", "userSpaceOnUse")
        .selectAll("stop").data( function(d) { return d.stops; }).enter().append("stop");

      gradients
        .attr("x1", function(d) { return d.box.x; }).attr("y1", function(d) { return d.box.y; } )
        .attr("x2", function(d) { return d.box.x + d.box.width })
        .attr("y2", function(d) { return d.box.y + d.box.height })
        .selectAll("stop")
          .attr("offset", function(d) { return d.offset; })
          .attr("stop-color", function(d) { return d.color; });
    }


    // Create gradient color object
    function createGradientDef( index, c1, c2, box ) {
      var id = "gd"+index;
      return {
        id: id,
        box: box,
        stops: [
          {offset: "0%", color: "rgb("+c1[0]+","+c1[1]+","+c1[2]+")"},
          {offset: "100%", color: "rgb("+c2[0]+","+c2[1]+","+c2[2]+")"}
        ]
      };
    }


    // Handles dot movement
    function onMove(target) {

      if (!target) return;

      var circle = svg.element.select( "#"+target.getAttribute("id")+"c" );
      var rect = target.getBoundingClientRect();
      var parentPos = dots.getBoundingClientRect();
      circle.attr("cx", rect.left - parentPos.left + dotSize ).attr("cy", rect.top - parentPos.top + dotSize );

      redraw()
    }

    // Best candidate sampling, based on http://bl.ocks.org/mbostock/b17e0b2aa8b2d50de465
    function bestCandidateSampler(width, height, numCandidates, numSamplesMax) {

      var numSamples = 0;

      var quadtree = d3.geom.quadtree()
          .extent([[0, 0], [width, height]])
          ([[Math.random() * width, Math.random() * height]]);

      var distance = function(a, b) {
        var dx = a[0] - b[0],
            dy = a[1] - b[1];
        return dx * dx + dy * dy;
      };

      return function() {
        if (++numSamples > numSamplesMax) return;
        var bestCandidate, bestDistance = 0;
        for (var i = 0; i < numCandidates; ++i) {
          var c = [Math.random() * width, Math.random() * height];
          var d = distance(quadtree.find(c), c);

          if (d > bestDistance) {
            bestDistance = d;
            bestCandidate = c;
          }
        }
        quadtree.add(bestCandidate);
        return bestCandidate;
      };

    }


    // UI and listeners
    var pointsInput = document.querySelector("#pointsInput");
    pointsInput.addEventListener("input", function(evt) {
      clearTimeout( uiTimeout );
      uiTimeout = setTimeout( function() {
        config.points = Math.min(svg.maxPoints, Math.max( 10, parseInt( evt.target.value ) || 10 ));
        if (parseInt( evt.target.value ) > svg.maxPoints) evt.target.value = svg.maxPoints;
        reset();
      }, 300 );
    });

    var gradientInput = document.querySelector("#gradientInput");
    gradientInput.addEventListener("change", function(evt) {
      config.gradient = evt.target.checked;
      redraw();
    });

    var featureInput = document.querySelector("#featureInput");
    featureInput.addEventListener("change", function(evt) {
      config.feature = evt.target.checked;
      reset();
    });

    var circleRadiusInput = document.querySelector("#circleRadiusInput");
    circleRadiusInput.addEventListener("input", function(evt) {
      clearTimeout( uiTimeout );
      uiTimeout = setTimeout( function() {
        config.radius = Math.max( 0, parseInt( evt.target.value ) || 0 );
        svg.element.selectAll("circle").attr("r", parseInt( config.radius ));
      }, 300 );
    });

    var lineStrokeInput = document.querySelector("#lineStrokeInput");
    lineStrokeInput.addEventListener("input", function(evt) {
      config.stroke =  Math.max( 0, parseInt( evt.target.value ) || 0 );

      clearTimeout( uiTimeout );
      uiTimeout = setTimeout( function() {
        svg.element.selectAll("polygon").attr("style", function(d) {
          this.style.stroke = (config.stroke > 0) ? "#fff" : this.style.fill;
          this.style.strokeWidth = (config.stroke > 0) ? config.stroke+"px" : "0.5px";
          return this.style.cssText;
        });

      }, 300 );
    });

    var visualizationInput = document.querySelector("#visualizationInput");
    visualizationInput.addEventListener("change", function(evt) {
      config.type = this.value;
      redraw();
    });

    var fileInput = document.querySelector("#fileInput");
    fileInput.addEventListener("change", readImage, false );

    // Read image from file picker
    function readImage() {
      if ( this.files && this.files[0] ) {
        var FR= new FileReader();
        FR.onload = function(e) {
          img.preview.setAttribute("src", e.target.result );
        };
        FR.readAsDataURL( this.files[0] );
      }
    }

    // Load existing image
    window.loadImage = function( target ) {
      var file = target.getAttribute("data-id");
      if (file) img.preview.src = "images/"+file;
    }


    // Triggers download svg
    window.downloadSVG = function() {
      var pom = document.createElement('a');
      pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(svg.container.innerHTML));
      pom.setAttribute('download', "kubist.svg");
      pom.style.display = 'none';
      document.body.appendChild(pom);
      pom.click();
      document.body.removeChild(pom);
    }


    // Make the dot element draggable
    function movable ( elem, parent ) {

      var _dragMove = false;
      var _dragStart = false;
      var _pos = {x: 0, y: 0};

      var onDragStart = function(evt) {

        var box = elem.getBoundingClientRect();
        _pos = { x: evt.pageX - box.left, y: evt.pageY - box.top };
        _dragStart = evt.target;

        window.addEventListener( "mousemove", onDrag );
        window.addEventListener( "mouseup", onDropOutside );

        evt.stopPropagation();
      };

      var onDrag = function(evt) {

        if (!_dragStart) return;

        _dragMove = true;

        var dx = evt.pageX - _pos.x + dotSize;
        var dy = evt.pageY - _pos.y + dotSize;

        move( {x: dx, y: dy}, true );
      };


      var onDropOutside = function(evt) {
        if (_dragMove) {
          onDrop();
        }
      }


      var onDrop = function(evt) {

        onMove( ((_dragStart) ? _dragStart : evt.target) );

        window.removeEventListener( "mousemove", onDrag );
        window.removeEventListener( "mouseup", onDropOutside );

        _dragStart = false;
        _dragMove = false;
      };

      var move = function( p, dragging ) {
        var parentPos = parent.getBoundingClientRect();
        elem.style.left = p.x - parentPos.left + "px";
        elem.style.top = p.y - parentPos.top + "px";

        if (dragging) {
          elem.classList.add( "dragging" );
        } else {
          elem.classList.remove( "dragging" );
        }
      }


      elem.addEventListener( "mousedown", onDragStart );
      elem.addEventListener( "mouseup", onDrop );
    }

  };

})();