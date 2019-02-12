

/*
This file contains code snippet which would be executed using the runtime
interface
It will also contain the corresponding handler

*/

var fs = require('fs');


var getCustomStat = async function(fetchCommand, Runtime, outputFile){
    var _result = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var result = _result.result;

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log("Done fetching cache statistics");

}
var getCacheStats = async function(Runtime, outDir){
    var fetchCommand = '__tracer.getCacheStats()';
    var _cacheStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheStats = _cacheStats.result;

    fs.writeFileSync(outDir +"/cacheStats", JSON.stringify(cacheStats, null, 2));
    console.log("Done fetching cache statistics");
}

var getNonCacheable = async function(Runtime, outDir){
    var fetchCommand = '__tracer.getNonCacheableFunctions()';
    var _cacheStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheStats = _cacheStats.result;

    fs.writeFileSync(outDir +"/noncache", JSON.stringify(cacheStats, null, 2));
    console.log("Done fetching non-cache statistics");
}

var getFunctionStats = async function(Runtime, outDir) {
    var stats = {};
    var fetchCommand = '__tracer.getFunctionStats()';
    var _fnStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    stats['fnStats'] = _fnStats.result;

    const reducer = (accumulator, currentValue) => accumulator + currentValue;
    fetchCommand = `Object.values(__tracer.getInvocations()).reduce(${reducer})`
    var _invocations = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    stats['invocations'] = _invocations.result;

    fs.writeFileSync(outDir +"/fnStats", JSON.stringify(stats, null, 2));
    console.log("Done fetching function statistics");    
    // fetchCommand = '__tracer.geInvocations()';
    // var _fnStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});

}

var roughSizeOfObject = function( object ) {

    var objectList = [];
    var stack = [ object ];
    var bytes = 0;

    while ( stack.length ) {
        var value = stack.pop();

        if ( typeof value === 'boolean' ) {
            bytes += 4;
        }
        else if ( typeof value === 'string' ) {
            bytes += value.length * 2;
        }
        else if ( typeof value === 'number' ) {
            bytes += 8;
        }
        else if
        (
            typeof value === 'object'
            && objectList.indexOf( value ) === -1
        )
        {
            objectList.push( value );

            for( var i in value ) {
                stack.push( value[ i ] );
            }
        }
    }
    return bytes;
}
var getCacheSize = async function(Runtime, outDir) {
    var fetchCommand = `
        var roughSizeOfObject = ${roughSizeOfObject};
        roughSizeOfObject(__tracer.getCustomCache());
    `
    var _cacheSize = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheSize = _cacheSize.result ? _cacheSize.result.value : 0;
    fs.writeFileSync(outDir + "/cacheSize", JSON.stringify(cacheSize));
    console.log("Done fetching the cache size");

}


module.exports = {
    getCacheStats : getCacheStats,
    getCacheSize : getCacheSize,
    getFunctionStats: getFunctionStats,
    getCustomStat: getCustomStat
}