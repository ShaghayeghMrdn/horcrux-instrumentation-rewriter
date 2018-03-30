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
    if (!e2eTesting) {
        window.addEventListener("load" ,function() {
            var MAXRESULT = 1000000;

            var tracer = {name};

            functions = {};
            var uniqueFunctions = [];
            var callsites = {}
            var ids = [];
            var ids_callsites = [];
            var nodesHandle = tracer.trackNodes();
            tracer.newNodes(nodesHandle).forEach(function (n) {
                if (n.type === 'function') {
                    functions[n.id] = n;
                    ids.push(n.id);
                } else if (n.type == 'callsite'){
                    callsites[n.id] = n;
                    ids_callsites.push(n.id);   
                }
            });

            var logHandle = tracer.trackLogs({ids: ids});
            invocations = tracer.logDelta(logHandle, MAXRESULT);

            console.log("Number of functions: " + Object.keys(functions).length);
            console.log("Number of invocations: " + invocations.length);

            var modifiedFunctionCounter = 0
            var uniqueFunctions = [];
            window.importantIDToInvocations = {};
            invocations.forEach(function(entry){

                if (entry.globalDelta != undefined && Object.keys(entry.globalDelta["After"]).length > 0){
                    importantIDToInvocations[entry.id] = entry;
                }
            });
            console.log("Total number of important invocations executed " + Object.keys(importantIDToInvocations).length);
        });
    }

	this.setGlobal = function (gthis) {
		globalThis = gthis;
	}

    var deepDiffMapper = function() {
        return {
            VALUE_CREATED: 'created',
            VALUE_UPDATED: 'updated',
            VALUE_DELETED: 'deleted',
            VALUE_UNCHANGED: 'unchanged',
            map: function(obj1, obj2) {
                if (this.isFunction(obj1) || this.isFunction(obj2)) {
                    throw 'Invalid argument. Function given, object expected.';
                }
                if (this.isValue(obj1) || this.isValue(obj2)) {
                    return {
                        type: this.compareValues(obj1, obj2),
                        data: (obj1 === undefined) ? obj2 : obj1
                    };
                }
                
                var diff = {};
                for (var key in obj1) {
                    if (this.isFunction(obj1[key])) {
                        continue;
                    }
                    
                    var value2 = undefined;
                    if ('undefined' != typeof(obj2[key])) {
                        value2 = obj2[key];
                    }
                    
                    diff[key] = this.map(obj1[key], value2);
                }
                for (var key in obj2) {
                    if (this.isFunction(obj2[key]) || ('undefined' != typeof(diff[key]))) {
                        continue;
                    }
                    
                    diff[key] = this.map(undefined, obj2[key]);
                }
                
                return diff;
                
            },
            compareValues: function(value1, value2) {
                if (value1 === value2) {
                    return this.VALUE_UNCHANGED;
                }
                if (this.isDate(value1) && this.isDate(value2) && value1.getTime() === value2.getTime()) {
                        return this.VALUE_UNCHANGED;
                }
                if ('undefined' == typeof(value1)) {
                    return this.VALUE_CREATED;
                }
                if ('undefined' == typeof(value2)) {
                    return this.VALUE_DELETED;
                }
                
                return this.VALUE_UPDATED;
            },
            isFunction: function(obj) {
                return {}.toString.apply(obj) === '[object Function]';
            },
            isArray: function(obj) {
                return {}.toString.apply(obj) === '[object Array]';
            },
            isObject: function(obj) {
                return {}.toString.apply(obj) === '[object Object]';
            },
            isDate: function(obj) {
                return {}.toString.apply(obj) === '[object Date]';
            },
            isValue: function(obj) {
                return !this.isObject(obj) && !this.isArray(obj);
            }
        }
    }();


    function getTypesFromWindowObject(windowObject){
        var types = {}
        Object.getOwnPropertyNames(window).forEach(function(n){

            if (!types[typeof window[n]]){
                types[typeof window[n]] = []
            }
            var a={}
            a[n] = window[n] 
            if (typeof window[n] != 'function'){
                types[typeof window[n]].push(a)
            }
        });
        return types;
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

    this.loadFromCache = function(cacheObject) {

    }

    this.compareAndCache = function(nodeId, params, globalReads, info) {
        var cacheObjectReads = JSON.parse(localStorage.getItem(nodeId + "-reads"));
        if (cacheObjectReads){
            Object.keys(cacheObjectReads).forEach(function(read){
                if (!(JSON.stringify(eval(read)) == JSON.stringify(cacheObjectReads[read])))
                    console.log("cache exists but didn't match")
                    return false;
            });             

            var cacheObjectWrites = JSON.parse(localStorage.getItem(nodeId + "-writes"));
            console.log("Cache hit for function: " + nodeId);
            if (cacheObjectWrites) {
                Object.keys(cacheObjectWrites).forEach(function(write){
                    var evalString = write + "= " + JSON.stringify(cacheObjectWrites[write]);
                    // console.log("going to evaluate " + evalString);
                    eval(evalString);
                });
            }
            return true;
        }

        // If cache doesn't exist, then update cache, however if it does, no version control:
        console.log("Cache doesn't yet exist for : " + nodeId);
        var serializedObject = {};
        if (globalReads.length) {
            globalReads.forEach(function(read, it){
                if (it%2==0)
                    serializedObject[read] = globalReads[it+1]; 
            });
        }

        // Dump the arguments as well:
        if (Object.keys(params).length){
            Object.keys(params).forEach(function(key){
                serializedObject[key] = params[key];
            });
        }

        localStorage.setItem(nodeId + "-reads", JSON.stringify(serializedObject));
        return false;
    }

    var buildCacheObject = function(nodeId, globalWrites) {
        // console.log(local"building cache for " + info.nodeId)
        try {
            var serializedObject = {};

            if (globalWrites.length) {
                globalWrites.forEach(function(write, it){
                    if (it%2==0)
                        serializedObject[write] = globalWrites[it+1]; 
                    // console.log(info.nodeId + "the cache object looks like: " + JSON.stringify(serializedObject));
                });
            }
            // console.log("Cache looks like "  + JSON.stringify(serializedObject));
            return serializedObject;
        } catch (e) {
            console.log("[WARNING] Building cache object "  + e + e.stack);
            return {};
        }
    }

    this.dumpCache = function(nodeId, globalWrites) {
        // return;

        var cacheValue = JSON.stringify(buildCacheObject(nodeId, globalWrites));
        console.log("Dupming cache for " + nodeId + " with value " + cacheValue);
        localStorage.setItem(nodeId + "-writes", cacheValue);
    }

    var escapeRegExp = function(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|\']/g, "\\$&");
    }

    this.setValue = function (val,variableName, variable, reads=[]) {
        // console.log(arguments[0].toString(), arguments);
        try {
            var top = invocationStack[invocationStack.length - 1];
            if (!top) {
                // console.log("Error while tracking the global write | Probably it is outside any function");
            } else {
                if (typeof(variable) != undefined) {
                    // console.log("Top is: " + JSON.stringify(top.globalDelta));
                    // console.log("variable is " + variable );
                    top.globalDelta["Before"][variableName] = variable;
                    top.globalDelta["After"][variableName] = val;

                    // top.globalDelta["Reads"] = top.globalDelta["Reads"].concat(readArray);
                    reads.forEach(function(read, it){
                        if (it % 2 == 0){
                            top.globalDelta["Reads"][reads[it+1]] = read;
                        }
                    });
                }
            }
            // console.log("Returning : " + val);
            return val;
        } catch (err) {
            console.log("[INFO][SET VALUE]: " + err + err.stack);
            return val;
        } 
    }

	this.Array = Array;
});
}
(function () { {name}.setGlobal(this); })();
