/**
 * @author Kai Salmen / https://kaisalmen.de
 * Development repository: https://github.com/kaisalmen/WWOBJLoader
 */

THREE.OBJLoader2Parser = function () {
  this.logging = {
    enabled: false,
    debug: false
  };
  let scope = this;
  this.callbacks = {
    onProgress: function (text) {
      scope._onProgress(text);
    },
    onAssetAvailable: function (payload) {
      scope._onAssetAvailable(payload);
    },
    onError: function (errorMessage) {
      scope._onError(errorMessage);
    },
    onLoad: function (object3d, message) {
      scope._onLoad(object3d, message);
    },
  };
  this.contentRef = null;
  this.legacyMode = false;
  this.materials = {};
  this.materialPerSmoothingGroup = false;
  this.useOAsMesh = false;
  this.useIndices = false;
  this.disregardNormals = false;
  this.vertices = [];
  this.colors = [];
  this.normals = [];
  this.uvs = [];
  this.rawMesh = {
    objectName: '',
    groupName: '',
    activeMtlName: '',
    mtllibName: '',
    faceType: -1,
    subGroups: [],
    subGroupInUse: null,
    smoothingGroup: {
      splitMaterials: false,
      normalized: -1,
      real: -1
    },
    counts: {
      doubleIndicesCount: 0,
      faceCount: 0,
      mtlCount: 0,
      smoothingGroupCount: 0
    }
  };
  this.inputObjectCount = 1;
  this.outputObjectCount = 1;
  this.globalCounts = {
    vertices: 0,
    faces: 0,
    doubleIndicesCount: 0,
    lineByte: 0,
    currentByte: 0,
    totalBytes: 0
  };

};

THREE.OBJLoader2Parser.prototype = {
  constructor: THREE.OBJLoader2Parser,
  _resetRawMesh: function () {
    this.rawMesh.subGroups = [];
    this.rawMesh.subGroupInUse = null;
    this.rawMesh.smoothingGroup.normalized = -1;
    this.rawMesh.smoothingGroup.real = -1;
    this._pushSmoothingGroup(1);
    this.rawMesh.counts.doubleIndicesCount = 0;
    this.rawMesh.counts.faceCount = 0;
    this.rawMesh.counts.mtlCount = 0;
    this.rawMesh.counts.smoothingGroupCount = 0;
  },
  setMaterialPerSmoothingGroup: function (materialPerSmoothingGroup) {
    this.materialPerSmoothingGroup = materialPerSmoothingGroup === true;
    return this;
  },
  setUseOAsMesh: function (useOAsMesh) {
    this.useOAsMesh = useOAsMesh === true;
    return this;
  },
  setUseIndices: function (useIndices) {
    this.useIndices = useIndices === true;
    return this;
  },
  setDisregardNormals: function (disregardNormals) {
    this.disregardNormals = disregardNormals === true;
    return this;
  },
  setMaterials: function (materials) {
    this.materials = Object.assign({}, materials);
  },
  setCallbackOnAssetAvailable: function (onAssetAvailable) {
    if (onAssetAvailable !== null && onAssetAvailable !== undefined && onAssetAvailable instanceof Function) {
      this.callbacks.onAssetAvailable = onAssetAvailable;
    }
    return this;
  },
  setCallbackOnProgress: function (onProgress) {
    if (onProgress !== null && onProgress !== undefined && onProgress instanceof Function) {
      this.callbacks.onProgress = onProgress;
    }
    return this;
  },
  setCallbackOnError: function (onError) {
    if (onError !== null && onError !== undefined && onError instanceof Function) {
      this.callbacks.onError = onError;
    }
    return this;
  },
  setCallbackOnLoad: function (onLoad) {
    if (onLoad !== null && onLoad !== undefined && onLoad instanceof Function) {
      this.callbacks.onLoad = onLoad;
    }
    return this;
  },
  _onProgress: function (text) {
    let message = text ? text : '';
    if (this.logging.enabled && this.logging.debug) {
      console.log(message);
    }
  },
  _onError: function (errorMessage) {
    if (this.logging.enabled && this.logging.debug) {
      console.error(errorMessage);
    }
  },
  _onAssetAvailable: function (payload) {
    let errorMessage = 'OBJLoader2Parser does not provide implementation for onAssetAvailable. Aborting...';
    this.callbacks.onError(errorMessage);
    throw errorMessage;
  },
  _onLoad: function (object3d, message) {
    console.log('You reached parser default onLoad callback: ' + message);
  },
  setLogging: function (enabled, debug) {
    this.logging.enabled = enabled === true;
    this.logging.debug = debug === true;
    return this;
  },
  _configure: function () {
    this._pushSmoothingGroup(1);
    if (this.logging.enabled) {
      let matKeys = Object.keys(this.materials);
      let matNames = (matKeys.length > 0) ? '\n\tmaterialNames:\n\t\t- ' + matKeys.join('\n\t\t- ') : '\n\tmaterialNames: None';
      let printedConfig = 'OBJLoader.Parser configuration:'
        + matNames
        + '\n\tmaterialPerSmoothingGroup: ' + this.materialPerSmoothingGroup
        + '\n\tuseOAsMesh: ' + this.useOAsMesh
        + '\n\tuseIndices: ' + this.useIndices
        + '\n\tdisregardNormals: ' + this.disregardNormals;
      printedConfig += '\n\tcallbacks.onProgress: ' + this.callbacks.onProgress.name;
      printedConfig += '\n\tcallbacks.onAssetAvailable: ' + this.callbacks.onAssetAvailable.name;
      printedConfig += '\n\tcallbacks.onError: ' + this.callbacks.onError.name;
      console.info(printedConfig);
    }
  },
  execute: function (arrayBuffer) {
    if (this.logging.enabled) console.time('OBJLoader2Parser.execute');
    this._configure();
    let arrayBufferView = new Uint8Array(arrayBuffer);
    this.contentRef = arrayBufferView;
    let length = arrayBufferView.byteLength;
    this.globalCounts.totalBytes = length;
    let buffer = new Array(128);
    for (let code, word = '', bufferPointer = 0, slashesCount = 0, i = 0; i < length; i++) {
      code = arrayBufferView[i];
      switch (code) {
        case 32:
          if (word.length > 0) buffer[bufferPointer++] = word;
          word = '';
          break;
        case 47:
          if (word.length > 0) buffer[bufferPointer++] = word;
          slashesCount++;
          word = '';
          break;
        case 10:
          if (word.length > 0) buffer[bufferPointer++] = word;
          word = '';
          this.globalCounts.lineByte = this.globalCounts.currentByte;
          this.globalCounts.currentByte = i;
          this._processLine(buffer, bufferPointer, slashesCount);
          bufferPointer = 0;
          slashesCount = 0;
          break;
        case 13:
          break;
        default:
          word += String.fromCharCode(code);
          break;
      }
    }
    this._finalizeParsing();
    if (this.logging.enabled) console.timeEnd('OBJLoader2Parser.execute');
  },
  executeLegacy: function (text) {
    if (this.logging.enabled) console.time('OBJLoader2Parser.executeLegacy');
    this._configure();
    this.legacyMode = true;
    this.contentRef = text;
    let length = text.length;
    this.globalCounts.totalBytes = length;
    let buffer = new Array(128);
    for (let char, word = '', bufferPointer = 0, slashesCount = 0, i = 0; i < length; i++) {
      char = text[i];
      switch (char) {
        case ' ':
          if (word.length > 0) buffer[bufferPointer++] = word;
          word = '';
          break;
        case '/':
          if (word.length > 0) buffer[bufferPointer++] = word;
          slashesCount++;
          word = '';
          break;
        case '\n':
          if (word.length > 0) buffer[bufferPointer++] = word;
          word = '';
          this.globalCounts.lineByte = this.globalCounts.currentByte;
          this.globalCounts.currentByte = i;
          this._processLine(buffer, bufferPointer, slashesCount);
          bufferPointer = 0;
          slashesCount = 0;
          break;
        case '\r':
          break;
        default:
          word += char;
      }
    }
    this._finalizeParsing();
    if (this.logging.enabled) console.timeEnd('OBJLoader2Parser.executeLegacy');
  },
  _processLine: function (buffer, bufferPointer, slashesCount) {
    if (bufferPointer < 1) return;
    let reconstructString = function (content, legacyMode, start, stop) {
      let line = '';
      if (stop > start) {
        let i;
        if (legacyMode) {
          for (i = start; i < stop; i++) line += content[i];
        } else {
          for (i = start; i < stop; i++) line += String.fromCharCode(content[i]);
        }
        line = line.trim();
      }
      return line;
    };
    let bufferLength, length, i, lineDesignation;
    lineDesignation = buffer[0];
    switch (lineDesignation) {
      case 'v':
        this.vertices.push(parseFloat(buffer[1]));
        this.vertices.push(parseFloat(buffer[2]));
        this.vertices.push(parseFloat(buffer[3]));
        if (bufferPointer > 4) {
          this.colors.push(parseFloat(buffer[4]));
          this.colors.push(parseFloat(buffer[5]));
          this.colors.push(parseFloat(buffer[6]));
        }
        break;
      case 'vt':
        this.uvs.push(parseFloat(buffer[1]));
        this.uvs.push(parseFloat(buffer[2]));
        break;
      case 'vn':
        this.normals.push(parseFloat(buffer[1]));
        this.normals.push(parseFloat(buffer[2]));
        this.normals.push(parseFloat(buffer[3]));
        break;
      case 'f':
        bufferLength = bufferPointer - 1;
        if (slashesCount === 0) {
          this._checkFaceType(0);
          for (i = 2, length = bufferLength; i < length; i++) {
            this._buildFace(buffer[1]);
            this._buildFace(buffer[i]);
            this._buildFace(buffer[i + 1]);
          }
        } else if (bufferLength === slashesCount * 2) {
          this._checkFaceType(1);
          for (i = 3, length = bufferLength - 2; i < length; i += 2) {
            this._buildFace(buffer[1], buffer[2]);
            this._buildFace(buffer[i], buffer[i + 1]);
            this._buildFace(buffer[i + 2], buffer[i + 3]);
          }
        } else if (bufferLength * 2 === slashesCount * 3) {
          this._checkFaceType(2);
          for (i = 4, length = bufferLength - 3; i < length; i += 3) {
            this._buildFace(buffer[1], buffer[2], buffer[3]);
            this._buildFace(buffer[i], buffer[i + 1], buffer[i + 2]);
            this._buildFace(buffer[i + 3], buffer[i + 4], buffer[i + 5]);
          }
        } else {
          this._checkFaceType(3);
          for (i = 3, length = bufferLength - 2; i < length; i += 2) {
            this._buildFace(buffer[1], undefined, buffer[2]);
            this._buildFace(buffer[i], undefined, buffer[i + 1]);
            this._buildFace(buffer[i + 2], undefined, buffer[i + 3]);
          }
        }
        break;
      case 'l':
      case 'p':
        bufferLength = bufferPointer - 1;
        if (bufferLength === slashesCount * 2) {
          this._checkFaceType(4);
          for (i = 1, length = bufferLength + 1; i < length; i += 2) this._buildFace(buffer[i], buffer[i + 1]);
        } else {
          this._checkFaceType((lineDesignation === 'l') ? 5 : 6);
          for (i = 1, length = bufferLength + 1; i < length; i++) this._buildFace(buffer[i]);
        }
        break;
      case 's':
        this._pushSmoothingGroup(buffer[1]);
        break;
      case 'g':
        this._processCompletedMesh();
        this.rawMesh.groupName = reconstructString(this.contentRef, this.legacyMode, this.globalCounts.lineByte + 2, this.globalCounts.currentByte);
        break;
      case 'o':
        if (this.useOAsMesh) this._processCompletedMesh();
        this.rawMesh.objectName = reconstructString(this.contentRef, this.legacyMode, this.globalCounts.lineByte + 2, this.globalCounts.currentByte);
        break;
      case 'mtllib':
        this.rawMesh.mtllibName = reconstructString(this.contentRef, this.legacyMode, this.globalCounts.lineByte + 7, this.globalCounts.currentByte);
        break;
      case 'usemtl':
        let mtlName = reconstructString(this.contentRef, this.legacyMode, this.globalCounts.lineByte + 7, this.globalCounts.currentByte);
        if (mtlName !== '' && this.rawMesh.activeMtlName !== mtlName) {
          this.rawMesh.activeMtlName = mtlName;
          this.rawMesh.counts.mtlCount++;
          this._checkSubGroup();
        }
        break;
      default:
        break;
    }
  },
  _pushSmoothingGroup: function (smoothingGroup) {
    let smoothingGroupInt = parseInt(smoothingGroup);
    if (isNaN(smoothingGroupInt)) {
      smoothingGroupInt = smoothingGroup === 'off' ? 0 : 1;
    }
    let smoothCheck = this.rawMesh.smoothingGroup.normalized;
    this.rawMesh.smoothingGroup.normalized = this.rawMesh.smoothingGroup.splitMaterials ? smoothingGroupInt : (smoothingGroupInt === 0) ? 0 : 1;
    this.rawMesh.smoothingGroup.real = smoothingGroupInt;
    if (smoothCheck !== smoothingGroupInt) {
      this.rawMesh.counts.smoothingGroupCount++;
      this._checkSubGroup();
    }
  },
  _checkFaceType: function (faceType) {
    if (this.rawMesh.faceType !== faceType) {
      this._processCompletedMesh();
      this.rawMesh.faceType = faceType;
      this._checkSubGroup();
    }
  },
  _checkSubGroup: function () {
    let index = this.rawMesh.activeMtlName + '|' + this.rawMesh.smoothingGroup.normalized;
    this.rawMesh.subGroupInUse = this.rawMesh.subGroups[index];
    if (this.rawMesh.subGroupInUse === undefined || this.rawMesh.subGroupInUse === null) {
      this.rawMesh.subGroupInUse = {
        index: index,
        objectName: this.rawMesh.objectName,
        groupName: this.rawMesh.groupName,
        materialName: this.rawMesh.activeMtlName,
        smoothingGroup: this.rawMesh.smoothingGroup.normalized,
        vertices: [],
        indexMappingsCount: 0,
        indexMappings: [],
        indices: [],
        colors: [],
        uvs: [],
        normals: []
      };
      this.rawMesh.subGroups[index] = this.rawMesh.subGroupInUse;
    }
  },
  _buildFace: function (faceIndexV, faceIndexU, faceIndexN) {
    let subGroupInUse = this.rawMesh.subGroupInUse;
    let scope = this;
    let updateSubGroupInUse = function () {
      let faceIndexVi = parseInt(faceIndexV);
      let indexPointerV = 3 * (faceIndexVi > 0 ? faceIndexVi - 1 : faceIndexVi + scope.vertices.length / 3);
      let indexPointerC = scope.colors.length > 0 ? indexPointerV : null;
      let vertices = subGroupInUse.vertices;
      vertices.push(scope.vertices[indexPointerV++]);
      vertices.push(scope.vertices[indexPointerV++]);
      vertices.push(scope.vertices[indexPointerV]);
      if (indexPointerC !== null) {
        let colors = subGroupInUse.colors;
        colors.push(scope.colors[indexPointerC++]);
        colors.push(scope.colors[indexPointerC++]);
        colors.push(scope.colors[indexPointerC]);
      }
      if (faceIndexU) {
        let faceIndexUi = parseInt(faceIndexU);
        let indexPointerU = 2 * (faceIndexUi > 0 ? faceIndexUi - 1 : faceIndexUi + scope.uvs.length / 2);
        let uvs = subGroupInUse.uvs;
        uvs.push(scope.uvs[indexPointerU++]);
        uvs.push(scope.uvs[indexPointerU]);
      }
      if (faceIndexN && !scope.disregardNormals) {
        let faceIndexNi = parseInt(faceIndexN);
        let indexPointerN = 3 * (faceIndexNi > 0 ? faceIndexNi - 1 : faceIndexNi + scope.normals.length / 3);
        let normals = subGroupInUse.normals;
        normals.push(scope.normals[indexPointerN++]);
        normals.push(scope.normals[indexPointerN++]);
        normals.push(scope.normals[indexPointerN]);
      }
    };
    if (this.useIndices) {
      if (this.disregardNormals) faceIndexN = undefined;
      let mappingName = faceIndexV + (faceIndexU ? '_' + faceIndexU : '_n') + (faceIndexN ? '_' + faceIndexN : '_n');
      let indicesPointer = subGroupInUse.indexMappings[mappingName];
      if (indicesPointer === undefined || indicesPointer === null) {
        indicesPointer = this.rawMesh.subGroupInUse.vertices.length / 3;
        updateSubGroupInUse();
        subGroupInUse.indexMappings[mappingName] = indicesPointer;
        subGroupInUse.indexMappingsCount++;
      } else {
        this.rawMesh.counts.doubleIndicesCount++;
      }
      subGroupInUse.indices.push(indicesPointer);
    } else {
      updateSubGroupInUse();
    }
    this.rawMesh.counts.faceCount++;
  },
  _createRawMeshReport: function (inputObjectCount) {
    return 'Input Object number: ' + inputObjectCount +
      '\n\tObject name: ' + this.rawMesh.objectName +
      '\n\tGroup name: ' + this.rawMesh.groupName +
      '\n\tMtllib name: ' + this.rawMesh.mtllibName +
      '\n\tVertex count: ' + this.vertices.length / 3 +
      '\n\tNormal count: ' + this.normals.length / 3 +
      '\n\tUV count: ' + this.uvs.length / 2 +
      '\n\tSmoothingGroup count: ' + this.rawMesh.counts.smoothingGroupCount +
      '\n\tMaterial count: ' + this.rawMesh.counts.mtlCount +
      '\n\tReal MeshOutputGroup count: ' + this.rawMesh.subGroups.length;
  },
  /**
   * Clear any empty subGroup and calculate absolute vertex, normal and uv counts
   */
  _finalizeRawMesh: function () {
    let meshOutputGroupTemp = [];
    let meshOutputGroup;
    let absoluteVertexCount = 0;
    let absoluteIndexMappingsCount = 0;
    let absoluteIndexCount = 0;
    let absoluteColorCount = 0;
    let absoluteNormalCount = 0;
    let absoluteUvCount = 0;
    let indices;
    for (let name in this.rawMesh.subGroups) {
      meshOutputGroup = this.rawMesh.subGroups[name];
      if (meshOutputGroup.vertices.length > 0) {
        indices = meshOutputGroup.indices;
        if (indices.length > 0 && absoluteIndexMappingsCount > 0) {
          for (let i = 0; i < indices.length; i++) {
            indices[i] = indices[i] + absoluteIndexMappingsCount;
          }
        }
        meshOutputGroupTemp.push(meshOutputGroup);
        absoluteVertexCount += meshOutputGroup.vertices.length;
        absoluteIndexMappingsCount += meshOutputGroup.indexMappingsCount;
        absoluteIndexCount += meshOutputGroup.indices.length;
        absoluteColorCount += meshOutputGroup.colors.length;
        absoluteUvCount += meshOutputGroup.uvs.length;
        absoluteNormalCount += meshOutputGroup.normals.length;
      }
    }
    let result = null;
    if (meshOutputGroupTemp.length > 0) {
      result = {
        name: this.rawMesh.groupName !== '' ? this.rawMesh.groupName : this.rawMesh.objectName,
        subGroups: meshOutputGroupTemp,
        absoluteVertexCount: absoluteVertexCount,
        absoluteIndexCount: absoluteIndexCount,
        absoluteColorCount: absoluteColorCount,
        absoluteNormalCount: absoluteNormalCount,
        absoluteUvCount: absoluteUvCount,
        faceCount: this.rawMesh.counts.faceCount,
        doubleIndicesCount: this.rawMesh.counts.doubleIndicesCount
      };
    }
    return result;
  },
  _processCompletedMesh: function () {
    let result = this._finalizeRawMesh();
    let haveMesh = result !== null;
    if (haveMesh) {
      if (this.colors.length > 0 && this.colors.length !== this.vertices.length) {
        this.callbacks.onError('Vertex Colors were detected, but vertex count and color count do not match!');
      }
      if (this.logging.enabled && this.logging.debug) console.debug(this._createRawMeshReport(this.inputObjectCount));
      this.inputObjectCount++;
      this._buildMesh(result);
      let progressBytesPercent = this.globalCounts.currentByte / this.globalCounts.totalBytes;
      this._onProgress('Completed [o: ' + this.rawMesh.objectName + ' g:' + this.rawMesh.groupName + '' +
        '] Total progress: ' + (progressBytesPercent * 100).toFixed(2) + '%');
      this._resetRawMesh();
    }
    return haveMesh;
  },
  _buildMesh: function (result) {
    let meshOutputGroups = result.subGroups;
    let vertexFA = new Float32Array(result.absoluteVertexCount);
    this.globalCounts.vertices += result.absoluteVertexCount / 3;
    this.globalCounts.faces += result.faceCount;
    this.globalCounts.doubleIndicesCount += result.doubleIndicesCount;
    let indexUA = (result.absoluteIndexCount > 0) ? new Uint32Array(result.absoluteIndexCount) : null;
    let colorFA = (result.absoluteColorCount > 0) ? new Float32Array(result.absoluteColorCount) : null;
    let normalFA = (result.absoluteNormalCount > 0) ? new Float32Array(result.absoluteNormalCount) : null;
    let uvFA = (result.absoluteUvCount > 0) ? new Float32Array(result.absoluteUvCount) : null;
    let haveVertexColors = colorFA !== null;
    let meshOutputGroup;
    let materialNames = [];
    let createMultiMaterial = (meshOutputGroups.length > 1);
    let materialIndex = 0;
    let materialIndexMapping = [];
    let selectedMaterialIndex;
    let materialGroup;
    let materialGroups = [];
    let vertexFAOffset = 0;
    let indexUAOffset = 0;
    let colorFAOffset = 0;
    let normalFAOffset = 0;
    let uvFAOffset = 0;
    let materialGroupOffset = 0;
    let materialGroupLength = 0;
    let materialOrg, material, materialName, materialNameOrg;
    for (let oodIndex in meshOutputGroups) {
      if (!meshOutputGroups.hasOwnProperty(oodIndex)) continue;
      meshOutputGroup = meshOutputGroups[oodIndex];
      materialNameOrg = meshOutputGroup.materialName;
      if (this.rawMesh.faceType < 4) {
        materialName = materialNameOrg + (haveVertexColors ? '_vertexColor' : '') + (meshOutputGroup.smoothingGroup === 0 ? '_flat' : '');
      } else {
        materialName = this.rawMesh.faceType === 6 ? 'defaultPointMaterial' : 'defaultLineMaterial';
      }
      materialOrg = this.materials[materialNameOrg];
      material = this.materials[materialName];
      if ((materialOrg === undefined || materialOrg === null) && (material === undefined || material === null)) {
        materialName = haveVertexColors ? 'defaultVertexColorMaterial' : 'defaultMaterial';
        material = this.materials[materialName];
        if (this.logging.enabled) {
          console.info('object_group "' + meshOutputGroup.objectName + '_' +
            meshOutputGroup.groupName + '" was defined with unresolvable material "' +
            materialNameOrg + '"! Assigning "' + materialName + '".');
        }
      }
      if (material === undefined || material === null) {
        let materialCloneInstructions = {
          materialNameOrg: materialNameOrg,
          materialName: materialName,
          materialProperties: {
            vertexColors: haveVertexColors ? 2 : 0,
            flatShading: meshOutputGroup.smoothingGroup === 0
          }
        };
        let payload = {
          cmd: 'assetAvailable',
          type: 'material',
          materials: {
            materialCloneInstructions: materialCloneInstructions
          }
        };
        this.callbacks.onAssetAvailable(payload);
        let matCheck = this.materials[materialName];
        if (matCheck === undefined || matCheck === null) {
          this.materials[materialName] = materialCloneInstructions;
        }
      }
      if (createMultiMaterial) {
        selectedMaterialIndex = materialIndexMapping[materialName];
        if (!selectedMaterialIndex) {
          selectedMaterialIndex = materialIndex;
          materialIndexMapping[materialName] = materialIndex;
          materialNames.push(materialName);
          materialIndex++;
        }
        materialGroupLength = this.useIndices ? meshOutputGroup.indices.length : meshOutputGroup.vertices.length / 3;
        materialGroup = {
          start: materialGroupOffset,
          count: materialGroupLength,
          index: selectedMaterialIndex
        };
        materialGroups.push(materialGroup);
        materialGroupOffset += materialGroupLength;
      } else {
        materialNames.push(materialName);
      }
      vertexFA.set(meshOutputGroup.vertices, vertexFAOffset);
      vertexFAOffset += meshOutputGroup.vertices.length;
      if (indexUA) {
        indexUA.set(meshOutputGroup.indices, indexUAOffset);
        indexUAOffset += meshOutputGroup.indices.length;
      }
      if (colorFA) {
        colorFA.set(meshOutputGroup.colors, colorFAOffset);
        colorFAOffset += meshOutputGroup.colors.length;
      }
      if (normalFA) {
        normalFA.set(meshOutputGroup.normals, normalFAOffset);
        normalFAOffset += meshOutputGroup.normals.length;
      }
      if (uvFA) {
        uvFA.set(meshOutputGroup.uvs, uvFAOffset);
        uvFAOffset += meshOutputGroup.uvs.length;
      }
      if (this.logging.enabled && this.logging.debug) {
        let materialIndexLine = (selectedMaterialIndex === undefined || selectedMaterialIndex === null) ? '' : '\n\t\tmaterialIndex: ' + selectedMaterialIndex;
        let createdReport = '\tOutput Object no.: ' + this.outputObjectCount +
          '\n\t\tgroupName: ' + meshOutputGroup.groupName +
          '\n\t\tIndex: ' + meshOutputGroup.index +
          '\n\t\tfaceType: ' + this.rawMesh.faceType +
          '\n\t\tmaterialName: ' + meshOutputGroup.materialName +
          '\n\t\tsmoothingGroup: ' + meshOutputGroup.smoothingGroup +
          materialIndexLine +
          '\n\t\tobjectName: ' + meshOutputGroup.objectName +
          '\n\t\t#vertices: ' + meshOutputGroup.vertices.length / 3 +
          '\n\t\t#indices: ' + meshOutputGroup.indices.length +
          '\n\t\t#colors: ' + meshOutputGroup.colors.length / 3 +
          '\n\t\t#uvs: ' + meshOutputGroup.uvs.length / 2 +
          '\n\t\t#normals: ' + meshOutputGroup.normals.length / 3;
        console.debug(createdReport);
      }
    }
    this.outputObjectCount++;
    this.callbacks.onAssetAvailable(
      {
        cmd: 'assetAvailable',
        type: 'mesh',
        progress: {
          numericalValue: this.globalCounts.currentByte / this.globalCounts.totalBytes
        },
        params: {
          meshName: result.name
        },
        materials: {
          multiMaterial: createMultiMaterial,
          materialNames: materialNames,
          materialGroups: materialGroups
        },
        buffers: {
          vertices: vertexFA,
          indices: indexUA,
          colors: colorFA,
          normals: normalFA,
          uvs: uvFA
        },
        geometryType: this.rawMesh.faceType < 4 ? 0 : (this.rawMesh.faceType === 6) ? 2 : 1
      },
      [vertexFA.buffer],
      indexUA !== null ? [indexUA.buffer] : null,
      colorFA !== null ? [colorFA.buffer] : null,
      normalFA !== null ? [normalFA.buffer] : null,
      uvFA !== null ? [uvFA.buffer] : null
    );
  },
  _finalizeParsing: function () {
    if (this.logging.enabled) console.info('Global output object count: ' + this.outputObjectCount);
    if (this._processCompletedMesh() && this.logging.enabled) {
      let parserFinalReport = 'Overall counts: ' +
        '\n\tVertices: ' + this.globalCounts.vertices +
        '\n\tFaces: ' + this.globalCounts.faces +
        '\n\tMultiple definitions: ' + this.globalCounts.doubleIndicesCount;
      console.info(parserFinalReport);
    }
  }
};

THREE.MaterialHandler = function () {
  this.logging = {
    enabled: false,
    debug: false
  };
  this.callbacks = {
    onLoadMaterials: null
  };
  this.materials = {};
};

THREE.MaterialHandler.prototype = {
  constructor: THREE.MaterialHandler,
  setLogging: function (enabled, debug) {
    this.logging.enabled = enabled === true;
    this.logging.debug = debug === true;
  },
  _setCallbacks: function (onLoadMaterials) {
    if (onLoadMaterials !== undefined && onLoadMaterials !== null && onLoadMaterials instanceof Function) {
      this.callbacks.onLoadMaterials = onLoadMaterials;
    }
  },
  createDefaultMaterials: function (overrideExisting) {
    let defaultMaterial = new THREE.MeshStandardMaterial({ color: 0xDCF1FF });
    defaultMaterial.name = 'defaultMaterial';
    let defaultVertexColorMaterial = new THREE.MeshStandardMaterial({ color: 0xDCF1FF });
    defaultVertexColorMaterial.name = 'defaultVertexColorMaterial';
    defaultVertexColorMaterial.vertexColors = THREE.VertexColors;
    let defaultLineMaterial = new THREE.LineBasicMaterial();
    defaultLineMaterial.name = 'defaultLineMaterial';
    let defaultPointMaterial = new THREE.PointsMaterial({ size: 0.1 });
    defaultPointMaterial.name = 'defaultPointMaterial';
    let runtimeMaterials = {};
    runtimeMaterials[defaultMaterial.name] = defaultMaterial;
    runtimeMaterials[defaultVertexColorMaterial.name] = defaultVertexColorMaterial;
    runtimeMaterials[defaultLineMaterial.name] = defaultLineMaterial;
    runtimeMaterials[defaultPointMaterial.name] = defaultPointMaterial;
    this.addMaterials(runtimeMaterials, overrideExisting);
  },
  addPayloadMaterials: function (materialPayload) {
    let material, materialName;
    let materialCloneInstructions = materialPayload.materials.materialCloneInstructions;
    let newMaterials = {};
    if (materialCloneInstructions !== undefined && materialCloneInstructions !== null) {
      let materialNameOrg = materialCloneInstructions.materialNameOrg;
      materialNameOrg = (materialNameOrg !== undefined && materialNameOrg !== null) ? materialNameOrg : '';
      let materialOrg = this.materials[materialNameOrg];
      if (materialOrg) {
        material = materialOrg.clone();
        materialName = materialCloneInstructions.materialName;
        material.name = materialName;
        Object.assign(material, materialCloneInstructions.materialProperties);
        this.materials[materialName] = material;
        newMaterials[materialName] = material;
      } else {
        if (this.logging.enabled) {
          console.info('Requested material "' + materialNameOrg + '" is not available!');
        }
      }
    }
    let materials = materialPayload.materials.serializedMaterials;
    if (materials !== undefined && materials !== null && Object.keys(materials).length > 0) {
      let loader = new THREE.MaterialLoader();
      let materialJson;
      for (materialName in materials) {
        materialJson = materials[materialName];
        if (materialJson !== undefined && materialJson !== null) {
          material = loader.parse(materialJson);
          if (this.logging.enabled) {
            console.info('De-serialized material with name "' + materialName + '" will be added.');
          }
          this.materials[materialName] = material;
          newMaterials[materialName] = material;
        }
      }
    }
    materials = materialPayload.materials.runtimeMaterials;
    newMaterials = this.addMaterials(materials, true, newMaterials);
    return newMaterials;
  },
  addMaterials: function (materials, overrideExisting, newMaterials) {
    if (newMaterials === undefined || newMaterials === null) {
      newMaterials = {};
    }
    if (materials !== undefined && materials !== null && Object.keys(materials).length > 0) {
      let material;
      let existingMaterial;
      let add;
      for (let materialName in materials) {
        material = materials[materialName];
        add = overrideExisting === true;
        if (!add) {
          existingMaterial = this.materials[materialName];
          add = (existingMaterial === null || existingMaterial === undefined);
        }
        if (add) {
          this.materials[materialName] = material;
          newMaterials[materialName] = material;
        }
        if (this.logging.enabled && this.logging.debug) {
          console.info('Material with name "' + materialName + '" was added.');
        }
      }
    }
    if (this.callbacks.onLoadMaterials) {
      this.callbacks.onLoadMaterials(newMaterials);
    }
    return newMaterials;
  },
  getMaterials: function () {
    return this.materials;
  },
  getMaterial: function (materialName) {
    return this.materials[materialName];
  },
  getMaterialsJSON: function () {
    let materialsJSON = {};
    let material;
    for (let materialName in this.materials) {
      material = this.materials[materialName];
      materialsJSON[materialName] = material.toJSON();
    }
    return materialsJSON;
  },
  clearMaterials: function () {
    this.materials = {};
  }
};
THREE.MeshReceiver = function (materialHandler) {
  this.logging = {
    enabled: false,
    debug: false
  };
  this.callbacks = {
    onProgress: null,
    onMeshAlter: null
  };
  this.materialHandler = materialHandler;

};

THREE.MeshReceiver.prototype = {
  constructor: THREE.MeshReceiver,
  setLogging: function (enabled, debug) {
    this.logging.enabled = enabled === true;
    this.logging.debug = debug === true;
  },
  _setCallbacks: function (onProgress, onMeshAlter) {
    if (onProgress !== null && onProgress !== undefined && onProgress instanceof Function) {
      this.callbacks.onProgress = onProgress;
    }
    if (onMeshAlter !== null && onMeshAlter !== undefined && onMeshAlter instanceof Function) {
      this.callbacks.onMeshAlter = onMeshAlter;
    }
  },
  buildMeshes: function (meshPayload) {
    let meshName = meshPayload.params.meshName;
    let buffers = meshPayload.buffers;
    let bufferGeometry = new THREE.BufferGeometry();
    if (buffers.vertices !== undefined && buffers.vertices !== null) {
      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffers.vertices), 3));
    }
    if (buffers.indices !== undefined && buffers.indices !== null) {
      bufferGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffers.indices), 1));
    }
    if (buffers.colors !== undefined && buffers.colors !== null) {
      bufferGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(buffers.colors), 3));
    }
    if (buffers.normals !== undefined && buffers.normals !== null) {
      bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(buffers.normals), 3));
    } else {
      bufferGeometry.computeVertexNormals();
    }
    if (buffers.uvs !== undefined && buffers.uvs !== null) {
      bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buffers.uvs), 2));
    }
    if (buffers.skinIndex !== undefined && buffers.skinIndex !== null) {
      bufferGeometry.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(buffers.skinIndex), 4));
    }
    if (buffers.skinWeight !== undefined && buffers.skinWeight !== null) {
      bufferGeometry.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(buffers.skinWeight), 4));
    }
    let material, materialName, key;
    let materialNames = meshPayload.materials.materialNames;
    let createMultiMaterial = meshPayload.materials.multiMaterial;
    let multiMaterials = [];
    for (key in materialNames) {
      materialName = materialNames[key];
      material = this.materialHandler.getMaterial(materialName);
      if (createMultiMaterial) multiMaterials.push(material);
    }
    if (createMultiMaterial) {
      material = multiMaterials;
      let materialGroups = meshPayload.materials.materialGroups;
      let materialGroup;
      for (key in materialGroups) {
        materialGroup = materialGroups[key];
        bufferGeometry.addGroup(materialGroup.start, materialGroup.count, materialGroup.index);
      }
    }
    let meshes = [];
    let mesh;
    let callbackOnMeshAlterResult;
    let useOrgMesh = true;
    let geometryType = meshPayload.geometryType === null ? 0 : meshPayload.geometryType;
    if (this.callbacks.onMeshAlter) {
      callbackOnMeshAlterResult = this.callbacks.onMeshAlter(
        {
          detail: {
            meshName: meshName,
            bufferGeometry: bufferGeometry,
            material: material,
            geometryType: geometryType
          }
        }
      );
    }
    if (callbackOnMeshAlterResult) {
      if (callbackOnMeshAlterResult.isDisregardMesh()) {
        useOrgMesh = false;
      } else if (callbackOnMeshAlterResult.providesAlteredMeshes()) {
        for (let i in callbackOnMeshAlterResult.meshes) {
          meshes.push(callbackOnMeshAlterResult.meshes[i]);
        }
        useOrgMesh = false;
      }
    }
    if (useOrgMesh) {
      if (meshPayload.computeBoundingSphere) bufferGeometry.computeBoundingSphere();
      if (geometryType === 0) {
        mesh = new THREE.Mesh(bufferGeometry, material);
      } else if (geometryType === 1) {
        mesh = new THREE.LineSegments(bufferGeometry, material);
      } else {
        mesh = new THREE.Points(bufferGeometry, material);
      }
      mesh.name = meshName;
      meshes.push(mesh);
    }
    let progressMessage = meshPayload.params.meshName;
    if (meshes.length > 0) {
      let meshNames = [];
      for (let i in meshes) {
        mesh = meshes[i];
        meshNames[i] = mesh.name;
      }
      progressMessage += ': Adding mesh(es) (' + meshNames.length + ': ' + meshNames + ') from input mesh: ' + meshName;
      progressMessage += ' (' + (meshPayload.progress.numericalValue * 100).toFixed(2) + '%)';
    } else {
      progressMessage += ': Not adding mesh: ' + meshName;
      progressMessage += ' (' + (meshPayload.progress.numericalValue * 100).toFixed(2) + '%)';
    }
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress('progress', progressMessage, meshPayload.progress.numericalValue);
    }
    return meshes;
  }
};

THREE.LoadedMeshUserOverride = function (disregardMesh, alteredMesh) {
  this.disregardMesh = disregardMesh === true;
  this.alteredMesh = alteredMesh === true;
  this.meshes = [];

};

THREE.LoadedMeshUserOverride.prototype = {
  constructor: THREE.LoadedMeshUserOverride,
  addMesh: function (mesh) {
    this.meshes.push(mesh);
    this.alteredMesh = true;
  },
  isDisregardMesh: function () {
    return this.disregardMesh;
  },
  providesAlteredMeshes: function () {
    return this.alteredMesh;
  }
};

THREE.OBJLoader2 = function (manager) {
  THREE.Loader.call(this, manager);
  this.parser = new THREE.OBJLoader2Parser();
  this.modelName = '';
  this.instanceNo = 0;
  this.baseObject3d = new THREE.Object3D();
  this.materialHandler = new THREE.MaterialHandler();
  this.meshReceiver = new THREE.MeshReceiver(this.materialHandler);
  let scope = this;
  let defaultOnAssetAvailable = function (payload) {
    scope._onAssetAvailable(payload);
  };
  this.parser.setCallbackOnAssetAvailable(defaultOnAssetAvailable);
};

THREE.OBJLoader2.OBJLOADER2_VERSION = '3.2.0';
console.info('Using OBJLoader2 version: ' + THREE.OBJLoader2.OBJLOADER2_VERSION);

THREE.OBJLoader2.prototype = Object.assign(Object.create(THREE.Loader.prototype), {
  constructor: THREE.OBJLoader2,
  setLogging: function (enabled, debug) {
    this.parser.setLogging(enabled, debug);
    return this;
  },
  setMaterialPerSmoothingGroup: function (materialPerSmoothingGroup) {
    this.parser.setMaterialPerSmoothingGroup(materialPerSmoothingGroup);
    return this;
  },
  setUseOAsMesh: function (useOAsMesh) {
    this.parser.setUseOAsMesh(useOAsMesh);
    return this;
  },
  setUseIndices: function (useIndices) {
    this.parser.setUseIndices(useIndices);
    return this;
  },
  setDisregardNormals: function (disregardNormals) {
    this.parser.setDisregardNormals(disregardNormals);
    return this;
  },
  setModelName: function (modelName) {
    this.modelName = modelName ? modelName : this.modelName;
    return this;
  },
  setBaseObject3d: function (baseObject3d) {
    this.baseObject3d = (baseObject3d === undefined || baseObject3d === null) ? this.baseObject3d : baseObject3d;
    return this;
  },
  addMaterials: function (materials, overrideExisting) {
    this.materialHandler.addMaterials(materials, overrideExisting);
    return this;
  },
  setCallbackOnAssetAvailable: function (onAssetAvailable) {
    this.parser.setCallbackOnAssetAvailable(onAssetAvailable);
    return this;
  },
  setCallbackOnProgress: function (onProgress) {
    this.parser.setCallbackOnProgress(onProgress);
    return this;
  },
  setCallbackOnError: function (onError) {
    this.parser.setCallbackOnError(onError);
    return this;
  },
  setCallbackOnLoad: function (onLoad) {
    this.parser.setCallbackOnLoad(onLoad);
    return this;
  },
  setCallbackOnMeshAlter: function (onMeshAlter) {
    this.meshReceiver._setCallbacks(this.parser.callbacks.onProgress, onMeshAlter);
    return this;
  },
  setCallbackOnLoadMaterials: function (onLoadMaterials) {
    this.materialHandler._setCallbacks(onLoadMaterials);
    return this;
  },
  load: function (url, onLoad, onFileLoadProgress, onError, onMeshAlter) {
    let scope = this;
    if (onLoad === null || onLoad === undefined || !(onLoad instanceof Function)) {
      let errorMessage = 'onLoad is not a function! Aborting...';
      scope.parser.callbacks.onError(errorMessage);
      throw errorMessage;
    } else {
      this.parser.setCallbackOnLoad(onLoad);
    }
    if (onError === null || onError === undefined || !(onError instanceof Function)) {
      onError = function (event) {
        let errorMessage = event;
        if (event.currentTarget && event.currentTarget.statusText !== null) {
          errorMessage = 'Error occurred while downloading!\nurl: ' + event.currentTarget.responseURL + '\nstatus: ' + event.currentTarget.statusText;
        }
        scope.parser.callbacks.onError(errorMessage);
      };
    }
    if (!url) {
      onError('An invalid url was provided. Unable to continue!');
    }
    let urlFull = new URL(url, window.location.href).href;
    let filename = urlFull;
    let urlParts = urlFull.split('/');
    if (urlParts.length > 2) {
      filename = urlParts[urlParts.length - 1];
      this.path = urlParts.slice(0, urlParts.length - 1).join('/') + '/';
    }
    if (onFileLoadProgress === null || onFileLoadProgress === undefined || !(onFileLoadProgress instanceof Function)) {
      let numericalValueRef = 0;
      let numericalValue = 0;
      onFileLoadProgress = function (event) {
        if (!event.lengthComputable) return;
        numericalValue = event.loaded / event.total;
        if (numericalValue > numericalValueRef) {
          numericalValueRef = numericalValue;
          let output = 'Download of "' + url + '": ' + (numericalValue * 100).toFixed(2) + '%';
          scope.parser.callbacks.onProgress('progressLoad', output, numericalValue);
        }
      };
    }
    this.setCallbackOnMeshAlter(onMeshAlter);
    let fileLoaderOnLoad = function (content) {
      scope.parser.callbacks.onLoad(scope.parse(content), 'OBJLoader2#load: Parsing completed');
    };
    let fileLoader = new THREE.FileLoader(this.manager);
    fileLoader.setPath(this.path || this.resourcePath);
    fileLoader.setResponseType('arraybuffer');
    fileLoader.load(filename, fileLoaderOnLoad, onFileLoadProgress, onError);
  },
  parse: function (content) {
    if (content === null || content === undefined) {
      throw 'Provided content is not a valid ArrayBuffer or String. Unable to continue parsing';
    }
    if (this.parser.logging.enabled) {
      console.time('OBJLoader parse: ' + this.modelName);
    }
    this.materialHandler.createDefaultMaterials(false);
    this.parser.setMaterials(this.materialHandler.getMaterials());
    if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
      if (this.parser.logging.enabled) console.info('Parsing arrayBuffer...');
      this.parser.execute(content);
    } else if (typeof (content) === 'string' || content instanceof String) {
      if (this.parser.logging.enabled) console.info('Parsing text...');
      this.parser.executeLegacy(content);
    } else {
      this.parser.callbacks.onError('Provided content was neither of type String nor Uint8Array! Aborting...');
    }
    if (this.parser.logging.enabled) {
      console.timeEnd('OBJLoader parse: ' + this.modelName);
    }
    return this.baseObject3d;
  },
  _onAssetAvailable: function (payload) {
    if (payload.cmd !== 'assetAvailable') return;
    if (payload.type === 'mesh') {
      let meshes = this.meshReceiver.buildMeshes(payload);
      for (let mesh of meshes) {
        this.baseObject3d.add(mesh);
      }
    } else if (payload.type === 'material') {
      this.materialHandler.addPayloadMaterials(payload);
    }
  }
});
