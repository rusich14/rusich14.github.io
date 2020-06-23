window.onload = function () {
  var select = document.getElementById('select');

  setSrc();
  CanvasInit();

  select.addEventListener('change', function () {
    setSrc();
    CanvasInit();
  });

  function setSrc() {
    var viewer = document.getElementById('viewer');
    var canvas = viewer.querySelector('canvas');

    if (canvas) {
      canvas.remove();
    }

    viewer.setAttribute('data-src', 'models/' + select.value + '/' + select.value);
  }

  function CanvasInit() {
    var canvasWrap = document.getElementById('viewer');
    var fileSrc = canvasWrap.getAttribute('data-src');
    var size = {
      x: canvasWrap.offsetWidth,
      y: canvasWrap.offsetHeight,
    };
    var colors = {
      white: 0xffffff,
      grey: 0xcccccc,
    };
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, size.x / size.y, 0.1, 500);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(size.x, size.y);
    renderer.setClearColor(colors.white);
    camera.position.z = 20;
    canvasWrap.appendChild(renderer.domElement);

    // scene.add(new THREE.AxesHelper(25));

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.minDistance = 0;
    controls.maxDistance = 100;
    controls.update();

    function directLight(lightColor, intensive, x, y, z) {
      var light = new THREE.DirectionalLight(lightColor, intensive);
      light.position.set(x, y, z);

      return light;
    }

    scene.add(directLight(colors.white, 0.8, 5, 5, 5));
    scene.add(directLight(colors.white, 0.5, -5, -5, -5));
    scene.add(new THREE.AmbientLight(colors.white, 0.3));

    var mtlLoader = new THREE.MTLLoader();
    var objLoader = new THREE.OBJLoader2();

    mtlLoader.load(`${fileSrc}.mtl`, (mtlParseResult) => {
      if (mtlParseResult instanceof THREE.MTLLoader.MaterialCreator) {
        var materials = THREE.MtlObjBridge.addMaterialsFromMtlLoader(mtlParseResult);

        materials.side = THREE.DoubleSide;
        objLoader.addMaterials(materials);

        objLoader.load(`${fileSrc}.obj`, (root) => {
          if (mtlParseResult instanceof THREE.MTLLoader.MaterialCreator) {
            scene.add(root);
          }
        });
      }
    });

    var render = function () {
      requestAnimationFrame(render);
      renderer.render(scene, camera);
    };

    render();
  }
};
