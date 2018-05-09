

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
DAMAGES (INCLUDING, BUT NOT LIMITED T, PROCUREMENT OF SUBSTITUTE GOODS OR
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
    var counter = 0;
    var currentMutationContext = null;
    var mutations = new Map();


    window.addEventListener("load", function(){

        buildCacheObject(customLocalStorage);
        localStorage.setItem("executionCount",1);
        observer.disconnect();
    });

    var targetNode = document;
    var config = {attributes: true, childList: true, characterData: true, subtree: true, attributeOldValue: true, characterDataOldValue: true};
    var callback = function(mutationsList) {
        if (currentMutationContext) {
            if (!mutations.get(currentMutationContext))
                mutations.set(currentMutationContext, []);
            var lMutations = mutations.get(currentMutationContext);
            lMutations.push.apply(lMutations, mutationsList);

            currentMutationContext = null;
        }
    };

    var observer = new MutationObserver(callback);
    observer.observe(document, config);


    this.getMutations = function() {
        return mutations;
    }
    
    this.setMutationContext = function(command, nodeId) {
        currentMutationContext = nodeId;
    }

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

    this.setCustomCache = function(customCache) {
        this.customLocalStorage = customCache;
    }

    var buildCacheObject = function(obj){
        var acyclicObj = {};
        Object.keys(obj).forEach(function(nodeId){
            acyclicObj[nodeId] = {};
            Object.keys(obj[nodeId]).forEach(function(md){
                try {
                    acyclicObj[nodeId][md] = stringify(obj[nodeId][md]);
                } catch (err) {

                }

            });

            // Stringify the dom mutations 
            var muts = mutations.get(nodeId);
            try { 
                localStorage.setItem(nodeId, JSON.stringify(acyclicObj[nodeId]));
            } catch (err) {
                // TODO wrong practice empty catch block
            }
        });

        return acyclicObj;
    }

    var extractCacheObject = function(){
        var cacheObject = {};

        Object.keys(localStorage).forEach(function(nodeId){ 
            try {
                var value = JSON.parse(localStorage.getItem(nodeId));
                cacheObject[nodeId] = {};
                Object.keys(value).forEach(function(md){
                    try {
                     cacheObject[nodeId][md] = parse(value[md]);
                    } catch (err) {}
                });
            } catch (err) {}
        });

        return cacheObject;
    }

    var isCyclic = function (obj) {
      var keys = [];
      var stack = [];
      var stackSet = new Set();
      var detected = false;

      function detect(obj, key) {
        if (typeof obj != 'object') { return; }

        if (stackSet.has(obj)) { // it's cyclic! Print the object and its locations.
          var oldindex = stack.indexOf(obj);
          var l1 = keys.join('.') + '.' + key;
          var l2 = keys.slice(0, oldindex + 1).join('.');
          // console.log('CIRCULAR: ' + l1 + ' = ' + l2 + ' = ' + obj);
          // console.log(obj);
          detected = true;
          return;
        }

        keys.push(key);
        stack.push(obj);
        stackSet.add(obj);
        for (var k in obj) { //dive on the object's children
          if (obj.hasOwnProperty(k)) { detect(obj[k], k); }
        }

        keys.pop();
        stack.pop();
        stackSet.delete(obj);
        return;
      }

      detect(obj, 'obj');
      return detected;
    }


    this.logWrite = function(functionIdentifier, rhs, variableName ){
        if (variableName)
            customLocalStorage[functionIdentifier]["writes"][variableName] = rhs;
        else { console.log(" write without a variable name");}
        return rhs;
    }

    this.logRead = function(functionIdentifier, readArray){
        customLocalStorage[functionIdentifier]["reads"][readArray[0]] = readArray[1];
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
            customLocalStorage[nodeId]["writes"]["calls"] = [];
            customLocalStorage[nodeId]["reads"] = {};
            if (params.length != 0) {
                customLocalStorage[nodeId]["arguments"] = {};
                customLocalStorage[nodeId]["arguments"]["before"] = params;
            }
        } else {
            // return false;
            console.log("Cache hit for function " + nodeId);
            var returnValue = customLocalStorage[nodeId]["returnValue"] ? customLocalStorage[nodeId]["returnValue"] : true;
            if (params && customLocalStorage[nodeId]["arguments"]){
                Object.keys(params).forEach(function(ind){
                    params[ind] = customLocalStorage[nodeId]["arguments"]["after"][ind];
                });
            }

            Object.keys(customLocalStorage[nodeId]["writes"]).forEach(function(write){
                var evalString = write + " = " + stringify(customLocalStorage[nodeId][write])
                eval(evalString);
            });

            return returnValue;
        }
        // if (globalReads.length) {
        //     globalReads.forEach(function(read, it){
        //         if (it%2==0)
        //             customLocalStorage[nodeId]["reads"][read] = globalReads[it+1]; 
        //     });           
        // }
        return false;
    }

    this.dumpArguments = function(nodeId, params) {
        if (customLocalStorage[nodeId]["arguments"])
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

    // var buildCacheObject = function(nodeId, globalWrites, returnValue) {
    //     // console.log(local"building cache for " + info.nodeId)
    //     try {
    //         // console.log("the return value is: " + returnValue);
    //         var serializedObject = {};
    //         if (returnValue)  {
    //             serializedObject["returnValue"] = returnValue;
    //         }
    //         if (globalWrites.length) {
    //             globalWrites.forEach(function(write, it){
    //                 if (it%2==0 && !isNative(globalWrites[it+1]))
    //                     serializedObject[write] = globalWrites[it+1]; 
    //                 // console.log(info.nodeId + "the cache object looks like: " + JSON.stringify(serializedObject));
    //             });
    //         }
    //         // console.log("Cache looks like "  + JSON.stringify(serializedObject));
    //         return serializedObject;
    //     } catch (e) {
    //         // console.log("[WARNING] Building cache object "  + e + e.stack);
    //         return {};
    //     }
    // }

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

    var stringify = function (obj) {

        return JSON.stringify(obj, function (key, value) {
            var DUMMYOBJ = {}
          // if (value == document || value == window ) 
          //   return DUMMYOBJ;
          // if (value && value.self == value)
          //   return DUMMYOBJ;

          var fnBody;
          if (value instanceof Function || typeof value == 'function') {

            if ((/\{\s*\[native code\]\s*\}/).test(value.toString())) {
                nativeObjectsStore[key] = value;
                return {};
            }
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

    var parse = function (str, date2obj) {

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
            // if ((/\{\s*\[native code\]\s*\}/).test(value))
            //     return nativeObjectsStore[key]
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

    var isReplay = localStorage.getItem("executionCount");
    if (isReplay){
        customLocalStorage = extractCacheObject();
        console.log("Restored custom local storage");
    }

    toJSON = function(node) {
        node = node || this;
        var obj = {
        nodeType: node.nodeType
        };
        if (node.tagName) {
        obj.tagName = node.tagName.toLowerCase();
        } else
        if (node.nodeName) {
        obj.nodeName = node.nodeName;
        }
        if (node.nodeValue) {
        obj.nodeValue = node.nodeValue;
        }
        var attrs = node.attributes;
        if (attrs) {
        var length = attrs.length;
        var arr = obj.attributes = new Array(length);
        for (var i = 0; i < length; i++) {
          attr = attrs[i];
          arr[i] = [attr.nodeName, attr.nodeValue];
        }
        }
        var childNodes = node.childNodes;
        if (childNodes) {
        length = childNodes.length;
        arr = obj.childNodes = new Array(length);
        for (i = 0; i < length; i++) {
          arr[i] = toJSON(childNodes[i]);
        }
        }
        return obj;
    }

    toDOM = function(obj) {
        if (typeof obj == 'string') {
        obj = JSON.parse(obj);
        }
        var node, nodeType = obj.nodeType;
        switch (nodeType) {
        case 1: //ELEMENT_NODE
          node = document.createElement(obj.tagName);
          var attributes = obj.attributes || [];
          for (var i = 0, len = attributes.length; i < len; i++) {
            var attr = attributes[i];
            node.setAttribute(attr[0], attr[1]);
          }
          break;
        case 3: //TEXT_NODE
          node = document.createTextNode(obj.nodeValue);
          break;
        case 8: //COMMENT_NODE
          node = document.createComment(obj.nodeValue);
          break;
        case 9: //DOCUMENT_NODE
          node = document.implementation.createDocument();
          break;
        case 10: //DOCUMENT_TYPE_NODE
          node = document.implementation.createDocumentType(obj.nodeName);
          break;
        case 11: //DOCUMENT_FRAGMENT_NODE
          node = document.createDocumentFragment();
          break;
        default:
          return node;
        }
        if (nodeType == 1 || nodeType == 11) {
        var childNodes = obj.childNodes || [];
        for (i = 0, len = childNodes.length; i < len; i++) {
          node.appendChild(toDOM(childNodes[i]));
        }
        }
        return node;
    }

    if (typeof JSON.decycle !== "function") {
        JSON.decycle = function decycle(object, replacer) {
            "use strict";


            var objects = new WeakMap();     // object to path mappings

            return (function derez(value, path) {


                var old_path;   // The path of an earlier occurance of value
                var nu;         // The new object or array

    // If a replacer function was provided, then call it to get a replacement value.

                if (replacer !== undefined) {
                    value = replacer(value);
                }

                if (
                    typeof value === "object" && value !== null &&
                    !(value instanceof Boolean) &&
                    !(value instanceof Date) &&
                    !(value instanceof Number) &&
                    !(value instanceof RegExp) &&
                    !(value instanceof String)
                ) {

    // If the value is an object or array, look to see if we have already
    // encountered it. If so, return a {"$ref":PATH} object. This uses an
    // ES6 WeakMap.

                    old_path = objects.get(value);
                    if (old_path !== undefined) {
                        return {$ref: old_path};
                    }

    // Otherwise, accumulate the unique value and its path.

                    objects.set(value, path);

    // If it is an array, replicate the array.

                    if (Array.isArray(value)) {
                        nu = [];
                        value.forEach(function (element, i) {
                            nu[i] = derez(element, path + "[" + i + "]");
                        });
                    } else {

    // If it is an object, replicate the object.

                        nu = {};
                        Object.keys(value).forEach(function (name) {
                            nu[name] = derez(
                                value[name],
                                path + "[" + JSON.stringify(name) + "]"
                            );
                        });
                    }
                    return nu;
                }
                return value;
            }(object, "$"));
        };
    }


    if (typeof JSON.retrocycle !== "function") {
        JSON.retrocycle = function retrocycle($) {
            "use strict";

            var px = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\([\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;

            (function rez(value) {


                if (value && typeof value === "object") {
                    if (Array.isArray(value)) {
                        value.forEach(function (element, i) {
                            if (typeof element === "object" && element !== null) {
                                var path = element.$ref;
                                if (typeof path === "string" && px.test(path)) {
                                    value[i] = eval(path);
                                } else {
                                    rez(element);
                                }
                            }
                        });
                    } else {
                        Object.keys(value).forEach(function (name) {
                            var item = value[name];
                            if (typeof item === "object" && item !== null) {
                                var path = item.$ref;
                                if (typeof path === "string" && px.test(path)) {
                                    value[name] = eval(path);
                                } else {
                                    rez(item);
                                }
                            }
                        });
                    }
                }
            }($));
            return $;
        };
    }
});
}
(function () { {name}.setGlobal(this); })();
