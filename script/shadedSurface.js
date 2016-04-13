// Requires FlatSurfaceShader
// https://github.com/wagerfield/flat-surface-shader
//
// (c) 2015 Datadog Inc.

/*
    lightDefs: [{
        ambient: <hexcolor>,
        diffuse: <hexcolor>,
        x: <x coord>,
        y: <y coord>,
        z: <z coord>,
        start: {
            <starting x,y,z coords for lightUp>
        }
    },...];

 */
(function(window){
var ShadedSurface = function(options, lightDefs) {
    var defaults = {
        container: 'body',
        cellsize: 100,
        jitter: 0.33,
        depth: 20,
        depthTransform: null,
        materialAmbient: '#FFFFFF',
        materialDiffuse: '#FFFFFF',
        fillOpacity: 1,
        strokeOpacity: 1,
        strokeWidth: 1,
        renderWith: 'svg'
    },
    Renderer,
    self = this;

    this.options = {};
    for (var key in defaults) {
        if (options.hasOwnProperty(key)) {
            this.options[key] = options[key];
        } else if (defaults.hasOwnProperty(key)) {
            this.options[key] = defaults[key];
        }
    }
    this.options.$container = document.querySelector(this.options.container);

    this.$wrapper = document.createElement('div');
    this.$wrapper.className += ' shadedSurfaceWrapper';

    var ws = this.$wrapper.style;
    ws.position = "absolute";
    ws.overflow = "hidden";
    ws.top = 0  + "px";
    ws.bottom = 0 + "px";
    ws.left = 0 + "px";
    ws.right = 0 + "px";

    // convert jitter to px based on cellsize
    this.options.distortion = this.options.jitter * this.options.cellsize;

    // Black background before lights come up
    this.options.$container.style.backgroundColor = "#000";

    Renderer = {
        "svg": FSS.SVGRenderer,
        "canvas": FSS.CanvasRenderer,
        "webgl": FSS.WebGLRenderer
    }[this.options.renderWith];
    if (!Renderer) {
        throw "Undefined Renderer; aborting";
    }
    this.renderer = new Renderer();
    this.scene = new FSS.Scene();

    this.lightDefs = lightDefs;

    return this;
};

// Export constructor
window.ShadedSurface = ShadedSurface;


/**
 * Set up basic mesh, material, and lights.  Inject DOM elements and
 * position in their containers.  Add window resize handler.
 */
ShadedSurface.prototype.initialize = function() {
    var self = this;
    this.scene.add(this.makeMesh());
    this.distortMesh(this.options.depthTransform);

    // add lights
    for (var i = 0 ; i < this.lightDefs.length ; i++) {
        var lightDef = this.lightDefs[i];
        self.scene.add( new FSS.Light(
            lightDef.ambient,
            lightDef.diffuse
        ));
    }

    this.options.$container.appendChild(this.$wrapper);
    this.$wrapper.appendChild(this.renderer.element);

    if (window.getComputedStyle(this.options.$container).position === "static") {
        this.options.$container.style.position = "relative";
    }

    var es = this.renderer.element.style;
    es.position = 'absolute';
    es.top = -this.options.distortion + "px";
    es.right = -this.options.distortion + "px";
    es.bottom = -this.options.distortion + "px";
    es.left = -this.options.distortion + "px";

    // handle window resizing
    var resizeHandler = function(e) {
        window.requestAnimationFrame(function(){
            self.resize().draw();
        });
    }
    if (window.addEventListener) {
        window.addEventListener('resize', resizeHandler);
    }
    return this;
};

/**
 * Get a fresh mesh geometry on resize, distort it, and set renderer size.
 */
ShadedSurface.prototype.resize = function() {
    this.scene.meshes[0] = this.makeMesh();
    this.distortMesh(this.options.depthTransform);
    this.renderer.setSize(this.options.$container.offsetWidth + 2 * this.options.distortion,
            this.options.$container.offsetHeight + 2 * this.options.distortion);
    return this;
};

/**
 * Generate a fresh mesh material and geometry based on container dimensions
 * @param  {FSS Geometry} geometry - Pass an existing geom if desired
 * @param  {FSS Material} material - Pass an existing material if desired
 * @return {FSS Mesh}              - Returns the (undistorted) Mesh
 */
ShadedSurface.prototype.makeMesh = function(geometry, material) {
    var w = this.options.$container.offsetWidth,
        h = this.options.$container.offsetHeight;
    if (!geometry) {
        geometry = new FSS.Plane(
            w + 2 * this.options.distortion,
            h + 2 * this.options.distortion,
            Math.floor(w / this.options.cellsize),
            Math.floor(h / this.options.cellsize)
            );
    }
    if (!material) {
        material = new FSS.Material(this.options.materialAmbient, this.options.materialDiffuse,
            this.options.fillOpacity, this.options.strokeOpacity, this.options.strokeWidth);
    }
    return new FSS.Mesh(geometry, material);
};

/**
 * Shift the positions of the vertices in the instance's mesh,
 * according to options.distortion for x and y, and options.depth for
 * z.  Also accepts a depthTransform function to allow setting depth based on
 * x and y position.
 *
 * @param  {function} depthTransform - f(vx, vy, depth) --> {float} depth
  */
ShadedSurface.prototype.distortMesh = function(depthTransform) {
    var Mesh = this.scene.meshes[0],
        v,
        vertex,
        distortion = this.options.distortion,
        depth = this.options.depth,
        dt = depthTransform || function(x, y, d) {
            return Math.randomInRange(-d, d);
        };
    for (v = Mesh.geometry.vertices.length - 1; v >= 0; v--) {
      vertex = Mesh.geometry.vertices[v];
      vertex.position[0] = Math.round(vertex.position[0] + Math.randomInRange(-distortion, distortion));
      vertex.position[1] = Math.round(vertex.position[1] + Math.randomInRange(-distortion, distortion));
      vertex.position[2] = dt(vertex.position[0], vertex.position[1], depth);
    }
    Mesh.geometry.dirty = true;
    return this;
};

/**
 * Reposition the lights and draw the surface.
 */
ShadedSurface.prototype.draw = function() {
    var self = this,
        lightDef,
        w = this.getWidth(),
        h = this.getHeight();

    // util to allow passing of functions as position values
    function get(val) {
        if (typeof val === "function") {
            return val(w, h); // pass dimensions to function
        } else {
            return val;
        }
    }

    // set light positions
    for (var i = 0; i < this.scene.lights.length ; i++) {
        var lightDef = this.lightDefs[i];
        self.scene.lights[i].setPosition(get(lightDef.x), get(lightDef.y), get(lightDef.z));
    }

    // render
    this.renderer.render(this.scene);
    return this;
};

/**
 * Set the whole thing black via material attributes
  */
ShadedSurface.prototype.dark = function() {
    this.scene.meshes[0].material.ambient = new FSS.Color('#000000');
    this.scene.meshes[0].material.diffuse = new FSS.Color('#000000');
    this.renderer.render(this.scene);
    return this;
};


// Yanked from D3
function d3_ease_cubicInOut(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var t2 = t * t, t3 = t2 * t;
    return 4 * (t < .5 ? t3 : 3 * (t - t2) + t3 - .75);
};


/**
 * Animate the lights from their start positions to final positions.
 * If no start position is specified for a light in options.lightDefs,
 * then it will just start from [0, 0, 0].
 *
 * @param  {integer} frames number of frames to tween over (@60fps)
 * @return {[type]}        [description]
 */
ShadedSurface.prototype.lightUp = function(frames) {
    var self = this,
        w = self.getWidth(),
        h = self.getHeight(),
        frames = Math.round(Number(frames)) || 60,
        step = 0,
        easer = d3_ease_cubicInOut;

    // util to allow passing of functions as position values
    function get(val) {
        if (typeof val === "function") {
            return val(w, h); // pass dimensions to function
        } else {
            return val;
        }
    }

    for (var i = 0;  i < self.scene.lights.length ; i++) {
        var light = self.scene.lights[i],
            def = self.lightDefs[i];

        if (def.start) {
            light.start = [get(def.start.x), get(def.start.y), get(def.start.z)];
        } else {
            light.start = [0, 0, 0];
        }

        light.diff = [light.position[0] - light.start[0],
            light.position[1] - light.start[1],
            light.position[2] - light.start[2]];
    }

    function dodraw() {
        var t = easer(step/frames); // get eased normalized transformation
        // Set stepped light positions
        for (var i = 0;  i < self.scene.lights.length ; i++) {
            var light = self.scene.lights[i];
            light.setPosition(
                light.start[0] + light.diff[0] * t,
                light.start[1] + light.diff[1] * t,
                light.start[2] + light.diff[2] * t
            )
        }
        // Actually draw
        self.renderer.render(self.scene);
        // continue via RAF
        if (step < frames) {
            step++;
            window.requestAnimationFrame(dodraw);
        }
    }

    // Before lighting up, reset the mesh color defs,
    // assuming Shader.dark() has been called
    self.scene.meshes[0].material.ambient = new FSS.Color(self.options.materialAmbient);
    self.scene.meshes[0].material.diffuse = new FSS.Color(self.options.materialDiffuse);
    dodraw();
};


/*
    Accessors for computed dimensions, fall back to
    container DOM queries if the Mesh has not been created
 */
ShadedSurface.prototype.getHeight = function() {
    var mesh = this.scene.meshes[0];
    if (mesh) {
        return mesh.geometry.height;
    } else {
        return this.options.$container.offsetHeight;
    }
};

ShadedSurface.prototype.getWidth = function() {
    var mesh = this.scene.meshes[0];
    if (mesh) {
        return mesh.geometry.width;
    } else {
        return this.options.$container.offsetWidth;
    }
};
})(this);
