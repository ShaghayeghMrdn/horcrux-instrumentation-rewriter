
var PATH_TO_OUTPUT = __dirname + "/output/"
var fs = require('fs');
var properties = require ("properties");
var signatures = {};
const PATH_TO_SIGNATURE = __dirname + "/signatures.ini";
properties.parse(PATH_TO_SIGNATURE, {path: true, sections: true, namespaces: true}, function(err, obj){ signatures = obj ;})

var loadSignature = function(testName) {
    var path = PATH_TO_OUTPUT + "/" + testName + "/Signature";
    var signatureObj = JSON.parse(fs.readFileSync(path, "utf-8"));
    return signatureObj;
}

var compareSignature =  function(testName) {

    return new Promise( (resolve, reject) => { 
        setTimeout(()=>{
            var computedSig = loadSignature(testName);
            var expectedSig = JSON.parse(signatures[testName].signature);
            resolve(JSON.stringify(computedSig) == JSON.stringify(expectedSig));
        },2000);
    });
} 

module.exports = {
    compareSignature: compareSignature
}