'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let surfaceWebCam;              // A substrate for webcam image
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let iTextureWebCam = -1;

let video;

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // PATH ZERO: DRAW ZERO PARALLAX WEBCAM

    if (iTextureWebCam >= 0) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0,0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }

    let matrOrth = m4.orthographic(0,1,0,1, 8,20);
    
    // TODO: Place your code here to draw webCam surface

    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    const colorPolygon = new Float32Array([0.5,0.5,0.5,1]);
    const colorEdge    = new Float32Array([1,1,1,1]);

    // The FIRST PASS (for the left eye)

    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4. translation(stereoCam.eyeSeparation/2, 0, 0);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0 );
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1 );
        
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1,0);
    
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // The SECOND PASS (for the right eye)

    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4. translation(-stereoCam.eyeSeparation/2, 0, 0);

    matAccum0 = m4.multiply(rotateToPointZero, modelView );
    matAccum1 = m4.multiply(translateRightEye, matAccum0 );
    matAccum2 = m4.multiply(translateToPointZero, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon );
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge );
    surface.DrawWireframe();

    // RESET specific params to their default state

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}



/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    let data = {};
    
    CreateSurfaceData(data)

    surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.indicesU16);

    surfaceWebCam = new Model('SurfaceWebCam');
    // TODO: Place your code here to load two triangle geomtery


    stereoCam = new StereoCamera(
        .7,     // decimeters
        14.0,   // decimeters
        1.3,    // aspect ratio of canvas
        0.4,    // radians
        8.0,    // decimeters
        20.0    // decimeters
    );

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    video = document.createElement('video');
    video.autoplay = true;

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);

        video.play();
    }  )
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
    }
    );

    setInterval(draw, 1/20);

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}


// let socket = new WebSocket("ws://192.168.0.102:8080/sensor/connect&type=android.sensor.magnetic_field");

// socket.onopen  =function() {
//     console.log("Connected");
//     socket.send("Hello, server!");
// }

// socket.onmessage = function(event) 
// {
//     console.log("Received:", event.data);

// }

// function quatMultiply(q1, q2) {
//     const [w1,x1,y1,z1] = q1;
//     const [w2,x2,y2,z2] = q2;
//     return [
//       w1*w2 - x1*x2 - y1*y2 - z1*z2,
//       w1*x2 + x1*w2 + y1*z2 - z1*y2,
//       w1*y2 - x1*z2 + y1*w2 + z1*x2,
//       w1*z2 + x1*y2 - y1*x2 + z1*w2
//     ];
//   }

//   // angles3d- array of angles
//   // magnRad- magnitude
//   function quatFromEulerAngles(angles3d, magnRad) {
//     const half = magnRad / 2;
//     const sin = Math.sin(half);
//     return [
//       Math.cos(half),
//       angles3d[0]*sin,
//       angles3d[1]*sin,
//       angles3d[2]*sin
//     ];
//   }

//   function quatToEulerZXY(q) {
//     const [w, x, y, z] = q;

//     const beta  = Math.asin(clamp(2 * (w*x + y*z), -1, 1));
//     const alpha = Math.atan2(-2 * (x*y - w*z), 1 - 2 * (x*x + z*z));
//     const gamma = Math.atan2(-2 * (x*z - w*y), 1 - 2 * (x*x + y*y));

//     return [
//       radToDeg(alpha), // Z
//       radToDeg(beta),  // X
//       radToDeg(gamma)  // Y
//     ];
//   }

//   function radToDeg(r) { return r * 180 / Math.PI; }
//   function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

//   let lastTimeStamp = null;
//   let orientationQ = [1,0,0,0];

//   .addEventListener(jsonData)
//   {
//     const t = jsonData.timeStamp;
//     const alpha = jsonData.alpha;
//     const beta  = jsonData.alpha;
//     const gamma = jsonData.alpha;


//     if (lastTimeStamp !== null) {

//         const dt = (t - lastTimeStamp) / 1000;  // ms
//         const wx = degToRad(alpha);
//         const wy = degToRad(beta);
//         const wz = degToRad(gamma);

//         const omega = [wx, wy, wz];
//         const mag = Math.hypot(..omega);

//         if (mag > 0.0001)
//         {
//             const angles3d = omega.map(v => v / mag);
//             const magnRad = mag*dt;
//             const dq = quatFromEulerAngles(angles3d, magnRad);
//             orientationQ = quatMultiply(orientationQ, dq);
//         }

//         lastTimeStamp = t;
//     }

//   }


// window.webkitAudio
// window.AudioContext

// function LoadAudio()
// {
//     var ctx = window.AudioContext;

//     var sound = {};

//     sound.source = ctx.createBufferSource();
//     sound.mainVolume = ctx.createGain();
//     sound.biquadFilter = ctx.createBiquadFilter();

//     sound.biquadFilter.type = "lowpass";
//     sound.biquadFilter.frequency.value = 500;   // Hz
//     sound.biquadFilter.gain.value = 25; // db

//     sound.source.connect(sound.mainVolume);
//     sound.mainVolume.connect(sound.biquadFilter);
//     sound.biquadFilter.connect(ctx.destination);

//     var request = new XMLHttpRequest();

//     request.open("GET", "http://127.0.0.1:3000/music.ogg", true);
//     request.responseType = "arraybuffer";
//     request.onload = function(e)
//     {
//         ctx.decodeAudioData(this.response, function onSuccess(buffer))
//         {
//             sound.buffer = buffer;
//             sound.source.buffer = bauffer;

//             sound.source.start(ctx.current);
//         }
//     }
//     request.send();

//     sound.panner = ctx.createPanner();
//     sound.mainVolume.connect(sound.panner);

//     // p- is a global position from PA#2
//     sound.panner.setPosition(p.x, p.y, p.z);

// }