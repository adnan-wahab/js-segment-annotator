;(function() {
/** Misc utilities regarding HTTP request.
 */
var helper_util, helper_pagination, image_layer, helper_segment_viewer, app_index, image_compat, image_segmentation_base, image_segmentation_pff, image_segmentation_slic, image_segmentation_slico, image_segmentation_binary_heap_priority_queue, image_canny, image_distance_transform, image_segmentation_watershed, image_segmentation, image_morph_neighbor_map, image_morph_max_filter, image_morph, helper_segment_annotator, app_edit, helper_colormap, main;
helper_util = function () {
  // Get JSON by AJAX request.
  function requestJSON(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        var data = xmlhttp.responseText;
        callback(JSON.parse(data));
      }
    };
    xmlhttp.open('GET', url, true);
    xmlhttp.send();
  }
  // Parse query params.
  function getQueryParams(queryString) {
    var tokens, params = {}, re = /[?&]?([^=]+)=([^&]*)/g;
    queryString = queryString || document.location.search;
    while (tokens = re.exec(queryString.split('+').join(' ')))
      params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    return params;
  }
  // Create a unique array.
  function unique() {
    var uniqueArray = [];
    for (var i = 0; i < arguments.length; ++i) {
      var array = arguments[i];
      for (var j = 0; j < array.length; ++j) {
        if (uniqueArray.indexOf(array[j]) < 0)
          uniqueArray.push(array[j]);
      }
    }
    return uniqueArray;
  }
  // Create query params from an object.
  function makeQueryParams(params, updates) {
    params = params || {};
    updates = updates || {};
    var queryString = '?';
    var keys = unique(Object.keys(params), Object.keys(updates));
    for (var i = 0; i < keys.length; ++i) {
      var value = updates[keys[i]];
      if (value === null)
        continue;
      else if (typeof value === 'undefined')
        value = params[keys[i]];
      queryString = queryString + encodeURIComponent(keys[i]) + '=' + encodeURIComponent(value) + (i < keys.length - 1 ? '&' : '');
    }
    return queryString;
  }
  return {
    requestJSON: requestJSON,
    getQueryParams: getQueryParams,
    makeQueryParams: makeQueryParams
  };
}();
helper_pagination = function (util) {
  function Pagination(count, params) {
    var i, anchor, page = parseInt(params.page || 0, 10), perPage = parseInt(params.per_page || 30, 10), neighbors = parseInt(params.page_neighbors || 2, 10), pages = Math.ceil(count / perPage), startIndex = Math.min(Math.max(page * perPage, 0), count), endIndex = Math.min(Math.max((page + 1) * perPage, 0), count);
    this.begin = function () {
      return startIndex;
    };
    this.end = function () {
      return endIndex;
    };
    this.render = function (options) {
      options = options || {};
      var index = [];
      for (i = 0; i < pages; ++i) {
        if (i <= (page <= neighbors ? 2 : 1) * neighbors || page - neighbors <= i && i <= page + neighbors || pages - (page >= pages - neighbors - 1 ? 2 : 1) * neighbors <= i)
          index.push(i);
      }
      var container = document.createElement(options.nodeType || 'p');
      {
        anchor = document.createElement('a');
        if (page > 0)
          anchor.href = util.makeQueryParams(params, { page: page - 1 });
        anchor.appendChild(document.createTextNode('Prev'));
        container.appendChild(anchor);
        container.appendChild(document.createTextNode(' '));
      }
      for (i = 0; i < index.length; ++i) {
        anchor = document.createElement('a');
        if (index[i] !== page)
          anchor.href = util.makeQueryParams(params, { page: index[i] });
        anchor.appendChild(document.createTextNode(index[i]));
        container.appendChild(anchor);
        container.appendChild(document.createTextNode(' '));
        if (i < index.length - 1 && index[i] + 1 != index[i + 1])
          container.appendChild(document.createTextNode('... '));
      }
      {
        anchor = document.createElement('a');
        if (page < pages - 1)
          anchor.href = util.makeQueryParams(params, { page: page + 1 });
        anchor.appendChild(document.createTextNode('Next'));
        container.appendChild(anchor);
      }
      return container;
    };
  }
  return Pagination;
}(helper_util);
image_layer = function () {
  // Canvas wrapper object.
  function Layer(source, options) {
    options = options || {};
    this.canvas = document.createElement('canvas');
    this.canvas.width = options.width || this.canvas.width;
    this.canvas.height = options.height || this.canvas.height;
    if (source) {
      if (typeof source === 'string' || typeof source === 'object' && source.nodeName === 'IMG')
        this.load(source, options);
      else if (typeof source === 'object' && (source.nodeName === 'CANVAS' || source instanceof ImageData))
        this.fromCanvas(source, options);
    }
  }
  Layer.prototype.load = function (source, options) {
    options = options || {};
    if (typeof options === 'function')
      options = { onload: options };
    var image, layer = this;
    this.canvas.width = options.width || this.canvas.width;
    this.canvas.height = options.height || this.canvas.height;
    if (typeof source === 'string') {
      image = new Image();
      image.src = source;
    } else
      image = source;
    image.onload = function () {
      layer._onImageLoad(image, options);
    };
    if (typeof options.onerror === 'function')
      image.onerror = options.onerror.call(this);
    return this;
  };
  Layer.prototype._onImageLoad = function (image, options) {
    this.canvas.width = options.width || image.width;
    this.canvas.height = options.height || image.height;
    var context = this.canvas.getContext('2d');
    this._setImageSmoothing(context, options);
    context.drawImage(image, 0, 0, image.width, image.height, 0, 0, this.canvas.width, this.canvas.height);
    this.imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    if (typeof options.onload === 'function')
      options.onload.call(this);
  };
  Layer.prototype.fromCanvas = function (source, options) {
    options = options || {};
    if (typeof options === 'function')
      options = { onload: options };
    this.canvas.width = source.width;
    this.canvas.height = source.height;
    var context = this.canvas.getContext('2d');
    this._setImageSmoothing(context, options);
    if (source instanceof ImageData)
      context.putImageData(source, 0, 0);
    else
      context.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
    this.imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    if (typeof options.onload === 'function')
      options.onload.call(this);
    return this;
  };
  Layer.prototype.fromImageData = function (imageData, options) {
    options = options || {};
    if (typeof options === 'function')
      options = { onload: options };
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    var context = this.canvas.getContext('2d');
    this._setImageSmoothing(context, options);
    context.drawImage(imageData, 0, 0, this.canvas.width, this.canvas.height);
    this.imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    if (typeof options.onload === 'function')
      options.onload.call(this);
    return this;
  };
  Layer.prototype._setImageSmoothing = function (context, options) {
    if (typeof options.imageSmoothingEnabled === 'undefined')
      options.imageSmoothingEnabled = true;
    context.mozImageSmoothingEnabled = options.imageSmoothingEnabled;
    context.webkitImageSmoothingEnabled = options.imageSmoothingEnabled;
    context.msImageSmoothingEnabled = options.imageSmoothingEnabled;
    context.imageSmoothingEnabled = options.imageSmoothingEnabled;
  };
  Layer.prototype.copy = function (source) {
    source.render();
    this.fromCanvas(source.canvas);
    return this;
  };
  Layer.prototype.process = function (callback) {
    if (typeof callback !== 'function')
      throw 'Invalid callback';
    callback.call(this, this.imageData);
    return this.render();
  };
  Layer.prototype.render = function () {
    if (this.imageData)
      this.canvas.getContext('2d').putImageData(this.imageData, 0, 0);
    return this;
  };
  Layer.prototype.setAlpha = function (alpha) {
    var data = this.imageData.data;
    for (var i = 3; i < data.length; i += 4)
      data[i] = alpha;
    return this;
  };
  Layer.prototype.fill = function (rgba) {
    var data = this.imageData.data;
    for (var i = 0; i < data.length; i += 4)
      for (var j = 0; j < rgba.length; ++j)
        data[i + j] = rgba[j];
    return this;
  };
  Layer.prototype.resize = function (width, height, options) {
    options = options || {};
    var temporaryCanvas = document.createElement('canvas'), tempoaryContext = temporaryCanvas.getContext('2d');
    temporaryCanvas.width = width;
    temporaryCanvas.height = height;
    tempoaryContext.drawImage(this.canvas, 0, 0, width, height);
    this.canvas.width = width;
    this.canvas.height = height;
    var context = this.canvas.getContext('2d');
    this._setImageSmoothing(context, options);
    context.drawImage(temporaryCanvas, 0, 0);
    this.imageData = context.getImageData(0, 0, width, height);
    return this;
  };
  Layer.prototype.applyColormap = function (colormap, grayscale) {
    var data = this.imageData.data;
    if (typeof grayscale === 'undefined')
      grayscale = true;
    for (var i = 0; i < data.length; i += 4) {
      var index = data[i];
      if (!grayscale)
        index |= data[i + 1] << 8 | data[i + 2] << 16;
      data[i + 0] = colormap[index][0];
      data[i + 1] = colormap[index][1];
      data[i + 2] = colormap[index][2];
    }
    return this;
  };
  Layer.prototype.computeEdgemap = function (options) {
    if (typeof options === 'undefined')
      options = {};
    var data = this.imageData.data, width = this.imageData.width, height = this.imageData.height, edgeMap = new Uint8Array(this.imageData.data), foreground = options.foreground || [
        255,
        255,
        255
      ], background = options.background || [
        0,
        0,
        0
      ], i, j, k;
    for (i = 0; i < height; ++i) {
      for (j = 0; j < width; ++j) {
        var offset = 4 * (i * width + j), index = data[4 * (i * width + j)], isBoundary = i === 0 || j === 0 || i === height - 1 || j === width - 1 || index !== data[4 * (i * width + j - 1)] || index !== data[4 * (i * width + j + 1)] || index !== data[4 * ((i - 1) * width + j)] || index !== data[4 * ((i + 1) * width + j)];
        if (isBoundary) {
          for (k = 0; k < foreground.length; ++k)
            edgeMap[offset + k] = foreground[k];
        } else {
          for (k = 0; k < background.length; ++k)
            edgeMap[offset + k] = background[k];
        }
      }
    }
    data.set(edgeMap);
    return this;
  };
  Layer.prototype.gray2index = function () {
    var data = this.imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
    return this;
  };
  return Layer;
}();
helper_segment_viewer = function (Layer) {
  // Segment viewer.
  function Viewer(imageURL, annotationURL, options) {
    if (typeof options === 'undefined')
      options = {};
    this.colormap = options.colormap || [
      [
        255,
        255,
        255
      ],
      [
        255,
        0,
        0
      ]
    ];
    this.labels = options.labels;
    this._createLayers(imageURL, annotationURL, options);
    var viewer = this;
    this.layers.image.load(imageURL, {
      width: options.width,
      height: options.height,
      onload: function () {
        viewer._initializeIfReady(options);
      }
    });
    this.layers.visualization.load(annotationURL, {
      width: options.width,
      height: options.height,
      imageSmoothingEnabled: false,
      onload: function () {
        viewer._initializeIfReady(options);
      },
      onerror: options.onerror
    });
    if (options.overlay)
      viewer.addOverlay(options.overlay);
  }
  Viewer.prototype._createLayers = function (imageURL, annotationURL, options) {
    var onload = options.onload;
    delete options.onload;
    this.container = document.createElement('div');
    this.container.classList.add('segment-viewer-container');
    this.layers = {
      image: new Layer(options),
      visualization: new Layer(options)
    };
    options.onload = onload;
    for (var key in this.layers) {
      var canvas = this.layers[key].canvas;
      canvas.classList.add('segment-viewer-layer');
      this.container.appendChild(canvas);
    }
    this._unloadedLayers = Object.keys(this.layers).length;
    this._resizeLayers(options);
  };
  Viewer.prototype._resizeLayers = function (options) {
    this.width = options.width || this.layers.image.canvas.width;
    this.height = options.height || this.layers.image.canvas.height;
    for (var key in this.layers) {
      if (key !== 'image') {
        var canvas = this.layers[key].canvas;
        canvas.width = this.width;
        canvas.height = this.height;
      }
    }
    this.container.style.width = this.width + 'px';
    this.container.style.height = this.height + 'px';
  };
  Viewer.prototype._initializeIfReady = function (options) {
    if (--this._unloadedLayers > 0)
      return;
    this._resizeLayers(options);
    var viewer = this;
    this.layers.visualization.process(function () {
      var uniqueIndex = getUniqueIndex(this.imageData.data);
      this.applyColormap(viewer.colormap);
      this.setAlpha(192);
      this.render();
      if (viewer.labels)
        viewer.addLegend(uniqueIndex.filter(function (x) {
          return (options.excludedLegends || []).indexOf(x) < 0;
        }));
    });
  };
  Viewer.prototype.addOverlay = function (text) {
    var overlayContainer = document.createElement('div');
    overlayContainer.classList.add('segment-viewer-overlay-container');
    if (text)
      overlayContainer.appendChild(document.createTextNode(text));
    this.container.appendChild(overlayContainer);
  };
  Viewer.prototype.addLegend = function (index) {
    var legendContainer = document.createElement('div'), i;
    if (typeof index === 'undefined') {
      index = [];
      for (i = 0; i < this.labels.length; ++i)
        index.push(i);
    }
    legendContainer.classList.add('segment-viewer-legend-container');
    for (i = 0; i < index.length; ++i) {
      var label = this.labels[index[i]], color = this.colormap[index[i]], legendItem = document.createElement('div'), colorbox = document.createElement('span'), legendLabel = document.createElement('span');
      colorbox.classList.add('segment-viewer-legend-colorbox');
      colorbox.style.backgroundColor = 'rgb(' + color.join(',') + ')';
      legendItem.classList.add('segment-viewer-legend-item');
      legendLabel.appendChild(document.createTextNode(' ' + label));
      legendLabel.classList.add('segment-viewer-legend-label');
      legendItem.appendChild(colorbox);
      legendItem.appendChild(legendLabel);
      legendContainer.appendChild(legendItem);
    }
    this.container.appendChild(legendContainer);
  };
  var getUniqueIndex = function (data) {
    var uniqueIndex = [];
    for (var i = 0; i < data.length; i += 4) {
      if (uniqueIndex.indexOf(data[i]) < 0) {
        uniqueIndex.push(data[i]);
      }
    }
    return uniqueIndex.sort(function (a, b) {
      return a - b;
    });
  };
  return Viewer;
}(image_layer);
app_index = function (Pagination, Viewer, util) {
  function createLabelOptions(params, labels) {
    var container = document.createElement('p'), select = document.createElement('select'), option;
    {
      option = document.createElement('option');
      option.appendChild(document.createTextNode('all'));
      select.appendChild(option);
    }
    for (var i = 0; i < labels.length; ++i) {
      option = document.createElement('option');
      option.appendChild(document.createTextNode(labels[i]));
      if (labels[i] === params.label) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    select.onchange = function (event) {
      window.location = util.makeQueryParams(params, { label: event.target.value === 'all' ? null : event.target.value });
    };
    container.appendChild(select);
    return container;
  }
  function render(data, params) {
    var pagination = new Pagination(data.imageURLs.length, params);
    document.body.appendChild(pagination.render());
    document.body.appendChild(createLabelOptions(params, data.labels));
    for (var i = pagination.begin(); i < pagination.end(); ++i) {
      var viewer = new Viewer(data.imageURLs[i], data.annotationURLs[i], {
          width: params.width || 240,
          height: params.height || 320,
          colormap: data.colormap,
          labels: data.labels,
          excludedLegends: [0],
          overlay: i.toString()
        }), anchor = document.createElement('a');
      anchor.appendChild(viewer.container);
      anchor.href = util.makeQueryParams({
        view: 'edit',
        id: i
      });
      document.body.appendChild(anchor);
    }
  }
  return render;
}(helper_pagination, helper_segment_viewer, helper_util);
image_compat = {
  // Internet Explorer doesn't support ImageData().
  createImageData: function (width, height) {
    var context = document.createElement('canvas').getContext('2d');
    return context.createImageData(width, height);
  }
};
image_segmentation_base = function (compat) {
  function BaseSegmentation(imageData, options) {
    if (!(imageData instanceof ImageData))
      throw 'Invalid ImageData';
    this.imageData = compat.createImageData(imageData.width, imageData.height);
    this.imageData.data.set(imageData.data);
  }
  BaseSegmentation.prototype.finer = function () {
  };
  BaseSegmentation.prototype.coarser = function () {
  };
  return BaseSegmentation;
}(image_compat);
image_segmentation_pff = function (BaseSegmentation, compat) {
  function PFF(imageData, options) {
    BaseSegmentation.call(this, imageData, options);
    options = options || {};
    this.sigma = options.sigma || Math.sqrt(2);
    this.threshold = options.threshold || 500;
    this.minSize = options.minSize || 20;
    this.result = this._compute();
  }
  PFF.prototype = Object.create(BaseSegmentation.prototype);
  // Compute segmentation.
  PFF.prototype._compute = function () {
    var smoothedImage = compat.createImageData(this.imageData.width, this.imageData.height);
    smoothedImage.data.set(this.imageData.data);
    smoothImage(smoothedImage, this.sigma);
    var universe = segmentGraph(smoothedImage, this.threshold, this.minSize), indexMap = createIndexMap(universe, smoothedImage), result = compat.createImageData(smoothedImage.width, smoothedImage.height);
    encodeLabels(indexMap, result.data);
    result.numSegments = universe.nodes;
    return result;
  };
  // Finer.
  PFF.prototype.finer = function (scale) {
    this.sigma /= scale || Math.sqrt(2);
    this.threshold /= scale || Math.sqrt(2);
    this.result = this._compute();
  };
  // Coarser.
  PFF.prototype.coarser = function (scale) {
    this.sigma *= scale || Math.sqrt(2);
    this.threshold *= scale || Math.sqrt(2);
    this.result = this._compute();
  };
  // Create a normalized Gaussian filter.
  function createGaussian(sigma) {
    sigma = Math.max(sigma, 0.01);
    var length = Math.ceil(sigma * 4) + 1, mask = new Float32Array(length), sumValues = 0, i;
    for (i = 0; i < length; ++i) {
      var value = Math.exp(-0.5 * Math.pow(i / sigma, 2));
      sumValues += Math.abs(value);
      mask[i] = value;
    }
    sumValues = 2 * sumValues - Math.abs(mask[0]);
    // 2x except center.
    for (i = 0; i < length; ++i)
      mask[i] /= sumValues;
    return mask;
  }
  // Convolve even.
  function convolveEven(imageData, filter) {
    var width = imageData.width, height = imageData.height, source = imageData.data, temporary = new Float32Array(source), i, j, k, l, sum;
    // Horizontal filter.
    for (i = 0; i < height; ++i) {
      for (j = 0; j < width; ++j) {
        for (k = 0; k < 3; ++k) {
          sum = filter[0] * source[4 * (i * width + j) + k];
          for (l = 1; l < filter.length; ++l) {
            sum += filter[l] * (source[4 * (i * width + Math.max(j - l, 0)) + k] + source[4 * (i * width + Math.min(j + l, width - 1)) + k]);
          }
          temporary[4 * (i * width + j) + k] = sum;
        }
      }
    }
    // Vertical filter.
    for (i = 0; i < height; ++i) {
      for (j = 0; j < width; ++j) {
        for (k = 0; k < 3; ++k) {
          sum = filter[0] * temporary[4 * (i * width + j) + k];
          for (l = 1; l < filter.length; ++l) {
            sum += filter[l] * (temporary[4 * (Math.max(i - l, 0) * width + j) + k] + temporary[4 * (Math.min(i + l, height - 1) * width + j) + k]);
          }
          source[4 * (i * width + j) + k] = sum;
        }
      }
    }
  }
  // Smooth an image.
  function smoothImage(imageData, sigma) {
    var gaussian = createGaussian(sigma);
    convolveEven(imageData, gaussian);
  }
  // Create an edge structure.
  function createEdges(imageData) {
    var width = imageData.width, height = imageData.height, rgbData = imageData.data, edgeSize = 4 * width * height - 3 * width - 3 * height + 2, index = 0, edges = {
        a: new Int32Array(edgeSize),
        b: new Int32Array(edgeSize),
        w: new Float32Array(edgeSize)
      }, x1, x2;
    for (var i = 0; i < height; ++i) {
      for (var j = 0; j < width; ++j) {
        if (j < width - 1) {
          x1 = i * width + j;
          x2 = i * width + j + 1;
          edges.a[index] = x1;
          edges.b[index] = x2;
          x1 = 4 * x1;
          x2 = 4 * x2;
          edges.w[index] = Math.sqrt(Math.pow(rgbData[x1 + 0] - rgbData[x2 + 0], 2) + Math.pow(rgbData[x1 + 1] - rgbData[x2 + 1], 2) + Math.pow(rgbData[x1 + 2] - rgbData[x2 + 2], 2));
          ++index;
        }
        if (i < height - 1) {
          x1 = i * width + j;
          x2 = (i + 1) * width + j;
          edges.a[index] = x1;
          edges.b[index] = x2;
          x1 = 4 * x1;
          x2 = 4 * x2;
          edges.w[index] = Math.sqrt(Math.pow(rgbData[x1 + 0] - rgbData[x2 + 0], 2) + Math.pow(rgbData[x1 + 1] - rgbData[x2 + 1], 2) + Math.pow(rgbData[x1 + 2] - rgbData[x2 + 2], 2));
          ++index;
        }
        if (j < width - 1 && i < height - 1) {
          x1 = i * width + j;
          x2 = (i + 1) * width + j + 1;
          edges.a[index] = x1;
          edges.b[index] = x2;
          x1 = 4 * x1;
          x2 = 4 * x2;
          edges.w[index] = Math.sqrt(Math.pow(rgbData[x1 + 0] - rgbData[x2 + 0], 2) + Math.pow(rgbData[x1 + 1] - rgbData[x2 + 1], 2) + Math.pow(rgbData[x1 + 2] - rgbData[x2 + 2], 2));
          ++index;
        }
        if (j < width - 1 && i > 0) {
          x1 = i * width + j;
          x2 = (i - 1) * width + j + 1;
          edges.a[index] = x1;
          edges.b[index] = x2;
          x1 = 4 * x1;
          x2 = 4 * x2;
          edges.w[index] = Math.sqrt(Math.pow(rgbData[x1 + 0] - rgbData[x2 + 0], 2) + Math.pow(rgbData[x1 + 1] - rgbData[x2 + 1], 2) + Math.pow(rgbData[x1 + 2] - rgbData[x2 + 2], 2));
          ++index;
        }
      }
    }
    return edges;
  }
  // Sort edges.
  function sortEdgesByWeights(edges) {
    var order = new Array(edges.w.length), i;
    for (i = 0; i < order.length; ++i)
      order[i] = i;
    var a = edges.a, b = edges.b, w = edges.w;
    order.sort(function (i, j) {
      return w[i] - w[j];
    });
    var temporaryA = new Uint32Array(a), temporaryB = new Uint32Array(b), temporaryW = new Float32Array(w);
    for (i = 0; i < order.length; ++i) {
      temporaryA[i] = a[order[i]];
      temporaryB[i] = b[order[i]];
      temporaryW[i] = w[order[i]];
    }
    edges.a = temporaryA;
    edges.b = temporaryB;
    edges.w = temporaryW;
  }
  // Create a universe struct.
  function createUniverse(nodes, c) {
    var universe = {
      nodes: nodes,
      rank: new Int32Array(nodes),
      p: new Int32Array(nodes),
      size: new Int32Array(nodes),
      threshold: new Float32Array(nodes)
    };
    for (var i = 0; i < nodes; ++i) {
      universe.size[i] = 1;
      universe.p[i] = i;
      universe.threshold[i] = c;
    }
    return universe;
  }
  // Find a vertex pointing self.
  function findNode(universe, index) {
    var i = index;
    while (i !== universe.p[i])
      i = universe.p[i];
    universe.p[index] = i;
    return i;
  }
  // Join a node.
  function joinNode(universe, a, b) {
    if (universe.rank[a] > universe.rank[b]) {
      universe.p[b] = a;
      universe.size[a] += universe.size[b];
    } else {
      universe.p[a] = b;
      universe.size[b] += universe.size[a];
      if (universe.rank[a] == universe.rank[b])
        universe.rank[b]++;
    }
    universe.nodes--;
  }
  // Segment a graph.
  function segmentGraph(imageData, c, minSize) {
    var edges = createEdges(imageData), a, b, i;
    sortEdgesByWeights(edges);
    var universe = createUniverse(imageData.width * imageData.height, c);
    // Bottom-up merge.
    for (i = 0; i < edges.a.length; ++i) {
      a = findNode(universe, edges.a[i]);
      b = findNode(universe, edges.b[i]);
      if (a != b && edges.w[i] <= universe.threshold[a] && edges.w[i] <= universe.threshold[b]) {
        joinNode(universe, a, b);
        a = findNode(universe, a);
        universe.threshold[a] = edges.w[i] + c / universe.size[a];
      }
    }
    // Merge small components.
    for (i = 0; i < edges.a.length; ++i) {
      a = findNode(universe, edges.a[i]);
      b = findNode(universe, edges.b[i]);
      if (a != b && (universe.size[a] < minSize || universe.size[b] < minSize))
        joinNode(universe, a, b);
    }
    return universe;
  }
  // Create an index map.
  function createIndexMap(universe, imageData) {
    var width = imageData.width, height = imageData.height, indexMap = new Int32Array(width * height), nodeIds = [], lastId = 0;
    for (var i = 0; i < height; ++i) {
      for (var j = 0; j < width; ++j) {
        var component = findNode(universe, i * width + j), index = nodeIds[component];
        if (index === undefined) {
          index = lastId;
          nodeIds[component] = lastId++;
        }
        indexMap[i * width + j] = index;
      }
    }
    return indexMap;
  }
  function encodeLabels(indexMap, data) {
    for (var i = 0; i < indexMap.length; ++i) {
      var value = indexMap[i];
      data[4 * i + 0] = value & 255;
      data[4 * i + 1] = value >>> 8 & 255;
      data[4 * i + 2] = value >>> 16 & 255;
      data[4 * i + 3] = 255;
    }
  }
  return PFF;
}(image_segmentation_base, image_compat);
image_segmentation_slic = function (BaseSegmentation, compat) {
  // SLIC segmentation.
  function SLIC(imageData, options) {
    BaseSegmentation.call(this, imageData, options);
    options = options || {};
    this.regionSize = options.regionSize || 16;
    this.minRegionSize = options.minRegionSize || Math.round(this.regionSize * 0.8);
    this.maxIterations = options.maxIterations || 10;
    this._compute();
  }
  SLIC.prototype = Object.create(BaseSegmentation.prototype);
  SLIC.prototype.finer = function () {
    var newSize = Math.max(5, Math.round(this.regionSize / Math.sqrt(2)));
    if (newSize !== this.regionSize) {
      this.regionSize = newSize;
      this.minRegionSize = Math.round(newSize * 0.8);
      this._compute();
    }
  };
  SLIC.prototype.coarser = function () {
    var newSize = Math.min(640, Math.round(this.regionSize * Math.sqrt(2)));
    if (newSize !== this.regionSize) {
      this.regionSize = newSize;
      this.minRegionSize = Math.round(newSize * 0.8);
      this._compute();
    }
  };
  SLIC.prototype._compute = function () {
    this.result = computeSLICSegmentation(this.imageData, this.regionSize, this.minRegionSize, this.maxIterations);
  };
  // Convert RGBA into XYZ color space. rgba: Red Green Blue Alpha.
  function rgb2xyz(rgba, w, h) {
    var xyz = new Float32Array(3 * w * h), gamma = 2.2;
    for (var i = 0; i < w * h; i++) {
      // 1.0 / 255.9 = 0.00392156862.
      var r = rgba[4 * i + 0] * 0.00392156862, g = rgba[4 * i + 1] * 0.00392156862, b = rgba[4 * i + 2] * 0.00392156862;
      r = Math.pow(r, gamma);
      g = Math.pow(g, gamma);
      b = Math.pow(b, gamma);
      xyz[i] = r * 0.488718 + g * 0.31068 + b * 0.200602;
      xyz[i + w * h] = r * 0.176204 + g * 0.812985 + b * 0.0108109;
      xyz[i + 2 * w * h] = g * 0.0102048 + b * 0.989795;
    }
    return xyz;
  }
  // Convert XYZ to Lab.
  function xyz2lab(xyz, w, h) {
    function f(x) {
      if (x > 0.00856)
        return Math.pow(x, 0.33333333);
      else
        return 7.78706891568 * x + 0.1379310336;
    }
    var xw = 1 / 3, yw = 1 / 3, Yw = 1, Xw = xw / yw, Zw = (1 - xw - yw) / (yw * Yw), ix = 1 / Xw, iy = 1 / Yw, iz = 1 / Zw, labData = new Float32Array(3 * w * h);
    for (var i = 0; i < w * h; i++) {
      var fx = f(xyz[i] * ix), fy = f(xyz[w * h + i] * iy), fz = f(xyz[2 * w * h + i] * iz);
      labData[i] = 116 * fy - 16;
      labData[i + w * h] = 500 * (fx - fy);
      labData[i + 2 * w * h] = 200 * (fy - fz);
    }
    return labData;
  }
  // Compute gradient of 3 channel color space image.
  function computeEdge(image, edgeMap, w, h) {
    for (var k = 0; k < 3; k++) {
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var a = image[k * w * h + y * w + x - 1], b = image[k * w * h + y * w + x + 1], c = image[k * w * h + (y + 1) * w + x], d = image[k * w * h + (y - 1) * w + x];
          edgeMap[y * w + x] += Math.pow(a - b, 2) + Math.pow(c - d, 2);
        }
      }
    }
  }
  // Initialize superpixel clusters.
  function initializeKmeansCenters(image, edgeMap, centers, clusterParams, numRegionsX, numRegionsY, regionSize, imW, imH) {
    var i = 0, j = 0, x, y;
    for (var v = 0; v < numRegionsY; v++) {
      for (var u = 0; u < numRegionsX; u++) {
        var centerx = 0, centery = 0, minEdgeValue = Infinity, xp, yp;
        x = parseInt(Math.round(regionSize * (u + 0.5)), 10);
        y = parseInt(Math.round(regionSize * (v + 0.5)), 10);
        x = Math.max(Math.min(x, imW - 1), 0);
        y = Math.max(Math.min(y, imH - 1), 0);
        // Search in a 3x3 neighbourhood the smallest edge response.
        for (yp = Math.max(0, y - 1); yp <= Math.min(imH - 1, y + 1); ++yp) {
          for (xp = Math.max(0, x - 1); xp <= Math.min(imW - 1, x + 1); ++xp) {
            var thisEdgeValue = edgeMap[yp * imW + xp];
            if (thisEdgeValue < minEdgeValue) {
              minEdgeValue = thisEdgeValue;
              centerx = xp;
              centery = yp;
            }
          }
        }
        // Initialize the new center at this location.
        centers[i++] = parseFloat(centerx);
        centers[i++] = parseFloat(centery);
        // 3 channels.
        centers[i++] = image[centery * imW + centerx];
        centers[i++] = image[imW * imH + centery * imW + centerx];
        centers[i++] = image[2 * imW * imH + centery * imW + centerx];
        // THIS IS THE VARIABLE VALUE OF M, just start with 5.
        clusterParams[j++] = 10 * 10;
        clusterParams[j++] = regionSize * regionSize;
      }
    }
  }
  // Re-compute clusters.
  function computeCenters(image, segmentation, masses, centers, numRegions, imW, imH) {
    var region;
    for (var y = 0; y < imH; y++) {
      for (var x = 0; x < imW; x++) {
        region = segmentation[x + y * imW];
        masses[region]++;
        centers[region * 5 + 0] += x;
        centers[region * 5 + 1] += y;
        centers[region * 5 + 2] += image[y * imW + x];
        centers[region * 5 + 3] += image[imW * imH + y * imW + x];
        centers[region * 5 + 4] += image[2 * imW * imH + y * imW + x];
      }
    }
    for (region = 0; region < numRegions; region++) {
      var iMass = 1 / Math.max(masses[region], 1e-8);
      centers[region * 5] = centers[region * 5] * iMass;
      centers[region * 5 + 1] = centers[region * 5 + 1] * iMass;
      centers[region * 5 + 2] = centers[region * 5 + 2] * iMass;
      centers[region * 5 + 3] = centers[region * 5 + 3] * iMass;
      centers[region * 5 + 4] = centers[region * 5 + 4] * iMass;
    }
  }
  // Remove small superpixels and assign them the nearest superpixel label.
  function eliminateSmallRegions(segmentation, minRegionSize, numPixels, imW, imH) {
    var cleaned = new Int32Array(numPixels), segment = new Int32Array(numPixels), dx = new Array(1, -1, 0, 0), dy = new Array(0, 0, 1, -1), segmentSize, label, cleanedLabel, numExpanded, pixel, x, y, xp, yp, neighbor, direction;
    for (pixel = 0; pixel < numPixels; ++pixel) {
      if (cleaned[pixel])
        continue;
      label = segmentation[pixel];
      numExpanded = 0;
      segmentSize = 0;
      segment[segmentSize++] = pixel;
      /** Find cleanedLabel as the label of an already cleaned region neighbor
       * of this pixel.
       */
      cleanedLabel = label + 1;
      cleaned[pixel] = label + 1;
      x = pixel % imW;
      y = Math.floor(pixel / imW);
      for (direction = 0; direction < 4; direction++) {
        xp = x + dx[direction];
        yp = y + dy[direction];
        neighbor = xp + yp * imW;
        if (0 <= xp && xp < imW && 0 <= yp && yp < imH && cleaned[neighbor])
          cleanedLabel = cleaned[neighbor];
      }
      // Expand the segment.
      while (numExpanded < segmentSize) {
        var open = segment[numExpanded++];
        x = open % imW;
        y = Math.floor(open / imW);
        for (direction = 0; direction < 4; ++direction) {
          xp = x + dx[direction];
          yp = y + dy[direction];
          neighbor = xp + yp * imW;
          if (0 <= xp && xp < imW && 0 <= yp && yp < imH && cleaned[neighbor] === 0 && segmentation[neighbor] === label) {
            cleaned[neighbor] = label + 1;
            segment[segmentSize++] = neighbor;
          }
        }
      }
      // Change label to cleanedLabel if the semgent is too small.
      if (segmentSize < minRegionSize) {
        while (segmentSize > 0)
          cleaned[segment[--segmentSize]] = cleanedLabel;
      }
    }
    // Restore base 0 indexing of the regions.
    for (pixel = 0; pixel < numPixels; ++pixel)
      --cleaned[pixel];
    for (var i = 0; i < numPixels; ++i)
      segmentation[i] = cleaned[i];
  }
  // Update cluster parameters.
  function updateClusterParams(segmentation, mcMap, msMap, clusterParams) {
    var mc = new Float32Array(clusterParams.length / 2), ms = new Float32Array(clusterParams.length / 2);
    for (var i = 0; i < segmentation.length; i++) {
      var region = segmentation[i];
      if (mc[region] < mcMap[region]) {
        mc[region] = mcMap[region];
        clusterParams[region * 2 + 0] = mcMap[region];
      }
      if (ms[region] < msMap[region]) {
        ms[region] = msMap[region];
        clusterParams[region * 2 + 1] = msMap[region];
      }
    }
  }
  // Assign superpixel label.
  function assignSuperpixelLabel(im, segmentation, mcMap, msMap, distanceMap, centers, clusterParams, numRegionsX, numRegionsY, regionSize, imW, imH) {
    var x, y;
    for (var i = 0; i < distanceMap.length; ++i)
      distanceMap[i] = Infinity;
    var S = regionSize;
    for (var region = 0; region < numRegionsX * numRegionsY; ++region) {
      var cx = Math.round(centers[region * 5 + 0]), cy = Math.round(centers[region * 5 + 1]);
      for (y = Math.max(0, cy - S); y < Math.min(imH, cy + S); ++y) {
        for (x = Math.max(0, cx - S); x < Math.min(imW, cx + S); ++x) {
          var spatial = (x - cx) * (x - cx) + (y - cy) * (y - cy), dR = im[y * imW + x] - centers[5 * region + 2], dG = im[imW * imH + y * imW + x] - centers[5 * region + 3], dB = im[2 * imW * imH + y * imW + x] - centers[5 * region + 4], appearance = dR * dR + dG * dG + dB * dB, distance = Math.sqrt(appearance / clusterParams[region * 2 + 0] + spatial / clusterParams[region * 2 + 1]);
          if (distance < distanceMap[y * imW + x]) {
            distanceMap[y * imW + x] = distance;
            segmentation[y * imW + x] = region;
          }
        }
      }
    }
    // Update the max distance of color and space.
    for (y = 0; y < imH; ++y) {
      for (x = 0; x < imW; ++x) {
        if (clusterParams[segmentation[y * imW + x] * 2] < mcMap[y * imW + x])
          clusterParams[segmentation[y * imW + x] * 2] = mcMap[y * imW + x];
        if (clusterParams[segmentation[y * imW + x] * 2 + 1] < msMap[y * imW + x])
          clusterParams[segmentation[y * imW + x] * 2 + 1] = msMap[y * imW + x];
      }
    }
  }
  // ...
  function computeResidualError(prevCenters, currentCenters) {
    var error = 0;
    for (var i = 0; i < prevCenters.length; ++i) {
      var d = prevCenters[i] - currentCenters[i];
      error += Math.sqrt(d * d);
    }
    return error;
  }
  // Remap label indices.
  function remapLabels(segmentation) {
    var map = {}, index = 0;
    for (var i = 0; i < segmentation.length; ++i) {
      var label = segmentation[i];
      if (map[label] === undefined)
        map[label] = index++;
      segmentation[i] = map[label];
    }
    return index;
  }
  // Encode labels in RGB.
  function encodeLabels(segmentation, data) {
    for (var i = 0; i < segmentation.length; ++i) {
      var value = Math.floor(segmentation[i]);
      data[4 * i + 0] = value & 255;
      data[4 * i + 1] = value >>> 8 & 255;
      data[4 * i + 2] = value >>> 16 & 255;
      data[4 * i + 3] = 255;
    }
  }
  // Compute SLIC Segmentation.
  function computeSLICSegmentation(imageData, regionSize, minRegionSize, maxIterations) {
    var i, imWidth = imageData.width, imHeight = imageData.height, numRegionsX = Math.floor(imWidth / regionSize), numRegionsY = Math.floor(imHeight / regionSize), numRegions = Math.floor(numRegionsX * numRegionsY), numPixels = Math.floor(imWidth * imHeight), edgeMap = new Float32Array(numPixels), masses = new Array(numPixels),
      // 2 (geometric: x & y) and 3 (RGB or Lab)
      currentCenters = new Float32Array((2 + 3) * numRegions), newCenters = new Float32Array((2 + 3) * numRegions), clusterParams = new Float32Array(2 * numRegions), mcMap = new Float32Array(numPixels), msMap = new Float32Array(numPixels), distanceMap = new Float32Array(numPixels), xyzData = rgb2xyz(imageData.data, imWidth, imHeight), labData = xyz2lab(xyzData, imWidth, imHeight);
    // Compute edge.
    computeEdge(labData, edgeMap, imWidth, imHeight);
    // Initialize K-Means Centers.
    initializeKmeansCenters(labData, edgeMap, currentCenters, clusterParams, numRegionsX, numRegionsY, regionSize, imWidth, imHeight);
    var segmentation = new Int32Array(numPixels);
    /** SLICO implementation: "SLIC Superpixels Compared to State-of-the-art
     * Superpixel Methods"
     */
    for (var iter = 0; iter < maxIterations; ++iter) {
      // Do assignment.
      assignSuperpixelLabel(labData, segmentation, mcMap, msMap, distanceMap, currentCenters, clusterParams, numRegionsX, numRegionsY, regionSize, imWidth, imHeight);
      // Update maximum spatial and color distances [1].
      updateClusterParams(segmentation, mcMap, msMap, clusterParams);
      // Compute new centers.
      for (i = 0; i < masses.length; ++i)
        masses[i] = 0;
      for (i = 0; i < newCenters.length; ++i)
        newCenters[i] = 0;
      computeCenters(labData, segmentation, masses, newCenters, numRegions, imWidth, imHeight);
      // Compute residual error of assignment.
      var error = computeResidualError(currentCenters, newCenters);
      if (error < 0.00001)
        break;
      for (i = 0; i < currentCenters.length; ++i)
        currentCenters[i] = newCenters[i];
    }
    eliminateSmallRegions(segmentation, minRegionSize, numPixels, imWidth, imHeight);
    // Refresh the canvas.
    var result = compat.createImageData(imWidth, imHeight);
    result.numSegments = remapLabels(segmentation);
    encodeLabels(segmentation, result.data);
    return result;
  }
  // function max(array) {
  //   var value = array[0];
  //   for (var i = 0; i < array.length; ++i)
  //     value = Math.max(array[i], value);
  //   return value;
  // }
  return SLIC;
}(image_segmentation_base, image_compat);
image_segmentation_slico = function (BaseSegmentation, compat) {
  function SLICO(imageData, options) {
    BaseSegmentation.call(this, imageData, options);
    this.width = this.imageData.width;
    this.height = this.imageData.height;
    options = options || {};
    this.method = options.method || 'FixedK';
    this.perturb = typeof options.perturb === 'undefined' ? true : options.perturb;
    this.maxIterations = options.maxIterations || 10;
    this.K = options.K || 1024;
    this.step = options.step || 200;
    this.enforceConnectivity = options.enforceConnectivity === false ? false : true;
    this._compute();
  }
  SLICO.prototype = Object.create(BaseSegmentation.prototype);
  SLICO.prototype.finer = function () {
    var newK = Math.min(8962, Math.round(this.K * 2));
    if (newK !== this.K) {
      this.K = newK;
      this._compute();
    }
  };
  SLICO.prototype.coarser = function () {
    var newK = Math.max(16, Math.round(this.K / 2));
    if (newK !== this.K) {
      this.K = newK;
      this._compute();
    }
  };
  SLICO.prototype._compute = function () {
    var labels = this.method === 'FixedK' ? this.performSLICOForGivenK() : this.performSLICOForGivenStepSize();
    var result = new ImageData(this.width, this.height);
    result.numSegments = remapLabels(labels);
    encodeLabels(labels, result.data);
    this.result = result;
  };
  // sRGB (D65 illuninant assumption) to XYZ conversion.
  SLICO.prototype.rgb2xyz = function (sRGB) {
    var R = parseInt(sRGB[0], 10) / 255, G = parseInt(sRGB[1], 10) / 255, B = parseInt(sRGB[2], 10) / 255, r = R <= 0.04045 ? R / 12.92 : Math.pow((R + 0.055) / 1.055, 2.4), g = G <= 0.04045 ? G / 12.92 : Math.pow((R + 0.055) / 1.055, 2.4), b = B <= 0.04045 ? B / 12.92 : Math.pow((R + 0.055) / 1.055, 2.4);
    return [
      r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
      r * 0.2126729 + g * 0.7151522 + b * 0.072175,
      r * 0.0193339 + g * 0.119192 + b * 0.9503041
    ];
  };
  // sRGB to Lab conversion.
  SLICO.prototype.rgb2lab = function (sRGB) {
    var epsilon = 0.008856,
      //actual CIE standard
      kappa = 903.3,
      //actual CIE standard
      Xr = 0.950456,
      //reference white
      Yr = 1,
      //reference white
      Zr = 1.088754,
      //reference white
      xyz = this.rgb2xyz(sRGB), xr = xyz[0] / Xr, yr = xyz[1] / Yr, zr = xyz[2] / Zr, fx = xr > epsilon ? Math.pow(xr, 1 / 3) : (kappa * xr + 16) / 116, fy = yr > epsilon ? Math.pow(yr, 1 / 3) : (kappa * yr + 16) / 116, fz = zr > epsilon ? Math.pow(zr, 1 / 3) : (kappa * zr + 16) / 116;
    return [
      116 * fy - 16,
      500 * (fx - fy),
      200 * (fy - fz)
    ];
  };
  SLICO.prototype.doRGBtoLABConversion = function (imageData) {
    var size = this.width * this.height, data = imageData.data;
    this.lvec = new Float64Array(size);
    this.avec = new Float64Array(size);
    this.bvec = new Float64Array(size);
    for (var j = 0; j < size; ++j) {
      var r = data[4 * j + 0], g = data[4 * j + 1], b = data[4 * j + 2];
      var lab = this.rgb2lab([
        r,
        g,
        b
      ]);
      this.lvec[j] = lab[0];
      this.avec[j] = lab[1];
      this.bvec[j] = lab[2];
    }
  };
  SLICO.prototype.detectLabEdges = function () {
    var w = this.width;
    this.edges = fillArray(new Float64Array(this.width * this.height), 0);
    for (var j = 1; j < this.height - 1; ++j) {
      for (var k = 1; k < this.width - 1; ++k) {
        var i = parseInt(j * this.width + k, 10), dx = Math.pow(this.lvec[i - 1] - this.lvec[i + 1], 2) + Math.pow(this.avec[i - 1] - this.avec[i + 1], 2) + Math.pow(this.bvec[i - 1] - this.bvec[i + 1], 2), dy = Math.pow(this.lvec[i - w] - this.lvec[i + w], 2) + Math.pow(this.avec[i - w] - this.avec[i + w], 2) + Math.pow(this.bvec[i - w] - this.bvec[i + w], 2);
        this.edges[i] = dx + dy;
      }
    }
  };
  SLICO.prototype.perturbSeeds = function () {
    var dx8 = [
        -1,
        -1,
        0,
        1,
        1,
        1,
        0,
        -1
      ], dy8 = [
        0,
        -1,
        -1,
        -1,
        0,
        1,
        1,
        1
      ], numSeeds = this.kSeedsL.length;
    for (var n = 0; n < numSeeds; ++n) {
      var ox = parseInt(this.kSeedsX[n], 10),
        //original x
        oy = parseInt(this.kSeedsY[n], 10),
        //original y
        oind = parseInt(oy * this.width + ox, 10), storeind = parseInt(oind, 10);
      for (var i = 0; i < 8; ++i) {
        var nx = parseInt(ox + dx8[i], 10);
        //new x
        var ny = parseInt(oy + dy8[i], 10);
        //new y
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          var nind = parseInt(ny * this.width + nx, 10);
          if (this.edges[nind] < this.edges[storeind])
            storeind = nind;
        }
      }
      if (storeind != oind) {
        this.kSeedsX[n] = Math.floor(storeind % this.width);
        this.kSeedsY[n] = Math.floor(storeind / this.width);
        this.kSeedsL[n] = this.lvec[storeind];
        this.kSeedsA[n] = this.avec[storeind];
        this.kSeedsB[n] = this.bvec[storeind];
      }
    }
  };
  SLICO.prototype.getLABXYSeedsForGivenStepSize = function (step, perturb) {
    var n = 0, xstrips = Math.round(0.5 + parseFloat(this.width) / parseFloat(step)), ystrips = Math.round(0.5 + parseFloat(this.height) / parseFloat(step)), xerr = Math.round(this.width - step * xstrips), yerr = Math.round(this.height - step * ystrips), xerrperstrip = parseFloat(xerr) / parseFloat(xstrips), yerrperstrip = parseFloat(yerr) / parseFloat(ystrips), xoff = Math.floor(step / 2), yoff = Math.floor(step / 2), numSeeds = xstrips * ystrips;
    this.kSeedsL = new Float64Array(numSeeds);
    this.kSeedsA = new Float64Array(numSeeds);
    this.kSeedsB = new Float64Array(numSeeds);
    this.kSeedsX = new Float64Array(numSeeds);
    this.kSeedsY = new Float64Array(numSeeds);
    for (var y = 0; y < ystrips; ++y) {
      var ye = Math.floor(y * yerrperstrip);
      for (var x = 0; x < xstrips; ++x) {
        var xe = Math.floor(x * xerrperstrip);
        var i = Math.floor((y * step + yoff + ye) * this.width + (x * step + xoff + xe));
        this.kSeedsL[n] = this.lvec[i];
        this.kSeedsA[n] = this.avec[i];
        this.kSeedsB[n] = this.bvec[i];
        this.kSeedsX[n] = x * step + xoff + xe;
        this.kSeedsY[n] = y * step + yoff + ye;
        ++n;
      }
    }
    if (perturb)
      this.perturbSeeds();
  };
  SLICO.prototype.getLABXYSeedsForGivenK = function (K, perturb) {
    var size = Math.floor(this.width * this.height);
    var step = Math.sqrt(parseFloat(size) / parseFloat(K));
    var xoff = Math.round(step / 2);
    var yoff = Math.round(step / 2);
    var n = 0;
    var r = 0;
    this.kSeedsL = [];
    this.kSeedsA = [];
    this.kSeedsB = [];
    this.kSeedsX = [];
    this.kSeedsY = [];
    for (var y = 0; y < this.height; ++y) {
      var Y = Math.floor(y * step + yoff);
      if (Y > this.height - 1)
        break;
      for (var x = 0; x < this.width; ++x) {
        //var X = x*step + xoff;  //square grid
        var X = Math.floor(x * step + (xoff << (r & 1)));
        //hex grid
        if (X > this.width - 1)
          break;
        var i = Math.floor(Y * this.width + X);
        this.kSeedsL.push(this.lvec[i]);
        this.kSeedsA.push(this.avec[i]);
        this.kSeedsB.push(this.bvec[i]);
        this.kSeedsX.push(X);
        this.kSeedsY.push(Y);
        ++n;
      }
      ++r;
    }
    if (perturb)
      this.perturbSeeds();
  };
  function fillArray(array, value) {
    for (var i = 0; i < array.length; ++i)
      array[i] = value;
    return array;
  }
  // function findMinMax(data) {
  //   var min = Infinity, max = -Infinity;
  //   for (var i = 0; i < data.length; ++i) {
  //     min = Math.min(min, data[i]);
  //     max = Math.max(max, data[i]);
  //   }
  //   return [min, max];
  // }
  // function sum(data) {
  //   var value = 0;
  //   for (var i = 0; i < data.length; ++i)
  //     value += data[i];
  //   return value;
  // }
  SLICO.prototype.performSuperpixelSegmentationVariableSandM = function (kLabels, step, maxIterations) {
    var size = Math.floor(this.width * this.height), numK = this.kSeedsL.length, numIter = 0, offset = Math.floor(step < 10 ? step * 1.5 : step), sigmal = fillArray(new Float64Array(numK), 0), sigmaa = fillArray(new Float64Array(numK), 0), sigmab = fillArray(new Float64Array(numK), 0), sigmax = fillArray(new Float64Array(numK), 0), sigmay = fillArray(new Float64Array(numK), 0), clusterSize = fillArray(new Int32Array(numK), 0), distxy = fillArray(new Float64Array(size), Infinity), distlab = fillArray(new Float64Array(size), Infinity), distvec = fillArray(new Float64Array(size), Infinity), maxlab = fillArray(new Float64Array(numK), Math.pow(10, 2)), maxxy = fillArray(new Float64Array(numK), Math.pow(step, 2)), i, j, k, n, x, y;
    while (numIter < maxIterations) {
      ++numIter;
      // Assign the closest cluster.
      fillArray(distvec, Infinity);
      for (n = 0; n < numK; ++n) {
        var y1 = Math.floor(Math.max(0, this.kSeedsY[n] - offset)), y2 = Math.floor(Math.min(this.height, this.kSeedsY[n] + offset)), x1 = Math.floor(Math.max(0, this.kSeedsX[n] - offset)), x2 = Math.floor(Math.min(this.width, this.kSeedsX[n] + offset));
        for (y = y1; y < y2; ++y) {
          for (x = x1; x < x2; ++x) {
            i = Math.floor(y * this.width + x);
            if (!(y < this.height && x < this.width && y >= 0 && x >= 0))
              throw 'Assertion error';
            var l = this.lvec[i], a = this.avec[i], b = this.bvec[i];
            distlab[i] = Math.pow(l - this.kSeedsL[n], 2) + Math.pow(a - this.kSeedsA[n], 2) + Math.pow(b - this.kSeedsB[n], 2);
            distxy[i] = Math.pow(x - this.kSeedsX[n], 2) + Math.pow(y - this.kSeedsY[n], 2);
            var dist = distlab[i] / maxlab[n] + distxy[i] / maxxy[n];
            if (dist < distvec[i]) {
              distvec[i] = dist;
              kLabels[i] = n;
            }
          }
        }
      }
      //console.log("iter = " + numIter + ", sum_dist = " + sum(distvec));
      // Assign the max color distance for a cluster.
      if (numIter === 0) {
        fillArray(maxlab, 1);
        fillArray(maxxy, 1);
      }
      for (i = 0; i < size; ++i) {
        if (maxlab[kLabels[i]] < distlab[i])
          maxlab[kLabels[i]] = distlab[i];
        if (maxxy[kLabels[i]] < distxy[i])
          maxxy[kLabels[i]] = distxy[i];
      }
      // Recalculate the centroid and store in the seed values.
      fillArray(sigmal, 0);
      fillArray(sigmaa, 0);
      fillArray(sigmab, 0);
      fillArray(sigmax, 0);
      fillArray(sigmay, 0);
      fillArray(clusterSize, 0);
      for (j = 0; j < size; ++j) {
        var temp = kLabels[j];
        if (temp < 0)
          throw 'Assertion error';
        sigmal[temp] += this.lvec[j];
        sigmaa[temp] += this.avec[j];
        sigmab[temp] += this.bvec[j];
        sigmax[temp] += j % this.width;
        sigmay[temp] += j / this.width;
        clusterSize[temp]++;
      }
      for (k = 0; k < numK; ++k) {
        if (clusterSize[k] <= 0)
          clusterSize[k] = 1;
        //computing inverse now to multiply, than divide later.
        var inv = 1 / clusterSize[k];
        this.kSeedsL[k] = sigmal[k] * inv;
        this.kSeedsA[k] = sigmaa[k] * inv;
        this.kSeedsB[k] = sigmab[k] * inv;
        this.kSeedsX[k] = sigmax[k] * inv;
        this.kSeedsY[k] = sigmay[k] * inv;
      }
    }
  };
  SLICO.prototype.enforceLabelConnectivity = function (labels, nlabels, K) {
    var dx4 = [
        -1,
        0,
        1,
        0
      ], dy4 = [
        0,
        -1,
        0,
        1
      ], size = this.width * this.height, SUPSZ = Math.floor(size / K), c, n, x, y, nindex;
    var label = 0, xvec = new Int32Array(size), yvec = new Int32Array(size), oindex = 0, adjlabel = 0;
    // adjacent label
    for (var j = 0; j < this.height; ++j) {
      for (var k = 0; k < this.width; ++k) {
        if (nlabels[oindex] < 0) {
          nlabels[oindex] = label;
          // Start a new segment.
          xvec[0] = k;
          yvec[0] = j;
          //  Quickly find an adjacent label for use later if needed.
          for (n = 0; n < 4; ++n) {
            x = Math.floor(xvec[0] + dx4[n]);
            y = Math.floor(yvec[0] + dy4[n]);
            if (x >= 0 && x < this.width && (y >= 0 && y < this.height)) {
              nindex = Math.floor(y * this.width + x);
              if (nlabels[nindex] >= 0)
                adjlabel = nlabels[nindex];
            }
          }
          var count = 1;
          for (c = 0; c < count; ++c) {
            for (n = 0; n < 4; ++n) {
              x = Math.floor(xvec[c] + dx4[n]);
              y = Math.floor(yvec[c] + dy4[n]);
              if (x >= 0 && x < this.width && (y >= 0 && y < this.height)) {
                nindex = Math.floor(y * this.width + x);
                if (nlabels[nindex] < 0 && labels[oindex] == labels[nindex]) {
                  xvec[count] = x;
                  yvec[count] = y;
                  nlabels[nindex] = label;
                  ++count;
                }
              }
            }
          }
          // If segment size is less then a limit, assign an
          // adjacent label found before, and decrement label count.
          if (count <= SUPSZ >> 2) {
            for (c = 0; c < count; c++) {
              var ind = Math.floor(yvec[c] * this.width + xvec[c]);
              nlabels[ind] = adjlabel;
            }
            --label;
          }
          ++label;
        }
        ++oindex;
      }
    }
    return label;
  };
  SLICO.prototype.performSLICOForGivenStepSize = function () {
    var size = this.width * this.height, kLabels = fillArray(new Int32Array(size), -1);
    this.doRGBtoLABConversion(this.imageData);
    if (this.perturb)
      this.detectLabEdges();
    this.getLABXYSeedsForGivenStepSize(this.step, this.perturb);
    this.performSuperpixelSegmentationVariableSandM(kLabels, this.step, this.maxIterations);
    var numlabels = kLabels.length;
    if (this.enforceConnectivity) {
      var nlabels = fillArray(new Int32Array(size), -1);
      numlabels = this.enforceLabelConnectivity(kLabels, nlabels, size / (this.step * this.estep));
      for (var i = 0; i < size; ++i)
        kLabels[i] = nlabels[i];
    }
    return kLabels;
  };
  SLICO.prototype.performSLICOForGivenK = function () {
    var size = this.width * this.height, kLabels = fillArray(new Int32Array(size), -1);
    this.doRGBtoLABConversion(this.imageData);
    if (this.perturb)
      this.detectLabEdges();
    this.getLABXYSeedsForGivenK(this.K, this.perturb);
    var step = Math.sqrt(size / this.K) + 2;
    this.performSuperpixelSegmentationVariableSandM(kLabels, step, this.maxIterations);
    var numlabels = kLabels.length;
    if (this.enforceConnectivity) {
      var nlabels = fillArray(new Int32Array(size), -1);
      numlabels = this.enforceLabelConnectivity(kLabels, nlabels, this.K);
      for (var i = 0; i < size; ++i)
        kLabels[i] = nlabels[i];
    }
    return kLabels;
  };
  SLICO.prototype.drawContoursAroundSegments = function (result) {
    var imageData = new ImageData(this.width, this.height), data = fillArray(imageData.data, 255), color = [
        255,
        0,
        0
      ], dx8 = [
        -1,
        -1,
        0,
        1,
        1,
        1,
        0,
        -1
      ], dy8 = [
        0,
        -1,
        -1,
        -1,
        0,
        1,
        1,
        1
      ], istaken = fillArray(new Uint8Array(this.width * this.height), 0);
    var mainindex = 0;
    for (var j = 0; j < this.height; ++j) {
      for (var k = 0; k < this.width; ++k) {
        var np = 0;
        for (var i = 0; i < 8; ++i) {
          var x = k + dx8[i], y = j + dy8[i];
          if (x >= 0 && x < this.width && (y >= 0 && y < this.height)) {
            var index = y * this.width + x;
            if (istaken[index] === 0 && result.labels[mainindex] !== result.labels[index])
              ++np;
          }
        }
        if (np > 1) {
          data[4 * mainindex + 0] = color[0];
          data[4 * mainindex + 1] = color[1];
          data[4 * mainindex + 2] = color[2];
        }
        ++mainindex;
      }
    }
    return imageData;
  };
  // Remap label indices.
  function remapLabels(labels) {
    var map = {}, index = 0;
    for (var i = 0; i < labels.length; ++i) {
      var label = labels[i];
      if (map[label] === undefined)
        map[label] = index++;
      labels[i] = map[label];
    }
    return index;
  }
  function encodeLabels(labels, data) {
    for (var i = 0; i < labels.length; ++i) {
      var label = labels[i];
      data[4 * i + 0] = 255 & label;
      data[4 * i + 1] = 255 & label >> 8;
      data[4 * i + 2] = 255 & label >> 16;
      data[4 * i + 3] = 255;
    }
  }
  return SLICO;
}(image_segmentation_base, image_compat);
image_segmentation_binary_heap_priority_queue = function () {
  function BinaryHeapPriorityQueue(options) {
    options = options || {};
    this.comparator = options.comparator || function (a, b) {
      return a - b;
    };
    this.data = options.initialValues ? options.initialValues.slice(0) : [];
    this.length = this.data.length;
    if (this.data.length > 0)
      for (var i = 1; i <= this.data.length; ++i)
        this._bubbleUp(i);
  }
  BinaryHeapPriorityQueue.prototype.push = function (value) {
    this.data.push(value);
    this.length = this.data.length;
    this._bubbleUp(this.data.length - 1);
    return this;
  };
  BinaryHeapPriorityQueue.prototype.shift = function () {
    var value = this.data[0], last = this.data.pop();
    this.length = this.data.length;
    if (this.length > 0) {
      this.data[0] = last;
      this._bubbleDown(0);
    }
    return value;
  };
  BinaryHeapPriorityQueue.prototype.peek = function () {
    return this.data[0];
  };
  BinaryHeapPriorityQueue.prototype._bubbleUp = function (i) {
    while (i > 0) {
      var parent = i - 1 >>> 1;
      if (this.comparator(this.data[i], this.data[parent]) < 0) {
        var value = this.data[parent];
        this.data[parent] = this.data[i];
        this.data[i] = value;
        i = parent;
      } else
        break;
    }
  };
  BinaryHeapPriorityQueue.prototype._bubbleDown = function (i) {
    var last = this.data.length - 1;
    while (true) {
      var left = (i << 1) + 1, right = left + 1, minIndex = i;
      if (left <= last && this.comparator(this.data[left], this.data[minIndex]) < 0)
        minIndex = left;
      if (right <= last && this.comparator(this.data[right], this.data[minIndex]) < 0)
        minIndex = right;
      if (minIndex !== i) {
        var value = this.data[minIndex];
        this.data[minIndex] = this.data[i];
        this.data[i] = value;
        i = minIndex;
      } else
        break;
    }
  };
  return BinaryHeapPriorityQueue;
}();
image_canny = function (compat) {
  function createIntensityData(width, height) {
    return {
      width: width,
      height: height,
      data: new Float32Array(width * height)
    };
  }
  function createGaussian1D(k, sigma) {
    k = k || 1;
    sigma = sigma || 1.3;
    var size = 2 * k + 1, kernel = new Float32Array(size), coeff = 1 / (2 * Math.PI * Math.pow(sigma, 2));
    for (var i = 0; i < size; ++i)
      kernel[i] = coeff * Math.exp(-Math.pow((i - k) / sigma, 2));
    return normalize(kernel);
  }
  function normalize(array) {
    var sum = 0, i;
    for (i = 0; i < array.length; ++i)
      sum += array[i];
    for (i = 0; i < array.length; ++i)
      array[i] /= sum;
    return array;
  }
  function rgb2intensity(imageData) {
    var intensity = createIntensityData(imageData.width, imageData.height), newData = intensity.data, data = imageData.data;
    for (var i = 0; i < imageData.width * imageData.height; ++i) {
      newData[i] = (data[4 * i] + data[4 * i + 1] + data[4 * i + 2]) / (3 * 255);
    }
    return intensity;
  }
  // function intensity2rgb(intensity) {
  //   var newImageData = compat.createImageData(intensity.width,
  //                                             intensity.height),
  //       data = intensity.data,
  //       newData = newImageData.data;
  //   for (var i = 0; i < data.length; ++i) {
  //     var value = Math.max(Math.min(Math.round(255 * data[i]), 255), 0);
  //     newData[4 * i] = value;
  //     newData[4 * i + 1] = value;
  //     newData[4 * i + 2] = value;
  //     newData[4 * i + 3] = 255;
  //   }
  //   return newImageData;
  // }
  function padImage(intensity, size) {
    size = size || [
      0,
      0
    ];
    if (typeof size === 'number')
      size = [
        size,
        size
      ];
    var width = intensity.width, height = intensity.height, data = intensity.data, newIntensity = createIntensityData(width + 2 * size[0], height + 2 * size[1]), newData = newIntensity.data, i, j;
    for (i = 0; i < newIntensity.height; ++i) {
      var y = i < size[1] ? size[1] - i : i >= height + size[1] ? 2 * height - size[1] + 1 - i : i - size[1];
      for (j = 0; j < newIntensity.width; ++j) {
        var x = j < size[0] ? size[0] - j : j >= width + size[0] ? 2 * width - size[0] + 1 - j : j - size[0], newOffset = i * newIntensity.width + j, oldOffset = y * width + x;
        newData[newOffset] = data[oldOffset];
      }
    }
    return newIntensity;
  }
  function filter1D(intensity, kernel, horizontal) {
    var size = Math.round((kernel.length - 1) / 2), paddedData = padImage(intensity, horizontal ? [
        size,
        0
      ] : [
        0,
        size
      ]), data = paddedData.data, width = paddedData.width, height = paddedData.height, temporaryData = new Float32Array(data.length), i, j, k, offset, value;
    if (horizontal) {
      for (i = 0; i < height; ++i) {
        for (j = size; j < width - size; ++j) {
          offset = i * width + j;
          value = kernel[size] * data[offset];
          for (k = 1; k <= size; ++k) {
            value += kernel[size + k] * data[offset + k] + kernel[size - k] * data[offset - k];
          }
          temporaryData[offset] = value;
        }
      }
    } else {
      for (i = size; i < height - size; ++i) {
        for (j = 0; j < width; ++j) {
          offset = i * width + j;
          value = kernel[size] * data[offset];
          for (k = 1; k <= size; ++k) {
            value += kernel[size + k] * data[offset + width * k] + kernel[size - k] * data[offset - width * k];
          }
          temporaryData[offset] = value;
        }
      }
    }
    paddedData.data.set(temporaryData);
    return padImage(paddedData, horizontal ? [
      -size,
      0
    ] : [
      0,
      -size
    ]);
  }
  function filter1DTwice(intensity, kernel) {
    return filter1D(filter1D(intensity, kernel, true), kernel, false);
  }
  function detectEdges(intensity, options) {
    var width = intensity.width, height = intensity.height, magnitude = new Float32Array(intensity.data.length), orientation = new Float32Array(intensity.data.length), suppressed = new Float32Array(intensity.data.length), result = createIntensityData(width, height), SobelKernel = [
        -1,
        0,
        1
      ], dx = filter1D(intensity, SobelKernel, true), dy = filter1D(intensity, SobelKernel, false), i, j, direction, offset, offset1, offset2;
    for (i = 0; i < intensity.data.length; ++i) {
      magnitude[i] = Math.sqrt(Math.pow(dx.data[i], 2) + Math.pow(dy.data[i], 2));
      direction = Math.atan2(dy.data[i], dx.data[i]);
      orientation[i] = direction < 0 ? direction + Math.PI : direction > Math.PI ? direction - Math.PI : direction;
    }
    // NMS.
    for (i = 1; i < height - 1; ++i) {
      for (j = 1; j < width - 1; ++j) {
        offset = i * width + j;
        direction = orientation[offset];
        if (direction < Math.PI / 8 || 7 * Math.PI / 8 <= direction) {
          offset1 = offset - 1;
          offset2 = offset + 1;
        } else if (Math.PI / 8 <= direction && direction < 3 * Math.PI / 8) {
          offset1 = offset - width - 1;
          offset2 = offset + width + 1;
        } else if (3 * Math.PI / 8 <= direction && direction < 5 * Math.PI / 8) {
          offset1 = offset - width;
          offset2 = offset + width;
        } else if (5 * Math.PI / 8 <= direction && direction < 7 * Math.PI / 8) {
          offset1 = offset - width + 1;
          offset2 = offset + width - 1;
        }
        suppressed[offset] = magnitude[offset] > magnitude[offset1] && magnitude[offset] > magnitude[offset2] ? magnitude[offset] : 0;
      }
    }
    // Hysteresis.
    for (i = 1; i < height - 1; ++i) {
      for (j = 1; j < width - 1; ++j) {
        offset = i * width + j;
        direction = orientation[offset] - 0.5 * Math.PI;
        direction = direction < 0 ? direction + Math.PI : direction;
        if (direction < Math.PI / 8 || 7 * Math.PI / 8 <= direction) {
          offset1 = offset - 1;
          offset2 = offset + 1;
        } else if (Math.PI / 8 <= direction && direction < 3 * Math.PI / 8) {
          offset1 = offset - width - 1;
          offset2 = offset + width + 1;
        } else if (3 * Math.PI / 8 <= direction && direction < 5 * Math.PI / 8) {
          offset1 = offset - width;
          offset2 = offset + width;
        } else if (5 * Math.PI / 8 <= direction && direction < 7 * Math.PI / 8) {
          offset1 = offset - width + 1;
          offset2 = offset + width - 1;
        }
        result.data[offset] = suppressed[offset] >= options.highThreshold || suppressed[offset] >= options.lowThreshold && suppressed[offset1] >= options.highThreshold || suppressed[offset] >= options.lowThreshold && suppressed[offset2] >= options.highThreshold ? suppressed[offset] : 0;
      }
    }
    result.magnitude = magnitude;
    return result;
  }
  function canny(imageData, options) {
    options = options || {};
    options.kernelTail = options.kernelTail || 4;
    options.sigma = options.sigma || 1.6;
    options.highThreshold = options.highThreshold || 0.04;
    options.lowThreshold = options.lowThreshold || 0.3 * options.highThreshold;
    var intensity = rgb2intensity(imageData);
    var gaussianKernel = createGaussian1D(options.kernelTail, options.sigma);
    var blurredData = filter1DTwice(intensity, gaussianKernel);
    var edge = detectEdges(blurredData, options);
    return edge;
  }
  return canny;
}(image_compat);
image_distance_transform = function (compat) {
  var INF = 100000000000000000000;
  function distanceTransform1D(f, n) {
    var d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1), k = 0, square = function (x) {
        return x * x;
      }, q;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (q = 1; q <= n - 1; ++q) {
      var s = (f[q] + square(q) - (f[v[k]] + square(v[k]))) / (2 * q - 2 * v[k]);
      if (isNaN(s))
        throw 'NaN error';
      while (s <= z[k]) {
        --k;
        s = (f[q] + square(q) - (f[v[k]] + square(v[k]))) / (2 * q - 2 * v[k]);
        if (isNaN(s))
          throw 'NaN error';
      }
      ++k;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (q = 0; q <= n - 1; ++q) {
      while (z[k + 1] < q)
        k++;
      d[q] = square(q - v[k]) + f[v[k]];
    }
    return d;
  }
  function distanceTransform2D(distanceMap) {
    var width = distanceMap.width, height = distanceMap.height, data = distanceMap.data, f = new Float32Array(Math.max(width, height)), x, y, d;
    // Column transform.
    for (x = 0; x < width; ++x) {
      for (y = 0; y < height; ++y)
        f[y] = data[y * width + x];
      d = distanceTransform1D(f, height);
      for (y = 0; y < height; ++y)
        data[y * width + x] = d[y];
    }
    // Row transform.
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x)
        f[x] = data[y * width + x];
      d = distanceTransform1D(f, width);
      for (x = 0; x < width; ++x)
        data[y * width + x] = d[x];
    }
    // Sqrt.
    for (x = 0; x < data.length; ++x)
      data[x] = Math.sqrt(data[x]);
  }
  function distanceTransform(intensity, options) {
    options = options || {};
    var distanceMap = {
      width: intensity.width,
      height: intensity.height,
      data: new Float32Array(intensity.data.length)
    };
    for (var offset = 0; offset < distanceMap.data.length; ++offset)
      distanceMap.data[offset] = intensity.data[offset] ? 0 : INF;
    distanceTransform2D(distanceMap);
    //if (options.outputRGB)
    //  distanceMap = intensity2rgb(distanceMap);
    return distanceMap;
  }
  // For debugging.
  // function intensity2rgb(intensity) {
  //   var newImageData = compat.createImageData(intensity.width,
  //                                             intensity.height),
  //       data = intensity.data,
  //       newData = newImageData.data;
  //   for (var i = 0; i < data.length; ++i) {
  //     var value = Math.round(data[i]);
  //     newData[4 * i] = 255 & value;
  //     newData[4 * i + 1] = 255 & (value >> 8);
  //     newData[4 * i + 2] = 255 & (value >> 16);
  //     newData[4 * i + 3] = 255;
  //   }
  //   return newImageData;
  // }
  return distanceTransform;
}(image_compat);
image_segmentation_watershed = function (BaseSegmentation, PriorityQueue, canny, compat, distanceTransform) {
  // Constructor for the segmentation configuration.
  function WatershedSegmentation(imageData, options) {
    BaseSegmentation.call(this, imageData, options);
    options = options || {};
    this.sigmaRange = options.sigmaRange || [
      -2,
      -1,
      0,
      0.5,
      1,
      2,
      3
    ].map(function (n) {
      return Math.pow(2, n);
    });
    this.kernelRange = options.kernelRange || [
      2,
      3,
      4,
      4,
      4,
      5,
      6
    ];
    this.currentConfig = options.currentConfig || Math.floor((this.sigmaRange.length - 1) / 2);
    this.minRegionSize = options.minRegionSize || 16;
    this.highThreshold = options.highThreshold || 0.04;
    this.lowThreshold = options.lowThreshold || 0.3 * options.highThreshold;
    if (this.sigmaRange.length <= 0)
      throw 'Invalid sigma range';
    this.neighborMap8 = new NeighborMap(this.imageData.width, this.imageData.height);
    this.neighborMap4 = new NeighborMap(this.imageData.width, this.imageData.height, [
      [
        -1,
        -1
      ],
      [
        -1,
        0
      ],
      [
        -1,
        1
      ],
      [
        0,
        -1
      ]
    ]);
    this._compute();
  }
  WatershedSegmentation.prototype = Object.create(BaseSegmentation.prototype);
  // Change the segmentation resolution.
  WatershedSegmentation.prototype.finer = function () {
    if (this.currentConfig > 0) {
      --this.currentConfig;
      if (this.imageData)
        this._compute();
    }
  };
  // Change the segmentation resolution.
  WatershedSegmentation.prototype.coarser = function () {
    if (this.currentConfig < this.sigmaRange.length - 1) {
      ++this.currentConfig;
      if (this.imageData)
        this._compute();
    }
  };
  // Compute canny-watershed segmentation.
  WatershedSegmentation.prototype._compute = function () {
    var queue = new PriorityQueue({
      comparator: function (a, b) {
        return a[0] - b[0];
      }
    });
    var edge = canny(this.imageData, {
      kernelTail: this.kernelRange[this.currentConfig],
      sigma: this.sigmaRange[this.currentConfig],
      lowThreshold: this.lowThreshold,
      highThreshold: this.highThreshold
    });
    var seeds = this._findLocalMaxima(distanceTransform(edge));
    var labels = new Int32Array(edge.data.length);
    var i, j, offset, neighbors, neighborOffset;
    // Initialize.
    for (i = 0; i < labels.length; ++i)
      labels[i] = -1;
    for (i = 0; i < seeds.length; ++i)
      labels[seeds[i]] = i + 1;
    for (i = 0; i < seeds.length; ++i) {
      neighbors = this.neighborMap8.get(seeds[i]);
      for (j = 0; j < neighbors.length; ++j) {
        neighborOffset = neighbors[j];
        if (labels[neighborOffset] === -1) {
          queue.push([
            edge.magnitude[neighborOffset],
            neighborOffset
          ]);
          labels[neighborOffset] = -2;
        }
      }
    }
    // Iterate until we label all pixels by non-border dilation.
    var iter = 0;
    while (queue.length > 0) {
      offset = queue.shift()[1];
      neighbors = this.neighborMap8.get(offset);
      var uniqueLabel = this._findUniqueRegionLabel(neighbors, labels);
      if (uniqueLabel) {
        // Dilate when there is a unique region label.
        labels[offset] = uniqueLabel;
        for (i = 0; i < neighbors.length; ++i) {
          neighborOffset = neighbors[i];
          if (labels[neighborOffset] === -1) {
            labels[neighborOffset] = -2;
            queue.push([
              edge.magnitude[neighborOffset],
              neighborOffset
            ]);
          }
        }
      } else
        labels[offset] = 0;
      // Boundary.
      if (++iter > labels.length)
        throw 'Too many iterations';
    }
    // Remove boundaries and small regions.
    this.erode(0, labels);
    this._removeSmallRegions(labels);
    var numSegments = this._relabel(labels);
    this.result = this._encodeLabels(labels);
    this.result.numSegments = numSegments;
  };
  // Find the local maxima.
  WatershedSegmentation.prototype._findLocalMaxima = function (intensity) {
    var data = intensity.data, maximaMap = new Uint8Array(data.length), offsets = [], k, offset, neighbors, flag;
    for (offset = 0; offset < data.length; ++offset) {
      neighbors = this.neighborMap8.get(offset);
      flag = true;
      for (k = 0; k < neighbors.length; ++k)
        flag = flag && data[offset] >= data[neighbors[k]];
      maximaMap[offset] = flag;
    }
    // Erase connected seeds.
    var suppressed = new Uint8Array(maximaMap.length);
    for (offset = 0; offset < data.length; ++offset) {
      neighbors = this.neighborMap4.get(offset);
      flag = true;
      for (k = 0; k < neighbors.length; ++k)
        flag = flag && maximaMap[offset] > maximaMap[neighbors[k]];
      suppressed[offset] = flag;
    }
    for (offset = 0; offset < suppressed.length; ++offset)
      if (suppressed[offset])
        offsets.push(offset);
    return offsets;
  };
  WatershedSegmentation.prototype._findUniqueRegionLabel = function (neighbors, labels) {
    var uniqueLabels = [];
    for (var i = 0; i < neighbors.length; ++i) {
      var label = labels[neighbors[i]];
      if (label > 0 && uniqueLabels.indexOf(label) < 0)
        uniqueLabels.push(label);
    }
    return uniqueLabels.length === 1 ? uniqueLabels[0] : null;
  };
  WatershedSegmentation.prototype._findDominantLabel = function (neighbors, labels, target) {
    var histogram = {}, label;
    for (var i = 0; i < neighbors.length; ++i) {
      label = labels[neighbors[i]];
      if (label !== target) {
        if (histogram[label])
          ++histogram[label];
        else
          histogram[label] = 1;
      }
    }
    var count = 0, dominantLabel = null;
    for (label in histogram) {
      if (histogram[label] > count) {
        dominantLabel = label;
        count = histogram[label];
      }
    }
    return dominantLabel;
  };
  // Greedy erode.
  WatershedSegmentation.prototype.erode = function (target, labels) {
    var offsets = [], updates = {}, offset;
    for (offset = 0; offset < labels.length; ++offset)
      if (labels[offset] === target)
        offsets.push(offset);
    if (target !== 0 && offsets.length === 0)
      throw 'No pixels for label ' + target;
    updates[target] = 0;
    var iter = 0;
    while (offsets.length > 0) {
      offset = offsets.shift();
      var neighbors = this.neighborMap8.get(offset), dominantLabel = this._findDominantLabel(neighbors, labels, target);
      if (dominantLabel !== null) {
        labels[offset] = dominantLabel;
        if (updates[dominantLabel])
          ++updates[dominantLabel];
        else
          updates[dominantLabel] = 1;
        --updates[target];
      } else
        offsets.push(offset);
      if (++iter > labels.length)
        throw 'Too many iterations for label ' + target;
    }
    return updates;
  };
  // Find small item.
  WatershedSegmentation.prototype._findSmallLabel = function (histogram) {
    var smallLabel = null;
    for (var label in histogram) {
      var count = histogram[label];
      if (0 < count && count < this.minRegionSize) {
        smallLabel = parseInt(label, 10);
        break;
      }
    }
    return smallLabel;
  };
  // Remove small regions.
  WatershedSegmentation.prototype._removeSmallRegions = function (labels) {
    var histogram = {}, offset, label, updates;
    for (offset = 0; offset < labels.length; ++offset) {
      label = labels[offset];
      if (histogram[label])
        ++histogram[label];
      else
        histogram[label] = 1;
    }
    var iter = 0;
    while (true) {
      var smallLabel = this._findSmallLabel(histogram);
      if (smallLabel !== null) {
        updates = this.erode(smallLabel, labels);
        for (label in updates)
          histogram[label] += updates[label];
      } else
        break;
      if (++iter >= Object.keys(histogram).length)
        throw 'Too many iterations';
    }
  };
  WatershedSegmentation.prototype._relabel = function (labels) {
    var uniqueArray = [];
    for (var i = 0; i < labels.length; ++i) {
      var index = uniqueArray.indexOf(labels[i]);
      if (index < 0) {
        index = uniqueArray.length;
        uniqueArray.push(labels[i]);
      }
      labels[i] = index;
    }
    return uniqueArray.length;
  };
  // Encode segmentation.
  WatershedSegmentation.prototype._encodeLabels = function (labels) {
    var imageData = new ImageData(this.imageData.width, this.imageData.height), data = imageData.data;
    for (var i = 0; i < labels.length; ++i) {
      var value = labels[i];
      data[4 * i] = 255 & value;
      data[4 * i + 1] = 255 & value >> 8;
      data[4 * i + 2] = 255 & value >> 16;
      data[4 * i + 3] = 255;
    }
    return imageData;
  };
  // Neighbor Map.
  function NeighborMap(width, height, neighbors) {
    this.neighbors = neighbors || [
      [
        -1,
        -1
      ],
      [
        -1,
        0
      ],
      [
        -1,
        1
      ],
      [
        0,
        -1
      ],
      [
        0,
        1
      ],
      [
        1,
        -1
      ],
      [
        1,
        0
      ],
      [
        1,
        1
      ]
    ];
    this.maps = [];
    for (var k = 0; k < this.neighbors.length; ++k) {
      var dy = this.neighbors[k][0], dx = this.neighbors[k][1], map = new Int32Array(width * height);
      for (var y = 0; y < height; ++y) {
        for (var x = 0; x < width; ++x) {
          var Y = y + dy, X = x + dx;
          map[y * width + x] = Y < 0 || height <= Y || X < 0 || width <= X ? -1 : Y * width + X;
        }
      }
      this.maps.push(map);
    }
  }
  NeighborMap.prototype.get = function (offset) {
    var neighborOffsets = [];
    for (var k = 0; k < this.neighbors.length; ++k) {
      var neighborOffset = this.maps[k][offset];
      if (neighborOffset >= 0)
        neighborOffsets.push(neighborOffset);
    }
    return neighborOffsets;
  };
  return WatershedSegmentation;
}(image_segmentation_base, image_segmentation_binary_heap_priority_queue, image_canny, image_compat, image_distance_transform);
image_segmentation = function (pff, slic, slico, watershed) {
  var methods = {
    pff: pff,
    slic: slic,
    slico: slico,
    watershed: watershed
  };
  methods.create = function (imageData, options) {
    options = options || {};
    options.method = options.method || 'slic';
    if (!methods[options.method])
      throw 'Invalid method: ' + options.method;
    return new methods[options.method](imageData, options);
  };
  return methods;
}(image_segmentation_pff, image_segmentation_slic, image_segmentation_slico, image_segmentation_watershed);
image_morph_neighbor_map = function () {
  // Neighbor Map.
  function NeighborMap(width, height, neighbors) {
    this.neighbors = neighbors || [
      [
        -1,
        -1
      ],
      [
        -1,
        0
      ],
      [
        -1,
        1
      ],
      [
        0,
        -1
      ],
      [
        0,
        1
      ],
      [
        1,
        -1
      ],
      [
        1,
        0
      ],
      [
        1,
        1
      ]
    ];
    this.maps = [];
    for (var k = 0; k < this.neighbors.length; ++k) {
      var dy = this.neighbors[k][0], dx = this.neighbors[k][1], map = new Int32Array(width * height);
      for (var y = 0; y < height; ++y) {
        for (var x = 0; x < width; ++x) {
          var Y = y + dy, X = x + dx;
          map[y * width + x] = Y < 0 || height <= Y || X < 0 || width <= X ? -1 : Y * width + X;
        }
      }
      this.maps.push(map);
    }
  }
  NeighborMap.prototype.get = function (offset) {
    var neighborOffsets = [];
    for (var k = 0; k < this.neighbors.length; ++k) {
      var neighborOffset = this.maps[k][offset];
      if (neighborOffset >= 0)
        neighborOffsets.push(neighborOffset);
    }
    return neighborOffsets;
  };
  return NeighborMap;
}();
image_morph_max_filter = function (NeighborMap) {
  function findDominantLabel(data, neighbors) {
    var histogram = {}, i, label;
    for (i = 0; i < neighbors.length; ++i) {
      label = data[neighbors[i]];
      if (histogram[label])
        ++histogram[label];
      else
        histogram[label] = 1;
    }
    var labels = Object.keys(histogram), count = 0, dominantLabel = null;
    for (i = 0; i < labels.length; ++i) {
      label = labels[i];
      if (histogram[label] > count) {
        dominantLabel = parseInt(label, 10);
        count = histogram[label];
      }
    }
    return dominantLabel;
  }
  function maxFilter(indexImage, options) {
    options = options || {};
    var neighbors = options.neighbors || [
        [
          -1,
          -1
        ],
        [
          -1,
          0
        ],
        [
          -1,
          1
        ],
        [
          0,
          -1
        ],
        [
          0,
          0
        ],
        [
          0,
          1
        ],
        [
          1,
          -1
        ],
        [
          1,
          0
        ],
        [
          1,
          1
        ]
      ], result = new Int32Array(indexImage.data.length), neighborMap = new NeighborMap(indexImage.width, indexImage.height, neighbors);
    for (var i = 0; i < indexImage.data.length; ++i)
      result[i] = findDominantLabel(indexImage.data, neighborMap.get(i));
    return {
      width: indexImage.width,
      height: indexImage.height,
      data: result
    };
  }
  return maxFilter;
}(image_morph_neighbor_map);
image_morph = function (compat, maxFilter) {
  function decodeIndexImage(imageData) {
    var indexImage = {
      width: imageData.width,
      height: imageData.height,
      data: new Int32Array(imageData.width * imageData.height)
    };
    for (var i = 0; i < imageData.data.length; ++i) {
      var offset = 4 * i;
      indexImage.data[i] = imageData.data[offset + 0] | imageData.data[offset + 1] << 8 | imageData.data[offset + 2] << 16;
    }
    return indexImage;
  }
  function encodeIndexImage(indexImage) {
    var imageData = compat.createImageData(indexImage.width, indexImage.height);
    for (var i = 0; i < indexImage.length; ++i) {
      var offset = 4 * i, value = indexImage.data[i];
      imageData.data[offset] = 255 & value;
      imageData.data[offset + 1] = 255 & value >>> 8;
      imageData.data[offset + 2] = 255 & value >>> 16;
      imageData.data[offset + 3] = 255;
    }
    return imageData;
  }
  return {
    encodeIndexImage: encodeIndexImage,
    decodeIndexImage: decodeIndexImage,
    maxFilter: maxFilter
  };
}(image_compat, image_morph_max_filter);
helper_segment_annotator = function (Layer, segmentation, morph) {
  // Segment annotator.
  function Annotator(imageURL, options) {
    options = options || {};
    if (typeof imageURL !== 'string') {
      throw 'Invalid imageURL';
    }
    this.colormap = options.colormap || [
      [
        255,
        255,
        255
      ],
      [
        255,
        0,
        0
      ]
    ];
    this.boundaryColor = options.boundaryColor || [
      255,
      255,
      255
    ];
    this.boundaryAlpha = options.boundaryAlpha || 127;
    this.visualizationAlpha = options.visualizationAlpha || 144;
    this.highlightAlpha = options.highlightAlpha || Math.min(255, this.visualizationAlpha + 128);
    this.currentZoom = 1;
    this.defaultLabel = options.defaultLabel || 0;
    this.maxHistoryRecord = options.maxHistoryRecord || 10;
    this.onchange = options.onchange || null;
    this.onrightclick = options.onrightclick || null;
    this.onleftclick = options.onleftclick || null;
    this.onhighlight = options.onhighlight || null;
    this.onmousemove = options.onmousemove || null;
    this._createLayers(options);
    this._initializeHistory(options);
    this._createLayers(options);
    this._initializeHistory(options);
    this.mode = 'superpixel';
    this.polygonPoints = [];
    this.prevAnnotationImg = null;
    var annotator = this;
    this.layers.image.load(imageURL, {
      width: options.width,
      height: options.height,
      onload: function () {
        annotator._initialize(options);
      },
      onerror: options.onerror
    });
  }
  // Run superpixel segmentation.
  Annotator.prototype.resetSuperpixels = function (options) {
    options = options || {};
    this.layers.superpixel.copy(this.layers.image);
    this.segmentation = segmentation.create(this.layers.image.imageData, options);
    this._updateSuperpixels(options);
    return this;
  };
  // Adjust the superpixel resolution.
  Annotator.prototype.finer = function (options) {
    this.segmentation.finer();
    this._updateSuperpixels(options);
    return this;
  };
  // Adjust the superpixel resolution.
  Annotator.prototype.coarser = function (options) {
    this.segmentation.coarser();
    this._updateSuperpixels(options);
    return this;
  };
  // Undo the edit.
  Annotator.prototype.undo = function () {
    if (this.currentHistoryRecord < 0)
      return false;
    var record = this.history[this.currentHistoryRecord--];
    this._fillPixels(record.pixels, record.prev);
    this.layers.visualization.render();
    if (typeof this.onchange === 'function')
      this.onchange.call(this);
    return this.currentHistoryRecord < 0;
  };
  // Redo the edit.
  Annotator.prototype.redo = function () {
    if (this.currentHistoryRecord >= this.history.length - 1)
      return false;
    var record = this.history[++this.currentHistoryRecord];
    this._fillPixels(record.pixels, record.next);
    this.layers.visualization.render();
    if (typeof this.onchange === 'function')
      this.onchange.call(this);
    return this.currentHistoryRecord >= this.history.length;
  };
  // Get unique labels in the current annotation.
  Annotator.prototype.getUniqueLabels = function () {
    var uniqueIndex = [], data = this.layers.annotation.imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      var label = _getEncodedLabel(data, i);
      if (uniqueIndex.indexOf(label) < 0) {
        uniqueIndex.push(label);
      }
    }
    return uniqueIndex.sort(function (a, b) {
      return a - b;
    });
  };
  // Fill all the pixels assigned the target label or all.
  Annotator.prototype.fill = function (targetLabel) {
    var pixels = [], annotationData = this.layers.annotation.imageData.data;
    for (var i = 0; i < annotationData.length; i += 4) {
      var label = _getEncodedLabel(annotationData, i);
      if (label === targetLabel || targetLabel === undefined)
        pixels.push(i);
    }
    if (pixels.length > 0)
      this._updateAnnotation(pixels, this.currentLabel);
    return this;
  };
  Annotator.prototype.setAlpha = function (alpha) {
    this.visualizationAlpha = Math.max(Math.min(alpha, 255), 0);
    this.layers.visualization.setAlpha(this.visualizationAlpha).render();
    return this;
  };
  Annotator.prototype.lessAlpha = function (scale) {
    return this.setAlpha(this.visualizationAlpha - (scale || 1) * 20);
  };
  Annotator.prototype.moreAlpha = function (scale) {
    return this.setAlpha(this.visualizationAlpha + (scale || 1) * 20);
  };
  // Import an existing annotation.
  Annotator.prototype.import = function (annotationURL, options) {
    options = options || {};
    var annotator = this;
    this.layers.annotation.load(annotationURL, {
      onload: function () {
        if (options.grayscale)
          this.gray2index();
        annotator.layers.visualization.copy(this).applyColormap(annotator.colormap).setAlpha(annotator.visualizationAlpha).render();
        this.setAlpha(0).render();
        this.history = [];
        this.currentHistoryRecord = -1;
        if (typeof options.onload === 'function')
          options.onload.call(annotator);
        if (typeof annotator.onchange === 'function')
          annotator.onchange.call(annotator);
      },
      onerror: options.onerror
    });
    return this;
  };
  // Export the annotation in data URL.
  Annotator.prototype.export = function () {
    this.layers.annotation.setAlpha(255);
    this.layers.annotation.render();
    var data = this.layers.annotation.canvas.toDataURL();
    this.layers.annotation.setAlpha(0);
    this.layers.annotation.render();
    return data;
  };
  // Show a specified layer.
  Annotator.prototype.show = function (layer) {
    this.layers[layer].canvas.style.display = 'inline-block';
    return this;
  };
  // Hide a specified layer.
  Annotator.prototype.hide = function (layer) {
    this.layers[layer].canvas.style.display = 'none';
    return this;
  };
  // Highlight a specified label.
  Annotator.prototype.highlightLabel = function (label) {
    var pixels = [], annotationData = this.layers.annotation.imageData.data;
    for (var i = 0; i < annotationData.length; i += 4) {
      var currentLabel = _getEncodedLabel(annotationData, i);
      if (currentLabel === label)
        pixels.push(i);
    }
    this._updateHighlight(pixels);
    return this;
  };
  // Disable highlight.
  Annotator.prototype.unhighlightLabel = function () {
    this._updateHighlight(null);
    return this;
  };
  // Zoom to specific resolution.
  Annotator.prototype.zoom = function (scale) {
    this.currentZoom = Math.max(Math.min(scale || 1, 10), 1);
    this.innerContainer.style.zoom = this.currentZoom;
    this.innerContainer.style.MozTransform = 'scale(' + this.currentZoom + ')';
    return this;
  };
  // Zoom in.
  Annotator.prototype.zoomIn = function (scale) {
    return this.zoom(this.currentZoom + (scale || 0.25));
  };
  // Zoom out.
  Annotator.prototype.zoomOut = function (scale) {
    return this.zoom(this.currentZoom - (scale || 0.25));
  };
  // // Align the current annotation to the boundary of superpixels.
  // Annotator.prototype.alignBoundary = function () {
  //   var annotationData = this.layers.annotation.imageData.data;
  //   for (var i = 0; i < this.pixelIndex.length; ++i) {
  //     var pixels = this.pixelIndex[i],
  //         label = _findMostFrequent(annotationData, pixels);
  //     this._fillPixels(pixels, label);
  //   }
  //   this.layers.visualization.render();
  //   this.history = [];
  //   this.currentHistoryRecord = 0;
  // };
  Annotator.prototype.denoise = function () {
    var indexImage = morph.decodeIndexImage(this.layers.annotation.imageData), result = morph.maxFilter(indexImage);
    var pixels = new Int32Array(result.data.length);
    for (var i = 0; i < pixels.length; ++i)
      pixels[i] = 4 * i;
    this._updateAnnotation(pixels, result.data);
    return this;
  };
  // Private methods.
  Annotator.prototype._createLayers = function (options) {
    var onload = options.onload;
    delete options.onload;
    this.container = document.createElement('div');
    this.container.classList.add('segment-annotator-outer-container');
    this.innerContainer = document.createElement('div');
    this.innerContainer.classList.add('segment-annotator-inner-container');
    this.layers = {
      image: new Layer(options),
      superpixel: new Layer(options),
      visualization: new Layer(options),
      boundary: new Layer(options),
      annotation: new Layer(options)
    };
    options.onload = onload;
    for (var key in this.layers) {
      var canvas = this.layers[key].canvas;
      canvas.classList.add('segment-annotator-layer');
      this.innerContainer.appendChild(canvas);
    }
    this.container.appendChild(this.innerContainer);
    this._resizeLayers(options);
  };
  Annotator.prototype._resizeLayers = function (options) {
    this.width = options.width || this.layers.image.canvas.width;
    this.height = options.height || this.layers.image.canvas.height;
    for (var key in this.layers) {
      if (key !== 'image') {
        var canvas = this.layers[key].canvas;
        canvas.width = this.width;
        canvas.height = this.height;
      }
    }
    this.innerContainer.style.width = this.width + 'px';
    this.innerContainer.style.height = this.height + 'px';
    this.container.style.width = this.width + 'px';
    this.container.style.height = this.height + 'px';
  };
  Annotator.prototype._initializeHistory = function (options) {
    this.history = [];
    this.currentHistoryRecord = -1;
  };
  Annotator.prototype._initialize = function (options) {
    options = options || {};
    if (!options.width)
      this._resizeLayers(options);
    this._initializeAnnotationLayer();
    this._initializeVisualizationLayer();
    this._initializeEvents();
    this.resetSuperpixels(options.superpixelOptions);
    if (typeof options.onload === 'function')
      options.onload.call(this);
    if (typeof this.onchange === 'function')
      this.onchange.call(this);
  };
  Annotator.prototype._initializeEvents = function () {
    var canvas = this.layers.annotation.canvas, mousestate = {
        down: false,
        button: 0
      }, annotator = this;
    canvas.oncontextmenu = function () {
      return false;
    };
    function updateIfActive(event) {
      var offset = annotator._getClickOffset(event), superpixelData = annotator.layers.superpixel.imageData.data, annotationData = annotator.layers.annotation.imageData.data, superpixelIndex = _getEncodedLabel(superpixelData, offset), pixels = annotator.pixelIndex[superpixelIndex], existingLabel = _getEncodedLabel(annotationData, offset);
      if (annotator.mode === 'superpixel')
        annotator._updateHighlight(pixels);
      if (typeof annotator.onmousemove === 'function')
        annotator.onmousemove.call(annotator, existingLabel);
      if (mousestate.down) {
        if (mousestate.button == 2 && typeof annotator.onrightclick === 'function') {
          if (annotator.mode === 'polygon')
            annotator._emptyPolygonPoints();  //reset
          else
            annotator.onrightclick.call(annotator, existingLabel);
        } else {
          if (annotator.mode === 'brush' && event.button === 0) {
            annotator.brush(annotator._getClickPos(event), annotator.currentLabel);
          }
          if (event.button === 0 && annotator.mode === 'polygon') {
            annotator._addPolygonPoint(event);
            if (annotator._checkLineIntersection())
              annotator._addPolygonToAnnotation();
          } else if (annotator.mode === 'superpixel') {
            annotator._updateAnnotation(pixels, annotator.currentLabel);
          }
          if (typeof annotator.onleftclick === 'function')
            annotator.onleftclick.call(annotator, annotator.currentLabel);
        }
      }
    }
    canvas.addEventListener('mousemove', updateIfActive);
    canvas.addEventListener('mouseup', updateIfActive);
    canvas.addEventListener('mouseleave', function () {
      annotator._updateHighlight(null);
      if (typeof annotator.onmousemove === 'function') {
        annotator.onmousemove.call(annotator, null);
      }
    });
    canvas.addEventListener('mousedown', function (event) {
      mousestate.down = true;
      mousestate.button = event.button;
    });
    window.addEventListener('mouseup', function () {
      mousestate.down = false;
    });
    //polygon on/off with ctrl-key
    window.onkeyup = function (e) {
      var key = e.keyCode ? e.keyCode : e.which;
      if (key == 17) {
        if (annotator.mode == 'polygon') {
          annotator.mode = 'superpixel';
        } else {
          annotator.mode = 'polygon';
          annotator._updateHighlight(null);
        }
        annotator._emptyPolygonPoints();
      }
    };
  };
  Annotator.prototype._updateBoundaryLayer = function () {
    var boundaryLayer = this.layers.boundary;
    boundaryLayer.copy(this.layers.superpixel);
    boundaryLayer.computeEdgemap({
      foreground: this.boundaryColor.concat(this.boundaryAlpha),
      background: this.boundaryColor.concat(0)
    });
    boundaryLayer.render();
  };
  Annotator.prototype._initializeAnnotationLayer = function () {
    var layer = this.layers.annotation;
    layer.resize(this.width, this.height);
    this.currentLabel = this.defaultLabel;
    layer.fill([
      this.defaultLabel,
      0,
      0,
      0
    ]);
    layer.render();
  };
  Annotator.prototype._initializeVisualizationLayer = function () {
    var layer = this.layers.visualization;
    layer.resize(this.width, this.height);
    var initialColor = this.colormap[this.defaultLabel].concat([this.visualizationAlpha]);
    layer.fill(initialColor);
    layer.render();
  };
  Annotator.prototype._updateSuperpixels = function () {
    var annotator = this;
    this.layers.superpixel.process(function (imageData) {
      imageData.data.set(annotator.segmentation.result.data);
      annotator._createPixelIndex(annotator.segmentation.result.numSegments);
      annotator._updateBoundaryLayer();
      this.setAlpha(0).render();
    });
  };
  Annotator.prototype._createPixelIndex = function (numSegments) {
    var pixelIndex = new Array(numSegments), data = this.layers.superpixel.imageData.data, i;
    for (i = 0; i < numSegments; ++i)
      pixelIndex[i] = [];
    for (i = 0; i < data.length; i += 4) {
      var index = data[i] | data[i + 1] << 8 | data[i + 2] << 16;
      pixelIndex[index].push(i);
    }
    this.currentPixels = null;
    this.pixelIndex = pixelIndex;
  };
  Annotator.prototype._getClickOffset = function (event) {
    var pos = this._getClickPos(event), x = pos[0], y = pos[1];
    return 4 * (y * this.layers.visualization.canvas.width + x);
  };
  Annotator.prototype._getClickPos = function (event) {
    var container = this.container, containerRect = container.getBoundingClientRect(), win = window, docElem = document.documentElement, offsetLeft = containerRect.left + (win.pageXOffset || docElem.scrollLeft) - (docElem.clientLeft || 0), offsetTop = containerRect.top + (win.pageYOffset || docElem.scrollTop) - (docElem.clientTop || 0), x = Math.round((event.pageX - offsetLeft + container.scrollLeft) * (container.offsetWidth / container.scrollWidth)), y = Math.round((event.pageY - offsetTop + container.scrollTop) * (container.offsetHeight / container.scrollHeight)), x = Math.max(Math.min(x, this.layers.visualization.canvas.width - 1), 0);
    y = Math.max(Math.min(y, this.layers.visualization.canvas.height - 1), 0);
    return [
      x,
      y
    ];
  };
  // polygon tool.
  Annotator.prototype._addPolygonPoint = function (event) {
    var annotator = this, pos = this._getClickPos(event), x = pos[0], y = pos[1];
    //get canvas.
    var canvas = annotator.layers.annotation.canvas, ctx = canvas.getContext('2d');
    if (this.polygonPoints.length === 0) {
      ctx.save();
      // remember previous state.
      annotator.prevAnnotationImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    // draw.
    ctx.fillStyle = '#FA6900';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    if (this.polygonPoints.length === 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    this.polygonPoints.push(pos);
  };
  Annotator.prototype._emptyPolygonPoints = function () {
    var annotator = this, ctx = annotator.layers.annotation.canvas.getContext('2d');
    ctx.restore();
    if (annotator.prevAnnotationImg)
      ctx.putImageData(annotator.prevAnnotationImg, 0, 0);
    //reset polygon-points
    annotator.polygonPoints = [];
  };
  Annotator.prototype._addPolygonToAnnotation = function () {
    var annotator = this, canvas = document.createElement('canvas'), x, y;
    // set canvas dimensions.
    canvas.width = annotator.layers.annotation.canvas.width;
    canvas.height = annotator.layers.annotation.canvas.height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 255, 255)';
    ctx.beginPath();
    ctx.moveTo(annotator.polygonPoints[0][0], annotator.polygonPoints[0][1]);
    for (i = 1; i < annotator.polygonPoints.length; ++i) {
      x = annotator.polygonPoints[i][0];
      y = annotator.polygonPoints[i][1];
      ctx.lineTo(x, y);
    }
    ctx.lineTo(annotator.polygonPoints[0][0], annotator.polygonPoints[0][1]);
    ctx.closePath();
    ctx.fill();
    //get pixels within polygon.
    var colorToCheck = [
        0,
        0,
        255,
        255
      ], imageData = ctx.getImageData(0, 0, canvas.width, canvas.height), data = imageData.data, pixelsPolygon = [];
    for (x = 0; x < canvas.width; ++x) {
      for (y = 0; y < canvas.height; ++y) {
        var index = (x + y * imageData.width) * 4;
        if (data[index + 0] == colorToCheck[0] && data[index + 1] == colorToCheck[1] && data[index + 2] == colorToCheck[2] && data[index + 3] == colorToCheck[3]) {
          pixelsPolygon.push(index);
        }
      }
    }
    // update annotation.
    annotator._updateAnnotation(pixelsPolygon, annotator.currentLabel);
    annotator._emptyPolygonPoints();
  };
  Annotator.prototype._checkLineIntersection = function () {
    if (this.polygonPoints.length < 4)
      return false;
    var newLineStartX = this.polygonPoints[this.polygonPoints.length - 2][0], newLineStartY = this.polygonPoints[this.polygonPoints.length - 2][1], newLineEndX = this.polygonPoints[this.polygonPoints.length - 1][0], newLineEndY = this.polygonPoints[this.polygonPoints.length - 1][1];
    for (i = 1; i < this.polygonPoints.length - 2; ++i) {
      var line1StartX = this.polygonPoints[i - 1][0], line1StartY = this.polygonPoints[i - 1][1], line1EndX = this.polygonPoints[i][0], line1EndY = this.polygonPoints[i][1], denominator = (newLineEndY - newLineStartY) * (line1EndX - line1StartX) - (newLineEndX - newLineStartX) * (line1EndY - line1StartY), a = line1StartY - newLineStartY, b = line1StartX - newLineStartX, numerator1 = (newLineEndX - newLineStartX) * a - (newLineEndY - newLineStartY) * b, numerator2 = (line1EndX - line1StartX) * a - (line1EndY - line1StartY) * b;
      a = numerator1 / denominator;
      b = numerator2 / denominator;
      if (a > 0 && a < 1 && b > 0 && b < 1)
        return true;
    }
    return false;
  };
  Annotator.prototype._setMode = function (mode) {
    this.mode = mode;
  };
  Annotator.prototype._updateHighlight = function (pixels) {
    var visualizationData = this.layers.visualization.imageData.data, boundaryData = this.layers.boundary.imageData.data, annotationData = this.layers.annotation.imageData.data, i, color, offset;
    if (this.currentPixels !== null) {
      for (i = 0; i < this.currentPixels.length; ++i) {
        offset = this.currentPixels[i];
        color = this.colormap[_getEncodedLabel(annotationData, offset)];
        visualizationData[offset + 0] = color[0];
        visualizationData[offset + 1] = color[1];
        visualizationData[offset + 2] = color[2];
        visualizationData[offset + 3] = this.visualizationAlpha;
      }
    }
    this.currentPixels = pixels;
    if (this.currentPixels !== null) {
      for (i = 0; i < pixels.length; ++i) {
        offset = pixels[i];
        if (boundaryData[offset + 3]) {
          visualizationData[offset + 0] = this.boundaryColor[0];
          visualizationData[offset + 1] = this.boundaryColor[1];
          visualizationData[offset + 2] = this.boundaryColor[2];
          visualizationData[offset + 3] = this.highlightAlpha;
        } else {
          visualizationData[offset + 3] = this.highlightAlpha;
        }
      }
    }
    this.layers.visualization.render();
    this.layers.boundary.render();
    if (typeof this.onhighlight === 'function')
      this.onhighlight.call(this);
  };
  Annotator.prototype._fillPixels = function (pixels, labels) {
    if (pixels.length !== labels.length)
      throw 'Invalid fill: ' + pixels.length + ' !== ' + labels.length;
    var annotationData = this.layers.annotation.imageData.data, visualizationData = this.layers.visualization.imageData.data;
    for (var i = 0; i < pixels.length; ++i) {
      var offset = pixels[i], label = labels[i], color = this.colormap[label];
      _setEncodedLabel(annotationData, offset, label);
      visualizationData[offset + 0] = color[0];
      visualizationData[offset + 1] = color[1];
      visualizationData[offset + 2] = color[2];
    }
  };
  // Update label.
  Annotator.prototype._updateAnnotation = function (pixels, labels) {
    var updates;
    labels = typeof labels === 'object' ? labels : _fillArray(new Int32Array(pixels.length), labels);
    updates = this._getDifferentialUpdates(pixels, labels);
    if (updates.pixels.length === 0)
      return this;
    this._updateHistory(updates);
    this._fillPixels(updates.pixels, updates.next);
    this.layers.visualization.render();
    if (typeof this.onchange === 'function')
      this.onchange.call(this);
    return this;
  };
  // Get the differential update of labels.
  Annotator.prototype._getDifferentialUpdates = function (pixels, labels) {
    if (pixels.length !== labels.length)
      throw 'Invalid labels';
    var annotationData = this.layers.annotation.imageData.data, updates = {
        pixels: [],
        prev: [],
        next: []
      };
    for (var i = 0; i < pixels.length; ++i) {
      var label = _getEncodedLabel(annotationData, pixels[i]);
      if (label !== labels[i]) {
        updates.pixels.push(pixels[i]);
        updates.prev.push(label);
        updates.next.push(labels[i]);
      }
    }
    return updates;
  };
  Annotator.prototype._updateHistory = function (updates) {
    this.history = this.history.slice(0, this.currentHistoryRecord + 1);
    this.history.push(updates);
    if (this.history.length > this.maxHistoryRecord)
      this.history = this.history.slice(1, this.history.length);
    else
      ++this.currentHistoryRecord;
  };
  function _fillArray(array, value) {
    for (var i = 0; i < array.length; ++i)
      array[i] = value;
    return array;
  }
  // function _findMostFrequent(annotationData, pixels) {
  //   var histogram = {},
  //       j;
  //   for (j = 0; j < pixels.length; ++j) {
  //     var label = _getEncodedLabel(annotationData, pixels[j]);
  //     histogram[label] = (histogram[label]) ? histogram[label] + 1 : 1;
  //   }
  //   var maxFrequency = 0,
  //       majorLabel = 0;
  //   for (j in histogram) {
  //     var frequency = histogram[j];
  //     if (frequency > maxFrequency) {
  //       maxFrequency = frequency;
  //       majorLabel = j;
  //     }
  //   }
  //   return majorLabel;
  // }
  function _getEncodedLabel(array, offset) {
    return array[offset] | array[offset + 1] << 8 | array[offset + 2] << 16;
  }
  function _setEncodedLabel(array, offset, label) {
    array[offset + 0] = label & 255;
    array[offset + 1] = label >>> 8 & 255;
    array[offset + 2] = label >>> 16 & 255;
    array[offset + 3] = 255;
  }
  return Annotator;
}(image_layer, image_segmentation, image_morph);
app_edit = function (Layer, Annotator, util) {
  // Create the navigation menu.
  function createNavigationMenu(params, data, annotator) {
    var navigationMenu = document.createElement('p'), navigation = createNavigation(params, data), idBlock = document.createElement('div');
    idBlock.className = 'edit-top-menu-block';
    idBlock.appendChild(document.createTextNode(' ID = ' + params.id));
    navigationMenu.appendChild(navigation);
    navigationMenu.appendChild(idBlock);
    return navigationMenu;
  }
  // Create the page navigation.
  function createNavigation(params, data) {
    var id = parseInt(params.id, 10), container = document.createElement('div'), indexAnchor = document.createElement('a'), indexAnchorText = document.createTextNode('Index'), prevAnchorText = document.createTextNode('Prev'), nextAnchorText = document.createTextNode('Next'), prevAnchor, nextAnchor;
    indexAnchor.href = util.makeQueryParams({ view: 'index' });
    indexAnchor.appendChild(indexAnchorText);
    if (id > 0) {
      prevAnchor = document.createElement('a');
      prevAnchor.appendChild(prevAnchorText);
      prevAnchor.href = util.makeQueryParams(params, { id: id - 1 });
    } else
      prevAnchor = prevAnchorText;
    if (id < data.imageURLs.length - 1) {
      nextAnchor = document.createElement('a');
      nextAnchor.appendChild(nextAnchorText);
      nextAnchor.href = util.makeQueryParams(params, { id: id + 1 });
    } else
      nextAnchor = nextAnchorText;
    container.appendChild(prevAnchor);
    container.appendChild(document.createTextNode(' '));
    container.appendChild(indexAnchor);
    container.appendChild(document.createTextNode(' '));
    container.appendChild(nextAnchor);
    container.classList.add('edit-top-menu-block');
    return container;
  }
  // Create the main content block.
  function createMainDisplay(params, data, annotator, imageLayer) {
    var container = document.createElement('div'), imageContainerSpacer = document.createElement('div'), imageContainer = document.createElement('div'), annotatorTopMenu = createImageTopMenu(params, data, annotator), annotatorContainer = document.createElement('div'), sidebarSpacer = document.createElement('div'), sidebarContainer = document.createElement('div'), sidebar = createSidebar(params, data, annotator);
    imageContainerSpacer.className = 'edit-image-top-menu';
    imageContainer.className = 'edit-image-display';
    imageContainer.appendChild(imageContainerSpacer);
    imageContainer.appendChild(imageLayer.canvas);
    annotatorContainer.className = 'edit-image-display';
    annotatorContainer.appendChild(annotatorTopMenu);
    annotatorContainer.appendChild(annotator.container);
    sidebarSpacer.className = 'edit-image-top-menu';
    sidebarContainer.className = 'edit-image-display';
    sidebarContainer.appendChild(sidebarSpacer);
    sidebarContainer.appendChild(sidebar);
    container.className = 'edit-main-container';
    container.appendChild(imageContainer);
    container.appendChild(annotatorContainer);
    container.appendChild(sidebarContainer);
    return container;
  }
  // Create the menu above the editor.
  function createImageTopMenu(params, data, annotator) {
    var container = document.createElement('div'), zoomOutButton = document.createElement('div'), zoomInButton = document.createElement('div'), spacer1 = document.createElement('span'), finerButton = document.createElement('div'), boundaryButton = document.createElement('div'), coarserButton = document.createElement('div'), spacer2 = document.createElement('span'), alphaMinusButton = document.createElement('div'), imageButton = document.createElement('div'), alphaPlusButton = document.createElement('div');
    zoomOutButton.appendChild(document.createTextNode('-'));
    zoomOutButton.classList.add('edit-image-top-button');
    zoomOutButton.addEventListener('click', function () {
      annotator.zoomOut();
    });
    zoomInButton.appendChild(document.createTextNode('zoom +'));
    zoomInButton.classList.add('edit-image-top-button');
    zoomInButton.addEventListener('click', function () {
      annotator.zoomIn();
    });
    spacer1.className = 'edit-image-top-spacer';
    boundaryButton.id = 'boundary-button';
    boundaryButton.className = 'edit-image-top-button';
    boundaryButton.appendChild(document.createTextNode('boundary'));
    boundaryButton.addEventListener('click', function () {
      if (boundaryFlashTimeoutID)
        window.clearTimeout(boundaryFlashTimeoutID);
      if (boundaryButton.classList.contains('edit-image-top-button-enabled'))
        annotator.hide('boundary');
      else
        annotator.show('boundary');
      boundaryButton.classList.toggle('edit-image-top-button-enabled');
    });
    finerButton.appendChild(document.createTextNode('-'));
    finerButton.className = 'edit-image-top-button';
    finerButton.addEventListener('click', function () {
      annotator.finer();
      boundaryFlash();
    });
    coarserButton.appendChild(document.createTextNode('+'));
    coarserButton.className = 'edit-image-top-button';
    coarserButton.addEventListener('click', function () {
      annotator.coarser();
      boundaryFlash();
    });
    spacer2.className = 'edit-image-top-spacer';
    alphaMinusButton.className = 'edit-image-top-button';
    alphaMinusButton.appendChild(document.createTextNode('-'));
    alphaMinusButton.addEventListener('click', function () {
      annotator.moreAlpha();
    });
    imageButton.className = 'edit-image-top-button ' + 'edit-image-top-button-enabled';
    imageButton.appendChild(document.createTextNode('image'));
    imageButton.addEventListener('click', function () {
      if (imageButton.classList.contains('edit-image-top-button-enabled'))
        annotator.hide('image');
      else
        annotator.show('image');
      imageButton.classList.toggle('edit-image-top-button-enabled');
    });
    alphaPlusButton.className = 'edit-image-top-button';
    alphaPlusButton.appendChild(document.createTextNode('+'));
    alphaPlusButton.addEventListener('click', function () {
      annotator.lessAlpha();
    });
    //
    container.className = 'edit-image-top-menu';
    container.appendChild(zoomOutButton);
    container.appendChild(zoomInButton);
    container.appendChild(spacer1);
    container.appendChild(finerButton);
    container.appendChild(boundaryButton);
    container.appendChild(coarserButton);
    container.appendChild(spacer2);
    container.appendChild(alphaMinusButton);
    container.appendChild(imageButton);
    container.appendChild(alphaPlusButton);
    return container;
  }
  // Set up the automatic flash of boundary.
  var boundaryFlashTimeoutID = null;
  function boundaryFlash() {
    var boundaryButton = document.getElementById('boundary-button');
    if (boundaryFlashTimeoutID) {
      window.clearTimeout(boundaryFlashTimeoutID);
      boundaryFlashTimeoutID = window.setTimeout(function () {
        boundaryButton.click();
        boundaryFlashTimeoutID = null;
      }, 1000);
    } else if (!boundaryButton.classList.contains('edit-image-top-button-enabled')) {
      boundaryButton.click();
      boundaryFlashTimeoutID = window.setTimeout(function () {
        boundaryButton.click();
        boundaryFlashTimeoutID = null;
      }, 1000);
    }
  }
  // Create the sidebar.
  function createSidebar(params, data, annotator) {
    var container = document.createElement('div'), labelPicker = createLabelPicker(params, data, annotator), spacer1 = document.createElement('div'), undoButton = document.createElement('div'), redoButton = document.createElement('div'), spacer2 = document.createElement('div'), denoiseButton = document.createElement('div'), spacer3 = document.createElement('div'), superpixelToolButton = document.createElement('div'), spacer4 = document.createElement('div'), polygonToolButton = document.createElement('div'), spacer5 = document.createElement('div'), brushToolButton = document.createElement('div'), spacer6 = document.createElement('div'), manualParagraph = document.createElement('p'), spacer7 = document.createElement('div'), exportButton = document.createElement('input'), manualText;
    exportButton.type = 'submit';
    exportButton.value = 'export';
    exportButton.className = 'edit-sidebar-submit';
    exportButton.addEventListener('click', function () {
      var filename = data.annotationURLs ? data.annotationURLs[params.id].split(/[\\\/]/).pop() : params.id + '.png';
      downloadURI(annotator.export(), filename);
    });
    spacer1.className = 'edit-sidebar-spacer';
    undoButton.className = 'edit-sidebar-button';
    undoButton.appendChild(document.createTextNode('undo'));
    undoButton.addEventListener('click', function () {
      annotator.undo();
    });
    redoButton.className = 'edit-sidebar-button';
    redoButton.appendChild(document.createTextNode('redo'));
    redoButton.addEventListener('click', function () {
      annotator.redo();
    });
    spacer2.className = 'edit-sidebar-spacer';
    denoiseButton.className = 'edit-sidebar-button';
    denoiseButton.appendChild(document.createTextNode('denoise'));
    denoiseButton.addEventListener('click', function () {
      annotator.denoise();
    });
    superpixelToolButton.className = 'edit-sidebar-button';
    superpixelToolButton.appendChild(document.createTextNode('Superpixel tool'));
    superpixelToolButton.addEventListener('click', function () {
      polygonToolButton.classList.remove('edit-sidebar-button-selected');
      brushToolButton.classList.remove('edit-sidebar-button-selected');
      superpixelToolButton.classList.add('edit-sidebar-button-selected');
      annotator._setMode('superpixel');
    });
    superpixelToolButton.classList.add('edit-sidebar-button-selected');
    polygonToolButton.className = 'edit-sidebar-button';
    polygonToolButton.appendChild(document.createTextNode('Polygon tool'));
    polygonToolButton.addEventListener('click', function () {
      superpixelToolButton.classList.remove('edit-sidebar-button-selected');
      brushToolButton.classList.remove('edit-sidebar-button-selected');
      polygonToolButton.classList.add('edit-sidebar-button-selected');
      annotator._setMode('polygon');
    });
    brushToolButton.classList.add('edit-sidebar-button-selected');
    brushToolButton.className = 'edit-sidebar-button';
    brushToolButton.appendChild(document.createTextNode('Brush tool'));
    brushToolButton.addEventListener('click', function () {
      superpixelToolButton.classList.remove('edit-sidebar-button-selected');
      polygonToolButton.classList.remove('edit-sidebar-button-selected');
      brushToolButton.classList.add('edit-sidebar-button-selected');
      annotator._setMode('brush');
    });
    spacer3.className = 'edit-sidebar-spacer';
    manualParagraph.appendChild(document.createTextNode('ctrl: toggle mode'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createTextNode('+Superpixel tool:'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createTextNode('left: mark'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createTextNode('right: pick label'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createTextNode('+Polygon tool:'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createTextNode('left: draw line'));
    manualParagraph.appendChild(document.createElement('br'));
    manualParagraph.appendChild(document.createTextNode('right: abort'));
    spacer4.className = 'edit-sidebar-spacer';
    container.className = 'edit-sidebar';
    container.appendChild(labelPicker);
    container.appendChild(spacer1);
    container.appendChild(undoButton);
    container.appendChild(redoButton);
    container.appendChild(spacer2);
    container.appendChild(denoiseButton);
    container.appendChild(spacer3);
    container.appendChild(polygonToolButton);
    container.appendChild(superpixelToolButton);
    container.appendChild(brushToolButton);
    container.appendChild(manualParagraph);
    //container.appendChild(spacer4);
    container.appendChild(exportButton);
    return container;
  }
  function createLabelButton(data, value, index, annotator) {
    var colorBox = document.createElement('span'), labelText = document.createElement('span'), pickButton = document.createElement('div'), popupButton = document.createElement('div'), popupContainer = document.createElement('div');
    colorBox.className = 'edit-sidebar-legend-colorbox';
    colorBox.style.backgroundColor = 'rgb(' + data.colormap[index].join(',') + ')';
    labelText.appendChild(document.createTextNode(value));
    labelText.className = 'edit-sidebar-legend-label';
    popupButton.appendChild(document.createTextNode('+'));
    popupButton.className = 'edit-sidebar-popup-trigger';
    popupButton.addEventListener('click', function () {
      popupContainer.classList.toggle('edit-sidebar-popup-active');
    });
    popupContainer.className = 'edit-sidebar-popup';
    popupContainer.appendChild(createRelabelSelector(data, index, annotator, popupContainer));
    popupContainer.addEventListener('click', function (event) {
      event.preventDefault();
    });
    pickButton.appendChild(colorBox);
    pickButton.appendChild(labelText);
    pickButton.appendChild(popupButton);
    pickButton.appendChild(popupContainer);
    pickButton.id = 'label-' + index + '-button';
    pickButton.className = 'edit-sidebar-button';
    pickButton.addEventListener('click', function () {
      var className = 'edit-sidebar-button-selected';
      annotator.currentLabel = index;
      var selectedElements = document.getElementsByClassName(className);
      for (var i = 0; i < selectedElements.length; ++i)
        selectedElements[i].classList.remove(className);
      pickButton.classList.add(className);
    });
    pickButton.addEventListener('mouseenter', function () {
      if (!document.getElementsByClassName('edit-sidebar-popup-active').length)
        annotator.highlightLabel(index);
    });
    pickButton.addEventListener('mouseleave', function () {
      if (!document.getElementsByClassName('edit-sidebar-popup-active').length)
        annotator.unhighlightLabel();
    });
    return pickButton;
  }
  // Write the brush tool
  Annotator.prototype.brush = function (pos, label) {
    var offsets = [], labels = [];
    for (var y = -2; y <= 2; y++) {
      for (var x = -2; x <= 2; x++) {
        // it is circle bitches
        if (x * x + y * y > 7)
          continue;
        var offset = 4 * ((pos[1] + y) * this.layers.visualization.canvas.width + (pos[0] + x));
        offsets.push(offset);
        labels.push(label);
      }
    }
    this._updateAnnotation(offsets, labels);
    this.layers.visualization.render();
    if (typeof this.onchange === 'function')
      this.onchange.call(this);
  };
  // Hightlight legend labels.
  function highlightLabel(label) {
    var highlightClass = 'edit-sidebar-button-highlight', elements = document.getElementsByClassName(highlightClass);
    for (var i = 0; i < elements.length; ++i)
      elements[i].classList.remove(highlightClass);
    var pickButton = document.getElementById('label-' + label + '-button');
    if (pickButton)
      pickButton.classList.add(highlightClass);
  }
  // Create the label picker button.
  function createLabelPicker(params, data, annotator) {
    var container = document.createElement('div');
    container.className = 'edit-sidebar-label-picker';
    for (var i = 0; i < data.labels.length; ++i) {
      var labelButton = createLabelButton(data, data.labels[i], i, annotator);
      if (i === 0) {
        annotator.currentLabel = 0;
        labelButton.classList.add('edit-sidebar-button-selected');
      }
      container.appendChild(labelButton);
    }
    window.addEventListener('click', cancelPopup, true);
    return container;
  }
  // Cancel popup.
  function cancelPopup(event) {
    var isOutsidePopup = true, target = event.target;
    while (target.parentNode) {
      isOutsidePopup = isOutsidePopup && !target.classList.contains('edit-sidebar-popup');
      target = target.parentNode;
    }
    if (isOutsidePopup) {
      var popups = document.getElementsByClassName('edit-sidebar-popup-active');
      if (popups.length)
        for (var i = 0; i < popups.length; ++i)
          popups[i].classList.remove('edit-sidebar-popup-active');
    }
  }
  // Create the relabel selector.
  function createRelabelSelector(data, index, annotator, popupContainer) {
    var select = document.createElement('select'), firstOption = document.createElement('option');
    firstOption.appendChild(document.createTextNode('Change to'));
    select.appendChild(firstOption);
    for (var i = 0; i < data.labels.length; ++i) {
      if (i !== index) {
        var option = document.createElement('option');
        option.value = i;
        option.appendChild(document.createTextNode(data.labels[i]));
        select.appendChild(option);
      }
    }
    select.addEventListener('change', function (event) {
      var sourceLabel = index;
      var targetLabel = parseInt(event.target.value, 10);
      if (sourceLabel !== targetLabel) {
        var currentLabel = annotator.currentLabel;
        annotator.currentLabel = targetLabel;
        annotator.fill(sourceLabel);
        annotator.currentLabel = currentLabel;
      }
      popupContainer.classList.remove('edit-sidebar-popup-active');
      firstOption.selected = true;
      event.preventDefault();
    });
    return select;
  }
  // Download trick.
  function downloadURI(uri, filename) {
    var anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.target = '_blank';
    // Safari doesn't work.
    anchor.download = filename;
    anchor.href = uri;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
  // Entry point.
  function render(data, params) {
    var id = parseInt(params.id, 10);
    if (isNaN(id))
      throw 'Invalid id';
    var annotator = new Annotator(data.imageURLs[id], {
        width: params.width,
        height: params.height,
        colormap: data.colormap,
        superpixelOptions: {
          method: 'slic',
          regionSize: 25
        },
        onload: function () {
          if (data.annotationURLs)
            annotator.import(data.annotationURLs[id]);
          annotator.hide('boundary');
          boundaryFlash();
        },
        onchange: function () {
          var activeLabels = this.getUniqueLabels(), legendClass = 'edit-sidebar-legend-label', legendActiveClass = 'edit-sidebar-legend-label-active', elements = document.getElementsByClassName(legendClass), i;
          for (i = 0; i < elements.length; ++i)
            elements[i].classList.remove(legendActiveClass);
          for (i = 0; i < activeLabels.length; ++i)
            elements[activeLabels[i]].classList.add(legendActiveClass);
        },
        onrightclick: function (label) {
          document.getElementById('label-' + label + '-button').click();
        },
        onmousemove: highlightLabel
      }), imageLayer = new Layer(data.imageURLs[id], {
        width: params.width,
        height: params.height
      });
    document.body.appendChild(createNavigationMenu(params, data, annotator));
    document.body.appendChild(createMainDisplay(params, data, annotator, imageLayer));
  }
  return render;
}(image_layer, helper_segment_annotator, helper_util);
helper_colormap = function () {
  var registry = {
    random: function (options) {
      var colormap = [];
      for (var i = 0; i < options.size; ++i)
        colormap.push([
          Math.floor(256 * Math.random()),
          Math.floor(256 * Math.random()),
          Math.floor(256 * Math.random())
        ]);
      return colormap;
    },
    gray: function (options) {
      var colormap = [];
      for (var i = 0; i < options.size; ++i) {
        var intensity = Math.round(255 * i / options.size);
        colormap.push([
          intensity,
          intensity,
          intensity
        ]);
      }
      return colormap;
    },
    hsv: function (options) {
      var colormap = [], saturation = options.saturation === undefined ? 1 : options.saturation;
      for (var i = 0; i < options.size; ++i)
        colormap.push(hsv2rgb(i / options.size, saturation, 1));
      return colormap;
    },
    hhsv: function (options) {
      var colormap = [], depth = options.depth || 2, saturationBlocks = [], i;
      for (i = 0; i < depth; ++i)
        saturationBlocks[i] = 0;
      for (i = 0; i < options.size; ++i)
        saturationBlocks[Math.floor(depth * i / options.size)] += 1;
      for (i = 0; i < depth; ++i) {
        colormap = colormap.concat(registry.hsv({
          size: saturationBlocks[i],
          saturation: 1 - i / depth
        }));
      }
      return colormap;
    },
    single: function (options) {
      var colormap = [];
      for (var i = 0; i < options.size; ++i) {
        if (i === options.index)
          colormap.push(options.foreground || [
            255,
            0,
            0
          ]);
        else
          colormap.push(options.background || [
            255,
            255,
            255
          ]);
      }
      return colormap;
    }
  };
  /** Compute RGB value from HSV.
   */
  function hsv2rgb(h, s, v) {
    var i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s), r, g, b;
    switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    }
    return [
      r,
      g,
      b
    ].map(function (x) {
      return Math.round(x * 255);
    });
  }
  function create(name, options) {
    if (typeof name === 'undefined')
      name = 'random';
    if (typeof options === 'undefined')
      options = {};
    options.size = options.size || 8;
    return registry[name](options);
  }
  function register(name, callback) {
    register[name] = callback;
  }
  return {
    create: create,
    register: register
  };
}();
/* Main page dispatcher.
*/
requirejs([
  'app/index',
  'app/edit',
  'helper/colormap',
  'helper/util'
], function (indexPage, editPage, colormap, util) {
  var dataURL = 'data/example.json',
    // Change this to another dataset.
    params = util.getQueryParams();
  // Create a colormap for display. The following is an example.
  function createColormap(label, labels) {
    return label ? colormap.create('single', {
      size: labels.length,
      index: labels.indexOf(label)
    }) : [
      [
        255,
        255,
        255
      ],
      [
        226,
        196,
        196
      ],
      [
        64,
        32,
        32
      ]
    ].concat(colormap.create('hsv', { size: labels.length - 3 }));
  }
  // Load dataset before rendering a view.
  function renderPage(renderer) {
    util.requestJSON(dataURL, function (data) {
      data.colormap = createColormap(params.label, data.labels);
      renderer(data, params);
    });
  }
  switch (params.view) {
  case 'index':
    renderPage(indexPage);
    break;
  case 'edit':
    renderPage(editPage);
    break;
  default:
    params.view = 'index';
    window.location = util.makeQueryParams(params);
    break;
  }
});
main = undefined;
}());