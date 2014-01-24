// Javascript implementation of an image segmentation algorithm of
//
//    SLIC Superpixels
//    Radhakrishna Achanta, Appu Shaji, Kevin Smith, Aurelien Lucchi, Pascal Fua, and Sabine Süsstrunk
//    EEE Transactions on Pattern Analysis and Machine Intelligence, vol. 34, num. 11, p. 2274 - 2282, May 2012.
//
// and based on implementation of VLFeat implementation.
//
// API
// ---
//
//    SLICSegmentation(imageURL, options)
//
// The function takes the following options.
// * `regionSize` - Parameter of superpixel size
// * `regularization` - regularization parameter. See paper.
// * `minRegionSize` - Minimum segment size in pixels.
// * `toDataURL` - callback function to receive the result as a data URL.
// * `callback` - function to be called on finish. The function takes a single
//                argument of result object that contains following fields.
//    * `width` - Width of the image in pixels.
//    * `height` - Height of the image in pixels.
//    * `size` - Number of segments.
//    * `indexMap` - Int32Array of `width * height` elements containing
//                   segment index for each pixel location. The segment index
//                   at pixel `(i, j)` is `indexMap(i * width + j)`, where
//                   `i` is the y coordinate of the pixel and `j` is the x
//                   coordinate.
//
//
// LongLong Yu 2014.
(function() {

     // rgba: Red Green Blue Alpha
     // convert RGBA into XYZ color space
     function rgb2xyz(rgba, w, h){
         var xyz = new Float32Array(3*w*h);
         var gamma = 2.2;
         for (var i = 0; i<w*h; i++){
             var r = parseFloat(rgba[4*i+0]) * 0.00392156862;
             var g = parseFloat(rgba[4*i+1]) * 0.00392156862;
             var b = parseFloat(rgba[4*i+2]) * 0.00392156862;
             r = Math.pow(r, gamma);
             g = Math.pow(g, gamma);
             b = Math.pow(b, gamma);
             xyz[i] = (r * 0.4887180 + g * 0.310680 + b * 0.2006020);
             xyz[i + w*h] = (r * 0.1762040 + g * 0.812985 + b * 0.0108109);
             xyz[i + 2*w*h] = (g * 0.0102048 + b * 0.989795);
         }
         return xyz;
     }

     // this function is used for XYZ2Lab
     function f(x){
         if (x > 0.00856){
             return Math.pow(x, 0.33333333);
         }
         else{
             return 7.78706891568 * x + 0.1379310336;
         }
     }

     // convert XYZ to Lab
     function xyz2lab(XYZ, w, h){
         var xw = 1.0/3.0;
         var yw = 1.0/3.0;

         var Yw = 1.0;
         var Xw = xw / yw;
         var Zw = (1-xw-yw) / yw * Yw;

         var ix = 1.0 / Xw;
         var iy = 1.0 / Yw;
         var iz = 1.0 / Zw;

         var Lab = new Float32Array(3*w*h);
         var i;
         for (i = 0; i<w*h; i++){
             var fx = f(XYZ[i] * ix);
             var fy = f(XYZ[w*h + i] * iy);
             var fz = f(XYZ[2*w*h + i] * iz);

             Lab[i] = 116.0 * fy - 16.0;
             Lab[i + w*h] = 500.0 * (fx - fy);
             Lab[i + 2*w*h] = 200.0 * (fy - fz);
         }

         return Lab;
     }


     // compute gradient of 3 channel color space image
     function compute_edge(im, edgeMap, w, h){
         for (var k = 0; k<3; k++){
             for (var y = 1; y<h-1; y++){
                 for (var x = 1; x<w-1; x++){
                     var a = im[k*w*h + y*w + x-1];
                     var b = im[k*w*h + y*w + x+1];
                     var c = im[k*w*h + (y+1)*w + x];
                     var d = im[k*w*h + (y-1)*w + x];
                     edgeMap[y*w +x] = edgeMap[y*w +x] + (a-b) * (a-b) + (c-d) * (c-d);
                 }
             }
         }
     }

     // initialize superpixel clusters
     function initialize_kmeans_centers(im, edgeMap, centers, cluster_params, numRegionsX, numRegionsY, regionSize, imW, imH){
         var x, y;
         var i = 0, j= 0;

         for (var v = 0 ; v < numRegionsY ; v++) {
             for (var u = 0 ; u < numRegionsX ; u++) {

                 var xp ;
                 var yp ;
                 var centerx = 0 ;
                 var centery = 0 ;
                 var minEdgeValue = Infinity;

                 x = parseInt( Math.round(regionSize * (u + 0.5)) );
                 y = parseInt( Math.round(regionSize * (v + 0.5)) );

                 x = Math.max(Math.min(x, imW-1),0) ;
                 y = Math.max(Math.min(y, imH-1),0) ;

                 // search in a 3x3 neighbourhood the smallest edge response
                 for (yp = Math.max(0, y-1) ; yp <= Math.min(imH-1, y+1) ; yp++) {
                     for (xp = Math.max(0, x-1) ; xp <= Math.min(imW-1, x+1) ; xp++) {
                         var thisEdgeValue = edgeMap[yp * imW + xp];
                         if (thisEdgeValue < minEdgeValue) {
                             minEdgeValue = thisEdgeValue ;
                             centerx = xp ;
                             centery = yp ;
                         }
                     }
                 }

                 // initialize the new center at this location
                 centers[i++] = parseFloat(centerx) ;
                 centers[i++] = parseFloat(centery) ;
                 // 3 channels
                 centers[i++] = im[centery * imW + centerx];
                 centers[i++] = im[imW * imH + centery * imW + centerx];
                 centers[i++] = im[2 * imW * imH + centery * imW + centerx];
                 
                 cluster_params[j++] = 10*10; // THIS IS THE VARIABLE VALUE OF M, just start with 5
                 cluster_params[j++] = regionSize * regionSize;
             }
         }
     }


     // compute energy of clustering assignment, update segmentation assignments, color_distance_map and spatial_distance_map
     function compute_slic_energy(im, segmentation, mc_map, ms_map, centers, cluster_params, factor, numRegionsX, numRegionsY, regionSize, imW, imH){
         
         var energy = 0;
         // assign pixels to centers
         for (var y = 0 ; y < imH ; ++y) {
             for (var x = 0 ; x < imW ; ++x) {
                 var u = Math.floor(parseFloat(x) / regionSize - 0.5);
                 var v = Math.floor(parseFloat(y) / regionSize - 0.5);
                 var up, vp ;
                 var minDistance = Infinity;

                 for (vp = Math.max(0, v) ; vp <= Math.min(numRegionsY-1, v+1) ; vp++) {
                     for (up = Math.max(0, u) ; up <= Math.min(numRegionsX-1, u+1) ; up++) {
                         var region = up  + vp * numRegionsX ;
                         var centerx = centers[5 * region + 0] ;
                         var centery = centers[5 * region + 1] ;

                         var spatial = (x - centerx) * (x - centerx) + (y - centery) * (y - centery) ;

                         var dR = im[y*imW + x] - centers[5*region + 2]; // R
                         var dG = im[imW * imH + y*imW + x] - centers[5*region + 3]; // G
                         var dB = im[2 * imW * imH + y*imW + x] - centers[5*region + 4]; // B
                         var appearance = dR * dR + dG * dG + dB * dB;

                         var distance = Math.sqrt( appearance / cluster_params[region*2 + 0] + spatial / cluster_params[region*2 + 1] );
                         //var distance = Math.sqrt( appearance + spatial * factor);
                         if (minDistance > distance) {
                             minDistance = distance ;
                             segmentation[y*imW + x] = region;
                             mc_map[y*imW + x] = appearance;
                             ms_map[y*imW + x] = spatial;
                         }
                     }
                 }
                 energy += minDistance ;
             }
         }
         return energy / (numRegionsX * numRegionsY);
     }

     // re-compute clusters
     function compute_centers(im, segmentation, masses, centers, numRegions, imW, imH){
         for (var y = 0 ; y < imH ; y++) {
             for (var x = 0 ; x < imW ; x++) {
                 var region = segmentation[x + y * imW] ;
                 masses[region] ++ ;
                 centers[region * 5 + 0] += x ;
                 centers[region * 5 + 1] += y ;
                 centers[region * 5 + 2] += im[y*imW + x];
                 centers[region * 5 + 3] += im[imW*imH + y*imW + x];
                 centers[region * 5 + 4] += im[2*imW*imH + y*imW + x];
             }
         }

         for (var region = 0 ; region < numRegions ; region++) {
             var iMass = 1. / Math.max(masses[region], 1e-8) ;
             centers[region*5] = centers[region*5] * iMass;
             centers[region*5+1] = centers[region*5+1] * iMass;
             centers[region*5+2] = centers[region*5+2] * iMass;
             centers[region*5+3] = centers[region*5+3] * iMass;
             centers[region*5+4] = centers[region*5+4] * iMass;
         }
     }

     function memset(d, n, value){
         for (var i = 0; i<n; i++){
             d[i] = value;
         }
     }

     function memcpy(p, q, n){
         for (var i =0; i<n; i++)
             p[i] = q[i];
     }


     // remove small superpixels and assign them the nearest superpixel label
     function eliminate_small_regions(segmentation, minRegionSize, numPixels, imW, imH){

         var cleaned = new Int32Array(numPixels);
         var segment = new Int32Array(numPixels);
         var segmentSize;
         var label;
         var cleanedLabel;
         var numExpanded;
         var dx = new Array(1, -1, 0, 0);
         var dy = new Array(0, 0, 1, -1);
         var pixel;
         var x, y;
         for (pixel = 0 ; pixel < numPixels ; pixel++) {
             if (cleaned[pixel]) continue ;
             label = segmentation[pixel] ;
             numExpanded = 0 ;
             segmentSize = 0 ;
             segment[segmentSize++] = pixel ;

             // find cleanedLabel as the label of an already cleaned region neihbour of this pixel
             cleanedLabel = label + 1 ;
             cleaned[pixel] = label + 1 ;
             x = (pixel % imW);
             y = Math.floor(pixel / imW);
             for (var direction = 0 ; direction < 4 ; direction++) {
                 var xp = x + dx[direction] ;
                 var yp = y + dy[direction] ;
                 var neighbor = xp + yp * imW ;
                 if (0 <= xp && xp < imW && 0 <= yp && yp < imH && cleaned[neighbor]) {
                     cleanedLabel = cleaned[neighbor] ;
                 }
             }

             // expand the segment
             while (numExpanded < segmentSize) {
                 var open = segment[numExpanded++] ;
                 x = open % imW ;
                 y = Math.floor(open / imW );
                 for (var direction = 0 ; direction < 4 ; ++direction) {
                     var xp = x + dx[direction] ;
                     var yp = y + dy[direction] ;
                     var neighbor = xp + yp * imW ;
                     if (0 <= xp && xp < imW && 0 <= yp && yp < imH && cleaned[neighbor] === 0 && segmentation[neighbor] === label) {
                         cleaned[neighbor] = label + 1 ;
                         segment[segmentSize++] = neighbor ;
                     }
                 }
             }

             // change label to cleanedLabel if the semgent is too small
             if (segmentSize < minRegionSize) {
                 while (segmentSize > 0) {
                     cleaned[segment[--segmentSize]] = cleanedLabel ;
                 }
             }
         }


         // restore base 0 indexing of the regions
         for (pixel = 0 ; pixel < numPixels ; pixel++){
             cleaned[pixel] -- ;
         }

         memcpy(segmentation, cleaned, numPixels);
     }

     function update_cluster_params(segmentation, mc_map, ms_map, cluster_params){
         var mc = new Float32Array(cluster_params.length/2);
         var ms = new Float32Array(cluster_params.length/2);
         for (var i = 0; i<segmentation.length; i++){
             var region = segmentation[i];
             if (mc[region] < mc_map[region]){
                 mc[region] = mc_map[region];
                 cluster_params[region*2+0] = mc_map[region];
             }
             if (ms[region] < ms_map[region]){
                 ms[region] = ms_map[region];
                 cluster_params[region*2+1] = ms_map[region];
             }
         }
     }



     function assign_superpixel_label(im, segmentation, mc_map, ms_map, distance_map, centers, cluster_params, factor, numRegionsX, numRegionsY, regionSize, imW, imH){

         var S = regionSize;
         memset(distance_map, distance_map.length, Infinity);
         for (var region =0; region<numRegionsX * numRegionsY; region ++){
             var cx = Math.round( centers[region*5+0] );
             var cy = Math.round( centers[region*5+1] );

             for (var y = Math.max(0, cy - S);  y < Math.min(imH, cy + S); y++){
                 for (var x = Math.max(0, cx - S); x < Math.min(imW, cx + S); x++){

                     var spatial = (x - cx) * (x - cx) + (y - cy) * (y - cy) ;

                     var dR = im[y*imW + x] - centers[5*region + 2]; // R
                     var dG = im[imW * imH + y*imW + x] - centers[5*region + 3]; // G
                     var dB = im[2 * imW * imH + y*imW + x] - centers[5*region + 4]; // B
                     var appearance = dR * dR + dG * dG + dB * dB;

                     var distance = Math.sqrt( appearance / cluster_params[region*2 + 0] + spatial / cluster_params[region*2 + 1] );
                     //var distance = Math.sqrt( appearance + spatial * factor);
                     if (distance < distance_map[y*imW + x]){
                         distance_map[y*imW + x] = distance;
                         segmentation[y*imW + x] = region;
                     }
                 }
             }
         }
         // update the max distance of color and space
         for (var y = 0; y < imH; y++){
           for (var x = 0; x < imW; x++){
             if (cluster_params[segmentation[y*imW + x]*2] < mc_map[y*imW + x]) // color
               cluster_params[segmentation[y*imW + x]*2] = mc_map[y*imW + x];
             if (cluster_params[segmentation[y*imW + x]*2+1] < ms_map[y*imW + x]) // space
               cluster_params[segmentation[y*imW + x]*2+1] = ms_map[y*imW + x];
           }
         }
     }


     function compute_residual_error(prev_centers, curr_centers){
         var error = 0.;
         for (var i=0; i<prev_centers.length; i++){
             var d = prev_centers[i] - curr_centers[i];
             error += Math.sqrt(d*d);
         }
         return error;
     }

     function slic_segmentation(imageData, options){

         var imWidth = imageData.width;
         var imHeight = imageData.height;
         var numRegionsX = parseInt(imWidth / options.regionSize);
         var numRegionsY = parseInt(imHeight / options.regionSize);
         var numRegions = parseInt(numRegionsX * numRegionsY);
         var numPixels = parseInt(imWidth * imHeight);
         var regionSize = options.regionSize;

         var edgeMap = new Float32Array(numPixels);
         var masses = new Array(numPixels);
         var curr_centers = new Float32Array((2+3)*numRegions); // 2 (geometric: x & y) and 3 (RGB or Lab)
         var new_centers = new Float32Array((2+3)*numRegions); // 2 (geometric: x & y) and 3 (RGB or Lab)
         var cluster_params = new Float32Array(2*numRegions);
         var mc_map = new Float32Array(numPixels);
         var ms_map = new Float32Array(numPixels);
         var distance_map = new Float32Array(numPixels);

         // first, convert RGB 2 Lab space
         var Lab = xyz2lab(rgb2xyz(imageData.data, imageData.width, imageData.height), imageData.width, imageData.height);

         // compute edge
         compute_edge(Lab, edgeMap, imageData.width, imageData.height);

         /* initialize K-Means Centers*/
         initialize_kmeans_centers(Lab, edgeMap, curr_centers, cluster_params, numRegionsX, numRegionsY, regionSize, imageData.width, imageData.height);



         var maxNumIterations = 10;
         var factor = options.regularization * options.regularization / (regionSize * regionSize);
         var segmentation = new Int32Array(numPixels);
         var iter;

         // VLFEAT implementation
         /*
         var previousEnergy = Infinity;
         var startingEnergy = 0;
         for (iter = 0; iter < maxNumIterations; iter++){
             // do superpixel assignment and energy computation
             var energy = compute_slic_energy(Lab, segmentation, mc_map, ms_map, curr_centers, cluster_params, factor, numRegionsX, numRegionsY, regionSize, imageData.width, imageData.height);

             if (iter === 0){
                 startingEnergy = energy;
             }
             else{
                 if (Math.abs(previousEnergy - energy) < 1e-5){
                     break;
                 }
             }
             previousEnergy = energy ;

             // recompute centers
             memset(masses, numPixels, 0);
             memset(curr_centers, (2+3)*numRegions, 0);
             // compute centers
             compute_centers(Lab, segmentation, masses, curr_centers, numRegions, imageData.width, imageData.height);

             // update maximum spatial and color distances [1]
             update_cluster_params(segmentation, mc_map, ms_map, cluster_params);
         }*/


         // SLICO implementation: "SLIC Superpixels Compared to State-of-the-art Superpixel Methods"
         for (iter =0; iter < maxNumIterations; iter++){
             // do assignment
             assign_superpixel_label(Lab, segmentation, mc_map, ms_map, distance_map, curr_centers, cluster_params, factor, numRegionsX, numRegionsY, regionSize, imageData.width, imageData.height);
             // update maximum spatial and color distances [1]
             update_cluster_params(segmentation, mc_map, ms_map, cluster_params);

             // compute new centers
             memset(masses, numPixels, 0);
             memset(new_centers, (2+3)*numRegions, 0);
             compute_centers(Lab, segmentation, masses, new_centers, numRegions, imageData.width, imageData.height);

             // compute residual error of assignment
             var error = compute_residual_error(curr_centers, new_centers);

             if (error < 1e-5){
                 break;
             }
             memcpy(curr_centers, new_centers, numRegions * 5);
         }



         eliminate_small_regions(segmentation, options.minRegionSize, numPixels, imageData.width, imageData.height);
         return segmentation;
     }


     Int32Array.prototype.unique = function() {
                 var arr = [];
                 for(var i = 0; i < this.length; i++) {
                     if(!arr.contains(this[i])) {
                         arr.push(this[i]);
                     }
                 }
                 return arr;
             }


     Array.prototype.contains = function(v){
                 for(var i = 0; i < this.length; i++) {
                     if(this[i] === v) return true;
                 }
                 return false;
             }

     // Compute segmentation.
     function computeSegmentation(imageData, options) {

         var segmentation = slic_segmentation(imageData, options);

         var labels = segmentation.unique();

         // construct mapping
         var M = {};
         var i;
         for (i = 0; i< labels.length; i++){
             M[labels[i]] = i;
         }


         for (i =0; i<segmentation.length; i++){
             segmentation[i] = M[segmentation[i]];
         }

         var nNodes = labels.length;

         if (options.callback) {
             var rgbData = new Uint8Array(imageData.data);
             options.callback({
                                  width: imageData.width,
                                  height: imageData.height,
                                  size: nNodes,
                                  indexMap: segmentation,
                                  rgbData: rgbData
                              });
         }
         if (options.toDataURL)
             getDataURL(imageData.width, imageData.height, indexMap, options);
     }

     // Convert to Data URL.
     function getDataURL(width, height, indexMap, options) {
         var canvas = document.createElement('canvas');
         canvas.width = width;
         canvas.height = height;
         var context = canvas.getContext('2d');
         var imageData = context.createImageData(width, height);
         var data = imageData.data;
         for (var i = 0; i < indexMap.length; ++i) {
             var value = indexMap[i];
             data[4 * i + 0] = value & 255;
             data[4 * i + 1] = (value >>> 8) & 255;
             data[4 * i + 2] = (value >>> 16) & 255;
         }
         context.putImageData(imageData, 0, 0);
         options.toDataURL(canvas.toDataURL());
     }

     // When image is loaded.
     function onSuccessImageLoad(image, options) {
         var canvas = document.createElement('canvas');
         canvas.width = image.width;
         canvas.height = image.height;
         var context = canvas.getContext('2d');
         context.drawImage(image, 0, 0);
         var imageData = context.getImageData(0, 0, image.width, image.height);
         var segmentation = computeSegmentation(imageData, options);
     }

     // When image is invalid.
     function onErrorImageLoad() {
         alert('Failed to load an image: ' + image.src);
     }

     // Public API.
     window.SLIC = function(imageURL, options) {
                 if (typeof options === 'undefined') options = {};
                 if (options.regionSize === undefined) options.regionSize = 40 // the lateral side of a rectangle superpixel in pixels
                 if (options.minRegionSize === undefined) options.minRegionSize = options.regionSize * options.regionSize / 4; // width or high should be larger than 20 pixels
                 var image = new Image();
                 image.crossOrigin="Anonymous";
                 image.onerror = function() { onErrorImageLoad(image); };
                 image.onload = function() { onSuccessImageLoad(image, options); };
                 image.src = imageURL;
                 

             };
 }).call(this);