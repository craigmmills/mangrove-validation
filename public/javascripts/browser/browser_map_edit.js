var poly;
var markers = [];
var path = new google.maps.MVCArray;

// Creating the class
var noPolygon = function() {
  // Private options used for construction
  var options = {
    points: []
  };

  function getTileCoordinates(point) {
    var numTiles = 1 << map.getZoom();
    var projection = new MercatorProjection();
    var worldCoordinate = projection.fromLatLngToPoint(point);
    var pixelCoordinate = new google.maps.Point(worldCoordinate.x * numTiles, worldCoordinate.y * numTiles);
    var tileCoordinate = new google.maps.Point(Math.floor(pixelCoordinate.x / MERCATOR_RANGE), Math.floor(pixelCoordinate.y / MERCATOR_RANGE));
    var gridCoordinate = new google.maps.Point(Math.floor(pixelCoordinate.x / 64), Math.floor(pixelCoordinate.y / 64));

    return {worldCoordinate: worldCoordinate, pixelCoordinate: pixelCoordinate, tileCoordinate: tileCoordinate, gridCoordinate: gridCoordinate};
  }

  // Begin public section
  return {
    reset: function() {
      options.points = [];
      this.updateGrids();
    },
    updateGrids: function() {
      var i, canvas, new_x, new_y;

      $("canvas.canvasTiles").each(function(index) {
        this.getContext("2d").clearRect(0, 0, MERCATOR_RANGE, MERCATOR_RANGE);
      });

      for(i = 0; i < options.points.length; i++) {
        new_x = Math.floor(options.points[i].x/4);
        new_y = Math.floor(options.points[i].y/4);

        canvas = $('#id-' + new_x + '-' + new_y + '-15');
        if(canvas.length > 0) {
          canvas[0].getContext("2d").drawImage(stripes_select, (options.points[i].x - (new_x * 4)) * 64, (options.points[i].y - (new_y * 4)) * 64);
        }
      }
    },
    click: function(latLng) {
      var i, gridCoordinate = getTileCoordinates(latLng).gridCoordinate;

      for(i = 0; i < options.points.length; i++) {
        if (options.points[i].x === gridCoordinate.x && options.points[i].y === gridCoordinate.y) {
          // Remove point if found
          options.points.splice(i, 1);

          this.updateGrids();

          return;
        }
      }

      // Add point if not found
      options.points.push(gridCoordinate);

      this.updateGrids();
    },
    points: function() {
      return options.points;
    }
  };
};

var no_polygon = noPolygon();

function initializeMapEdition() {
  poly = new google.maps.Polygon({
    strokeWeight: 2,
    fillColor: '#00FF00',
  });
  markers = [];
  poly.setMap(map);
  poly.setPaths(new google.maps.MVCArray([path]));

  google.maps.event.addListener(path, 'insert_at', pathChange);
  google.maps.event.addListener(path, 'set_at', pathChange);

  google.maps.event.addListener(map, 'click', addPoint);

  google.maps.event.addListener(poly, 'dblclick', changePolyColor);
}

function changePolyColor(event) {
  if(poly.fillColor == "#00FF00") {
    poly.setOptions({fillColor: "#FF0000"});
  } else {
    poly.setOptions({fillColor: "#00FF00"});
  }
}

function addMarker(event){
  var marker = new google.maps.Marker({
    position: event.latLng,
    map: map,
    icon: vertexIcon,
    draggable: true
  });
  markers.push(marker);
  google.maps.event.addListener(marker, 'click', function(){
    marker.setMap(null);
    for( var i = 0, I = markers.length; i < I && markers[i] != marker; i++)
     ;
    markers.splice(i,1);
    path.removeAt(i);
    updateGrid();
  });

  google.maps.event.addListener(marker, 'dragend', function() {
    for (var i = 0, I = markers.length; i < I && markers[i] != marker; ++i)
    ;
    path.setAt(i, marker.getPosition());
    propagateChanges();
  });
}

function addPoint(event) {
  if($("#build_polygon").is(":checked")) {
    // Insert path
    path.insertAt(path.length, event.latLng);
    addMarker(event);
    // Update Grid
    updateGrid();
  } else {
    no_polygon.click(event.latLng);
  }
}

function pathChange() {
  // Update Grid
  updateGrid();
}

function updateGrid(clear) {
  if (clear == null) clear = false;
  
  // Path as to be at least a triangle
  if(path.length < 3 && !clear) {
    return;
  }

  // Update tiles
  $("canvas.canvasTiles").each(function(index) {
    var id_split = $(this).attr('id').split('-');
    updateCanvas(id_split[1], id_split[2], this, path);
  });
}

function updateCanvas(canvas_x, canvas_y, canvas, path) {
  if(!$("#build_polygon").is(":checked")) {
    no_polygon.updateGrids();
    return;
  }

  var x = 0, y = 0, cellSize = 64, poly,
    context = canvas.getContext("2d"),
    cellsSize = 64;

  context.clearRect(0, 0, MERCATOR_RANGE, MERCATOR_RANGE);

  if(canvas.tiles_data !== undefined) {
    var x_coord = Math.floor(canvas_x*4);
    var y_coord = Math.floor(canvas_y*4);

    for (var i = x_coord; i < (x_coord + 4); i++) {
      for (var j = y_coord; j< (y_coord + 4); j++) {
        if (checkCellType(canvas.tiles_data, i, j)) {
          context.drawImage(stripes, (cellsSize*x), (cellsSize*y));
        }
        y = y+1;
      }
      y = 0;
      x = x+1;
    }
  }

  for (x = 0; x < 4; x++) {
    for (y = 0; y < 4; y++) {
      poly = [
        new google.maps.Point((canvas_x * MERCATOR_RANGE) + (x * cellSize), (canvas_y * MERCATOR_RANGE) + (y * cellSize)),
        new google.maps.Point((canvas_x * MERCATOR_RANGE) + ((x + 1) * cellSize), (canvas_y * MERCATOR_RANGE) + (y * cellSize)),
        new google.maps.Point((canvas_x * MERCATOR_RANGE) + ((x + 1) * cellSize), (canvas_y * MERCATOR_RANGE) + ((y + 1) * cellSize)),
        new google.maps.Point((canvas_x * MERCATOR_RANGE) + (x * cellSize), (canvas_y * MERCATOR_RANGE) + ((y + 1) * cellSize))
      ];

      if(polyIntersectsPath(poly, path)) {
        context.clearRect(cellsSize*x, cellsSize*y, 64, 64);
        context.drawImage(stripes_select, cellSize*x, cellSize*y);
      }
    }
  }
}

function polyIntersectsPath(poly, path) {
  var i, pixel_coordinates, fixed_path = [], fixed_poly = [];
  
  for(i = 0; i < path.length; i++) {
    pixel_coordinates = getTileCoordinates(path.getAt(i)).pixelCoordinate;

    fixed_path.push([pixel_coordinates.x, pixel_coordinates.y]);
  }

  for(i = 0; i < poly.length; i++) {
    fixed_poly.push([poly[i].x, poly[i].y]);
    
    if(pointInPoly(fixed_path, poly[i].x, poly[i].y)) {
      return true;
    }
  }

  for(i = 0; i < fixed_path.length; i++) {
    if(pointInPoly(fixed_poly, fixed_path[i][0], fixed_path[i][1])) {
      return true;
    }
  }

  return false;
}

function pointInPoly(polyCords, pointX, pointY) {
  var i, j, c = false;

  for (i = 0, j = polyCords.length - 1; i < polyCords.length; j = i++) {
    if (((polyCords[i][1] > pointY) != (polyCords[j][1] > pointY)) && (pointX < (polyCords[j][0] - polyCords[i][0]) * (pointY - polyCords[i][1]) / (polyCords[j][1] - polyCords[i][1]) + polyCords[i][0])) {
      c = !c;
    }
  }

  return c;
}

// Source: http://code.google.com/apis/maps/documentation/javascript/examples/map-coordinates.html
function getTileCoordinates(point) {
  var numTiles = 1 << map.getZoom();
  var projection = new MercatorProjection();
  var worldCoordinate = projection.fromLatLngToPoint(point);
  var pixelCoordinate = new google.maps.Point(worldCoordinate.x * numTiles, worldCoordinate.y * numTiles);
  var tileCoordinate = new google.maps.Point(Math.floor(pixelCoordinate.x / MERCATOR_RANGE), Math.floor(pixelCoordinate.y / MERCATOR_RANGE));

  return {worldCoordinate: worldCoordinate, pixelCoordinate: pixelCoordinate, tileCoordinate: tileCoordinate};
}

var vertexIcon = new google.maps.MarkerImage('/images/vertex.png',
                                             new google.maps.Size(12, 12), // The origin for this image
                                             new google.maps.Point(0, 0), // The anchor for this image
                                             new google.maps.Point(6, 6)
                                            );
