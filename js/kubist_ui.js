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
      element: d3.select("#svg").append("svg").attr("shape-rendering", "geometricPrecision").attr("id", "svgElem"),
      polygons: null,
      circles: null,
      vertices: [],
      dots: document.querySelector("#dots")
    }

    var config = {
      points: 50,
      radius: 0,
      stroke: 0,
      gradient: true,
      type: "delaunay"
    }

    var img = {
      preview: document.querySelector("#preview"),
      canvas: document.createElement("canvas"),
      loaded: false
    }

    document.querySelector("#canvas").appendChild( img.canvas );


    var sample = null;
    var dots = document.querySelector("#dots");
    var dotSize = 8;
    var dotCount = 0;

    reset();

    function reset() {

      console.log("reset---")

      svg.maxWidth = svg.container.offsetWidth;
      svg.maxHeight = svg.container.offsetHeight;

      var w = (img.loaded) ? img.preview.offsetWidth : svg.maxWidth;
      var h = (img.loaded) ? img.preview.offsetHeight : svg.maxHeight;
      var scale = Math.min( svg.maxWidth / w, svg.maxHeight / h );

      svg.width = w * scale;
      svg.height = h * scale;

      //    if (scaleW > scaleH) {
      //      svg.width = svg.maxWidth;
      //      svg.height = svg.maxHeight * scaleH / scaleW;
      //    } else {
      //      svg.height = svg.maxHeight;
      //      svg.width = svg.maxWidth * scaleW / scaleH;
      //      console.log( scaleW, scaleH, scaleW/scaleH, svg.height );
      //    }

      svg.element.selectAll("g").remove()
      svg.element.attr("width", svg.width).attr("height", svg.height );
      svg.polygons = svg.element.append("g").attr("id", "polygons").selectAll("polygon");
      svg.circles = svg.element.append("g").attr("id", "circles");
      svg.dots.innerHTML = "";

      sample = bestCandidateSampler(svg.width, svg.height, 10, config.points);

      generate();


      var pos = document.querySelector("#svgElem").getBoundingClientRect();
      dots.style.left = pos.left+"px";
      dots.style.top = pos.top+"px";
      dots.style.width = pos.width+"px";
      dots.style.height = pos.height+"px";
    }



    window.onresize = function(evt) {
      clearTimeout( resetTimeout );
      resetTimeout = setTimeout( function() {
        reset();
      }, 500);
    };



    // UI and listeners
    var pointsInput = document.querySelector("#pointsInput");
    pointsInput.addEventListener("input", function(evt) {
      clearTimeout( uiTimeout );
      uiTimeout = setTimeout( function() {
        config.points = Math.max( 10, parseInt( evt.target.value ) || 10 );
        reset()
      }, 500 );
    });

    var gradientInput = document.querySelector("#gradientInput");
    gradientInput.addEventListener("change", function(evt) {
      config.gradient = evt.target.checked;
      redraw();
      console.log( config )
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
          this.style.stroke = (config.stroke > 0) ? "#f3f5f9" : this.style.fill;
          this.style.strokeWidth = (config.stroke > 0) ? config.stroke+"px" : "0.5px";
          return this.style.cssText;

          //        var styles = this.getAttribute("style").split(";");
          //        var f = [];
          //        for (var i=0; i<styles.length; i++) {
          //          if (styles[i].indexOf("stroke-width") < 0) {
          //            f.push( styles[i]);
          //          }
          //        }
          //        f.push( "stroke-width:"+config.stroke+"px");
          //        return f.join(";");
        });

      }, 300 );
    });

    var visualizationInput = document.querySelector("#visualizationInput");
    visualizationInput.addEventListener("change", function(evt) {
      config.type = this.value;
      reset();
    });

    var fileInput = document.querySelector("#fileInput");
    fileInput.addEventListener("change", readImage, false );


    function readImage() {
      if ( this.files && this.files[0] ) {
        var FR= new FileReader();
        FR.onload = function(e) {
          img.preview.onload = function() {
            img.canvas.width = img.preview.width ;
            img.canvas.height = img.preview.height;
            img.canvas.getContext('2d').drawImage(img.preview, 0, 0, img.preview.width, img.preview.height );
            img.loaded = true;
            reset( img.preview.width, img.preview.height );
          };
          img.preview.setAttribute("src", e.target.result );

        };
        FR.readAsDataURL( this.files[0] );
      }
    }



    function redraw() {
      svg.vertices = svg.circles.selectAll("circle")[0].map( function(d) {
        return [ Math.floor(d.cx.baseVal.value), Math.floor(d.cy.baseVal.value)];
      });

      var path = svg.polygons;
      var str = "";
      var count = 0;

      console.log("redraw---");

      if (config.type=="voronoi") {
        var viz = d3.geom.voronoi().clipExtent([[0, 0], [svg.width, svg.height]] );
        path = path.data( viz(svg.vertices).map(function(d) { return d.join(","); }));
      } else if (config.type=="delaunay") {
        path = path.data( d3.geom.delaunay(svg.vertices).map(function(d) { return d.join(","); }));
      }



      path.exit().remove();
      path.enter().append("polygon")
          .attr("points", function(d) { return d; } )
          .attr("style", function (d, i) {
            var fill;

            // paint images
            if (this && img.loaded) {
              count++;
              var box = this.getBBox();

              if (config.gradient) {

                var p1 = this.points[0] || box;
                var p2 = this.points[1] || {x: box.x+box.width, y:box.y+box.height};

                var sx1 = Math.floor( img.canvas.width * (p1.x) / svg.width );
                var sy1 = Math.floor( img.canvas.height * (p1.y ) / svg.height );
                var sx2 = Math.floor( img.canvas.width * (p2.x) / svg.width );
                var sy2 = Math.floor( img.canvas.height * (p2.y) / svg.height );

                var px1 = img.canvas.getContext('2d').getImageData(sx1, sy1, 1, 1).data;
                var px2 = img.canvas.getContext('2d').getImageData(sx2, sy2, 1, 1).data;

                fill = "url(#"+createGradientDef(count, px1, px2, box)+")";

              } else {
                var sx = Math.floor( img.canvas.width * (box.x + box.width/2) / svg.width );
                var sy = Math.floor( img.canvas.height * (box.y + box.height/2) / svg.height );
                var px = img.canvas.getContext('2d').getImageData(sx, sy, 1, 1).data
                fill = "rgb("+px[0]+","+px[1]+","+px[2]+")"
              }


            } else {
              var f = "CDE"[Math.floor( i%3 )];
              fill = "#"+f+f+f
            }

            var stroke = (config.stroke > 0) ? "stroke-width: "+config.stroke+"px;stroke:#f3f5f9;" : "stroke-width: 0.5px;stroke: "+fill+";";

            return "fill:"+fill+";"+"stroke-linejoin:bevel;"+stroke;

          }
      )
    }


    function generate() {
      d3.timer( function() {
        for (var i = 0; i < config.points; ++i) {
          var s = sample();
          if (!s) return true;

          //        var dot = new Dot();
          //        dot.style.left= s[0]+"px";
          //        dot.style.top= s[1]+"px";
          //        dot.setAttribute("id", "dot"+dotCount);
          //        container.appendChild( dot );

          //        var cfill = (circle_fill) ? "fill:#"+circle_fill : '';
          //        var cstroke = (circle_stroke) ? "stroke:#"+circle_stroke : '';


          var dot = document.createElement("div");
          dot.classList.add("dot");
          dot.style.left = s[0]+"px";
          dot.style.top = s[1]+"px";
          dot.setAttribute("id", "d"+dotCount);
          movable( dot, dots );
          dots.appendChild(dot);

          svg.circles.append("circle")
              .attr("cx", s[0])
              .attr("cy", s[1])
              .attr("r", config.radius )
              .attr("style", "fill:#fff")
              .attr("id", "d"+dotCount+"c");

          dotCount++;

        }

        redraw();
      });
    }


    function onMove(target) {

      if (!target) return;

      var circle = svg.element.select( "#"+target.getAttribute("id")+"c" );
      var rect = target.getBoundingClientRect();
      var parentPos = dots.getBoundingClientRect();
      circle.attr("cx", rect.left - parentPos.left + dotSize ).attr("cy", rect.top - parentPos.top + dotSize );

      svg.element.selectAll("#polygons").remove();
      svg.polygons = svg.element.append("g").attr("id", "polygons").selectAll("polygon");

      redraw()
    }

    function createGradientDef( index, c1, c2, box ) {
      var id = "gd"+index;
      var g = svg.element.select("#"+id);
      if (g.empty()) {
        svg.element.append("linearGradient")
            .attr("id", id)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", box.x).attr("y1", box.y)
            .attr("x2", box.x + box.width).attr("y2", box.y + box.height)
            .selectAll("stop")
            .data([
              {offset: "0%", color: "rgb("+c1[0]+","+c1[1]+","+c1[2]+")"},
              {offset: "100%", color: "rgb("+c2[0]+","+c2[1]+","+c2[2]+")"}
            ])
            .enter().append("stop")
            .attr("offset", function(d) { return d.offset; })
            .attr("stop-color", function(d) { return d.color; });

        } else {
          g.attr("x1", box.x).attr("y1", box.y)
            .attr("x2", box.x + box.width).attr("y2", box.y + box.height)
            .data([
                  {offset: "0%", color: "rgb("+c1[0]+","+c1[1]+","+c1[2]+")"},
                  {offset: "100%", color: "rgb("+c2[0]+","+c2[1]+","+c2[2]+")"}
                ]);
      }

      return id;
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


    var movable = function ( elem, parent ) {

      var _dragMove = false;
      var _dragStart = false;
      var _pos = {x: 0, y: 0};
      var parentPos = parent.getBoundingClientRect();

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