/*
The following code was inserted automatically by fondue to collect information
about the execution of all the JavaScript on this page or in this program.

If you're using Brackets, this is caused by the Theseus extension, which you
can disable by unchecking File > Enable Theseus.

https://github.com/adobe-research/fondue
https://github.com/adobe-research/theseus
*/

/*
 * Copyright (c) 2012 Massachusetts Institute of Technology, Adobe Systems
 * Incorporated, and other contributors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*
The source of source-map is included below on the line beginning with "var sourceMap",
and its license is as follows:

Copyright (c) 2009-2011, Mozilla Foundation and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

if (typeof {name} === 'undefined') {
{name} = new (function () {
    var e2eTesting = true;
    var functions = new Set();
    var invocations = {};
    var cacheStats = {};
    var nativeObjectsStore = {};
    var customLocalStorage = {}; // Use this in place of the localstorage API for faster access. 
    cacheStats.cacheHit = {};

    // window.addEventListener("load", function(){
    //     // Add the custom local storage object to the indexed db


    // });

	this.setGlobal = function (gthis) {
		globalThis = gthis;
	}

    this.getFunctions = function () {
        return functions;
    }

    this.getInvocations = function() {
        return invocations;
    }

    this.getCacheStats = function () {
        return cacheStats;
    }

    this.getCustomCache = function() {
        return customLocalStorage;
    }

    var isCyclic = function (obj) {
      var seenObjects = [];

      function detect (obj) {
        if (obj && typeof obj === 'object') {
          if (seenObjects.indexOf(obj) !== -1) {
            return true;
          }
          seenObjects.push(obj);
          for (var key in obj) {
            if (obj.hasOwnProperty(key) && detect(obj[key])) {
              console.log(obj, 'cycle at ' + key + "seenObjects: " + JSON.stringify(seenObjects));
              return true;
            }
          }
        }
        return false;
      }

      return detect(obj);
    }

    this.logWrite = function(functionIdentifier, rhs, variableName ){
        customLocalStorage[functionIdentifier]["writes"][variableName] = rhs;
        return rhs;
    }

    this.logRead = function(functionIdentifier, readArray){
        customLocalStorage[functionIdentifier]["read"][readArray[0]] = readArray[1];
        return readArray[2];
    }

    this.logReturnValue = function(functionIdentifier, returnValue) {
        customLocalStorage[functionIdentifier]["returnValue"] = returnValue;
        return returnValue;
    }


    this.cacheAndReplay = function(nodeId, params, globalReads, info){
        if (!customLocalStorage[nodeId]) {
            customLocalStorage[nodeId] = {};
            customLocalStorage[nodeId]["writes"] = {};
            customLocalStorage[nodeId]["reads"] = {};
            customLocalStorage[nodeId]["arguments"] = {};
            customLocalStorage[nodeId]["arguments"]["before"] = params;
        }
        if (globalReads.length) {
            globalReads.forEach(function(read, it){
                if (it%2==0)
                    customLocalStorage[nodeId]["reads"][read] = globalReads[it+1]; 
            });           
        }
    }

    this.dumpArguments = function(nodeId, params) {
        if (Object.keys(params).length != 0)
            customLocalStorage[nodeId]["arguments"]["after"] = params;
    }

    this.compareAndCache = function(nodeId, params, globalReads, info) {
        customLocalStorage[nodeId] = {};
        customLocalStorage[nodeId]["writes"] = {};
        return false;
        try {
            if (!(nodeId in invocations))
                invocations[nodeId] = 0;
            invocations[nodeId]++;
            functions.add(nodeId);
            var cacheObjectReads = this.parse.call(this, localStorage.getItem(nodeId + "-reads") || null);
            var gthis = this;
            if (cacheObjectReads){
                Object.keys(cacheObjectReads).forEach(function(read){
                    if (read == "params") {
                        try {
                            if (!(gthis.stringify.call(gthis, params) == cacheObjectReads[read])) {
                                // console.log("arguments match failed for " + nodeId + " "  + JSON.stringify(params)  + cacheObjectReads[read] );
                                return false;
                            } 
                        } catch (e) {
                            // console.log("[WARNING] stringifying circular object: " + nodeId);
                            return false;
                        }
                    }
                    else if (!(gthis.stringify.call(gthis,eval(read)) == gthis.stringify.call(gthis,cacheObjectReads[read]))) {
                        // console.log("cache exists but didn't match for function: " + nodeId + " different read:" + JSON.stringify(arguments));
                        return false;
                    }

                }); 
                var cacheObjectWrites = this.parse.call(this,localStorage.getItem(nodeId + "-writes") || null);
                var returnValue = true;
                // console.log("Cache hit for function: " + nodeId);
                if (!(nodeId in cacheStats.cacheHit))
                    cacheStats.cacheHit[nodeId] = 0;

                cacheStats.cacheHit[nodeId]++;
                if (cacheObjectWrites) {
                    Object.keys(cacheObjectWrites).forEach(function(write){
                        if (!write.includes("returnValue")) eval(write + "= " + gthis.stringify.call(gthis,cacheObjectWrites[write]));
                        else returnValue = cacheObjectWrites[write];
                    });
                }
                return false;
            }

            // If cache doesn't exist, then update cache, however if it does, no version control:
            // console.log("Cache doesn't yet exist for : " + nodeId);
            var serializedObject = {};
            if (globalReads.length) {
                globalReads.forEach(function(read, it){
                    if (it%2==0 && !isNative(globalReads[it+1]))
                        serializedObject[read] = globalReads[it+1]; 
                });
            }

            serializedObject["params"] = this.stringify.call(this,params);
            // console.log("setting read cache value for " + nodeId + " " + this.stringify(serializedObject));
            localStorage.setItem(nodeId + "-reads", this.stringify.call(this,serializedObject));
            return false;
        } catch (e) { 
            // console.log("[WARNING][COMPARECACHE] warning raised while comparing the cache" + e + e.stack); 
            return false;
        }
    }

    var buildCacheObject = function(nodeId, globalWrites, returnValue) {
        // console.log(local"building cache for " + info.nodeId)
        try {
            // console.log("the return value is: " + returnValue);
            var serializedObject = {};
            if (returnValue)  {
                serializedObject["returnValue"] = returnValue;
            }
            if (globalWrites.length) {
                globalWrites.forEach(function(write, it){
                    if (it%2==0 && !isNative(globalWrites[it+1]))
                        serializedObject[write] = globalWrites[it+1]; 
                    // console.log(info.nodeId + "the cache object looks like: " + JSON.stringify(serializedObject));
                });
            }
            // console.log("Cache looks like "  + JSON.stringify(serializedObject));
            return serializedObject;
        } catch (e) {
            // console.log("[WARNING] Building cache object "  + e + e.stack);
            return {};
        }
    }

    this.dumpCache = function(nodeId, globalWrites, returnValue) {
        return;
        try {
            var _cacheValue = buildCacheObject(nodeId, globalWrites, returnValue);
            var cacheValue =  this.stringify.call(this, _cacheValue);
            // console.log("Dupming cache for " + nodeId + " with length " + cacheValue.length);
            localStorage.setItem(nodeId + "-writes", cacheValue);
        } catch (dumpErr) {
            // do nothing as of now. 
        }
    }

    var escapeRegExp = function(str) {
        return str.replace(/[\"]/g, "\\$&");
    }

    var isNative = function(fn) {
        return (/\{\s*\[native code\]\s*\}/).test('' + fn);
    }

    this.stringify = function (obj) {

        return JSON.stringify(obj, function (key, value) {
          var fnBody;
          if (value instanceof Function || typeof value == 'function') {

            if ((/\{\s*\[native code\]\s*\}/).test(value.toString()))
                nativeObjectsStore[key] = value;
            fnBody = value.toString();

            if (fnBody.length < 8 || fnBody.substring(0, 8) !== 'function') { //this is ES6 Arrow Function
              return '_NuFrRa_' + fnBody;
            }
            return fnBody;
          }
          if (value instanceof RegExp) {
            return '_PxEgEr_' + value;
          }
          return value;
        });
    };

    this.parse = function (str, date2obj) {

    var iso8061 = date2obj ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/ : false;

    return JSON.parse(str, function (key, value) {
        var prefix;

        if (typeof value != 'string') {
        return value;
        }
        if (value.length < 8) {
        return value;
        }

        prefix = value.substring(0, 8);

        if (iso8061 && value.match(iso8061)) {
            return new Date(value);
        }
        if (prefix === 'function') {
            if ((/\{\s*\[native code\]\s*\}/).test(value))
                return nativeObjectsStore[key]
            return eval('(' + value + ')');
        }
        if (prefix === '_PxEgEr_') {
            return eval(value.slice(8));
        }
        if (prefix === '_NuFrRa_') {
            return eval(value.slice(8));
        }

        return value;
        });
    };

	this.Array = Array;
});
}
(function () { {name}.setGlobal(this); })();
